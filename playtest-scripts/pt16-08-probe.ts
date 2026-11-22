/** Probe a timed mini-sim page: print the page text and mini() every 0.5 s for N s without tapping, then tap once at T s (touch) and print. usage: <hash> <N> [T] */
import { open, BASE } from './pt16-common.js';
const [hash, N = '10', T] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-miniacts button');
const t0 = Date.now(); let tapped = false;
while ((Date.now() - t0) / 1000 < Number(N)) {
  const s = (Date.now() - t0) / 1000;
  if (T && !tapped && s >= Number(T)) { const b = (await page.locator('.s2-miniacts button').first().boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); tapped = true; console.log('TAP at', s.toFixed(1)); }
  const r = await page.evaluate(() => ({ t: (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '), m: (window as any).__rally.school.mini() }));
  console.log(s.toFixed(1), 'el', r.m.elapsed?.toFixed(2), r.t.slice(-160));
  await page.waitForTimeout(500);
}
console.log('errors', errors); await ctx.close();
