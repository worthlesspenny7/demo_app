// UI fix sprint: first-run clarity, stop card, legal mode, layout, resilience, D07 controls, quiz keys.
import { test, expect, type Page } from '@playwright/test';

async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function depart(page: Page): Promise<void> {
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
}

test('C2 no false storage banner on a direct load; Home shows Start here', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.locator('h1')).toHaveText('Settings');
  await expect(page.locator('#navnote')).toHaveText('');
  await page.goto('/#/');
  await expect(page.locator('#starthere-panel')).toBeVisible();
  await expect(page.locator('#starthere-panel li.current')).toContainText(/ghost car/i);
  await expect(page.locator('.card[data-drill="D03"] .pips .tier.gold')).toBeVisible();
});

test('C3/C4 HUD buttons work above the pre-read; the lapboard note blurs on Enter so Space works', async ({ page }) => {
  await openDrill(page, 'D01');
  await expect(page.locator('#preread')).toBeVisible();
  await expect(page.locator('#preread')).toContainText(/Objective/);
  await expect(page.locator('#preread')).toContainText(/front bumper/);   // D01-specific text
  await expect(page.locator('#hintbar')).toContainText(/Lap the watch/);
  await page.locator('#pause').click({ timeout: 3000 });   // would time out when the overlay covers the HUD
  await expect(page.locator('#pause')).toHaveText('Resume'); await page.locator('#pause').click();
  await expect(page.locator('button[data-scale="4"]')).toBeDisabled();   // D01 is locked to 1x (N8)
  await depart(page);
  const note = page.locator('.lapboard input[placeholder^="note"]');
  await note.click(); await note.fill('k = 1.01'); await page.keyboard.press('Enter');
  await expect(note).not.toBeFocused();
  await page.keyboard.press(' ');
  expect(await page.evaluate(() => window.__rally!.observe().stopwatch.running)).toBe(true);
});

test('C1/W1 at a STOP the book and perf card show the stopped line, with the turn-capped dwell and the wait', async ({ page }) => {
  await openDrill(page, 'D03');
  await depart(page);
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 600 && r.observe().stoppedAtLine === null; i++) r.advance(1); });
  const line = await page.evaluate(() => window.__rally!.observe().stoppedAtLine);
  expect(line).not.toBeNull();
  await expect(page.locator('#perfcard')).toContainText(`Stopped: line ${line}`);
  await expect(page.locator('#perfcard')).toContainText(/turn capped at 12 mph/);
  await expect(page.locator('#perfcard')).toContainText(/more s|go now/);
  await expect(page.locator(`#book .row.stopped[data-n="${line}"]`)).toBeVisible();
  // the strip, the card and the Debrief agree: card dwell == pause - turn-capped loss
  const strip = await page.locator(`#book .row[data-n="${line}"] .ann`).innerText();
  const card = await page.locator('#perfcard').innerText();
  const m = /card ([0-9.]+) s/.exec(strip); const d = /dwell\s+([0-9.]+)\s+s after/.exec(card);
  expect(m && d && m[1] === d[1]).toBeTruthy();
});

test('legal mode (rung <= 1) hides digital readouts and the computed card; Bronze keeps them', async ({ page }) => {
  await openDrill(page, 'D18', 2);   // Gold, rung 0
  await expect(page.locator('#tod')).toBeHidden();
  await depart(page);
  await page.evaluate(() => window.__rally!.advance(5));
  await expect(page.locator('#perfcard')).toContainText(/Legal mode/);
  await expect(page.locator('#book')).not.toContainText(/card [0-9.]+ s/);
  const caps = await page.locator('.instruments .caption').allInnerTexts();
  expect(caps[0]).toMatch(/^official start/);              // clock: no digital readout
  expect(caps.join(' ')).not.toMatch(/\bmph\b/);              // speedo: no number
  expect(caps.join(' ')).not.toMatch(/to go/);              // bezel countdown number
  await openDrill(page, 'D03', 0);
  await expect(page.locator('#tod')).toBeVisible();
});

