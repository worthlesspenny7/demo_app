/** Look at Home (phone) now: what is the primary button? usage: <shot> */
import { open, shot, BASE } from './pt16-common.js';
const [name = '16-home-after-core'] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(BASE + '/?mode=mobile#/m'); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(400);
console.log(await page.evaluate(() => (document.querySelector('[data-screen]') as HTMLElement).innerText.replace(/\n+/g, ' | ')));
console.log(await page.evaluate(() => [...document.querySelectorAll('.primary, [class*=primary]')].map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ') + ' -> ' + ((e as HTMLAnchorElement).getAttribute('href') ?? (e as HTMLElement).dataset.testid))));
console.log(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1') ?? '{}').course)));
await shot(page, name); await ctx.close();
