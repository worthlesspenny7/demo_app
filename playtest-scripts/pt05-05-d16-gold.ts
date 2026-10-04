/** PT-05 step 5: D16 Gold (aids rung 0, legal): what the start queue, pace cars, the loose-minute-hand clock and the watch TOD mode look like
 *  to Josh, and whether a naive clock read near the top of a minute is recoverable. Real keys for every action; time via advance only. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv, until } from './pt05-common.js';
const F = '05-d16-gold.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/cockpit/drill/D16/2/1'); await hold(page);
let o = await obs(page);
log(F, 'preread: ' + (await txt(page, '#preread')).slice(0, 900));
log(F, 'drawer: ' + await txt(page, '.drawer .bar'));
log(F, 'launch ' + JSON.stringify(o.launch) + '\nqueue ' + JSON.stringify(o.startQueue) + '\npace ' + JSON.stringify(o.paceCars) + '\nclock ' + JSON.stringify(o.clock));
await shot(page, 'd16gold-preread');
// Q too early (the car ahead is still at the sign)
await page.keyboard.press('q'); await adv(page, 0.1); log(F, 'Q early -> ' + await txt(page, '#alert'));
// close the pre-read box? watch the clock at the top of the minute before the start: T-62 .. T-55
o = await obs(page); const toMin = (60 - (o.tod % 60)) % 60; await adv(page, toMin - 3);
o = await obs(page); log(F, `at tod ${o.tod.toFixed(1)} clock ${JSON.stringify(o.clock)} warn: ${await txt(page, '#clock-warn')}`);
await page.locator('#clock').screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt05-d16gold-clock-ambiguous.png' });
await shot(page, 'd16gold-ambiguous-minute');
await page.keyboard.press('m'); await adv(page, 0.1);
log(F, 'TOD mode lcd: ' + await txt(page, '#lcd') + ' mode ' + await txt(page, '#dw-mode') + ' hint ' + await txt(page, '#dw-hint'));
await page.keyboard.press('k'); await adv(page, 0.1); log(F, 'K -> ' + await txt(page, '#alert'));
await page.locator('#stopwatch').screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt05-d16gold-watch-tod.png' });
await page.keyboard.press('m');
// wait for the car ahead to leave, then Q, W at ~30 s, then D on my own count (no visible count at rung 0?)
o = await until(page, '!o.startQueue || !o.startQueue.carAheadAtSign', 400, 0.5);
log(F, `car ahead gone at ${o.tod}; queue ${JSON.stringify(o.startQueue)}`);
await page.keyboard.press('q'); await adv(page, 0.2); log(F, 'Q -> ' + await txt(page, '#alert') + ' | ' + (await txt(page, '#preread')).slice(0, 300));
o = await obs(page); log(F, 'launch now ' + JSON.stringify(o.launch));
await adv(page, o.launch.secondsToLaunch - 31); await page.keyboard.press('w'); await adv(page, 0.2);
await adv(page, 20);
await shot(page, 'd16gold-T-10');
log(F, 'T-10 preread: ' + (await txt(page, '#preread')).slice(0, 500) + '\ncount visible ' + await page.locator('#start-count').first().isVisible());
// Josh launches on his own: own time minus 4 s, reading the TOD
o = await obs(page); await adv(page, o.launch.launchTime - o.tod); await page.keyboard.press('d'); await page.keyboard.press(' ');
await adv(page, 30);
o = await obs(page); log(F, 'running; pace ' + JSON.stringify(o.paceCars) + ' cues ' + JSON.stringify(o.cues) + ' ahead ' + JSON.stringify(o.ahead).slice(0, 400));
await shot(page, 'd16gold-road-pacecar');
log(F, 'hud: ' + await txt(page, '.hud'));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();   // not saved: a probe, not a played run
