/** PT-13 session 4 (shared profile): turn the phone sideways mid-run; play cards in landscape; turn back. */
import { open, shot, writeJson, state, geometry, cardInfo, screenWords, tapEl, sleep, BASE } from './pt13-common.js';
import { playRun, summarize, seedPlayer } from './pt13-player.js';

seedPlayer(41);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/?mode=mobile#/m/play/practice`);
await page.waitForSelector('[data-screen=run]');
const notes: unknown[] = [];
let st = await state(page);
for (let k = 0; k < 10 && st?.phase === 'rule'; k++) { await tapEl(page, '[data-action=ack]'); await sleep(300); st = await state(page); }
const before = await state(page);
await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
const mid = await state(page);
const g = await geometry(page); const w = await screenWords(page);
const layout = await page.evaluate(() => { const b = (s: string) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; }; const m = document.querySelector('.mob-main') as HTMLElement; return { landscape: document.body.classList.contains('mob-landscape'), actions: b('.mob-actions'), main: b('.mob-main'), driver: (document.querySelector('[data-testid=driver-line]')?.textContent ?? '').trim(), mainScrolls: m ? m.scrollHeight > m.clientHeight + 2 : null, mainScrollH: m?.scrollHeight, mainClientH: m?.clientHeight, prompt: b('.mprompt'), row: b('.mrow') }; });
await shot(page, `30-landscape-${mid?.kind ?? mid?.phase}`);
notes.push({ before: { id: before?.id, kind: before?.kind }, mid: { id: mid?.id, kind: mid?.kind }, sameCard: before?.id === mid?.id, layout, geo: { hscroll: g.hscroll, small: g.small, tiny: g.tiny, controls: g.controls }, words: w.total });
// play four cards in landscape (a person holding the phone sideways)
const land = await playRun(page, { policy: 'rules', label: 'landscape 4 cards', stopAfterDecisions: 4, turnFromOracle: true });
const kinds = land.cards.map(c => c.kind);
// a timing card in landscape: screenshot whatever face is on now
const st2 = await state(page);
await shot(page, `31-landscape-${st2?.kind ?? st2?.phase}`);
const layout2 = await page.evaluate(() => { const m = document.querySelector('.mob-main') as HTMLElement; const a = document.querySelector('.mob-actions') as HTMLElement; return { mainScrolls: m.scrollHeight > m.clientHeight + 2, mainScrollH: m.scrollHeight, mainClientH: m.clientHeight, actionsScrolls: a.scrollHeight > a.clientHeight + 2, actionsH: a.clientHeight, actionsScrollH: a.scrollHeight }; });
await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
const back = await state(page);
const rest = await playRun(page, { policy: 'rules', label: 'portrait again to the end', turnFromOracle: true });
const out = { notes, landKinds: kinds, layout2, backSame: back?.id === st2?.id, summaries: [summarize(land), summarize(rest)], land, rest, errors: h.errors };
writeJson('s04-landscape', out);
console.log(JSON.stringify({ notes, landKinds: kinds, layout2, backSame: out.backSame, summaries: out.summaries, errors: h.errors }, null, 1));
await h.close();
