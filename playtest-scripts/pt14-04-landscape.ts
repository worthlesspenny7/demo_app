/** PT-14 session 4 (shared profile, replay of pt13-04): turn the phone sideways mid-run, play four cards in landscape (screenshot a timed
 *  card with the sign bar), turn back and finish in portrait. */
import { open, shot, writeJson, state, geometry, screenWords, tapEl, sleep, BASE } from './pt14-common.js';
import { playRun, summarize, seedPlayer } from './pt14-player.js';

seedPlayer(44);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/?mode=mobile#/m/play/skill/stayOnTime`);
await page.waitForSelector('[data-screen=run], [data-screen=confirm]');
if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
let st = await state(page);
for (let k = 0; k < 10 && st?.phase === 'rule'; k++) { await tapEl(page, '[data-action=ack]'); await sleep(300); st = await state(page); }
const before = await state(page);
await page.setViewportSize({ width: 844, height: 390 }); await sleep(400);
const mid = await state(page);
const g = await geometry(page); const w = await screenWords(page);
const layout = await page.evaluate(() => { const b = (s: string) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; }; const m = document.querySelector('.mob-main') as HTMLElement; return { landscape: document.body.classList.contains('mob-landscape'), actions: b('.mob-actions'), main: b('.mob-main'), sign: b('.msign'), driver: (document.querySelector('[data-testid=driver-line]')?.textContent ?? '').trim(), mainScrolls: m ? m.scrollHeight > m.clientHeight + 2 : null }; });
await shot(page, `30-landscape-${mid?.kind ?? mid?.phase}`);
// watch the Mark! moment on a timed card in landscape
let markShot = false;
const markWatcher = (async () => { for (let i = 0; i < 400 && !markShot; i++) { const m = await page.evaluate(() => /Mark/.test(document.querySelector('[data-testid=mark]')?.textContent ?? '')).catch(() => false); if (m) { markShot = true; await shot(page, '31-landscape-mark'); break; } await sleep(50); } })();
const land = await playRun(page, { policy: 'rules', label: 'landscape 4 cards', stopAfterDecisions: 4 });
await markWatcher;
const st2 = await state(page);
const layout2 = await page.evaluate(() => { const m = document.querySelector('.mob-main') as HTMLElement; const a = document.querySelector('.mob-actions') as HTMLElement; return { mainScrolls: m.scrollHeight > m.clientHeight + 2, actionsScrolls: a.scrollHeight > a.clientHeight + 2 }; });
await page.setViewportSize({ width: 390, height: 844 }); await sleep(400);
const back = await state(page);
const rest = await playRun(page, { policy: 'rules', label: 'portrait again to the end' });
const out = { before: { id: before?.id, kind: before?.kind }, mid: { id: mid?.id, kind: mid?.kind }, same: before?.id === mid?.id, layout, geo: { hscroll: g.hscroll, small: g.small, tiny: g.tiny, controls: g.controls }, words: w.total, landWords: land.cards.map(c => `${c.kind} ${c.words}`), landKinds: land.cards.map(c => c.kind), layout2, backSame: back?.id === st2?.id, markShot, summaries: [summarize(land), summarize(rest)], errors: h.errors };
writeJson('s04-landscape', { ...out, land, rest });
console.log(JSON.stringify(out, null, 1));
await h.close();