test('digital watch renders a digital readout', async ({ page }) => {
  await page.goto('/#/settings');
  await page.locator('select').first().selectOption('digital');
  await openDrill(page, 'D18', 2);
  await expect(page.locator('#lcd')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
});

test('K1 1280x720 has no overflow and no overlap; resizing re-lays the cockpit out live', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDrill(page, 'D03');
  await depart(page);
  await page.evaluate(() => window.__rally!.advance(3));
  const check = async (): Promise<void> => {
    const r = await page.evaluate(() => {
      const se = document.scrollingElement!;
      const box = (s: string) => { const b = document.querySelector(s)!.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      return { sh: se.scrollHeight, ih: window.innerHeight, sw: se.scrollWidth, iw: window.innerWidth, road: box('.road'), inst: box('.instruments'), sw2: box('#stopwatch'), book: box('.book'), left: box('.left'), drawer: box('.drawer'), clock: box('#clock'), speedo: box('#speedo') };
    });
    expect(r.sh).toBeLessThanOrEqual(r.ih); expect(r.sw).toBeLessThanOrEqual(r.iw);
    expect(r.sw2.t).toBeGreaterThanOrEqual(r.inst.t - 1); expect(r.sw2.b).toBeLessThanOrEqual(r.inst.b + 1);
    expect(r.clock.r).toBeLessThanOrEqual(r.sw2.l + 1); expect(r.sw2.r).toBeLessThanOrEqual(r.speedo.l + 1);
    expect(r.left.r).toBeLessThanOrEqual(r.book.l + 1);
    expect(r.inst.b).toBeLessThanOrEqual(r.drawer.t + 1);
  };
  await check();
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(300); await check();
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(300); await check();
});

test('K2 light theme: HUD chips stay readable; flash is not a square', async ({ page }) => {
  await page.goto('/#/settings');
  await page.locator('select').nth(3).selectOption('light');
  await openDrill(page, 'D03');
  const c = await page.evaluate(() => { const e = document.querySelector('#phase')!; const cs = getComputedStyle(e); return { color: cs.color, bg: cs.backgroundColor }; });
  expect(c.bg).toMatch(/rgba?\(20, 26, 34/);
  expect(c.color).not.toBe('rgb(27, 32, 40)');
  await page.evaluate(() => localStorage.clear());
});

test('C7 an ended run is shown but not recorded', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await openDrill(page, 'D03');
  await depart(page);
  await page.evaluate(() => window.__rally!.advance(20));
  await page.locator('#abort').click();
  await expect(page.locator('#debrief')).toBeVisible();
  await expect(page.locator('#aborted')).toBeVisible();
  await page.goto('/#/');
  expect(await page.locator('#lastruns').count()).toBe(0);
  await expect(page.locator('.card[data-drill="D03"]')).toContainText('not yet played');
});

test('resilience: live run is saved, Home offers Resume, replay restores the same tick; Debrief survives a reload', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await openDrill(page, 'D03');
  await depart(page);
  await page.keyboard.press(' ');
  await page.evaluate(() => window.__rally!.advance(40));
  await page.goto('/#/');              // leaving the cockpit saves the run
  const before = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('rally-trainer.live-run.v1')!); return { tick: v.tick as number, actions: v.actions.length as number }; });
  expect(before.tick).toBeGreaterThan(400);
  await expect(page.locator('#resume-panel')).toBeVisible();
  await page.locator('#resume').click();
  await expect(page.locator('#cockpit')).toBeVisible();
  const after = await page.evaluate(() => ({ tick: window.__rally!.sim.tick, tod: window.__rally!.observe().tod, running: window.__rally!.observe().stopwatch.running }));
  expect(after.tick).toBe(before.tick);
  expect(after.running).toBe(true);
  // finish a tiny built-in, reload on the Debrief
  await page.goto('/#/cockpit/builtin/straight/1');
  await depart(page);
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 400 && r.sim.phase !== 'finished'; i++) { const o = r.observe(); if (o.driver.waitingForGo) r.act({ type: 'call.go' }); r.advance(1); } });
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.locator('#debrief')).toBeVisible();
  await expect(page.locator('#cp-table tbody tr').first()).toBeVisible();
});

test('D07 cockpit controls set the Timewise factor and the cheat card', async ({ page }) => {
  await openDrill(page, 'D07', 0);
  await expect(page.locator('#calbox')).toBeVisible();
  await page.locator('#cal-k').fill('1.012');
  await page.locator('#cal-setk').click();
  expect(await page.evaluate(() => window.__rally!.sim.speedo.userFactor)).toBeCloseTo(1.012, 5);
  await page.locator('#calbox input[data-v="50"]').fill('48.6');
  await page.locator('#cal-setcard').click();
  const card = await page.evaluate(() => window.__rally!.sim.card);
  expect(card['50']).toBeCloseTo(48.6, 5);
});

test('D09 quiz: 20 distinct cards, answerable with the keyboard; D14 options are distinct', async ({ page }) => {
  await page.goto('/#/quiz/D09');
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    seen.add(await page.locator('.panel p').first().innerText());
    await page.keyboard.press('1');
    await expect(page.locator('#quiz-next')).toBeVisible();
    await page.keyboard.press('Enter');
  }
  expect(seen.size).toBe(20);
  await expect(page.locator('h2')).toContainText(/\/ 20 correct/);
  await page.goto('/#/math/D14');
  for (let i = 0; i < 20; i++) {
    const opts = await page.locator('.opt').allInnerTexts();
    expect(new Set(opts).size).toBe(opts.length);
    await page.keyboard.press('1'); await page.keyboard.press('Enter');
  }
});

test('C9 a live run warns before unload; at rung >= 1 the book follows the driver check-off', async ({ page }) => {
  await openDrill(page, 'D18', 0);     // Bronze at D18 is rung 1: no engine auto-advance
  await depart(page);
  await page.keyboard.press(' ');      // user activation so Chromium shows the beforeunload dialog
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.type()); void d.accept(); });
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 400 && r.observe().driver.lastExecutedLine === null; i++) r.advance(1); r.advance(0.5); });
  const o = await page.evaluate(() => { const o = window.__rally!.observe(); return { le: o.driver.lastExecutedLine, cur: o.currentLine }; });
  expect(o.le).not.toBeNull();
  expect(o.cur).toBe(o.le! + 1);
  await page.reload();
  expect(dialogs).toContain('beforeunload');
});
