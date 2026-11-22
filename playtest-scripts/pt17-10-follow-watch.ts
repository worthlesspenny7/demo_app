/** A player who follows the watch face (not the internal clock): read N ms, Start, note the digits right after Start, tap GO when the
 *  digits reach the sit time printed on the card. usage: <ms> <hash> <target seconds> */
import { open, tap, BASE } from './pt17-common.js';
const [ms, hash, target] = process.argv.slice(2);
const { ctx, page } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-probe' });
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-minisim'); await page.waitForTimeout(Number(ms));
const dig = () => page.evaluate(() => document.querySelector('.s2-miniacts [data-testid=watch-digits]')?.textContent ?? '');
const tod = () => page.evaluate(() => document.querySelector('.s2-miniacts [data-testid=tod-digits]')?.textContent ?? '');
console.log('before Start digits', await dig(), 'tod', await tod());
await tap(page, '.s2-miniacts [data-action=start-card]'); await page.waitForTimeout(60);
console.log('60 ms after Start digits', await dig(), 'tod', await tod());
const secs = (s: string) => { const m = /(\d+):(\d+\.\d+)/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const b = (await page.locator('.s2-miniacts [data-action=go]').boundingBox())!;
while (secs(await dig()) < Number(target)) await page.waitForTimeout(10);
await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
console.log('verdict', (await page.locator('[data-testid=mini-verdict]').innerText()).replace(/\n+/g, ' | ').slice(0, 100));
await ctx.close();
