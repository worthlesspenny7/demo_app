/** PT-18 pass 1 step 1: a brand-new visitor opens the bare URL (fresh profile), reads, notes words, buttons, timers. */
import { open, shot, look, words, BASE } from './pt18-common.js';
const { ctx, page, errors } = await open();
const t0 = Date.now();
await page.goto(BASE + '/');
await page.waitForSelector('[data-screen]');
console.log('first paint ms', Date.now() - t0);
await page.waitForTimeout(500);
const l = await look(page);
console.log('hash', l.hash, 'words page', words(l.text), 'words screen', words(l.all));
console.log(l.all);
console.log('buttons', l.buttons, 'chips', l.chips, 'scroll', JSON.stringify(l.docScroll), JSON.stringify(l.pageScroll));
console.log('school', JSON.stringify(l.school));
await shot(page, '01-first-open');
console.log('errors', errors);
await ctx.close();
