/** PT-08 probe: on a full-start drill (D08, D16) the pre-read's "Fast-forward to the start time" button: where does it land against the launch second,
 *  what does the screen say then, and what does pressing D at once cost? Scratch profile. usage: tsx pt08-probe-ff-start.ts <hash> <label> */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt08-common.js';
const [hash = 'drill/D08/0/1', label = 'ff-d08'] = process.argv.slice(2);
const F = `probe-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, `#/cockpit/${hash}`); await hold(page);
let o = await obs(page); log(F, `before: tod ${o.tod} secondsToStart ${o.secondsToStart} launch ${JSON.stringify(o.launch)}`);
const b = page.locator('#skip'); log(F, 'button: ' + await b.innerText()); await b.click(); await page.waitForTimeout(150);
o = await obs(page); log(F, `after: phase ${o.phase} tod ${o.tod} secondsToStart ${o.secondsToStart} launch ${JSON.stringify(o.launch)}`);
await shot(page, `${label}-after-ff`);
log(F, 'preread: ' + await txt(page, '#preread') + '\ncount: ' + await txt(page, '#start-count') + '\nperf: ' + (await txt(page, '#perfcard')).slice(0, 500));
await adv(page, 1); await page.keyboard.press('d'); await adv(page, 0.5);
o = await obs(page); log(F, `pressed D one second later: phase ${o.phase} tod ${o.tod}; driver ${(await txt(page, '#driverlog')).split('\n').slice(-3).join(' / ')}`);
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.browser.close();
