/** Open a reference chip as a newcomer would (touch), wait for the sheet to settle, screenshot, report its box. usage: <hash> <chip index> <shot> */
import { open, shot, BASE } from './pt16-common.js';
const [hash = '#/school/m0/1', idx = '0', name = '17-sheet'] = process.argv.slice(2);
const { ctx, page } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-audit-390' });
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-chip');
const b = (await page.locator('.s2-chip').nth(Number(idx)).boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
for (const ms of [100, 400, 1000]) { await page.waitForTimeout(ms); console.log(ms, await page.evaluate(() => { const s = document.querySelector('#s2-sheet .s2-sheet-body') as HTMLElement | null; if (!s) return 'none'; const r = s.getBoundingClientRect(); return `top ${r.top.toFixed(0)} bottom ${r.bottom.toFixed(0)} h ${r.height.toFixed(0)} vh ${innerHeight} scroll ${s.scrollHeight}/${s.clientHeight}`; })); }
await shot(page, name); await ctx.close();
