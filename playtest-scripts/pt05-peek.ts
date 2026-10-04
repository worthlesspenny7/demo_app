/** PT-05 helper: print a screen's text (and localStorage keys) in the shared profile. */
import { launch, goto } from './pt05-common.js';
const h = await launch({ width: 1366, height: 768 });
await goto(h.page, process.argv[2] ?? '#/debrief');
console.log((await h.page.locator('#view').innerText()).slice(0, Number(process.argv[3] ?? 1500)));
console.log('LS', await h.page.evaluate(() => Object.keys(localStorage).map(k => k + ':' + localStorage.getItem(k)!.length)));
console.log('errors', h.errors);
if (process.argv[4] === 'save') await h.save();
await h.browser.close();
