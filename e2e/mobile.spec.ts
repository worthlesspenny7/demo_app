// Phase VIII phone shell (MOB-020..026, MOB-030/031, MOB-041) on phone viewports. Desk mode stays at 1366 x 800 in the other specs.
import { test, expect } from '@playwright/test';
import { PHONES, state, step, toDecision, geometry, expectPhoneGeometry, collectErrors, screenWords, type W } from './mobile-helpers.js';

for (const vp of PHONES) {
  test.describe(`phone ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: true, isMobile: true });

    test(`MOB-020 MOB-025 MOB-041 a narrow viewport opens the phone Home and every card keeps its controls in the bottom 40 % (${vp.width}x${vp.height})`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors = collectErrors(page);
      await page.goto('/');
      // MOB-025 Home: Daily set, five meters, streak, Dad's card, Desk mode (Continue appears once a run is unfinished)
      await expect(page.locator('[data-screen=home]')).toBeVisible();
      await expect(page.locator('.nav')).toBeHidden();
      await expect(page.locator('[data-testid=play-daily]')).toBeVisible();
      await expect(page.locator('.mob-meter')).toHaveCount(5);
      await expect(page.locator('[data-testid=streak]')).toHaveText(/Streak \d+/);
      await expect(page.locator('[data-testid=dads-card]')).toBeVisible();
      await expect(page.locator('[data-testid=desk-mode]')).toBeVisible();
      await expect(page.locator('[data-testid=school]')).toHaveAttribute('href', '#/school');   // MOB-061: the School is one tap from the phone Home
      const home = await geometry(page);
      expect(home.hscroll).toBe(false); expect(home.small).toEqual([]); expect(home.tiny).toEqual([]);
      await page.locator('[data-testid=play-daily]').click();
      await expect(page.locator('[data-screen=run]')).toBeVisible();
      const kinds = new Set<string>();
      for (let i = 0; i < 60; i++) {
        const st = await state(page);
        if (st.screen === 'recap') break;
        if (st.phase === 'decision' || st.phase === 'rule' || st.phase === 'verdict') {
          // top strip: skill, streak, card n of N (short forms on screen, the long ones as accessible names)
          await expect(page.locator('[data-testid=strip-skill]')).not.toBeEmpty();
          await expect(page.locator('.mob-strip .mob-streak')).toHaveAttribute('aria-label', /^Streak \d+$/);
          await expect(page.locator('[data-testid=card-count]')).toHaveText(/^\d+\/\d+$/);
          await expect(page.locator('[data-testid=card-count]')).toHaveAttribute('aria-label', /^Card \d+ of \d+$/);
          expectPhoneGeometry(await geometry(page), `${st.phase} ${st.kind ?? ''}`);
          // MOB-061: under 40 words on a decision screen, under 60 on a rule card (closed "details" do not count)
          if (st.phase === 'decision' || st.phase === 'rule') { const n = await screenWords(page); expect(n, `${st.phase} ${st.kind ?? ''}: ${n} words`).toBeLessThan(st.phase === 'rule' ? 60 : 40); }
          if (st.kind) kinds.add(st.kind);
        }
        await step(page);
      }
      await expect(page.locator('[data-screen=recap]')).toBeVisible();
      expectPhoneGeometry(await geometry(page), 'recap');
      expect(kinds.size).toBeGreaterThanOrEqual(4);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('phone 390x844', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

  test('MOB-021 tap-stopwatch: the whole face is GO/LAUNCH in a pause or restart card; START/STOP left, LAP right, TOD strip and a lap table in a timed start', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/?mode=mobile#/m/play/practice');
    const faces = new Set<string>();
    for (let i = 0; i < 60 && faces.size < 2; i++) {
      const st = await state(page);
      if (st.screen === 'recap') { await page.goto('/?mode=mobile#/m/play/practice'); continue; }
      if (st.phase === 'decision' && st.timing) {
        const t = st.timing as { kind: string; tapLabel: string };
        await expect(page.locator('.mw-tod')).toHaveText(/^TOD \d{1,2}:\d\d:\d\d$/);
        if (t.kind === 'startStop') {
          await expect(page.locator('.mw-face[data-face=split]')).toBeVisible();
          const left = await page.locator('[data-action=startstop]').boundingBox(), right = await page.locator('[data-action=lap]').boundingBox();
          const w = PHONES[0].width;
          expect(left!.x + left!.width).toBeLessThanOrEqual(w / 2 + 8); expect(right!.x).toBeGreaterThanOrEqual(w / 2 - 8);
          await expect(page.locator('[data-action=startstop]')).toHaveText('START');
          await expect(page.locator('[data-testid=watch-digits]')).toHaveText('0:00.00');
          faces.add('split');
          await step(page);
          // the real Stopwatch ran and lapped: the lap table shows interval / cumulative
          await expect(page.locator('.mob-verdict .mw-laps td').first()).toHaveText('1');
          await expect(page.locator('.mob-verdict .mw-laps th').nth(1)).toHaveText('interval');
          await expect(page.locator('.mob-verdict .mw-laps td').nth(1)).toHaveText(/^\dm\d\d\.\ds$/);
          continue;
        }
        if (st.kind === 'pause' || st.kind === 'restart') {
          const face = page.locator('.mw-face[data-face=go] [data-action=go]');
          await expect(face).toBeVisible();
          await expect(face).toContainText(st.kind === 'pause' ? 'GO' : 'LAUNCH');
          const box = (await face.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(140); expect(box.width).toBeGreaterThanOrEqual(PHONES[0].width - 40);
          // the digits run (1/100 s) from the card's moment
          const a = await page.locator('[data-testid=watch-digits]').textContent(); await page.waitForTimeout(120); const b = await page.locator('[data-testid=watch-digits]').textContent();
          expect(a).toMatch(/^\d+:\d\d\.\d\d$/); expect(a).not.toBe(b);
          faces.add('go');
        }
      }
      await step(page);
    }
    expect([...faces].sort()).toEqual(['go', 'split']);
  });

  test('MOB-022 landscape shows the mini cockpit (watch large, the row, the driver line) and rotating keeps the run', async ({ page }) => {
    await page.goto('/?mode=mobile#/m/play/practice');
    await toDecision(page);
    const before = await state(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('body')).toHaveClass(/mob-landscape/);
    await expect(page.locator('[data-testid=driver-line]')).toBeVisible();
    await expect(page.locator('[data-testid=driver-line]')).toHaveText(/^Dad: /);
    const mid = await state(page);
    expect(mid.id).toBe(before.id); expect(mid.n).toBe(before.n);
    const acts = (await page.locator('[data-testid=actions]').boundingBox())!, main = (await page.locator('.mob-main').boundingBox())!;
    expect(acts.x).toBeLessThan(main.x);            // the watch / buttons on the left half, the card on the right
    expect(await page.locator('.mob-actions button').count()).toBeLessThanOrEqual(4);
    await page.setViewportSize(PHONES[0]);
    await expect(page.locator('body')).not.toHaveClass(/mob-landscape/);
    expect((await state(page)).id).toBe(before.id);
    await step(page);
    expect((await state(page)).answered).toBe(1);
  });

  test('MOB-030 MOB-032 Continue resumes an unfinished run across a reload at the same card; the daily set records completion and the Desk progress lists the run', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/?mode=mobile#/m');
    await page.locator('[data-testid=play-daily]').click();
    let answered = 0;
    while (answered < 2) { if ((await step(page)) === 'decision') answered++; }
    await page.locator('.mob-actions [data-action=next]').click();
    await toDecision(page);
    const at = await state(page);
    await page.goto('/?mode=mobile#/m'); await page.reload();
    await expect(page.locator('[data-testid=continue]')).toContainText('2 of');
    await page.locator('[data-testid=continue]').click();
    await toDecision(page);
    const back = await state(page);
    expect(back.id).toBe(at.id); expect(back.n).toBe(at.n); expect(back.answered).toBe(2);
    for (let i = 0; i < 80; i++) { if ((await step(page)) === 'recap') break; }
    await expect(page.locator('[data-screen=recap]')).toBeVisible();
    await expect(page.locator('[data-testid=recap-sum]')).toHaveText(/\d+ of \d+ right/);
    await expect(page.locator('.mob-stars')).toBeVisible();
    // MOB-032: the run is also in the Desk progress store (its recent-runs list), stars included
    const desk = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.progress.v1') ?? '{}') as { runs?: { id: string; stars: number }[] });
    expect(desk.runs?.some(r => r.id === 'M-daily')).toBe(true);
    await page.locator('[data-action=next-run]').click();
    await expect(page.locator('[data-screen=run]')).toBeVisible();
    await page.goto('/?mode=mobile#/m');
    await expect(page.locator('.mob-pill.done')).toHaveCount(1);
    await expect(page.locator('[data-testid=streak]')).toHaveText('Streak 1');
    await expect(page.locator('[data-testid=play-daily]')).toHaveText(/run 2 of 3/);
  });

  test('MOB-031 MOB-059 the legal-rung run appears at 80 % on a skill and the Boss run when every meter is at 50 %; the legal rung withholds the chart cell; the first Boss shows the chart', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?mode=mobile#/m');
    await page.evaluate(() => {
      const meters: Record<string, unknown> = {};
      for (const s of ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments']) meters[s] = { value: s === 'stayOnTime' ? 0.85 : 0.45, correct: 10, total: 12, lastDay: null, passed: s === 'stayOnTime' };
      localStorage.setItem('rally-trainer.decision.v1', JSON.stringify({ version: 1, meters, streak: { current: 0, best: 0, lastDay: null }, daily: { day: null, completed: [], best: {} }, rulesSeen: [], unfinished: null, runs: 3 }));
    });
    await page.reload();
    await expect(page.locator('[data-legal]')).toHaveCount(1);
    await expect(page.locator('[data-legal=stayOnTime]')).toBeVisible();
    await expect(page.locator('[data-testid=boss-locked]')).toBeVisible();
    await page.locator('[data-legal=stayOnTime]').click();
    await toDecision(page);
    for (let i = 0; i < 3; i++) { await expect(page.locator('.mchart')).toHaveCount(0); if ((await step(page)) === 'recap') break; await toDecision(page).catch(() => undefined); }
    await page.goto('/?mode=mobile#/m');
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('rally-trainer.decision.v1')!); for (const k of Object.keys(p.meters)) p.meters[k].value = 0.55; p.unfinished = null; localStorage.setItem('rally-trainer.decision.v1', JSON.stringify(p)); });
    await page.reload();
    await expect(page.locator('[data-testid=boss]')).toBeVisible();
    await page.locator('[data-testid=boss]').click();
    await toDecision(page);
    expect((await state(page)).of).toBe(22);
    await expect(page.locator('[data-testid=chart-button]')).toHaveCount(0);   // rung 2: no Chart button, the chart is on the card
    await step(page);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1')!).unfinished.plan.rung)).toBe(2);
  });

  test('MOB-026 a pre-read card shows the real book row at phone width: CAMEO left, Column C right, remark below', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?mode=mobile#/m/play/skill/safetyCourse');
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) {
      const st = await state(page);
      if (st.screen === 'recap') break;
      if (st.phase === 'decision' && (await page.locator('.mcard .mrow').count())) {
        const a = (await page.locator('.mrow-a').boundingBox())!, c = (await page.locator('.mrow-c').boundingBox())!;
        expect(a.x + a.width).toBeLessThanOrEqual(c.x + 1);
        expect(await page.locator('.mrow-c .cl').count()).toBeGreaterThan(0);
        if (await page.locator('.mrow-d').count()) { const d = (await page.locator('.mrow-d').boundingBox())!; expect(d.y).toBeGreaterThanOrEqual(c.y + c.height - 1); }
        seen = true;
      }
      await step(page);
    }
    expect(seen).toBe(true);
  });

  test('MOB-024 a wrong answer shows the verdict with seconds and the rule, then the next card; Desk mode is one tap from Home and back', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => { (window as unknown as { __vib: unknown[] }).__vib = []; (navigator as unknown as { vibrate: (p: unknown) => boolean }).vibrate = (p: unknown) => { (window as unknown as { __vib: unknown[] }).__vib.push(p); return true; }; });
    await page.goto('/?mode=mobile#/m/play/practice');
    await toDecision(page);
    await step(page, { wrong: true });
    await expect(page.locator('[data-testid=verdict]')).toHaveAttribute('data-correct', 'false');
    await expect(page.locator('.mv-sec')).toHaveText(/s$/);
    await expect(page.locator('.mv-rule')).not.toBeEmpty();
    expect((await page.evaluate(() => (window as unknown as { __vib: number[][] }).__vib)).slice(-1)).toEqual([[60, 80, 60]]);   // (a timed card may buzz once at Dad's Mark! first)
    const n0 = (await state(page)).answered;
    await page.locator('.mob-actions [data-action=next]').click();
    await toDecision(page);
    expect((await state(page)).answered).toBe(n0);
    await page.locator('.mob-quit').click();
    await page.locator('[data-testid=desk-mode]').click();
    await expect(page).toHaveURL(/mode=desk/);
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.card.playable').first()).toBeVisible();
    await page.locator('#nav-phone').click();
    await expect(page.locator('[data-screen=home]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('MOB-052 a speed-change or timed-start card shows the sign arriving: the bar shrinks to zero and Dad says Mark! at the sign', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?mode=mobile#/m/play/skill/stayOnTime');
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) {
      const st = await state(page);
      if (st.screen === 'recap') { await page.goto('/?mode=mobile#/m/play/skill/stayOnTime'); continue; }
      const t = st.timing as { signSeconds?: number } | null;
      if (st.phase === 'decision' && t?.signSeconds) {
        const bar = page.locator('[data-testid=sign-bar]'); await expect(bar).toBeVisible();
        await expect(page.locator('[data-testid=mark]')).toHaveText('');
        const w0 = await page.locator('.msign-fill').evaluate(e => (e as HTMLElement).getBoundingClientRect().width);
        await page.waitForFunction(x => (window as unknown as W).__rally.decision.elapsed() >= x + 0.1, t.signSeconds, { polling: 'raf', timeout: 60_000 });
        await expect(page.locator('[data-testid=mark]')).toHaveText('Mark!');
        expect(await page.locator('.msign-fill').evaluate(e => (e as HTMLElement).getBoundingClientRect().width)).toBeLessThan(Math.max(2, w0 * 0.05));
        await expect(page.locator('.msign-ft')).toHaveText('0 ft');
        seen = true;
      }
      await step(page);
    }
    expect(seen).toBe(true);
  });

  test('MOB-058 a restart card shows the time of day as the big digits', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?mode=mobile#/m/play/skill/startOnTime');
    let seen = false;
    for (let i = 0; i < 30 && !seen; i++) {
      const st = await state(page);
      if (st.screen === 'recap') break;
      if (st.phase === 'decision' && st.kind === 'restart') {
        const big = page.locator('.mw-tod.mw-big'); await expect(big).toHaveText(/^TOD \d{1,2}:\d\d:\d\d$/);
        const fs = async (sel: string): Promise<number> => page.locator(sel).evaluate(e => parseFloat(getComputedStyle(e).fontSize));
        expect(await fs('.mw-tod.mw-big')).toBeGreaterThan(await fs('[data-testid=watch-digits]'));
        seen = true;
      }
      await step(page);
    }
    expect(seen).toBe(true);
  });

  test('MOB-060 with an unfinished run Continue is the primary button, and starting another run asks first', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/?mode=mobile#/m/play/practice');
    let answered = 0; while (answered < 1) { if ((await step(page)) === 'decision') answered++; }
    await page.locator('.mob-actions [data-action=next]').click();
    await toDecision(page);
    const at = await state(page);
    await page.locator('.mob-quit').click();
    await expect(page.locator('[data-testid=continue]')).toHaveClass(/primary/);
    await expect(page.locator('[data-testid=play-daily]')).not.toHaveClass(/primary/);
    const c = (await page.locator('[data-testid=continue]').boundingBox())!, d = (await page.locator('[data-testid=play-daily]').boundingBox())!;
    expect(c.y).toBeLessThan(d.y);
    await page.locator('[data-testid=play-daily]').click();
    await expect(page.locator('[data-screen=confirm]')).toBeVisible();
    await page.locator('[data-testid=keep-run]').click();
    await toDecision(page);
    expect((await state(page)).id).toBe(at.id);
    await page.locator('.mob-quit').click();
    await page.locator('[data-testid=play-daily]').click();
    await page.locator('[data-testid=start-over]').click();
    await toDecision(page);
    expect((await state(page)).answered).toBe(0);
    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1')!).unfinished);
    expect(u === null || u.plan.mode === 'daily').toBe(true);
  });
});
