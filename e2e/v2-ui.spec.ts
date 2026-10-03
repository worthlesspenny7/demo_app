// UI V2 (GRIID book, charts, TA point screen, restart cards, scorecard, digital watch): e2e on a generated day stage.
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';

async function openStage(page: Page, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/builtin/stage/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function depart(page: Page): Promise<void> {
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
}

/** Drive the generated stage with the oracle bot in Node until the first TA window opens, and hand the page that run as its saved live run. */
async function resumeAtFirstTaWindow(page: Page, seed: number): Promise<void> {
  const sim = new Simulator(generateStage(seed), { watch: 'digital' });
  const bot = new OracleBot(sim);
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && !sim.taState().windowOpen; n++) { bot.onTick(); sim.step(0.1); }
  expect(sim.taState().windowOpen).toBe(true);
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/');
  await page.locator('#resume').click();
  await expect(page.locator('#cockpit')).toBeVisible();
}

test('UI-029 a GRIID row shows 0 MPH / 0m15s stacked and an hourglass with odometer digits on a generated stage', async ({ page }) => {
  await openStage(page, 1);
  const pause = page.locator('#book .row .gc').filter({ hasText: '0m15s' }).first();
  const lines = await pause.locator('.cl').allInnerTexts();
  expect(lines.slice(0, 2)).toEqual(['0 MPH', '0m15s']);                          // stacked, one per line (Column C)
  expect(lines[2]).toMatch(/^\d+ MPH$/);
  await expect(page.locator('#book')).not.toContainText(/\bP15\b|for \d+:\d\d then/);   // the old notation is gone
  const hour = page.locator('#book .bsym:has(svg[data-sym="transit-begin"]):has(.odo)').first();      // the hourglass with its odometer box
  await expect(hour).toHaveCount(1);
  expect(await hour.locator('.odo').getAttribute('data-odo')).toMatch(/^\d{4}$/);     // the 4-digit tenths-of-a-mile box
  expect(await hour.locator('.odo i').count()).toBe(4);
  // the other Column B pictograms and the calibration box / asterisk exist on this stage
  for (const sym of ['warmup', 'calibration', 'transit-end', 'end-timed', 'ta', 'finish']) expect(await page.locator(`#book svg[data-sym="${sym}"]`).count()).toBeGreaterThan(0);
  expect(await page.locator('#book .gc .cbox').count()).toBeGreaterThan(0);
  expect(await page.locator('#book .gc .asterisk').count()).toBeGreaterThan(0);
  // page breaks every 6 rows
  await expect(page.locator('#book .page-break').first()).toContainText(/Page 2 of 33/);
});

test('UI-029 the printable book route shows six rows a page with "Page n of m" and the stage title', async ({ page }) => {
  await page.goto('/#/book/builtin/stage/1');
  await expect(page.locator('.book-sheet').first()).toBeVisible();
  expect(await page.locator('.book-sheet').count()).toBe(33);
  expect(await page.locator('.book-sheet').first().locator('.grow').count()).toBe(6);
  await expect(page.locator('.book-sheet').first().locator('.sheet-foot')).toContainText('Page 1 of 33');
  await expect(page.locator('.book-sheet').nth(1).locator('.sheet-head')).toContainText('fullStage #1');
  const colC = await page.locator('.book-sheet .grow .gc').first().innerText();
  expect(colC).toMatch(/CDT 8:00:00/);
});

test('UI-030 the charts overlay shows the three IN x OUT grids (accel includes 0) with the current pair highlighted; the stop card reads chart (b)', async ({ page }) => {
  await openStage(page, 1);
  await depart(page);
  const stopLine = await page.evaluate(() => { const r = window.__rally!; const b = r.observe().book; const n = b.find(i => i.pause && (!i.turn || i.turn === 'S'))!.n; r.act({ type: 'line.set', n }); return n; });
  expect(stopLine).toBeGreaterThan(1);
  await expect(page.locator('#chartline')).toContainText(/Chart \(b\) Stop & Go: \d+ in \/ \d+ out = sit [0-9.]+ s for a 15 s stop/);
  await page.locator('#view').focus();
  await page.keyboard.press('c');
  await expect(page.locator('#charts-overlay')).toBeVisible();
  for (const id of ['accel', 'stopGo', 'turns']) await expect(page.locator(`#chart-${id} table`)).toBeVisible();
  expect(await page.locator('#chart-accel tbody tr th').first().innerText()).toBe('0');            // acceleration chart includes the 0 row
  expect(await page.locator('#chart-stopGo td.cur').count()).toBe(1);                                // the current pair
  await page.keyboard.press('Escape');
  await expect(page.locator('#charts-overlay')).toBeHidden();
});

