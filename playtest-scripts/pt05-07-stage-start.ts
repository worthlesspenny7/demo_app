/** PT-05 step 7: the first minute of the full day stage (builtin/stage/1): line 1 is a Tire Warm-up transit with no assigned speed.
 *  What does Josh see, does Dad move, what prompts him to call a speed? (fresh profile so the shared one keeps its history) */
import { launch, goto, shot, txt, log, reset, hold, obs, adv, type } from './pt05-common.js';
const F = '07-stage-start.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/cockpit/builtin/stage/1'); await hold(page);
let o = await obs(page);
await adv(page, o.launch.secondsToLaunch - 31); await page.keyboard.press('w'); await page.keyboard.press('q');
o = await obs(page); await adv(page, o.launch.launchTime - o.tod); await page.keyboard.press('d'); await page.keyboard.press(' ');
await adv(page, 60);
o = await obs(page);
log(F, `60 s after D: state ${o.driver.state} speedo ${o.speedo.reading} target ${o.driver.targetIndicated} carStopped ${o.carStopped}`);
log(F, 'driver: ' + await txt(page, '#driverlog')); log(F, 'perf: ' + await txt(page, '#perfcard')); log(F, 'next-call: ' + await txt(page, '#next-call')); log(F, 'hud: ' + (await txt(page, '.hud')).replace(/\n/g, ' '));
log(F, 'book row 1-3: ' + (await txt(page, '#book')).slice(0, 900));
await shot(page, 'stage-stuck-at-start');
await adv(page, 600); o = await obs(page); log(F, `+10 min: state ${o.driver.state} speedo ${o.speedo.reading} msgs ${o.driver.messages.slice(-3).map((m: any) => m.text).join(' / ')}`);
await type(page, '40'); await page.keyboard.press('Enter'); await adv(page, 30); o = await obs(page);
log(F, `after calling 40: state ${o.driver.state} speedo ${o.speedo.reading} driver ${(await txt(page, '#driverlog')).split('\n').slice(-3).join(' / ')}`);
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
