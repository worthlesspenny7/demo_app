/** Pass 1 step 1: a brand-new visitor opens the bare URL (fresh profile). */
import { open, shot, look, BASE } from './pt16-common.js';
const { ctx, page, errors } = await open();
const t0 = Date.now();
await page.goto(BASE + '/');
await page.waitForSelector('[data-screen]');
console.log('first paint ms', Date.now() - t0);
const l = await look(page);
console.log(JSON.stringify(l, null, 1));
await shot(page, '01-first-open');
console.log('errors', errors);
await ctx.close();
