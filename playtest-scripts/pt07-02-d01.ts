/** PT-07 step 2: D01 from the Start-here button. Pass 1 (naive, as in PT-05): Josh presses D at once from the pre-read.
 *  Pass 2 (by the book): the pre-read's primary button "Fast-forward to the launch", Space as the car leaves, L at each marker.
 *  Sim time only through window.__rally.advance; 0.25 +- 0.08 s latency on every lap. Then Home: did the path advance (PLAY-001)? */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt07-common.js';
const F = '02-d01.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
async function lapLoop(tag: string): Promise<number> {
  let o = await obs(page); let laps = 0; let lastSign: number | null = null;
  for (let i = 0; i < 40000 && o && o.phase !== 'finished'; i++) {
    if (o.phase === 'running' && !o.stopwatch.running) await page.keyboard.press(' ');
    const sign = o.ahead.find((f: any) => f.kind === 'sign' || /MARKER/i.test(f.label ?? ''));
    if (lastSign !== null && lastSign < 60 && (!sign || sign.approxDistanceFt > lastSign + 50)) {
      const lat = 0.25 + (rnd() - 0.5) * 0.16; await adv(page, lat); await page.keyboard.press('l'); laps++;
      if (laps === 2 && tag === 'book') { await shot(page, 'd01-running-lap2'); log(F, 'lap2 watch: ' + await txt(page, '#stopwatch') + '\nperf: ' + await txt(page, '#perfcard') + '\ndriver: ' + await txt(page, '#driverlog')); }
    }
    lastSign = sign ? sign.approxDistanceFt : null;
    await adv(page, sign && sign.approxDistanceFt < 300 ? 0.05 : 0.5); o = await obs(page);
  }
  return laps;
}
await goto(page, '#/');
log(F, 'home button: ' + await txt(page, '#starthere'));
await page.locator('#starthere').click(); await page.waitForTimeout(300);
log(F, 'url ' + page.url()); await hold(page);
await shot(page, 'd01-preread');
log(F, '== HINTBAR ==\n' + await txt(page, '#hintbar'));
log(F, '== PREREAD ==\n' + await txt(page, '#preread'));
log(F, '== PERFCARD ==\n' + await txt(page, '#perfcard'));
log(F, '== BOOK ==\n' + (await txt(page, '#book')).slice(0, 1200));
log(F, 'preread buttons: ' + (await page.locator('#preread button').allInnerTexts()).join(' | '));
let o = await obs(page);
log(F, 'secondsToStart ' + o.secondsToStart + ' launch ' + JSON.stringify(o.launch) + ' startQueue ' + JSON.stringify(o.startQueue));
// --- pass 1: naive D at once
await page.keyboard.press('d'); await page.waitForTimeout(50); await adv(page, 0.3);
o = await obs(page); log(F, 'after D: phase ' + o.phase + ' tod ' + o.tod + ' alert ' + await txt(page, '#alert') + ' driver ' + (await txt(page, '#driverlog')).replace(/\n/g, ' / '));
let laps = await lapLoop('naive'); log(F, 'naive laps ' + laps);
await page.waitForTimeout(500); log(F, 'url ' + page.url());
await shot(page, 'd01-naive-debrief');
log(F, '== NAIVE DEBRIEF ==\n' + (await page.locator('#view').innerText()).slice(0, 3500));
await goto(page, '#/'); log(F, 'HOME after naive: ' + await txt(page, '#starthere'));
// --- pass 2: by the book
await goto(page, '#/cockpit/drill/D01/0/1'); await hold(page);
log(F, 'resume banner? ' + await txt(page, '#resume-banner'));
const ff = page.locator('#skip'); log(F, 'skip button: ' + await ff.innerText().catch(() => 'none'));
await ff.click().catch(e => log(F, 'skip failed ' + e)); await page.waitForTimeout(100);
o = await obs(page); log(F, 'after fast-forward: phase ' + o.phase + ' secondsToStart ' + o.secondsToStart + ' tod ' + o.tod + ' launch ' + JSON.stringify(o.launch));
for (let i = 0; i < 1200 && o.phase === 'preread'; i++) { await adv(page, 0.1); o = await obs(page); }
log(F, 'departed at tod ' + o.tod + ' driver ' + (await txt(page, '#driverlog')).replace(/\n/g, ' / '));
laps = await lapLoop('book'); log(F, 'book laps ' + laps);
await page.waitForTimeout(500);
await shot(page, 'd01-book-debrief');
log(F, '== BOOK DEBRIEF ==\n' + (await page.locator('#view').innerText()).slice(0, 3500));
await goto(page, '#/'); log(F, 'HOME after book: ' + await txt(page, '#starthere-panel'));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