test('UI-031 the TA form appears at a TA point on a generated day stage and the window counts down', async ({ page }) => {
  await resumeAtFirstTaWindow(page, 6);
  await expect(page.locator('#ta-panel')).toBeVisible();
  await expect(page.locator('#ta-count')).toContainText(/window 1[45]:\d\d left/);
  const first = await page.locator('#ta-count').innerText();
  await page.evaluate(() => window.__rally!.advance(65));
  const later = await page.locator('#ta-count').innerText();
  const secs = (t: string): number => { const m = /(\d+):(\d\d)/.exec(t)!; return Number(m[1]) * 60 + Number(m[2]); };
  expect(secs(first) - secs(later)).toBeGreaterThanOrEqual(60);                                      // counting down in sim time
  expect(await page.locator('#ta-legs tbody tr').count()).toBeGreaterThanOrEqual(2);                // leg list from sim.taAdvice
  // the form: leg 3 carries a measured delay, the suggestion fills the request, the live rounding shows the adjustment
  await expect(page.locator('#ta-leg')).toHaveValue('3');
  await expect(page.locator('#ta-request')).toHaveValue('50');
  await page.locator('#ta-request').fill('47');
  await expect(page.locator('#ta-round')).toContainText(/0m47s adjusted to 0m[45]0s/);
  await page.locator('#ta-request').fill('50');
  await page.locator('#ta-cause').fill('a farm tractor');
  await expect(page.locator('#ta-pattern')).toContainText(/Delayed 1m29s by a farm tractor\. Made up 0m29s\. Request 0m50s\./);
  await page.locator('#ta-submit').click();
  await expect(page.locator('#ta-filed')).toContainText(/Leg 3: 0m50s/);
  const filed = await page.evaluate(() => window.__rally!.observe().ta.requests);
  expect(filed.length).toBe(1); expect(filed[0]!.adjusted).toBe(50); expect(filed[0]!.status).toBe('filed');
  await page.evaluate(() => window.__rally!.advance(900));
  await expect(page.locator('#ta-panel')).toBeHidden();                                              // the window closed
});

test('UI-032 the cockpit shows the restart card (base + ASP = your time), the exact-transit card and the promoted-stop card', async ({ page }) => {
  await openStage(page, 1);
  const lines = await page.evaluate(() => { const b = window.__rally!.observe().book; return { restart: b.find(i => i.section === 'restart')!.n, transit: b.find(i => i.transit?.exact && !i.transit.end && i.section !== 'start' && i.section !== 'warmup')?.n ?? null, promoted: b.find(i => i.promotedStop)?.n ?? null }; });
  await depart(page);
  await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.restart);
  await expect(page.locator('#holdcard')).toContainText(/base \d\d:\d\d:\d\d \+ ASP \d+ min = your time \d\d:\d\d:\d\d, leave at that second, do not pull up before your minute/);
  if (lines.transit !== null) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.transit); await expect(page.locator('#holdcard')).toContainText(/IN .* \+ \d+m00s = OUT|IN \(read the clock/); }
  if (lines.promoted !== null) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.promoted); await expect(page.locator('#holdcard')).toContainText(/leave (by \d\d:\d\d:\d\d )?\(?\d+m00s\)? ?(prior to end of transit)/); }
});

