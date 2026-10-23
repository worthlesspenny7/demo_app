/** PT-13 session 2 (shared profile): start a run from Home, answer three cards, close the browser mid-run (app swiped away), reopen, Continue. */
import { open, shot, writeJson, state, cardInfo, tapEl, sleep, BASE } from './pt13-common.js';
import { playRun, summarize, seedPlayer } from './pt13-player.js';

seedPlayer(21);
let h = await open();
await h.page.goto(`${BASE}/`);
await h.page.waitForSelector('[data-screen=home]');
const homeBtn = await h.page.locator('[data-testid=play-daily]').textContent();
await tapEl(h.page, '[data-testid=play-daily]');
await h.page.waitForSelector('[data-screen=run]');
const part1 = await playRun(h.page, { policy: 'rules', label: 'practice part 1 (before close)', stopAfterDecisions: 3, turnFromOracle: true });
// now a fresh card is on screen (or a rule card): note it, then "swipe the app away"
let st = await state(h.page);
for (let k = 0; k < 10 && st && st.phase === 'rule'; k++) { await tapEl(h.page, '[data-action=ack]'); await sleep(300); st = await state(h.page); }
const before = { st, info: await cardInfo(h.page) };
await shot(h.page, '10-before-close');
const errs1 = [...h.errors];
await h.close();
await sleep(1500);
h = await open();
const tOpen = Date.now();
await h.page.goto(`${BASE}/`);
await h.page.waitForSelector('[data-screen=home]');
const cont = await h.page.locator('[data-testid=continue]').textContent().catch(() => null);
await shot(h.page, '11-home-continue');
await tapEl(h.page, '[data-testid=continue]');
await h.page.waitForSelector('[data-screen=run]');
await sleep(300);
let st2 = await state(h.page);
const afterRaw = { st: st2, info: await cardInfo(h.page) };
const tBack = Date.now() - tOpen;
for (let k = 0; k < 10 && st2 && st2.phase === 'rule'; k++) { await tapEl(h.page, '[data-action=ack]'); await sleep(300); st2 = await state(h.page); }
const after = { st: st2, info: await cardInfo(h.page) };
await shot(h.page, '12-after-continue');
const part2 = await playRun(h.page, { policy: 'rules', label: 'practice part 2 (after Continue)', turnFromOracle: true });
const same = before.st?.id === after.st?.id && before.info.prompt === after.info.prompt;
const out = { homeBtn, before, cont, afterRaw, after, same, msToContinueCard: tBack, summaries: [summarize(part1), summarize(part2)], part1, part2, errors: [...errs1, ...h.errors] };
writeJson('s02-continue', out);
console.log(JSON.stringify({ homeBtn, cont, same, before: { id: before.st?.id, n: before.st?.n, of: before.st?.of, phase: before.st?.phase, prompt: before.info.prompt }, afterRaw: { phase: afterRaw.st?.phase, id: afterRaw.st?.id }, after: { id: after.st?.id, n: after.st?.n, of: after.st?.of, prompt: after.info.prompt }, msToContinueCard: tBack, summaries: out.summaries, errors: out.errors }, null, 1));
await h.close();
