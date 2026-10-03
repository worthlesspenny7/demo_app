/** V2 revalidation: Playwright screenshots of the V2 UI (vite preview on :4176). */
import { chromium, type Page } from 'playwright';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { makeBot, OracleBotLike } from './v2-ui-helpers.js';
import { snapshotRun, LIVE_KEY, LAST_KEY } from '../src/ui/viewmodels/resume.js';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const BASE = 'http://127.0.0.1:4176'; const OUT = '/home/user/demo_app/docs/playtest/screenshots';
const log: string[] = [];
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const page = await ctx.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = async (name: string, p: Page = page, full = false) => { await p.screenshot({ path: `${OUT}/v2-${name}.png`, fullPage: full }); console.log('shot', name); };
const depart = () => page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });

// 1. cockpit with five-column book (stage 1, running)
await page.goto(`${BASE}/#/cockpit/builtin/stage/1`); await page.waitForSelector('#cockpit');
await shot('01-cockpit-preread');
await depart(); await page.evaluate(() => window.__rally!.advance(40)); await page.waitForTimeout(200);
await shot('02-cockpit-running-book');
// book panel close-up
const book = page.locator('#book'); if (await book.count()) await book.screenshot({ path: `${OUT}/v2-03-cockpit-book-panel.png` });
// 2. charts overlay
await page.evaluate(() => { const r = window.__rally!; const n = r.observe().book.find(i => i.pause && (!i.turn || i.turn === 'S'))!.n; r.act({ type: 'line.set', n }); });
await page.locator('#view').focus(); await page.keyboard.press('c'); await page.waitForTimeout(250); await shot('04-charts-overlay'); await page.keyboard.press('Escape');
await shot('05-cockpit-stop-card');
// 3. restart card / exact transit / promoted
const lines = await page.evaluate(() => { const b = window.__rally!.observe().book; return { restart: b.find(i => i.section === 'restart')!.n, promoted: b.find(i => i.promotedStop)?.n ?? null, calib: b.find(i => i.calibrationStart)?.n ?? null, free: b.find(i => i.freeZone === 'begin')?.n ?? null }; });
console.log('lines', JSON.stringify(lines));
await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.restart); await page.waitForTimeout(150); await shot('06-restart-card');
if (lines.promoted) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.promoted); await page.waitForTimeout(150); await shot('07-promoted-stop-card'); }
if (lines.calib) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), lines.calib); await page.waitForTimeout(150); await shot('08-calibration-row'); }
// digital watch with laps: drill D07 (calibration) and stopwatch
await page.goto(`${BASE}/#/cockpit/drill/D07/0/1`); await page.waitForSelector('#cockpit'); await depart(); await page.locator('#view').focus();
await page.keyboard.press(' '); await page.evaluate(() => window.__rally!.advance(12.34)); await page.keyboard.press('l'); await page.evaluate(() => window.__rally!.advance(7)); await page.keyboard.press('l'); await page.evaluate(() => window.__rally!.advance(3)); await page.keyboard.press('l'); await page.waitForTimeout(200);
await shot('09-digital-watch-laps');
const sw = page.locator('#stopwatch'); if (await sw.count()) await sw.screenshot({ path: `${OUT}/v2-10-digital-watch-closeup.png` });
// D16 exact transit card
await page.goto(`${BASE}/#/cockpit/drill/D16/0/2`); await page.waitForSelector('#cockpit'); await depart();
const l16 = await page.evaluate(() => { const b = window.__rally!.observe().book; return { tr: b.find(i => i.transit?.exact && !i.transit.end)?.n ?? null, trEnd: b.find(i => i.transit?.exact && i.transit.end)?.n ?? null, restart: b.find(i => i.section === 'restart')?.n ?? null }; });
console.log('d16 lines', JSON.stringify(l16));
if (l16.tr) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), l16.tr); await page.waitForTimeout(150); await shot('11-exact-transit-in-card'); }
if (l16.trEnd) { await page.evaluate(n => window.__rally!.act({ type: 'line.set', n }), l16.trEnd); await page.waitForTimeout(150); await shot('12-exact-transit-out-card'); }
// 4. TA form at TA point (stage seed 6), via a node-side oracle run resumed
async function oracleToTa(seed: number): Promise<void> {
  const sim = new Simulator(generateStage(seed), { watch: 'digital' }); const bot = makeBot(sim);
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && !sim.taState().windowOpen; n++) { bot.onTick(sim); sim.step(0.1); }
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto(`${BASE}/#/settings`); await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto(`${BASE}/#/`); await page.locator('#resume').click(); await page.waitForSelector('#cockpit');
}
await oracleToTa(6); await page.waitForSelector('#ta-panel'); await page.waitForTimeout(250); await shot('13-ta-form');
await page.locator('#ta-request').fill('47').catch(() => {}); await page.waitForTimeout(150); await shot('14-ta-form-rounding');
// 5. scorecard (debrief) from a finished oracle run
{
  const seed = 3; const sim = new Simulator(generateStage(seed), { watch: 'digital' }); const bot = makeBot(sim);
  let t = 0; while (sim.phase !== 'finished' && t < 200000) { bot.onTick(sim); sim.step(0.1); t++; }
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto(`${BASE}/#/settings`); await page.evaluate(([k, v]) => { localStorage.setItem(k!, v!); localStorage.removeItem('rally-trainer.live-run.v1'); }, [LAST_KEY, JSON.stringify(stored)]);
  await page.goto(`${BASE}/#/debrief`); await page.waitForTimeout(800); await shot('15-scorecard-top'); await shot('16-scorecard-full', page, true);
}
// 6. printable book page
await page.goto(`${BASE}/#/book/builtin/stage/1`); await page.waitForSelector('.book-sheet'); await page.waitForTimeout(300);
const sheets = page.locator('.book-sheet'); console.log('sheets', await sheets.count());
await shot('20-book-route-top'); await sheets.nth(0).screenshot({ path: `${OUT}/v2-21-book-sheet-1.png` }); await sheets.nth(1).screenshot({ path: `${OUT}/v2-22-book-sheet-2.png` });
// find sheet with end-timed, ta and with lunch
const idxOf = async (sel: string) => page.evaluate(s => Array.from(document.querySelectorAll('.book-sheet')).findIndex(e => e.querySelector(s)), sel);
for (const [sel, name] of [['svg[data-sym="end-timed"]', '23-book-sheet-end-timed'], ['svg[data-sym="meal"]', '24-book-sheet-lunch'], ['svg[data-sym="freezone-begin"]', '25-book-sheet-freezone'], ['svg[data-sym="finish"]', '26-book-sheet-finish']] as const) { const i = await idxOf(sel); console.log(name, 'sheet index', i); if (i >= 0) await sheets.nth(i).screenshot({ path: `${OUT}/v2-${name}.png` }); }
console.log('page errors', JSON.stringify(errors));
await browser.close();
