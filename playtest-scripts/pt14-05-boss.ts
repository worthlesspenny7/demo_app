/** PT-14 session 5 (shared profile, replay of pt13-05): is the Boss open? If not, SEED every meter to 50 % (stated in the report). Play the
 *  first Boss (rung 2, chart on the card) and a second one (rung 1, chart behind the Chart button) by the rule cards. */
import { open, shot, writeJson, tapEl, sleep, BASE } from './pt14-common.js';
import { playRun, summarize, seedPlayer } from './pt14-player.js';

seedPlayer(55);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const meters = await page.evaluate(() => [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
const unlocked = await page.locator('[data-testid=boss]').count() > 0;
let seeded = false;
if (!unlocked) {
  seeded = true;
  await page.evaluate(() => { const k = 'rally-trainer.decision.v1'; const p = JSON.parse(localStorage.getItem(k)!); for (const s of Object.keys(p.meters)) p.meters[s].value = Math.max(p.meters[s].value, 0.5); p.unfinished = null; localStorage.setItem(k, JSON.stringify(p)); });
  await page.reload(); await page.waitForSelector('[data-screen=home]');
}
await shot(page, '40-home-boss-open');
const sums: unknown[] = []; const runs: unknown[] = []; const metersAfter: string[][] = [];
for (const [i, rung] of [[1, 2], [2, 1]] as const) {
  await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
  // PT-14 rerun note: a first attempt played Boss 1 (rung 2, 22/22) and crashed in Boss 2 on a player bug; bossRuns is reset to 0 for
  // Boss 1 so the first Boss is again the rung-2 one (stated in the report)
  if (i === 1) await page.evaluate(() => { const k = 'rally-trainer.decision.v1'; const p = JSON.parse(localStorage.getItem(k)!); p.bossRuns = 0; for (const s of Object.keys(p.meters)) p.meters[s].value = Math.max(p.meters[s].value, 0.5); p.unfinished = null; localStorage.setItem(k, JSON.stringify(p)); });
  if (i === 1) { await page.reload(); await page.waitForSelector('[data-screen=home]'); }
  if (!(await page.locator('[data-testid=boss]').count())) { metersAfter.push(['boss locked again']); break; }
  await tapEl(page, '[data-testid=boss]');
  await page.waitForSelector('[data-screen=run], [data-screen=confirm]');
  if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
  const run = await playRun(page, { policy: 'rules', label: `Boss ${i} (rung ${rung})`, rung, shotPrefix: `4${i}-boss`, shotKinds: new Set(i === 1 ? ['rule', 'turn', 'preread', 'checkpoint', 'transitOut', 'clock', 'makeup', 'lost', 'ta', 'restart', 'watch', 'hazard', 'speedChange'] : ['rule', 'turn', 'preread', 'checkpoint', 'transitOut', 'clock', 'makeup', 'lost', 'ta', 'restart', 'watch', 'hazard', 'timedStart', 'verdict-right']), geometry: true });
  runs.push(run); sums.push(summarize(run));
  await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
  metersAfter.push(await page.evaluate(() => [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())));
}
const out = { meters, unlocked, seeded, metersAfter, summaries: sums, errors: h.errors };
writeJson('s05-boss', { ...out, runs });
console.log(JSON.stringify(out, null, 1));
await h.close();
