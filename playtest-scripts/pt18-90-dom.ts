import { open, tap, BASE } from './pt18-common.js';
const { ctx, page } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/probe' });
for (const h of process.argv.slice(2)) {
await page.goto(BASE + '/?mode=mobile' + h); await page.waitForSelector('.s2-minisim'); await page.waitForTimeout(300);
await tap(page, '.s2-miniacts [data-action=start-card]'); await page.waitForTimeout(1500);
console.log(h, (await page.evaluate(() => document.querySelector('.s2-minisim')!.outerHTML)).replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').slice(0, 5000));
}
await ctx.close();
