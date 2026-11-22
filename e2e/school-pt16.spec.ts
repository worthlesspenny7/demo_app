// PT-16 fix sprint (SCH-011..020), the DOM parts: touch verdicts, pointer rings, try-it guided state, the stopwatch card, the checkpoint
// widget, LAP layout, verdict chips, Home, desk and landscape. Engine and content parts: tests/sch-pt16.test.ts.
import { test, expect, type Page } from '@playwright/test';
import { PHONES } from './mobile-helpers.js';

type School = { state(): { module: string; page: number; kind: string; complete: boolean }; course(): { id: string; pages: number; kinds: string[] }[]; mini(): { kind: string | null; options: string[]; attempt: number; complete: boolean; elapsed: number; timing: { truthSeconds: number; secondTapSeconds?: number } | null }; oracle(): { optionId?: string; tapSeconds?: number; taps?: number[] } | null };
type W = { __rally: { school: School } };
const mini = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.mini());
const oracle = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.oracle());
const DECISION_KEY = 'rally-trainer.decision.v1';
async function withCourse(page: Page, course: { modulesDone: string[]; pages: Record<string, number> }): Promise<void> {
  await page.addInitScript(([k, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k as string, JSON.stringify({ course: { tryItStars: {}, ...(c as object) } })); sessionStorage.setItem('seeded', '1'); } }, [DECISION_KEY, course] as const);
}
async function tapEl(page: Page, sel: string): Promise<void> { const b = (await page.locator(sel).boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
async function waitCard(page: Page, t: number): Promise<void> { await page.waitForFunction(x => (window as unknown as W).__rally.school.mini().elapsed >= x - 0.04, t, { polling: 'raf', timeout: 60_000 }); }

test.describe('PT-16 phone 390x844 (touch)', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

  test('SCH-011 a touch tap on CALL early on #/school/m2/4 shows the verdict, which stays until an explicit second tap on Try again', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m2/4');
    await expect(page.locator('.s2-miniacts [data-action=go]')).toBeVisible();
    expect((await mini(page)).kind).toBe('speedChange');
    await tapEl(page, '.s2-miniacts [data-action=start-card]');   // SCH-022: the card starts on its Start tap
    await page.waitForTimeout(300);
    await tapEl(page, '.s2-miniacts [data-action=go]');
    const verdict = page.locator('[data-testid=mini-verdict]');
    await expect(verdict).toHaveAttribute('data-correct', 'false');
    await page.waitForTimeout(1200);
    await expect(verdict).toBeVisible(); expect((await mini(page)).attempt).toBe(1);
    await expect(page.locator('[data-action=try-again]')).toBeEnabled();
    await tapEl(page, '[data-action=try-again]');
    await expect(verdict).toHaveCount(0); expect((await mini(page)).attempt).toBe(2);
  });

  test('SCH-012 every mini-sim page rings a control that is on its card and shows its pointer line', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?mode=mobile#/school/m1/1');
    const mods = await page.evaluate(() => (window as unknown as W).__rally.school.course());
    const bad: string[] = [];
    for (const m of mods) for (let i = 1; i <= m.pages; i++) {
      if (m.kinds[i - 1] !== 'minisim') continue;
      await page.goto(`/?mode=mobile#/school/${m.id}/${i}`);
      await expect(page.locator('.s2-minisim .mcard')).toBeVisible();
      const ring = await page.locator('.s2-minisim .s2-ring').count(); const ptr = (await page.locator('[data-testid=pointer]').innerText()).trim();
      if (ring < 1 || ptr.length < 8) bad.push(`${m.id} p${i}: ring ${ring}, pointer "${ptr}"`);
    }
    expect(bad).toEqual([]);
  });

  test('SCH-014 the Module 1 try-it greys no answer; the Module 2 try-it hides nothing on its cards', async ({ page }) => {
    await withCourse(page, { modulesDone: ['m0'], pages: { m1: 8 } });
    await page.goto('/?mode=mobile#/school/m1/try');
    await expect(page.locator('[data-screen=run] .mob-opts')).toBeVisible();
    expect(await page.locator('.mob-opts .g-grey, .mob-opts.g-grey').count()).toBe(0);
    expect(await page.locator('.g-hide').count()).toBe(0);
    await page.evaluate(k => { const o = JSON.parse(localStorage.getItem(k) ?? '{}'); o.course = { modulesDone: ['m0', 'm1'], pages: { m2: 7 }, tryItStars: {} }; localStorage.setItem(k, JSON.stringify(o)); }, DECISION_KEY);
    for (let n = 0; n < 3; n++) {
      await page.goto('/?mode=mobile#/school/m2/try');
      await expect(page.locator('[data-screen=run] .mcard')).toBeVisible();
      expect(await page.locator('[data-screen=run] .g-hide').count()).toBe(0);
      expect(await page.locator('.mob-opts .g-grey, [data-action=go].g-grey').count()).toBe(0);
    }
  });

  test('SCH-015 Module 3: START at the first sign, LAP at the second on the tap-watch, then the lap read-off', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?mode=mobile#/school/m3/2');
    await expect(page.locator('.s2-miniacts [data-action=startstop]')).toBeVisible();
    await expect(page.locator('[data-testid=pointer]')).toHaveText(/START.*LAP/);
    await page.locator('.s2-miniacts [data-action=start-card]').click();
    const o = (await oracle(page))!; expect(o.taps?.length).toBe(2);
    await waitCard(page, o.taps![0]!); await page.locator('.s2-miniacts [data-action=startstop]').click();
    await waitCard(page, o.taps![1]!); await page.locator('.s2-miniacts [data-action=lap]').click();
    await expect(page.locator('[data-testid=mini-verdict]')).toHaveAttribute('data-correct', 'true');
    await expect(page.locator('[data-testid=lap-read]')).toHaveText(/lap reads 0m\d\d\.\ds/);
  });

  test('SCH-016 whereCheckpoint draws the green sign and the ghost; the strip is the leg; the score is explained', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?mode=mobile#/school/m0/4');
    await expect(page.locator('[data-testid=checkpoint]')).toBeVisible();
    await expect(page.locator('[data-widget=whereCheckpoint] .s2-ghost')).toBeVisible();
    await page.waitForFunction(() => parseFloat(document.querySelector('[data-testid=leg-clock]')?.textContent ?? '0') >= 20.4, null, { timeout: 30_000, polling: 'raf' });
    const car = (await page.locator('[data-widget=whereCheckpoint] .s2-car:not(.s2-ghost)').boundingBox())!; const sign = (await page.locator('[data-testid=checkpoint]').boundingBox())!;
    expect(Math.abs(car.x + car.width - (sign.x + sign.width))).toBeLessThan(24);   // the car's nose is at the sign when the ghost's time is up
    await page.locator('[data-action=leg-ended]').click();
    await expect(page.locator('[data-testid=cp-result]')).toHaveText(/The ghost reached the sign at 20\.\d s\. You tapped at [\d.]+ s.*whole seconds: [01] points?/);
  });

  test('SCH-019 tapLap: LAP stays put while laps are listed below it, and the lap numbers are not clipped', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m3/4');
    const lap = page.locator('[data-action=lap]');
    const y0 = (await lap.boundingBox())!.y;
    for (let i = 0; i < 2; i++) { await page.waitForTimeout(700); await lap.click(); expect(Math.abs((await lap.boundingBox())!.y - y0)).toBeLessThan(1); }
    expect(await page.locator('[data-testid=laps]').evaluate(e => getComputedStyle(e).listStylePosition)).toBe('inside');
    const li = (await page.locator('[data-testid=laps] li').first().boundingBox())!; const ol = (await page.locator('[data-testid=laps]').boundingBox())!;
    expect(li.x).toBeGreaterThanOrEqual(ol.x - 0.5);
  });

  test('SCH-018 a wrong mini-sim answer shows the rule without a citation and the source as a chip that opens the excerpt sheet', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m1/3');
    const m = await mini(page); const o = await oracle(page);
    await page.locator(`.s2-miniacts [data-option="${m.options.find(x => x !== o?.optionId)}"]`).click();
    await expect(page.locator('[data-testid=mini-rule]')).not.toHaveText(/\((HB|REG)|\[\d+:\d\d\]|video\)/);
    const chip = page.locator('[data-testid=verdict-chips] .s2-chip').first();
    await expect(chip).toBeVisible(); await chip.click();
    await expect(page.locator('[data-testid=sheet-text]')).not.toBeEmpty();
    await expect(page.locator('[data-testid=sheet-cite]')).not.toHaveText(/docs\/|\.md/);
  });

  test('SCH-020 the time zone chip explains CDT; Home keeps Continue course after Module 6 until Module 12', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m2/6');
    await expect(page.locator('[data-testid=zone-chip]')).toBeVisible();
    await page.locator('[data-testid=zone-chip]').click();
    await expect(page.locator('[data-testid=sheet-text]')).toHaveText(/Central Daylight Time/);
    await page.evaluate(k => { localStorage.setItem(k, JSON.stringify({ course: { modulesDone: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'], pages: { m6: 9 }, tryItStars: {} } })); }, DECISION_KEY);
    await page.goto('/?mode=mobile#/m');
    await expect(page.locator('[data-testid=continue-course]')).toHaveText(/^Continue course: Module 7, page \d+$/);
  });
});

test.describe('PT-16 landscape phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('SCH-020 a phone held sideways gets a "turn upright" card instead of a page that scrolls', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m11/7');
    await expect(page.locator('[data-testid=rotate]')).toBeVisible();
    await expect(page.locator('.s2 > .s2-main')).toBeHidden();
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight + 1)).toBe(true);
  });
});

test.describe('PT-16 desk width', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  test('SCH-020 a desk-width mini-sim sits at the top of the column', async ({ page }) => {
    await page.goto('/?mode=desk#/school/m4/3');
    await expect(page.locator('.s2-minisim .mcard')).toBeVisible();
    const pg = (await page.locator('[data-testid=page]').boundingBox())!; const card = (await page.locator('.s2-minicard').boundingBox())!;
    expect(card.y - pg.y).toBeLessThan(60);
    await expect(page.locator('[data-testid=rotate]')).toBeHidden();
  });
});
