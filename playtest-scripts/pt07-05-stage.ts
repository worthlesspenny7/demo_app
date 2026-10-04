/** PT-07 step 5: the full day stage builtin/stage/1 at Bronze by the card, in a copy of the profile (run with PT07_OUT=<copy dir>).
 *  Looks: 30 s after the launch (does Dad ask for the warm-up speed, does the card print the transit pace: PLAY-002), the cockpit layout
 *  while running at 1366x768, then play to the finish and dump the Debrief. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt07-common.js';
import { playHuman } from './pt07-human.js';
const F = 'stage.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/cockpit/builtin/stage/1'); await hold(page);
let o = await obs(page);
log(F, 'launch ' + JSON.stringify(o.launch) + ' book ' + o.book.length + ' lines, aids ' + JSON.stringify(o.aids) + ' asp ' + o.asp);
log(F, '== PREREAD ==\n' + (await txt(page, '#preread')).slice(0, 1500));
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 8, uturnOnDeadEnd: true, log: (s: string) => log(F, s) } as const;
// launch, then do NOT call a speed for 30 s: what prompts Josh?
let r = await playHuman(page, { ...base, until: "o.phase === 'running'" });
await adv(page, 30); o = await obs(page);
log(F, `30 s after launch: state ${o.driver.state} target ${o.driver.targetIndicated} speedo ${o.speedo.reading}`);
log(F, 'driver: ' + (await txt(page, '#driverlog')).split('\n').slice(-3).join(' / ') + '\ntransit pace on card: ' + await txt(page, '#transitpace') + '\nnext-call: ' + await txt(page, '#next-call'));
const geo = await page.evaluate(() => { const b = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.y), Math.round(q.height)]; }; return { road: b('.road'), clock: b('#clock'), watch: b('#stopwatch'), book: b('#book'), drawer: b('.drawer'), perfcard: b('#perfcard') }; });
log(F, 'layout [y,h] after launch: ' + JSON.stringify(geo));
await shot(page, 'stage-after-launch');
r = await playHuman(page, { ...base, keepState: true, until: "o.tod > 30600 && o.driver.state === 'cruise'" });
const geo2 = await page.evaluate(() => { const b = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.y), Math.round(q.height)]; }; return { road: b('.road'), clock: b('#clock'), watch: b('#stopwatch'), book: b('#book'), drawer: b('.drawer'), perfcard: b('#perfcard') }; });
o = await obs(page); log(F, `mid-stage tod ${o.tod} line ${o.currentLine}: layout ${JSON.stringify(geo2)} wall ${(r.wall / 60).toFixed(1)} min`);
await shot(page, 'stage-midrun');
r = await playHuman(page, { ...base, keepState: true });
log(F, `played: finished ${r.finished} wall est ${(r.wall / 60).toFixed(1)} min, sim ${(r.sim / 60).toFixed(1)} min, keys ${r.keys.length}`);
await page.waitForTimeout(800);
if (!/debrief/.test(page.url())) { o = await obs(page); log(F, 'NOT FINISHED ' + page.url() + ' state ' + o?.driver?.state + ' line ' + o?.currentLine + ' driver ' + await txt(page, '#driverlog')); await shot(page, 'stage-unfinished'); }
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText());
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
