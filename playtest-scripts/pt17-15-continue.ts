/** B13 (first visit consumed by opening) and Continue course, on a throwaway fresh profile. */
import { open, tap, BASE } from './pt17-common.js';
const P = '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-fresh-' + Date.now();
let { ctx, page } = await open({ profile: P });
await page.goto(BASE + '/'); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(500);
console.log('open 1 (no tap):', page.url().replace(/.*4189/, ''));
await ctx.close();
({ ctx, page } = await open({ profile: P }));
await page.goto(BASE + '/'); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(500);
console.log('open 2:', page.url().replace(/.*4189/, ''), (await page.locator('[data-screen]').innerText()).slice(0, 120).replace(/\n+/g, ' | '));
await page.goto(BASE + '/?mode=mobile#/school/m0/1'); await page.waitForSelector('[data-testid=page]');
for (let i = 0; i < 3; i++) { await tap(page, '[data-action=next]:visible'); await page.waitForTimeout(300); }
await tap(page, '[data-testid=s2-home]'); await page.waitForTimeout(500);
console.log('after x:', page.url().replace(/.*4189/, ''), await page.locator('[data-testid=continue-course]').innerText().catch(() => 'no continue button'));
await tap(page, '[data-testid=continue-course]'); await page.waitForTimeout(500);
console.log('continue ->', page.url().replace(/.*4189/, ''));
await ctx.close();
