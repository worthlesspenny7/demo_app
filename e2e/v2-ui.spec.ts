// UI V2 (GRIID book, charts, TA point screen, restart cards, scorecard, digital watch): e2e on a generated day stage.
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { allDrills } from '../src/core/drills/index.js';
import { formatClock } from '../src/core/units.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY, LAST_KEY } from '../src/ui/viewmodels/resume.js';

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
  for (const sym of ['warmup', 'calibration', 'transit-end', 'end-timed', 'finish']) expect(await page.locator(`#book svg[data-sym="${sym}"]`).count()).toBeGreaterThan(0);
  expect(await page.locator('#book .gc .cbox').count()).toBeGreaterThan(0);
  expect(await page.locator('#book .gc .cbox.cstart .asterisk').count()).toBeGreaterThan(0);   // the calibration start: the box with its dot (GRIID-002)
  expect(await page.locator('#book svg[data-sym="ta"]').count()).toBe(0);                      // no Column B symbol for the TA row (GRIID-013)
  // page breaks laid out by content (GRIID-014); the Time Allowance row is one rounded yellow box and the watch faces sit in Column C
  await expect(page.locator('#book .page-break').first()).toContainText(/Page 2 of \d+/);
  await expect(page.locator('#book .row.ta-row .tabanner').first()).toContainText(/Within 15m00s/);
  expect(await page.locator('#book .row.ta-row .gb').count()).toBe(0);
  expect(await page.locator('#book .gc .cicons svg[data-sym="restart"]').count()).toBeGreaterThan(0); expect(await page.locator('#book .gc .cicons svg[data-sym="end-timed"]').count()).toBeGreaterThan(0);
  expect(await page.locator('#book .gb svg[data-sym="end-timed"]').count()).toBe(0);
});

test('UI-029 GRIID-014 GRIID-018 the printable book route lays pages out by content (5 to 10 rows), 6 / 7 / 8 on request, with the three-block footer and no page header', async ({ page }) => {
  await page.goto('/#/book/builtin/stage/1');
  await expect(page.locator('.book-sheet').first()).toBeVisible();
  const sheets = await page.locator('.book-sheet').count(); const total = await page.locator('.book-sheet .grow').count();
  const counts = await page.locator('.book-sheet').evaluateAll(els => els.map(e => e.querySelectorAll('.grow').length));
  expect(counts.slice(0, -1).every(n => n >= 5 && n <= 10)).toBe(true); expect(new Set(counts).size).toBeGreaterThan(1);     // content-driven: the pages do not all carry the same count
  await expect(page.locator('.book-sheet').first().locator('.sheet-foot')).toContainText(`Page 1 of ${sheets}`);
  await expect(page.locator('.book-sheet').first().locator('.sheet-foot')).toContainText('Hemmings Motor News Great Race');
  await expect(page.locator('.book-sheet').first().locator('.sheet-foot')).toContainText(/\u00a9 \d{4}, Great Race/);
  expect(await page.locator('.sheet-head').count()).toBe(0);                                                                // no page header
  await page.locator('#rows-per-page').selectOption('7');
  expect(await page.locator('.book-sheet').count()).toBe(Math.ceil(total / 7)); expect(await page.locator('.book-sheet').first().locator('.grow').count()).toBe(7);
  await page.locator('#rows-per-page').selectOption('8');
  expect(await page.locator('.book-sheet').count()).toBe(Math.ceil(total / 8)); expect(await page.locator('.book-sheet').first().locator('.grow').count()).toBe(8);
  await expect(page.locator('.book-sheet').first().locator('.sheet-foot')).toContainText(`Page 1 of ${Math.ceil(total / 8)}`);
  await expect(page.locator('.book-sheet .grow.ta-row .tabanner').first()).toBeVisible();   // GRIID-013: one rounded yellow box
  await expect(page.locator('.book-sheet').nth(1).locator('.sheet-foot')).toContainText('Day stage 1');
  await expect(page.locator('.book-sheet .grow .gc').first()).toContainText('CDT');         // the zone label over the watch (GRIID-010)
  expect(await page.locator('.book-sheet .grow .gc svg[data-sym="restart"] text').first().textContent()).toBe('8:00:00');   // the time inside the watch
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
  expect(await page.locator('#chart-accel tbody tr:first-child th').nth(1).innerText()).toBe('0');   // acceleration chart includes the 0 row
  await expect(page.locator('#chart-accel th.axis-side')).toHaveText('BRAKING'); await expect(page.locator('#chart-accel th.axis-top')).toHaveText('ACCELERATION');   // CHART-001: the printed axis labels
  await expect(page.locator('#chart-stopGo th.axis-side')).toHaveText('IN speed'); await expect(page.locator('#chart-stopGo th.axis-top')).toHaveText('OUT speed');
  expect(await page.locator('#chart-accel td.blank').count()).toBeGreaterThanOrEqual(10);        // the grey blank diagonal
  await expect(page.locator('#chart-stopGo')).toContainText('(START/STOP TIME)-(accel IN + accel OUT)');   // the sheet\'s footnote, verbatim
  expect(await page.locator('#chart-stopGo td.cur').count()).toBe(1);                                // the current pair
  await page.keyboard.press('Escape');
  await expect(page.locator('#charts-overlay')).toBeHidden();
});

