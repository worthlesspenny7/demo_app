/** PT-13 session 5 (shared profile): is the Boss run open? If not, SEED the meters to 65 % (stated in the report) and play it by the rules. */
import { open, shot, writeJson, tapEl, sleep, BASE } from './pt13-common.js';
import { playRun, summarize, seedPlayer } from './pt13-player.js';

seedPlayer(51);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const meters = await page.evaluate(() => [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
const unlocked = await page.locator('[data-testid=boss]').count() > 0;
let seeded = false;
if (!unlocked) {
  seeded = true;
  await page.evaluate(() => { const k = 'rally-trainer.decision.v1'; const p = JSON.parse(localStorage.getItem(k)!); for (const s of Object.keys(p.meters)) p.meters[s].value = Math.max(p.meters[s].value, 0.65); p.unfinished = null; localStorage.setItem(k, JSON.stringify(p)); });
  await page.reload(); await page.waitForSelector('[data-screen=home]');
}
await shot(page, '40-home-boss-open');
await tapEl(page, '[data-testid=boss]');
await page.waitForSelector('[data-screen=run]');
const run = await playRun(page, { policy: 'rules', label: 'Boss run (rules)', shotPrefix: '41-boss', shotKinds: new Set(['rule', 'verdict-right', 'verdict-wrong', 'turn', 'makeup', 'clock', 'preread', 'speedChange', 'restart', 'timedStart', 'checkpoint', 'transitOut', 'hazard', 'ta', 'lost']), turnFromOracle: true, geometry: true });
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
const metersAfter = await page.evaluate(() => [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
const out = { meters, unlocked, seeded, metersAfter, summary: summarize(run), run, errors: h.errors };
writeJson('s05-boss', out);
console.log(JSON.stringify({ meters, unlocked, seeded, metersAfter, summary: out.summary, cards: run.cards.map(c => `${c.kind} ${c.verdict ? c.verdict.head + ' ' + c.verdict.sec : ''} ${c.action ?? ''} onCard ${c.tTap ? ((c.tTap - c.tShown) / 1000).toFixed(1) : ''}`), errors: h.errors }, null, 1));
await h.close();
