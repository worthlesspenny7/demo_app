/** PT-10 probe (copy of pt08-04, scratch profile PT10_NOSAVE=1): N-B14 and the lost doctrine. Josh calls the left 350 ft before the STOP-T where the side road is (the PT-08 mistake). Was: PT-08 step 4: D10 Bronze from the lesson's "Next on your path" in the shared profile. Josh plays it by the card at 4x with the full start
 *  (W, Q, count), and makes the rookie mistake the drill is built for: he takes the side road 350 ft before the real STOP-T left for the turn.
 *  Then the lost doctrine as the lesson teaches it: notice the landmark never comes (about 20 s), U turn-around, stopwatch reset + start on the same
 *  second, stop it at the junction, double it and write "lost N" in the notes box. Real keys; sim time only via advance. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt10-common.js';
import { playHuman } from './pt10-human.js';
const [label = 'd10-bronze', tier = '0'] = process.argv.slice(2);   // first pass (label d10-bronze) stopped the watch on 'Heading back' by a harness slip; the retry (d10-retry) stops it on Dad's "Back on course"
const F = `04-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, `#/cockpit/drill/D10/${tier}/1`); await hold(page);
await shot(page, `${label}-preread`);
log(F, '== PREREAD ==\n' + await txt(page, '#preread') + '\n== PERF ==\n' + await txt(page, '#perfcard') + '\n== BOOK ==\n' + (await txt(page, '#book')).slice(0, 2500));
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as const;
let r = await playHuman(page, { ...base, until: "o.ahead.some(f => f.label === 'side road L' && f.approxDistanceFt <= 350 && f.approxDistanceFt > 200)" });
let o = await obs(page); log(F, `\n== at the side road: tod ${o.tod.toFixed(1)} line ${o.currentLine} ahead ${JSON.stringify(o.ahead)}`);
if (o.phase !== 'finished') {
  await page.keyboard.press('ArrowLeft'); log(F, 'Josh called LEFT at the side road (wrong: the book line is the STOP-T 500 ft on)');
  for (let i = 0; i < 400; i++) { await adv(page, 0.25); o = await obs(page); if (o.driver.state === 'offcourse' || o.offCourseHint) break; }
  log(F, `driver state ${o.driver.state} hint ${o.offCourseHint} tod ${o.tod.toFixed(1)}; driver: ${(await txt(page, '#driverlog')).split('\n').slice(-4).join(' / ')}`);
  await adv(page, 20); o = await obs(page);
  await shot(page, `${label}-offcourse`);
  log(F, `+20 s, the STOP never came: state ${o.driver.state}, ahead ${JSON.stringify(o.ahead)}\nperf: ${await txt(page, '#perfcard')}\nhint: ${await txt(page, '#hintbar')}\nalert: ${await txt(page, '#alert')}`);
  await page.keyboard.press('u'); await page.keyboard.press('Shift+R'); await page.keyboard.press(' ');
  const t0 = o.tod; log(F, `U + watch reset/start at tod ${t0.toFixed(1)}`);
  let st = o.driver.state;
  for (let i = 0; i < 2000; i++) { await adv(page, 0.2); o = await obs(page); if (o.driver.state !== st) { log(F, `state ${st} -> ${o.driver.state} at tod ${o.tod.toFixed(1)}`); st = o.driver.state; } if (/Back on course/.test(await txt(page, '#driverlog'))) break; }
  await page.keyboard.press(' ');
  const watch = await txt(page, '#stopwatch'); log(F, `back on course at tod ${o.tod.toFixed(1)} (watch display: ${watch.replace(/\n/g, ' ')})`);
  const secs = o.stopwatch?.reading ?? (o.tod - t0); const doubled = Math.round(2 * secs);
  log(F, `Josh reads ${secs.toFixed(1)} s, doubles it: lost ${doubled}`);
  const note = page.locator('input[placeholder^="note"]'); await note.click(); await note.type(`lost ${doubled}`); await page.keyboard.press('Enter');
  await page.locator('#view').focus().catch(() => {});
  await page.keyboard.press(' ');   // watch back on for the rest of the leg
  log(F, 'driver after: ' + (await txt(page, '#driverlog')).split('\n').slice(-4).join(' / '));
}
r = await playHuman(page, { ...base, keepState: true });
log(F, `played: finished ${r.finished} wall est ${(r.wall / 60).toFixed(1)} min`);
await page.waitForTimeout(600);
await shot(page, `${label}-debrief`);
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText());
await goto(page, '#/'); log(F, '== HOME ==\n' + await txt(page, '#starthere-panel'));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
