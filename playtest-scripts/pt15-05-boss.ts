/** PT-15 session 5 (shared profile, replay of pt14-05; screenshot of a compressed hold): is the Boss open? If not, SEED every meter to 50 % (stated in the report). Play the
 *  first Boss (rung 2, chart on the card) and a second one (rung 1, chart behind the Chart button) by the rule cards. */
import { open, shot, writeJson, tapEl, sleep, BASE } from './pt15-common.js';
import { playRun, summarize, seedPlayer } from './pt15-player.js';

seedPlayer(155);
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
  if (i === 1) { const br = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1')!).bossRuns ?? 0); metersAfter.push([`bossRuns before Boss 1: ${br}`]); }
  if (!(await page.locator('[data-testid=boss]').count())) { metersAfter.push(['boss locked again']); break; }
  // a compressed hold: screenshot the moment the watch jumps ("Jumped ahead N s."), once per Boss
  let skipShot = false;
  const skipWatch = (async () => { for (let k = 0; k < 12000 && !skipShot; k++) { const v = await page.evaluate(() => { const e = document.querySelector('[data-testid=skip-note]') as HTMLElement | null; return !!e && !e.hidden; }).catch(() => false); if (v) { skipShot = true; await shot(page, `4${i}-boss-skip-jump`); break; } if (await page.locator('[data-screen=recap]').count().catch(() => 0)) break; await sleep(100); } })();
  await tapEl(page, '[data-testid=boss]');
  await page.waitForSelector('[data-screen=run], [data-screen=confirm]');
  if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
  const run = await playRun(page, { policy: 'rules', label: `Boss ${i} (rung ${rung})`, rung, shotPrefix: `4${i}-boss`, shotKinds: new Set(i === 1 ? ['rule', 'turn', 'preread', 'checkpoint', 'transitOut', 'clock', 'makeup', 'lost', 'ta', 'restart', 'watch', 'speedChange', 'pause', 'timedStart', 'recap'] : ['rule', 'turn', 'preread', 'checkpoint', 'transitOut', 'clock', 'makeup', 'lost', 'ta', 'watch', 'hazard', 'timedStart', 'speedChange', 'recap']), geometry: true });
  void skipWatch;
  runs.push(run); sums.push(summarize(run));
  await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
  metersAfter.push(await page.evaluate(() => [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim())));
}
const out = { meters, unlocked, seeded, metersAfter, summaries: sums, errors: h.errors };
writeJson('s05-boss', { ...out, runs });
console.log(JSON.stringify(out, null, 1));
await h.close();
