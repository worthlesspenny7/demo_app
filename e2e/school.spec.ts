// Phase IX Rally School 2.0 page player (SCH-003..008, SCH-010 UI parts) on a 390x844 phone (touch) and at desk width.
import { test, expect, type Page } from '@playwright/test';
import { PHONES, state, step } from './mobile-helpers.js';

type School = { state(): { module: string; page: number; of: number; kind: string; complete: boolean; firstVisit: boolean }; mini(): { kind: string | null; options: string[]; attempt: number; complete: boolean; elapsed: number; timing: { truthSeconds: number } | null }; oracle(): { optionId?: string; tapSeconds?: number; taps?: number[] } | null };
type W = { __rally: { school: School } };
const sch = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.state());
const mini = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.mini());
const DECISION_KEY = 'rally-trainer.decision.v1';

async function withCourse(page: Page, course: { modulesDone: string[]; pages: Record<string, number>; tryItStars?: Record<string, number> }): Promise<void> {
  await page.addInitScript(([k, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k as string, JSON.stringify({ course: { tryItStars: {}, ...(c as object) } })); sessionStorage.setItem('seeded', '1'); } }, [DECISION_KEY, course] as const);
}

test.describe('school phone 390x844', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

  test('SCH-010 a brand-new visitor landing on the page sees Module 0 page 1 with the first-visit line and a Start button, nothing else first', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-screen=school]')).toBeVisible();
    await expect(page).toHaveURL(/#\/school$/);
    await expect(page.locator('[data-testid=first-visit]')).toHaveText(/^What is this\?/);
    await expect(page.locator('[data-testid=start]')).toHaveText('Start');
    await expect(page.locator('.nav')).toBeHidden();
    await expect(page.locator('[data-screen=home]')).toHaveCount(0);
    expect(await sch(page)).toMatchObject({ module: 'm0', page: 0, firstVisit: true });
    await page.locator('[data-testid=start]').click();
    expect(await sch(page)).toMatchObject({ module: 'm0', page: 1 });
    // a returning visitor (progress saved) is not a first visit
    await page.goto('/'); await page.reload();
    await expect(page.locator('[data-testid=first-visit]')).toHaveCount(0);
  });

  test('SCH-006 the page player: tap Next, swipe, Back, dot strip, the module remembers its page, reading pages advance on a tap at the right', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m1/1');
    await expect(page.locator('[data-testid=page][data-page="1"]')).toBeVisible();
    await expect(page.locator('.s2-dot')).toHaveCount(9);   // 8 pages + the try-it page
    await page.locator('[data-action=next]').click();
    expect((await sch(page)).page).toBe(1);
    // swipe left on the page: next; swipe right: back
    const swipe = async (dx: number): Promise<void> => {
      const b = (await page.locator('[data-testid=page]').boundingBox())!; const y = b.y + 40; const x0 = b.x + b.width / 2;
      await page.locator('[data-testid=page]').dispatchEvent('touchstart', { changedTouches: [{ identifier: 1, clientX: x0, clientY: y }], touches: [{ identifier: 1, clientX: x0, clientY: y }] });
      await page.locator('[data-testid=page]').dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: x0 + dx, clientY: y }], touches: [] });
    };
    await swipe(-150); expect((await sch(page)).page).toBe(2);
    await swipe(150); expect((await sch(page)).page).toBe(1);
    await page.locator('[data-action=back]').click(); expect((await sch(page)).page).toBe(0);
    // tap the right third of a reading page
    const b = (await page.locator('[data-testid=page]').boundingBox())!;
    await page.mouse.click(b.x + b.width * 0.9, b.y + 60); expect((await sch(page)).page).toBe(1);
    await page.locator('.s2-dot[data-page="5"]').click(); expect((await sch(page)).page).toBe(5);
    await expect(page.locator('.s2-dot.on')).toHaveAttribute('data-page', '5');
    // the module remembers the page
    await page.goto('/?mode=mobile#/school/m0/2'); await expect(page.locator('[data-testid=page][data-page="2"]')).toBeVisible();
    await page.goto('/?mode=mobile#/school/m1'); await expect(page.locator('[data-testid=page][data-page="6"]')).toBeVisible();
    await page.goto('/?mode=mobile#/school/m0'); await expect(page.locator('[data-testid=page][data-page="2"]')).toBeVisible();
  });

  test('SCH-006 SCH-002 a reference chip opens a bottom sheet with the excerpt and its citation (never pasted into the page); at most two chips', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m0/1');
    const chips = page.locator('.s2-chip');
    expect(await chips.count()).toBeGreaterThan(0); expect(await chips.count()).toBeLessThanOrEqual(2);
    const label = await chips.first().innerText();
    await chips.first().click();
    const sheet = page.locator('#s2-sheet');
    await expect(sheet).toBeVisible();
    const text = await page.locator('[data-testid=sheet-text]').innerText();
    expect(text.length).toBeGreaterThan(20); expect(text).not.toMatch(/not in the app yet/);
    await expect(page.locator('[data-testid=sheet-cite]')).not.toBeEmpty();
    expect(await page.locator('[data-testid=page]').innerText()).not.toContain(text.slice(0, 40));
    expect(label).toMatch(/^(REG|HB|Video) /);
    await page.locator('[data-action=close-sheet]').click(); await expect(sheet).toHaveCount(0);
    // a video chip: the sheet offers "Open video at mm:ss" only when the URL is known
    await page.goto('/?mode=mobile#/school/m0/6');
    const v = page.locator('.s2-chip[data-ref-type=video]').first(); await v.click();
    await expect(page.locator('[data-testid=sheet-text]')).toBeVisible();
    const hasUrl = await page.locator('[data-testid=open-video]').count();
    if (hasUrl) await expect(page.locator('[data-testid=open-video]')).toHaveText(/^Open video at \d+:\d\d$/);
  });

  test('SCH-006 check page: tap an option, instant right or wrong', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m0/8');
    await page.locator('.s2-checkopts [data-right=false]').first().click();
    await expect(page.locator('.s2-checkopts .s2-wrong')).toHaveCount(1);
    await expect(page.locator('[data-testid=check-result]')).toHaveText(/^Not quite: /);
    await page.locator('.s2-checkopts [data-right=true]').click();
    await expect(page.locator('[data-testid=check-result]')).toHaveText(/^Correct\./);
    expect((await sch(page)).complete).toBe(true);
    await expect(page.locator('.s2-dot[data-page="7"]')).toHaveClass(/done/);
  });

  test('SCH-005 mini-sim page: one phone card with a ring and a one-line pointer on its control; a wrong answer shows the rule and a second try; complete after a right answer with the why line', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m1/3');
    await expect(page.locator('.s2-minisim .mcard')).toBeVisible();
    await expect(page.locator('[data-testid=pointer]')).toBeVisible();
    await expect(page.locator('[data-testid=pointer]')).toHaveAttribute('data-control', 'book');
    await expect(page.locator('.s2-minisim .s2-ring')).toHaveCount(1);
    const words = (await page.locator('.s2-minisim .mprompt').innerText()).split(/\s+/).length; expect(words).toBeLessThanOrEqual(40);
    let m = await mini(page); let o = await page.evaluate(() => (window as unknown as W).__rally.school.oracle());
    const wrong = m.options.find(x => x !== o?.optionId)!;
    await page.locator(`.s2-miniacts [data-option="${wrong}"]`).click();
    await expect(page.locator('[data-testid=mini-verdict]')).toHaveAttribute('data-correct', 'false');
    await expect(page.locator('[data-testid=mini-rule]')).not.toBeEmpty();
    await page.locator('[data-action=try-again]').click();
    m = await mini(page); expect(m.attempt).toBe(2);
    o = await page.evaluate(() => (window as unknown as W).__rally.school.oracle());
    await page.locator(`.s2-miniacts [data-option="${o!.optionId}"]`).click();
    await expect(page.locator('[data-testid=mini-verdict]')).toHaveAttribute('data-correct', 'true');
    await expect(page.locator('[data-testid=why]')).not.toBeEmpty();
    expect((await sch(page)).complete).toBe(true); expect((await mini(page)).complete).toBe(true);
  });

  test('SCH-005 a timed mini-sim (pause: tap GO at the chart second) completes on a right tap', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?mode=mobile#/school/m2/6');
    await expect(page.locator('.s2-miniacts [data-action=go]')).toBeVisible();
    await page.locator('.s2-miniacts [data-action=start-card]').click();   // SCH-022
    const o = await page.evaluate(() => (window as unknown as W).__rally.school.oracle());
    expect(o?.tapSeconds).toBeGreaterThan(0);
    await page.waitForFunction(t => (window as unknown as W).__rally.school.mini().elapsed >= t - 0.04, o!.tapSeconds!, { polling: 'raf', timeout: 60_000 });
    await page.locator('.s2-miniacts [data-action=go]').click();
    await expect(page.locator('[data-testid=mini-verdict]')).toHaveAttribute('data-correct', 'true');
  });

  test('SCH-003 holdSpeed: the readout is the car against the ghost; holding 35 within 1 mph for 10 s completes the page', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?mode=mobile#/school/m0/2');
    const drift = page.locator('[data-testid=drift]');
    await page.waitForTimeout(1500);
    await expect(drift).toHaveText(/s late$/);   // starting at 25 against an assigned 35: falling behind the ghost
    await page.locator('[data-testid=speed-slider]').fill('35');
    await expect(page.locator('[data-testid=car-speed]')).toHaveText('35 mph', { timeout: 5000 });
    await expect(page.locator('.s2-widget.s2-done')).toBeVisible({ timeout: 16_000 });
    expect((await sch(page)).complete).toBe(true);
  });

  test('SCH-003 whereCheckpoint: tap when the leg ended; the checkpoint and the score appear', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m0/4');
    await page.waitForTimeout(2500);
    await page.locator('[data-action=leg-ended]').click();
    await expect(page.locator('[data-testid=checkpoint]')).toBeVisible();
    await expect(page.locator('[data-testid=cp-result]')).toHaveText(/The ghost reached the sign at [\d.]+ s\. You tapped at [\d.]+ s.* \d+ points?/);
    expect((await sch(page)).complete).toBe(true);
  });

  test('SCH-003 tapLap: LAP at three markers on the digital stopwatch, then read the split', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m3/4');
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(800); await page.locator('[data-action=lap]').click(); }
    await expect(page.locator('[data-testid=laps] li')).toHaveCount(3);
    await page.locator('.s2-q [data-right=false]').first().click();
    await expect(page.locator('[data-testid=split-result]')).toHaveText(/^Not quite/);
    await page.locator('.s2-q [data-right=true]').click();
    await expect(page.locator('[data-testid=split-result]')).toHaveText(/^Correct/);
    expect((await sch(page)).complete).toBe(true);
  });

  test('SCH-003 readScorecard: a sample scorecard; read the day\'s score (raw seconds x the age factor)', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m11/7');
    await expect(page.locator('[data-testid=scorecard] tbody tr.s2-leg')).toHaveCount(5);
    await page.locator('[data-widget=readScorecard] button[data-right=false]').first().click();
    await expect(page.locator('[data-testid=card-result]')).toHaveText(/^Not quite/);
    await page.locator('[data-widget=readScorecard] button[data-right=true]').click();
    await expect(page.locator('[data-testid=card-result]')).toHaveText(/^Correct/);
  });

  test('SCH-007 try-it: the last page starts a 5-card run on the run screen, then a recap with stars and the module\'s "You can now" line; the module is recorded done', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/?mode=mobile#/school/m0/9');
    await expect(page.locator('[data-action=start-tryit]')).toBeVisible();
    await page.locator('[data-action=start-tryit]').click();
    await expect(page.locator('[data-screen=run]')).toBeVisible();
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      if (await page.locator('[data-screen=school-recap]').count()) break;
      const st = await state(page); if (st.kind) kinds.add(st.kind);
      if (st.screen === 'run') { if (st.phase === 'decision') expect(st.of).toBe(5); await step(page); } else await page.waitForTimeout(200);
    }
    await expect(page.locator('[data-screen=school-recap]')).toBeVisible();
    await expect(page).toHaveURL(/#\/school\/m0\/recap$/);
    expect([...kinds]).toEqual(['checkpoint']);
    await expect(page.locator('[data-testid=tryit-recap] .mob-stars')).toHaveAttribute('data-stars', /[1-3]/);
    await expect(page.locator('[data-testid=you-can-now]')).toHaveText(/^You can now /);
    const course = await page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}').course, DECISION_KEY);
    expect(course.modulesDone).toContain('m0');
    // the try-it run is not left behind as an unfinished run
    expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? '{}').unfinished ?? null, DECISION_KEY)).toBeNull();
    await page.locator('[data-action=next-module]').click();
    await expect(page.locator('[data-screen=school][data-module=m1]')).toBeVisible();
  });

  test('SCH-004 Home shows "Continue course: Module n, page m" as the primary button while the core is not done; Desk mode appears once module 12 is done', async ({ page }) => {
    await withCourse(page, { modulesDone: ['m0', 'm1'], pages: { m2: 2 } });
    await page.addInitScript(() => { if (!sessionStorage.getItem('pos')) { localStorage.setItem('rally-trainer.course.pos.v1', JSON.stringify({ pos: { m2: 1 }, last: 'm2' })); sessionStorage.setItem('pos', '1'); } });
    await page.goto('/?mode=mobile#/m');
    await expect(page.locator('[data-testid=continue-course]')).toHaveText('Continue course: Module 2, page 2');
    await expect(page.locator('[data-testid=continue-course]')).toHaveClass(/primary/);
    await expect(page.locator('[data-testid=play-daily]')).not.toHaveClass(/primary/);
    await expect(page.locator('[data-testid=desk-mode]')).toHaveCount(0);
    await page.locator('[data-testid=continue-course]').click();
    await expect(page.locator('[data-screen=school][data-module=m2] [data-testid=page][data-page="2"]')).toBeVisible();
    const all = Array.from({ length: 13 }, (_, i) => `m${i}`);
    await page.evaluate(([k, ids]) => localStorage.setItem(k as string, JSON.stringify({ course: { modulesDone: ids, pages: {}, tryItStars: {} } })), [DECISION_KEY, all] as const);
    await page.goto('/?mode=mobile#/m'); await page.reload();
    await expect(page.locator('[data-testid=continue-course]')).toHaveCount(0);
    await expect(page.locator('[data-testid=desk-mode]')).toBeVisible();
  });

  test('SCH-004 guided controls: while the core is not done the run screen hides controls not yet introduced (the TOD strip) and greys answer controls; guidance lifts when modules 0-6 are done', async ({ page }) => {
    test.setTimeout(240_000);
    await withCourse(page, { modulesDone: ['m0', 'm1'], pages: { m2: 1 } });
    await page.goto('/?mode=mobile#/m/play/skill/stayOnTime');
    await expect(page.locator('[data-screen=run]')).toBeVisible();
    let sawTimed = false;
    for (let i = 0; i < 30 && !sawTimed; i++) {
      const st = await state(page);
      if (st.screen === 'recap') break;
      if (st.phase === 'decision') {
        await expect(page.locator('.mob-run')).toHaveClass(/guided/);
        if (st.timing) {
          sawTimed = true;
          await expect(page.locator('.mob-actions [data-testid=tod-digits]')).toHaveClass(/g-hide/);
          await expect(page.locator('.mob-actions [data-testid=tod-digits]')).toBeHidden();
          if (st.kind === 'pause') { await expect(page.locator('[data-testid=pointer]')).toHaveAttribute('data-control', 'go'); await expect(page.locator('.mob-actions [data-action=go]')).not.toHaveClass(/g-grey/); }
          if (st.kind === 'timedStart') await expect(page.locator('.mob-actions [data-action=startstop]')).toHaveClass(/g-grey/);
        }
      }
      await step(page);
    }
    expect(sawTimed).toBe(true);
    // modules 0-6 done: no guidance
    await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ course: { modulesDone: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6'], pages: {}, tryItStars: {} } })), DECISION_KEY);
    await page.goto('/?mode=mobile#/m'); await page.reload();
    await page.goto('/?mode=mobile#/m/play/skill/stayOnTime');
    await expect(page.locator('[data-screen=run]')).toBeVisible();
    for (let i = 0; i < 10; i++) { const st = await state(page); if (st.phase === 'decision') break; await step(page); }
    await expect(page.locator('.mob-run')).not.toHaveClass(/guided/);
    await expect(page.locator('.g-hide, .g-grey, [data-testid=pointer]')).toHaveCount(0);
  });

  test('SCH-008 old School routes: #/school/<old lesson id> opens the module that covers it; the rule cards live under Reference as "Rules"; the long lessons stay in Reference long form', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/protocol');
    await expect(page).toHaveURL(/#\/school\/m2$/);
    await expect(page.locator('[data-screen=school][data-module=m2]')).toBeVisible();
    await page.goto('/?mode=mobile#/school/ghost-car'); await expect(page).toHaveURL(/#\/school\/m0$/);
    await page.goto('/?mode=mobile#/reference/rules');
    await expect(page.locator('#rules-page h1')).toHaveText('Rules');
    expect(await page.locator('.rule-card').count()).toBeGreaterThan(5);
    await page.goto('/?mode=mobile#/reference');
    await expect(page.locator('#ref-rules-link a[href="#/reference/rules"]')).toBeVisible();
    await page.goto('/?mode=mobile#/lesson/protocol');
    await expect(page.locator('.lesson h1')).toHaveText('Team protocol');
  });
});

test('SCH-006 SCH-008 desk width: the same player, centred, concept pages at most two columns (figure beside the words)', async ({ page }) => {
  await page.goto('/?mode=desk#/school/m0/1');
  await expect(page.locator('.nav')).toBeVisible();
  await expect(page.locator('[data-screen=school]')).toBeVisible();
  const box = (await page.locator('.s2').boundingBox())!; expect(box.width).toBeLessThanOrEqual(822);
  const cols = await page.locator('.s2-concept').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
  expect(cols).toBe(2);
  const o = await page.locator('[data-testid=page]').evaluate(n => ({ s: n.scrollHeight, c: n.clientHeight }));
  expect(o.s).toBeLessThanOrEqual(o.c + 1);
  await page.goto('/?mode=desk#/school/m2/2');
  const mcols = await page.locator('.s2-minisim').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length);
  expect(mcols).toBeLessThanOrEqual(2);
});