test('UI-034 the debrief scorecard shows the age factor, a capped leg and the stage score to 0.01 s', async ({ page }) => {
  await page.goto('/#/cockpit/builtin/straight/1');
  await expect(page.locator('#cockpit')).toBeVisible();
  // leave three minutes late: the leg error is capped at 2m00s
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.advance(183); r.act({ type: 'start' }); r.act({ type: 'call.speed', mph: 30 }); });
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 600 && r.sim.phase !== 'finished'; i++) { const o = r.observe(); if (o.driver.waitingForGo) r.act({ type: 'call.go' }); r.advance(1); } });
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#age-factor')).toContainText('0.845 (1939)');
  const capped = page.locator('#cp-table tbody tr[data-flag="late-cap"]');
  await expect(capped).toHaveCount(1);
  await expect(capped).toContainText(/capped at 2m00s \(late\)/);
  await expect(capped.locator('td.pen').last()).toHaveText('120');
  await expect(page.locator('#caps-note')).toContainText(/capped at 2m00s, early legs at 5m00s|late legs are capped at 2m00s/i);
  await expect(page.locator('#penalty-items')).toContainText(/Observation Checkpoint crossed without the stop: \+180 s/);   // never stopped at the finish
  await expect(page.locator('#raw-score')).toContainText('300 s');                                     // 120 (capped leg) + 180
  await expect(page.locator('#stage-score')).toContainText('253.50 s');                                // 300 x 0.845, to 0.01 s
  await expect(page.locator('#instrument-discipline')).toBeVisible();
});

test('WATCH-008 the digital stopwatch: 1/100 s display, CHRONO / TOD chip, lap boxes, frozen split with auto-release, recall, keys Space/L/R/M, reset only when stopped', async ({ page }) => {
  await page.goto('/#/cockpit/drill/D03/0/1');
  await expect(page.locator('#cockpit')).toBeVisible();
  await depart(page);
  await page.locator('#view').focus();
  await expect(page.locator('#lcd')).toHaveText(/^\d+:\d\d\.\d\d$/);                                    // 1/100 s
  await expect(page.locator('#dw-mode')).toHaveText('CHRONO');
  await page.keyboard.press(' ');
  await page.evaluate(() => window.__rally!.advance(12.34));
  await page.keyboard.press('l');
  await expect(page.locator('#dw-ind')).toContainText(/SPLIT frozen, releases in [0-5]\.\d s/);          // split-frozen indicator with the countdown
  await expect(page.locator('#laps .dw-lap').first().locator('.cbox span')).toHaveCount(2);              // interval over cumulative, the calibration-box shape
  await expect(page.locator('#laps .dw-lap').first()).toContainText(/\d+m\d\d\.\ds/);
  await page.evaluate(() => window.__rally!.advance(6));
  await expect(page.locator('#dw-ind')).toHaveText('');                                                  // auto-released after splitHoldSeconds
  await page.keyboard.press('l'); await page.evaluate(() => window.__rally!.advance(1)); await page.keyboard.press('r');   // R releases the freeze
  await page.keyboard.press('r');                                                                         // R again recalls the newest lap
  await expect(page.locator('#dw-ind')).toContainText(/RECALL L2/);
  await page.keyboard.press('m');
  await expect(page.locator('#dw-mode')).toHaveText('TOD');
  await expect(page.locator('#lcd')).toHaveText(/^\d\d:\d\d:\d\d\.\d\d$/);                              // time of day
  await page.keyboard.press('m');
  await expect(page.locator('#dw-mode')).toHaveText('CHRONO');
  await expect(page.locator('#dw-reset')).toBeDisabled();                                                 // running: no reset
  await page.keyboard.press(' ');
  await expect(page.locator('#dw-reset')).toBeEnabled();
  await page.locator('#dw-reset').click();
  expect(await page.evaluate(() => window.__rally!.observe().stopwatch.laps.length)).toBe(0);
  await page.keyboard.press(' ');
  await page.keyboard.press('Shift+R');                                                                   // Shift+R forces it while running
  expect(await page.evaluate(() => window.__rally!.observe().stopwatch.reading)).toBe(0);
});

test('UI-033 the cockpit honours Settings.watch and Settings.clock (digital watch and analog clock by default; digital clock and analog watch on request)', async ({ page }) => {
  await openStage(page, 1);
  await expect(page.locator('div#stopwatch.dwatch')).toBeVisible();
  await expect(page.locator('canvas#clock')).toBeVisible();
  await page.goto('/#/settings');
  await page.locator('select').first().selectOption('analog');
  await page.locator('select').nth(4).selectOption('digital');
  await openStage(page, 1);
  await expect(page.locator('canvas#stopwatch')).toBeVisible();
  await expect(page.locator('div#clock.dclock')).toBeVisible();
  await expect(page.locator('div#clock.dclock')).toHaveText(/^\d\d:\d\d:\d\d$/);
  await page.evaluate(() => localStorage.clear());
});
