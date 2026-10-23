/** PT-14 session 2 (shared profile, replay of pt13-02): start a run, answer three cards, close the browser mid-card, reopen; check that
 *  Continue is the primary button, that the other run buttons ask "Continue my run / Start over", that Continue brings the same card back;
 *  finish; then check "Start over" really starts a new run. */
import { open, shot, writeJson, state, cardInfo, tapEl, sleep, BASE } from './pt14-common.js';
import { playRun, summarize, seedPlayer } from './pt14-player.js';

seedPlayer(22);
let h = await open();
await h.page.goto(`${BASE}/`);
await h.page.waitForSelector('[data-screen=home]');
const homeBtn = await h.page.locator('[data-testid=play-daily]').textContent();
await tapEl(h.page, '[data-testid=play-daily]');
await h.page.waitForSelector('[data-screen=run]');
const part1 = await playRun(h.page, { policy: 'rules', label: 'practice part 1 (before close)', stopAfterDecisions: 3 });
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
const home = await h.page.evaluate(() => { const r = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; return e ? { text: (e.textContent ?? '').trim(), primary: e.classList.contains('primary'), top: Math.round(e.getBoundingClientRect().top) } : null; }; return { cont: r('[data-testid=continue]'), daily: r('[data-testid=play-daily]') }; });
await shot(h.page, '11-home-continue');
// the other big button: does it ask first?
await tapEl(h.page, '[data-testid=play-daily]');
await h.page.waitForSelector('[data-screen=confirm], [data-screen=run]');
const confirm = await h.page.evaluate(() => ({ screen: (document.querySelector('[data-screen]') as HTMLElement).dataset.screen, text: (document.querySelector('.mob')?.textContent ?? '').replace(/\s+/g, ' ').trim(), keep: !!document.querySelector('[data-testid=keep-run]'), over: !!document.querySelector('[data-testid=start-over]') }));
await shot(h.page, '12-confirm-start-over');
await tapEl(h.page, '[data-testid=keep-run]');
await h.page.waitForSelector('[data-screen=run]');
await sleep(300);
let st2 = await state(h.page);
const tBack = Date.now() - tOpen;
for (let k = 0; k < 10 && st2 && st2.phase === 'rule'; k++) { await tapEl(h.page, '[data-action=ack]'); await sleep(300); st2 = await state(h.page); }
const after = { st: st2, info: await cardInfo(h.page) };
await shot(h.page, '13-after-continue');
const part2 = await playRun(h.page, { policy: 'rules', label: 'practice part 2 (after Continue)' });
const same = before.st?.id === after.st?.id && before.info.prompt === after.info.prompt;
// Start over: a skill run, one answer, Home, a meter, Start over
await h.page.goto(`${BASE}/#/m/play/skill/recovery`); await h.page.waitForSelector('[data-screen=run], [data-screen=confirm]');
const part3 = await playRun(h.page, { policy: 'rules', label: 'recovery run, 1 card then Home', stopAfterDecisions: 1 });
await h.page.goto(`${BASE}/#/m`); await h.page.waitForSelector('[data-screen=home]');
const contBefore = await h.page.locator('[data-testid=continue]').textContent().catch(() => null);
await tapEl(h.page, '.mob-meter[data-skill=instruments] .mob-meter-main');
await h.page.waitForSelector('[data-screen=confirm]');
await tapEl(h.page, '[data-testid=start-over]');
await h.page.waitForSelector('[data-screen=run]'); await sleep(300);
const overSt = await state(h.page);
const unfinishedAfterOver = await h.page.evaluate(() => { const u = JSON.parse(localStorage.getItem('rally-trainer.decision.v1') ?? '{}').unfinished; return u ? { skills: u.plan?.skills, responses: u.responses?.length } : null; });
const out = { homeBtn, home, confirm, before, after, same, msToContinueCard: tBack, contBefore, overSt: { phase: overSt?.phase, kind: overSt?.kind, n: overSt?.n }, unfinishedAfterOver, summaries: [summarize(part1), summarize(part2), summarize(part3)], errors: [...errs1, ...h.errors] };
writeJson('s02-continue', { ...out, part1, part2 });
console.log(JSON.stringify({ ...out, before: { id: before.st?.id, n: before.st?.n, prompt: before.info.prompt }, after: { id: after.st?.id, n: after.st?.n, prompt: after.info.prompt } }, null, 1));
await h.close();
