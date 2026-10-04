/** PT-05 step 4: D01 by the book after the naive run: Retry from the Debrief, W at ~30 s, D on the launch second (the visible count), Space at the
 *  official second, L at each marker, S for the Observation Checkpoint. Then Home: did the Start-here path advance? */
import { launch, goto, shot, txt, log, reset, hold, obs, adv, until } from './pt05-common.js';
const F = '04-d01-retry.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/debrief');
await page.getByText('Retry this run').click(); await page.waitForTimeout(300);
log(F, 'url ' + page.url()); await hold(page);
let o = await obs(page);
const launchAt = o.launch; log(F, 'launch ' + JSON.stringify(launchAt) + ' startQueue ' + JSON.stringify(o.startQueue) + ' paceCars ' + JSON.stringify(o.paceCars).slice(0, 300));
// to T-31 then W
await adv(page, o.secondsToStart - 31); await page.keyboard.press('w'); await adv(page, 0.2);
log(F, 'after W: alert ' + await txt(page, '#alert') + ' driver ' + await txt(page, '#driverlog'));
await page.keyboard.press('q'); await adv(page, 0.2); log(F, 'after Q: ' + await txt(page, '#preread .start-queue') + ' | alert ' + await txt(page, '#alert'));
// follow the visible count
o = await obs(page);
await adv(page, o.secondsToStart - 12);
await shot(page, 'd01-count-banner');
log(F, 'preread at T-12: ' + (await txt(page, '#preread')).slice(0, 600));
let seen: string[] = [];
for (let i = 0; i < 200; i++) {
  const c = await page.locator('#start-count').first().innerText().catch(() => '');
  if (c && seen[seen.length - 1] !== c) seen.push(c);
  if (c === 'GO') { await adv(page, 0.2); await page.keyboard.press('d'); break; }   // human: D on GO with 0.2 s latency
  await adv(page, 0.1);
}
log(F, 'count beats seen: ' + seen.join(' '));
o = await obs(page); log(F, 'after D: tod ' + o.tod + ' phase ' + o.phase + ' driver ' + (await txt(page, '#driverlog')).replace(/\n/g, ' / '));
// Space on the official second (08:00:00)
o = await until(page, 'o.tod >= o.startTime', 10, 0.05); await adv(page, 0.2); await page.keyboard.press(' ');
// laps + S at the finish
let lastSign: number | null = null; let laps = 0; let sDone = false;
for (let i = 0; i < 40000; i++) {
  o = await obs(page); if (!o || o.phase === 'finished') break;
  const sign = o.ahead.find((f: any) => f.kind === 'sign');
  const fin = o.ahead.find((f: any) => f.kind === 'finish' || /finish|observation/i.test(f.label ?? ''));
  if (fin && fin.approxDistanceFt < 1200 && !sDone) { log(F, 'finish ahead ' + JSON.stringify(fin) + ' hint: ' + await txt(page, '#perfcard')); await shot(page, 'd01-finish-approach'); await page.keyboard.press('s'); sDone = true; }
  if (lastSign !== null && lastSign < 60 && (!sign || sign.approxDistanceFt > lastSign + 50)) { await adv(page, 0.25); await page.keyboard.press('l'); laps++; }
  lastSign = sign ? sign.approxDistanceFt : null;
  await adv(page, sign && sign.approxDistanceFt < 300 ? 0.05 : 0.5);
}
log(F, 'ahead kinds seen at end: ' + JSON.stringify(o?.ahead));
await page.waitForTimeout(500); log(F, 'url ' + page.url());
await shot(page, 'd01-retry-debrief');
log(F, '== DEBRIEF ==\n' + (await page.locator('#view').innerText()).slice(0, 2600));
await goto(page, '#/');
log(F, '== HOME start-here ==\n' + await txt(page, '#starthere-panel') + '\nlast runs: ' + await txt(page, '#lastruns'));
await shot(page, 'home-after-d01');
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
