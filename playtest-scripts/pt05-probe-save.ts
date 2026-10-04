/** PT-05 probe: is a finished drill recorded to localStorage (progress + last run)? */
import { launch, goto, adv, obs, hold } from './pt05-common.js';
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/cockpit/drill/D01/0/1'); await hold(page);
let o = await obs(page);
await adv(page, o.secondsToStart - 4); await page.keyboard.press('d'); await page.keyboard.press(' ');
await adv(page, 400);
await page.waitForTimeout(800);
console.log('url', page.url());
console.log('LS', await page.evaluate(() => Object.keys(localStorage).map(k => k + ':' + localStorage.getItem(k)!.slice(0, 300))));
await h.close();
console.log('state saved');
