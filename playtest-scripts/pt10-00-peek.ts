/** PT-10 peek: open a hash in a scratch (never-saved) fresh profile and dump the view text. usage: tsx pt10-00-peek.ts '<hash>' [selector] */
import { launch, goto, txt } from './pt10-common.js';
const [hash = '#/', sel = '#view'] = process.argv.slice(2);
const h = await launch({ width: 1366, height: 768 }, true);
await goto(h.page, hash); await h.page.waitForTimeout(300);
console.log(await txt(h.page, sel));
console.log('errors', JSON.stringify(h.errors));
await h.browser.close();
