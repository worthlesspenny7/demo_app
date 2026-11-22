/** PT-18: list elements of a School page that stick out of the viewport. usage: <hash> [w] [h] */
import { open, BASE } from './pt18-common.js';
const [h, w = '390', hh = '844'] = process.argv.slice(2);
const { ctx, page } = await open({ width: Number(w), height: Number(hh), profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/probe' + w });
await page.goto(BASE + '/?mode=mobile' + h); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(300);
console.log(await page.evaluate(() => [...document.querySelectorAll('[data-testid=page] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => `${e.tagName}.${(e as HTMLElement).className?.baseVal ?? (e as HTMLElement).className} "${(e.textContent ?? '').slice(0, 40)}" ${JSON.stringify(e.getBoundingClientRect())}`)));
if (process.argv[5]) await page.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt18-' + process.argv[5] + '.png' });
await ctx.close();
