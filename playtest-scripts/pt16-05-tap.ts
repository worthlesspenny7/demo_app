/** Pass 1: open a School page and tap things by visible text (in order), printing the page after each tap.
 *  usage: tsx pt16-05-tap.ts <hash> <shot> <text1> [text2 ...]   (a text "wait:N" waits N ms) */
import { open, shot, tap, BASE } from './pt16-common.js';
const [hash, name, ...texts] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(400);
const txt = () => page.evaluate(() => ((document.querySelector('[data-testid=page]') ?? document.querySelector('[data-screen]') ?? document.body) as HTMLElement).innerText.replace(/\n+/g, ' | '));
for (const t of texts) {
  if (t.startsWith('wait:')) { await page.waitForTimeout(Number(t.slice(5))); continue; }
  const loc = page.locator('button:visible, a:visible', { hasText: t }).filter({ hasText: new RegExp('^\\s*' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') });
  const n = await loc.count();
  const target = n ? loc.first() : page.getByText(t, { exact: true }).first();
  const b = await target.boundingBox(); if (!b) { console.log('NOT FOUND', t); break; }
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400);
  console.log(`tap "${t}" ->`, location(), await txt());
}
function location() { return page.url().replace(/.*#/, '#'); }
console.log('state', JSON.stringify(await page.evaluate(() => (window as any).__rally?.school?.state?.() ?? null)));
if (name !== '-') await shot(page, name);
console.log('errors', errors); await ctx.close();
