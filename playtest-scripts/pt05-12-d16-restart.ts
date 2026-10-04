/** PT-05 step 12: D16 Bronze restart count on the road (UI-037): drive to the restart hold with the human model, then look at the road start
 *  card at T-12 and T-0, and how long the hold lasts at 1x (no fast-forward while stopped). Fresh profile, not recorded. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt05-common.js';
import { playHuman } from './pt05-human.js';
const F = '12-d16-restart.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/cockpit/drill/D16/0/1'); await hold(page);
const r = await playHuman(page, { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 8, until: "o.driver.state === 'waiting:hold' && o.stoppedAtLine === 6", log: s => log(F, s) });
let o = await obs(page);
log(F, `at restart hold: tod ${o.tod} launch ${JSON.stringify(o.launch)} wall so far ${(r.wall / 60).toFixed(1)} min`);
log(F, 'road start card: ' + await txt(page, '#startcard-road') + '\nperf: ' + await txt(page, '#perfcard') + '\nscale chip: ' + await txt(page, '#scale'));
await shot(page, 'd16-restart-hold');
const waitS = o.launch.launchTime - o.tod; log(F, `hold until launch: ${waitS.toFixed(0)} s = ${(waitS / 60).toFixed(1)} min at 1x (car stopped -> adaptive scale 1x)`);
await adv(page, waitS - 31); await page.keyboard.press('w'); await adv(page, 19);
await shot(page, 'd16-restart-count-road');
log(F, 'T-12 road card: ' + await txt(page, '#startcard-road'));
await adv(page, 7); await shot(page, 'd16-restart-count-road-T5');
const cb = await page.locator('#start-count-road').boundingBox().catch(() => null); const rb = await page.locator('.road').boundingBox();
log(F, 'T-5 count box ' + JSON.stringify(cb) + ' road box ' + JSON.stringify(rb) + ' visible ' + await page.locator('#start-count-road').isVisible() + ' text ' + await txt(page, '#start-count-road'));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