test('UI-031 the TA form appears at a TA point on a generated day stage and the window counts down', async ({ page }) => {
  await resumeAtFirstTaWindow(page, 21);
  await expect(page.locator('#ta-panel')).toBeVisible();
  await expect(page.locator('#ta-count')).toContainText(/window 1[45]:\d\d left/);
  const first = await page.locator('#ta-count').innerText();
  await page.evaluate(() => window.__rally!.advance(65));
  const later = await page.locator('#ta-count').innerText();
  const secs = (t: string): number => { const m = /(\d+):(\d\d)/.exec(t)!; return Number(m[1]) * 60 + Number(m[2]); };
  expect(secs(first) - secs(later)).toBeGreaterThanOrEqual(60);                                      // counting down in sim time
  expect(await page.locator('#ta-legs tbody tr').count()).toBeGreaterThanOrEqual(2);                // leg list from sim.taAdvice
  // the form: leg 3 carries a measured delay (TAF-002: stopped time + the chart stop-and-go loss), the suggestion fills the request, the live rounding shows the adjustment
  const adv = await page.evaluate(() => { const a = window.__rally!.sim.taAdvice(3); return { measured: a.measuredDelay, recoverable: a.recoverable, suggested: a.suggested }; });
  const mmss = (x: number): string => `${Math.floor(Math.round(x) / 60)}m${String(Math.round(x) % 60).padStart(2, '0')}s`;
  expect(adv.suggested).toBeGreaterThan(0);
  await expect(page.locator('#ta-leg')).toHaveValue('3');
  // TAF-001: the web form is the 2026 page: the login first (Car Number, Password, Phone Number), then Stage, Leg Number, Between Instructions a & b, Allowance m s, Reason
  await page.locator('#ta-car').fill('99'); await page.locator('#ta-password').fill('1234'); await page.locator('#ta-phone').fill('555-0100'); await page.locator('#ta-login').click();
  await expect(page.locator('#ta-entry-screen')).toBeVisible();
  await expect(page.locator('#ta-min')).toHaveValue(String(Math.floor(adv.suggested / 60))); await expect(page.locator('#ta-sec')).toHaveValue(String(adv.suggested % 60));
  await page.locator('#ta-min').fill(String(Math.floor((adv.suggested + 7) / 60))); await page.locator('#ta-sec').fill(String((adv.suggested + 7) % 60));
  await expect(page.locator('#ta-round')).toContainText(new RegExp(`${mmss(adv.suggested + 7)} adjusted to \\d+m\\d0s`));
  await page.locator('#ta-min').fill(String(Math.floor(adv.suggested / 60))); await page.locator('#ta-sec').fill(String(adv.suggested % 60));
  await page.locator('#ta-cause').fill('Delayed by a farm tractor');
  await expect(page.locator('#ta-pattern')).toContainText(`Delayed ${mmss(adv.measured)} by a farm tractor. Made up ${mmss(adv.recoverable)}. Request ${mmss(adv.suggested)}.`);
  await page.locator('#ta-submit').click();
  await page.locator('#ta-see').click();                                                              // the yellow "CLICK to see Time Allowances Submitted"
  await expect(page.locator('#ta-filed')).toContainText(`Leg 3: ${mmss(adv.suggested)}`);
  const filed = await page.evaluate(() => window.__rally!.observe().ta.requests);
  expect(filed.length).toBe(1); expect(filed[0]!.adjusted).toBe(adv.suggested); expect(filed[0]!.status).toBe('filed');
  await page.evaluate(() => window.__rally!.advance(900));
  await expect(page.locator('#ta-panel')).toBeHidden();                                              // the window closed
});

