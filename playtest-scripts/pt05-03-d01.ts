/** PT-05 step 3: D01 from the Start-here button. First look (pre-read, hint bar, keys overlay), then play as Josh: D, Space, L at each marker
 *  with 0.25 s +- 0.08 human latency (real key presses); sim time advanced in 0.05 s slices, never wall-clock waits. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt05-common.js';
const F = '03-d01.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/');
await page.locator('#starthere').click(); await page.waitForTimeout(300);
log(F, 'url ' + page.url());
await hold(page);
await shot(page, 'd01-preread');
log(F, '== HINTBAR ==\n' + await txt(page, '#hintbar'));
log(F, '== PREREAD ==\n' + await txt(page, '#preread'));
log(F, '== PERFCARD ==\n' + await txt(page, '#perfcard'));
log(F, '== BOOK ==\n' + (await txt(page, '#book')).slice(0, 1500));
log(F, '== DRAWER bar ==\n' + await txt(page, '.drawer .bar'));
let o = await obs(page);
log(F, 'obs keys: ' + Object.keys(o).join(','));
log(F, 'secondsToStart ' + o.secondsToStart + ' phase ' + o.phase + ' aids ' + JSON.stringify(o.aids));
// keys overlay
await page.keyboard.press('?'); await page.waitForTimeout(100); await shot(page, 'd01-keys-overlay');
log(F, 'keys overlay visible: ' + await page.locator('#keys-overlay').isVisible());
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
log(F, 'after Esc overlay visible: ' + await page.locator('#keys-overlay').isVisible() + ' pause btn ' + await txt(page, '#pause'));
// Naive: Josh presses D right away (does not wait), then Space.
await page.keyboard.press('d'); await page.waitForTimeout(50);
o = await obs(page); log(F, 'after D: phase ' + o.phase + ' tod ' + o.tod + ' start ' + o.startTime + ' alert ' + await txt(page, '#alert'));
await page.keyboard.press(' ');
await adv(page, 2);
await shot(page, 'd01-running');
log(F, '== after start: HINT ==\n' + await txt(page, '#hintbar') + '\n== perf ==\n' + await txt(page, '#perfcard') + '\n== driver ==\n' + await txt(page, '#driverlog'));
o = await obs(page); log(F, 'ahead ' + JSON.stringify(o.ahead).slice(0, 600)); log(F, 'stopwatch ' + JSON.stringify(o.stopwatch).slice(0, 400));
// lap loop
let laps = 0; let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
let lastSign: number | null = null; let simT = 0; let shotDone = false;
for (let i = 0; i < 40000 && o && o.phase !== 'finished'; i++) {
  const sign = o.ahead.find((f: any) => f.kind === 'sign' || /MARKER/i.test(f.label ?? ''));
  if (sign && sign.approxDistanceFt < 200 && !shotDone) { await shot(page, 'd01-marker-approach'); shotDone = true; }
  if (lastSign !== null && lastSign < 60 && (!sign || sign.approxDistanceFt > lastSign + 50)) {
    const lat = 0.25 + (rnd() - 0.5) * 0.16; await adv(page, lat); simT += lat; await page.keyboard.press('l'); laps++;
    if (laps === 2) { await shot(page, 'd01-after-lap2'); log(F, 'lap2 watch: ' + await txt(page, '#stopwatch') + '\nperf: ' + await txt(page, '#perfcard')); }
  }
  lastSign = sign ? sign.approxDistanceFt : null;
  o = await adv(page, sign && sign.approxDistanceFt < 300 ? 0.05 : 0.5); simT += 0.05; o = await obs(page);
  if (!o) break;
}
log(F, `laps pressed ${laps}`);
await page.waitForTimeout(500);
log(F, 'url ' + page.url());
await shot(page, 'd01-debrief');
await shot(page, 'd01-debrief-full', true);
log(F, '== DEBRIEF ==\n' + (await page.locator('#view').innerText()).slice(0, 5000));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
