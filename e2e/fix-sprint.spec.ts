// Fix sprint PT-05 (2026-10-04): the playability fixes as the player meets them, at the laptop size Josh uses (1366x768).
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';
import { PROGRESS_KEY } from '../src/ui/viewmodels/progress.js';

async function hold(page: Page): Promise<void> { await page.locator('#pause').click(); }
async function advance(page: Page, seconds: number): Promise<void> { await page.evaluate(s => { window.__rally!.advance(s); }, seconds); }
async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> { await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`); await expect(page.locator('#cockpit')).toBeVisible(); }
/** Does the element own the pixel at its own centre (nothing drawn over it)? */
async function onTop(page: Page, sel: string): Promise<boolean> {
  return page.evaluate(s => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return false; const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === e || e.contains(hit)); }, sel);
}

test.use({ viewport: { width: 1366, height: 768 } });

test('PLAY-001 EDU-005 a Bronze star moves the Start-here path on: Next opens D03 at Bronze, and the protocol lesson leads to the D09 quiz', async ({ page }) => {
  await page.goto('/#/settings');
  const p1 = (stars: number, tiers: number[]) => ({ stars, tierStars: tiers, aces: 0, runs: 1, bestScore: 0.2, lastScore: 0.2, bestRaw: 0, lastPlayed: Date.now() });
  const read = { 'four-s': true, 'griid-cameo': true, protocol: true, lost: true, transits: true, 'ghost-car': true, 'which-timer': true, 'pause-arithmetic': true };   // PLAY-023: the path now carries which-timer and pause-arithmetic before D03
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [PROGRESS_KEY, JSON.stringify({ version: 1, drills: { D09: p1(1, [1]), D10: p1(1, [1, 0, 0]), D16: p1(1, [1, 0, 0]), D01: p1(3, [3, 0, 0]) }, lessons: read, runs: [], maneuvers: {} })]);
  await page.goto('/#/');
  await expect(page.locator('#starthere-panel li[data-step="D01"]')).toHaveClass(/done/);
  await expect(page.locator('#starthere')).toHaveText(/Next: D03 Pause arithmetic/);
  await page.locator('#starthere').click();
  await expect(page).toHaveURL(/#\/cockpit\/drill\/D03\/0\/1$/);
  await page.evaluate(([k]) => localStorage.removeItem(k!), [PROGRESS_KEY]);
  // PLAY-023: start on time (transits, which timer, ghost car, D16) comes before the course block, so those are done here
  await page.evaluate(([k]) => localStorage.setItem(k!, JSON.stringify({ version: 1, drills: { D16: { stars: 1, tierStars: [1, 0, 0], aces: 0, runs: 1, bestScore: 1, lastScore: 1, bestRaw: 1, lastPlayed: 1 } }, lessons: { 'four-s': true, transits: true, 'which-timer': true, 'ghost-car': true, 'griid-cameo': true }, runs: [], maneuvers: {} })), [PROGRESS_KEY]);
  await page.goto('/#/school/protocol'); await page.reload();
  await expect(page.locator('#next-path')).toHaveText(/Next on your path: D09/);
  await page.locator('#next-path').click(); await expect(page).toHaveURL(/#\/quiz\/D09$/);
});

test('PLAY-002 the day stage moves: with no speed printed on the warm-up the driver asks "what speed?" and the card prints the transit pace', async ({ page }) => {
  await page.goto('/#/cockpit/builtin/stage/1'); await expect(page.locator('#cockpit')).toBeVisible(); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  await advance(page, 2);
  await expect(page.locator('#driverlog')).toContainText(/What speed for the warm-up\? The book prints none: about \d+ mph/);
  await expect(page.locator('#transitpace')).toContainText(/No speed printed: call about \d+ mph \([\d.]+ mi \/ \d+ min\)/);
});

test('PLAY-003 PLAY-004 a restart hold runs at the chosen 8x until a minute before the launch; the restart count is outside the road view and fully on screen at 1366x768', async ({ page }) => {
  await openDrill(page, 'D16');
  await page.locator('button[data-scale="8"]').click(); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  // drive to the restart line (the oracle's calls, made in the page), then wait there
  const rs = await page.evaluate(() => window.__rally!.observe().book.find(i => i.section === 'restart')!.n);
  await page.evaluate(n => { const r = window.__rally!; for (let i = 0; i < 4000 && r.observe().stoppedAtLine !== n; i++) { const o = r.observe(); if (o.driver.waitingForGo && o.stoppedAtLine !== n) r.act({ type: 'call.go' }); r.advance(1); } }, rs);
  expect(await page.evaluate(() => window.__rally!.observe().stoppedAtLine)).toBe(rs);
  const left = await page.evaluate(() => { const s = window.__rally!.sim; return s.launchInfo()!.launchTime - s.tod; });
  expect(left).toBeGreaterThan(120);
  await page.locator('#pause').click();                                          // resume the loop: the hold runs at the chosen scale
  await expect(page.locator('#scale')).toHaveText(/^8x/);
  await hold(page);
  await advance(page, left - 50);                                                // inside the last minute: 1x
  await page.locator('#pause').click(); await expect(page.locator('#scale')).toHaveText(/^1x/); await hold(page);
  await advance(page, 44);                                                        // T-6: the count is running
  const count = page.locator('#start-count-road'); await expect(count).toBeVisible();
  const box = (await count.boundingBox())!; const road = (await page.locator('.road').boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(768); expect(box.x + box.width).toBeLessThanOrEqual(1366);
  expect(box.x >= road.x + road.width - 1 || box.y >= road.y + road.height - 1).toBe(true);          // not inside the road view
  expect(await onTop(page, '#start-count-road')).toBe(true);
});

test('PLAY-004 at the start the pre-read folds away 45 s before the launch so the clock and the stopwatch can be read (and it can be folded by hand)', async ({ page }) => {
  await openDrill(page, 'D16', 2); await hold(page);
  await expect(page.locator('#preread')).not.toHaveClass(/collapsed/);
  await page.locator('#preread-toggle').click(); await expect(page.locator('#preread')).toHaveClass(/collapsed/);
  await page.locator('#preread-toggle').click(); await expect(page.locator('#preread')).not.toHaveClass(/collapsed/);
  await page.reload(); await expect(page.locator('#cockpit')).toBeVisible(); await hold(page);
  const L = await page.evaluate(() => { const s = window.__rally!.sim; return s.launchInfo()!.launchTime - s.tod; });
  await advance(page, L - 10);
  await expect(page.locator('#preread')).toHaveClass(/collapsed/);
  expect(await onTop(page, '#clock')).toBe(true); expect(await onTop(page, '#stopwatch')).toBe(true);
  await expect(page.locator('#preread-toggle')).toBeVisible(); await expect(page.locator('#preread-toggle')).toHaveText('Show the pre-read');   // the strip keeps the toggle and the buttons
});

test('PLAY-005 D01 has a drill-sized start: no queue, no count, the car launches itself on the printed second', async ({ page }) => {
  await openDrill(page, 'D01'); await hold(page);
  await expect(page.locator('#skip')).toHaveText('Fast-forward to the launch'); await expect(page.locator('#skip')).toHaveClass(/primary/);
  await expect(page.locator('#pull-up')).toHaveCount(0); await expect(page.locator('#warn-driver')).toHaveCount(0);
  await expect(page.locator('#preread')).toContainText(/launches itself/);
  await page.locator('#skip').click();
  await advance(page, 6);
  expect(await page.evaluate(() => window.__rally!.observe().phase)).toBe('running');
  expect(await page.evaluate(() => window.__rally!.result().startDeltas[0]!.auto)).toBe('drill');
});

test('PLAY-010 Discard asks first, and at the end-of-stage TA point the red Done button is pinned at the top of the form', async ({ page }) => {
  const sim = new Simulator(generateStage(6), { watch: 'digital' }); const bot = new OracleBot(sim);
  for (let n = 0; n < 3_000_000 && sim.phase !== 'finished'; n++) { bot.onTick(); sim.step(0.1); const t = sim.taState(); if (t.windowOpen && t.endOfStage && !sim.scorecardAcked) break; }
  expect(sim.taState().endOfStage).toBe(true);
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed: 6 }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings'); await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/');
  page.once('dialog', d => { void d.dismiss(); });
  await page.locator('#discard').click();
  await expect(page.locator('#resume')).toBeVisible();                            // dismissed: the saved run is still there
  await page.locator('#resume').click(); await expect(page.locator('#cockpit')).toBeVisible();
  await expect(page.locator('#ta-panel')).toBeVisible();
  const pin = page.locator('#ta-done-pin'); await expect(pin).toBeVisible(); await expect(pin).toHaveText('Done (red button)');
  const pb = (await pin.boundingBox())!; const panel = (await page.locator('#ta-panel').boundingBox())!;
  expect(pb.y).toBeLessThan(panel.y + 40); expect(pb.y + pb.height).toBeLessThanOrEqual(768);
  await pin.click(); await expect(page.locator('#ta-acked')).toBeVisible();
});