test('REG-008 LESSON-007 the reference page: phones only for emergencies and Time Allowance Requests (II.H.1.i), the clock has no digital readout (II.H.1.d(1)), lights are not a TA delay, TA goes in by the method the day\'s instructions print', async ({ page }) => {
  await page.goto('/#/reference');
  const body = page.locator('body'); await expect(body).toContainText('II.H.1.i'); await expect(body).toContainText('only for emergencies');
  await expect(body).toContainText('II.H.1.d(1)'); await expect(body).toContainText('II.H.1.d(3)');
  await expect(body).not.toContainText('calculators and phones prohibited'); await expect(body).not.toContainText('A red light may qualify');
  await expect(body).toContainText('does not name traffic lights'); await expect(body).toContainText('web page, phone, or at the Observation Checkpoint');
  await expect(body).toContainText('Simulator convention, not in the documents');
});

test('UI-036 the TA form fits at 1366 x 800: every "Use" button lies inside the panel and the viewport, and the panel has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await resumeAtFirstTaWindow(page, 21);
  await expect(page.locator('#ta-panel')).toBeVisible();
  const m = await page.evaluate(() => {
    const p = document.querySelector('#ta-panel') as HTMLElement; const pr = p.getBoundingClientRect();
    const btns = [...p.querySelectorAll('#ta-legs button[data-leg]')].map(b => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; });
    return { panel: { l: pr.left, r: pr.right, scroll: p.scrollWidth, client: p.clientWidth }, btns, vw: window.innerWidth };
  });
  expect(m.btns.length).toBeGreaterThanOrEqual(2);
  for (const b of m.btns) { expect(b.w).toBeGreaterThan(20); expect(b.l).toBeGreaterThanOrEqual(m.panel.l); expect(b.r).toBeLessThanOrEqual(m.panel.r - 2); expect(b.r).toBeLessThanOrEqual(m.vw); }
  expect(m.panel.scroll).toBeLessThanOrEqual(m.panel.client + 1);
  await page.locator('#ta-legs button[data-leg]').last().click();                                  // and the button works
  await expect(page.locator('#ta-leg')).toHaveValue(String(m.btns.length));
});

test('UI-032 the cockpit shows the restart card (base + ASP = your time), the exact-transit card and the promoted-stop card', async ({ page }) => {
  await openStage(page, 1);
  const lines = await page.evaluate(() => { const b = window.__rally!.observe().book; return { restart: b.find(i => i.section === 'restart')!.n, transit: b.find(i => i.transit?.exact && !i.transit.end && i.section !== 'start' && i.section !== 'warmup')?.n ?? null, promoted: b.find(i => i.promotedStop)?.n ?? null }; });
  await depart(page);
  await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.restart);
  await expect(page.locator('#holdcard')).toContainText(/base \d\d:\d\d:\d\d \+ ASP \d+ min = your time \d\d:\d\d:\d\d: launch on the count \(your time minus the standing-start loss\), do not pull up before your minute/);   // PLAY-032: wording
  if (lines.transit !== null) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.transit); await expect(page.locator('#holdcard')).toContainText(/IN .* \+ \d+m00s = OUT|IN \(read the clock/); }
  if (lines.promoted !== null) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.promoted); await expect(page.locator('#holdcard')).toContainText(/leave AT (\d\d:\d\d:\d\d \(not before \d\d:\d\d:\d\d - 5 min penalty window; )?\d+m00s prior to (your )?end/); }
});

