// PT-17 fix sprint (SCH-028..037), the DOM parts: Start starts the clock on every timed mini-sim and run card, widgets behind Start,
// trap lines, try-it stars, the newcomer's second visit, no seconds on option verdicts, redirects. Unit parts: tests/sch-pt17.test.ts.
import { test, expect, type Page } from '@playwright/test';
import { COURSE } from '../content/course.js';
import type { MinisimPage } from '../content/course-types.js';
import { PHONES, state, step, type W as DW } from './mobile-helpers.js';

type School = { mini(): { kind: string | null; options: string[]; attempt: number; complete: boolean; elapsed: number; started: boolean; round: number; timing: { truthSeconds: number; secondTapSeconds?: number } | null }; oracle(): { optionId?: string; tapSeconds?: number; taps?: number[] } | null };
type W = { __rally: { school: School } };
const mini = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.mini());
const oracle = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.oracle());
const DECISION_KEY = 'rally-trainer.decision.v1';
/** Click `sel` once the card's own clock reads `t` (the oracle second: for a speed change, the bar's CALL tick). */
async function clickAt(page: Page, sel: string, t: number, clock: 'mini' | 'run'): Promise<void> {
  const box = (await page.locator(sel).boundingBox())!;
  if (clock === 'mini') await page.waitForFunction(x => (window as unknown as W).__rally.school.mini().elapsed >= x - 0.04, t, { polling: 'raf', timeout: 60_000 });
  else await page.waitForFunction(x => (window as unknown as DW).__rally.decision.elapsed() >= x - 0.04, t, { polling: 'raf', timeout: 60_000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const digits = (page: Page, scope: string) => page.locator(`${scope} [data-testid=watch-digits]`).first().evaluate(e => ({ text: e.textContent ?? '', hidden: (e as HTMLElement).hidden }));
const secondsOf = (t: string): number => { const m = /(\d+):(\d+\.\d+)/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

/** Every timed mini-sim page of the course (by its kind and form; the start-queue restart is an option card). */
const TIMED = COURSE.flatMap(m => m.pages.flatMap((p, i) => {
  if (p.kind !== 'minisim') return [];
  const s = p as MinisimPage;
  const timed = (['pause', 'speedChange', 'timedStart', 'restart'].includes(s.decisionKind) && s.form !== 'queue') || (s.decisionKind === 'watch' && s.form === 'lap');
  return timed ? [{ route: `${m.id}/${i + 1}`, kind: s.decisionKind }] : [];
}));

test.describe('PT-17 phone 390x844', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

  test('SCH-028 the course has timed mini-sims in Modules 2-6 and 10/12 (every one is played below)', () => {
    expect(TIMED.length).toBeGreaterThanOrEqual(12);
    for (const k of ['pause', 'speedChange', 'timedStart', 'restart', 'watch']) expect(TIMED.some(t => t.kind === k), k).toBe(true);
  });

  for (const { route, kind } of TIMED) {
    test(`SCH-028 #/school/${route} (${kind}): read 3 s under Start, tap Start, tap at the oracle second (the bar's CALL tick): Correct; the watch starts at 0`, async ({ page }) => {
      await page.goto(`/?mode=mobile#/school/${route}`);
      const start = page.locator('.s2-miniacts [data-action=start-card]');
      await expect(start).toBeVisible();
      await page.waitForTimeout(3000);   // reading the card
      expect((await mini(page)).elapsed).toBe(0);
      await start.click();
      const d = await digits(page, '.s2-miniacts');
      if (!d.hidden) expect(secondsOf(d.text), d.text).toBeLessThan(0.3);
      expect((await mini(page)).elapsed).toBeLessThan(0.5);
      const o = (await oracle(page))!;
      if (o.taps?.length) {
        await clickAt(page, '.s2-miniacts [data-action=startstop]', o.taps[0]!, 'mini');
        await clickAt(page, '.s2-miniacts [data-action=lap]', o.taps[1]!, 'mini');
      } else await clickAt(page, '.s2-miniacts [data-action=go]', o.tapSeconds!, 'mini');
      const v = page.locator('[data-testid=mini-verdict]');
      await expect(v).toBeVisible();
      await expect(v, await v.innerText()).toHaveAttribute('data-correct', 'true');
    });
  }

  for (const id of ['m4', 'm3']) {
    test(`SCH-028 a ${id} try-it run card: read 3 s under Start, tap Start, tap at the oracle second: Correct`, async ({ page }) => {
      await page.goto(`/?mode=mobile#/school/${id}/try`);
      const start = page.locator('.mob-actions [data-action=start-card]');
      await expect(start).toBeVisible();
      await page.waitForTimeout(3000);
      expect((await state(page)).elapsed).toBe(0);
      await start.click();
      const d = await digits(page, '.mob-actions');
      if (!d.hidden) expect(secondsOf(d.text), d.text).toBeLessThan(0.3);
      const o = (await page.evaluate(() => (window as unknown as DW).__rally.decision.oracle()))!;
      if (o.taps?.length) {
        await clickAt(page, '.mob-actions [data-action=startstop]', o.taps[0]!, 'run');
        await clickAt(page, '.mob-actions [data-action=lap]', o.taps[1]!, 'run');
      } else await clickAt(page, '.mob-actions [data-action=go]', o.tapSeconds!, 'run');
      await expect(page.locator('[data-testid=verdict]')).toHaveAttribute('data-correct', 'true');
    });
  }

  test('SCH-032 SCH-022 holdSpeed, whereCheckpoint and tapLap wait under Start with their goal shown; nothing moves before it', async ({ page }) => {
    for (const r of ['m0/2', 'm0/7']) {
      await page.goto(`/?mode=mobile#/school/${r}`);
      await expect(page.locator('.s2-goal')).toBeVisible(); await expect(page.locator('[data-action=start-widget]')).toBeVisible();
      await expect(page.locator('[data-testid=speed-slider]')).toBeHidden();
      await page.waitForTimeout(1200);
      await expect(page.locator('[data-testid=drift]')).toHaveText('on time');
      await page.locator('[data-action=start-widget]').click();
      await expect(page.locator('[data-testid=speed-slider]')).toBeVisible();
      await expect(page.locator('[data-testid=drift]')).toHaveText(/s late$/, { timeout: 4000 });
    }
    await page.goto('/?mode=mobile#/school/m0/4');
    await expect(page.locator('[data-action=leg-ended]')).toBeHidden();
    await page.waitForTimeout(1200); await expect(page.locator('[data-testid=leg-clock]')).toHaveText('0.0 s');
    await page.locator('[data-action=start-widget]').click();
    await expect(page.locator('[data-action=leg-ended]')).toBeVisible();
    await page.waitForTimeout(800); expect(parseFloat((await page.locator('[data-testid=leg-clock]').textContent()) ?? '0')).toBeGreaterThan(0.5);
    await page.goto('/?mode=mobile#/school/m3/4');
    await expect(page.locator('.s2-widget[data-widget=tapLap] [data-action=lap]')).toBeHidden();
    await page.waitForTimeout(1200); await expect(page.locator('.s2-widget [data-testid=watch-digits]')).toHaveText('0m00.0s');
    await page.locator('[data-action=start-widget]').click();
    await page.waitForTimeout(600); await expect(page.locator('.s2-widget [data-testid=watch-digits]')).not.toHaveText('0m00.0s');
  });

  test('SCH-029 SCH-034 Module 1: the posted-limit case\'s wrong answer names the trap and quotes Column C; option verdicts show no seconds', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m1/6');
    let o = (await oracle(page))!; await page.locator(`.s2-miniacts [data-option="${o.optionId}"]`).click();
    await page.locator('[data-action=next-case]').click();
    const prompt = await page.locator('.s2-minisim .mprompt').innerText(); const posted = /SPEED LIMIT (\d+)/.exec(prompt)![1]!;
    await page.locator(`.s2-miniacts [data-option="v${posted}"]`).click();
    const v = page.locator('[data-testid=mini-verdict]');
    await expect(v).toHaveAttribute('data-correct', 'false');
    await expect(v.locator('.mv-head')).toContainText('the posted limit is not your speed');
    await expect(page.locator('[data-testid=mini-rule]')).toHaveText(/^Trap: the posted limit\. This row's Column C says "\d+ MPH": call \d+/);
    await expect(page.locator('[data-testid=mini-rule]')).not.toContainText(`"${posted} MPH"`);
    await expect(v.locator('.mv-sec')).toHaveText('');
    await page.goto('/?mode=mobile#/school/m1/3');
    o = (await oracle(page))!; const wrong = (await mini(page)).options.find(x => x !== o.optionId)!;
    await page.locator(`.s2-miniacts [data-option="${wrong}"]`).click();
    await expect(page.locator('[data-testid=mini-verdict] .mv-sec')).toHaveText('');
  });

  test('SCH-031 a try-it with no correct answer gives 0 stars, says "0 of N correct" and offers Try again first', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?mode=mobile#/school/m0/try');
    for (let i = 0; i < 40; i++) { const r = await step(page, { wrong: true }); if (r === 'recap' || r === 'other') break; }
    await expect(page.locator('[data-testid=tryit-recap]')).toBeVisible();
    await expect(page.locator('.mob-stars')).toHaveAttribute('data-stars', '0');
    await expect(page.locator('.mob-stars')).toHaveText('☆☆☆');
    await expect(page.locator('[data-testid=recap-sum]')).toHaveText(/^0 of \d+ correct/);
    const primary = page.locator('.s2-navbtns .mob-btn.primary');   // the primary sits where Next usually is (the right)
    await expect(primary).toHaveCount(1); await expect(primary).toHaveText('Try again'); await expect(page.locator('.s2-navbtns .mob-btn').last()).toHaveText('Try again');
    await expect(page.locator('[data-action=next-module]')).not.toHaveClass(/primary/);
  });

  test('SCH-033 opening the bare page twice without finishing Module 0 lands on the School both times; after Module 0, Home', async ({ page }) => {
    await page.goto('/?mode=mobile');
    await expect(page).toHaveURL(/#\/school$/); await expect(page.locator('[data-testid=first-visit]')).toBeVisible();
    await page.goto('/?mode=mobile');
    await expect(page).toHaveURL(/#\/school$/); await expect(page.locator('[data-screen=school]')).toBeVisible();
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 1, runs: 0, course: { modulesDone: [], pages: { m0: 3 }, tryItStars: {} } })), DECISION_KEY);
    await page.goto('/?mode=mobile');
    await expect(page).toHaveURL(/#\/school$/); await expect(page.locator('[data-testid=first-visit]')).toHaveCount(0);
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ version: 1, runs: 0, course: { modulesDone: ['m0'], pages: { m0: 8 }, tryItStars: { m0: 1 } } })), DECISION_KEY);
    await page.goto('/?mode=mobile');
    await expect(page.locator('[data-screen=school]')).toHaveCount(0); expect(page.url()).not.toMatch(/#\/school/);
  });

  test('SCH-037 #/school/<lesson section> opens its module; an unknown id opens the module list', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/ice-calls'); await expect(page).toHaveURL(/#\/school\/m2/);
    await page.goto('/?mode=mobile#/school/nonsense'); await expect(page).toHaveURL(/#\/school\/modules$/);
    await expect(page.locator('[data-testid=module-list]')).toBeVisible();
  });
});