test('UI-032 the exact-transit card shows the recorded IN time: IN hh:mm:ss + 20m00s = OUT hh:mm:ss (D16, resumed after the car crossed the IN sign)', async ({ page }) => {
  const sc = allDrills().find(d => d.id === 'D16')!.scenario(1, 0);
  const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  const begin = sc.book.find(i => i.transit?.exact && !i.transit.end)!; const end = sc.book.find(i => i.transit?.end && i.transit.exact)!;
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && sim.transitIn[begin.n] === undefined; n++) { bot.onTick(); sim.step(0.1); }
  const inT = sim.transitIn[begin.n]; expect(inT).toBeDefined();
  const stored = snapshotRun(sim, { kind: 'drill', drillId: 'D16', tier: 0, seed: 1 }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/');
  await page.locator('#resume').click();
  await expect(page.locator('#cockpit')).toBeVisible();
  await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), end.n);
  await expect(page.locator('#holdcard')).toContainText(`IN ${formatClock(inT!)} + 20m00s = OUT ${formatClock(inT! + 1200)}`);
  await expect(page.locator('#holdcard')).not.toContainText('read the clock');
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

test('UI-035 the debrief of a full day stays under 4000 px at 1366 wide: summary, scorecard and headline tip open, per-leg attribution, stop detail and replays collapsed', async ({ page }) => {
  const sim = new Simulator(generateStage(1), { watch: 'digital' }); runBot(sim, new OracleBot(sim, { useWatch: true })); expect(sim.phase).toBe('finished');
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed: 1 }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LAST_KEY, JSON.stringify(stored)]);
  await page.goto('/#/debrief');
  await expect(page.locator('#debrief')).toBeVisible();
  await expect(page.locator('#tip')).toBeVisible(); await expect(page.locator('#scorecard')).toBeVisible();
  for (const id of ['attribution', 'worked', 'counterfactuals']) { await expect(page.locator(`details#${id}`)).toBeVisible(); expect(await page.locator(`details#${id}`).getAttribute('open')).toBeNull(); }
  await expect(page.locator('#counterfactuals .cf-row').first()).toBeAttached({ timeout: 30000 });   // the replays still run, folded
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(h, `debrief height ${h}px`).toBeLessThan(4000);
  await page.locator('details#worked > summary').click(); await expect(page.locator('#worked li').first()).toBeVisible();   // one click opens the stop detail
  await page.locator('details#attribution > summary').click(); await expect(page.locator('#attribution .bar-row').first()).toBeVisible();
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

test('UI-033 REG-007 the cockpit honours Settings.watch (digital by default, analog on request); the dash clock is always analog with no digital readout (REG II.H.1.d(1))', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.locator('select')).toHaveCount(6);                  // stopwatch, time scale, driver, theme, dash clock face (Sawtooth / bezel, INST-003), performance card (CHART-007): the clock is never digital
  await expect(page.locator('#clock-note')).toContainText('II.H.1.d(1)');
  await expect(page.locator('body')).not.toContainText('Digital readout');
  await openStage(page, 1);
  await expect(page.locator('div#stopwatch.dwatch')).toBeVisible();
  await expect(page.locator('canvas#clock')).toBeVisible();
  await expect(page.locator('.dclock')).toHaveCount(0);
  await expect(page.locator('#tod')).toHaveCount(0);
  expect(await page.locator('.instruments .caption').first().innerText()).not.toMatch(/\d\d:\d\d:\d\d\s*·/);   // no time of day under the dial, only the printed official start
  await page.goto('/#/settings');
  await page.locator('select').first().selectOption('analog');
  await openStage(page, 1);
  await expect(page.locator('canvas#stopwatch')).toBeVisible();
  await expect(page.locator('canvas#clock')).toBeVisible();
  await expect(page.locator('.dclock')).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
});
