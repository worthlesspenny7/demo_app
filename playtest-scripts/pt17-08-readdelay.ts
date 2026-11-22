/** SCH-022 check on the graded clock: read the card for N ms, tap Start, then tap exactly at the oracle seconds (touch).
 *  A correct verdict at 300 ms and a wrong one at 4000 ms means time spent reading before Start is still graded.
 *  usage: <ms> <hash>... */
import { open, tap, BASE } from './pt17-common.js';
const [ms, ...hashes] = process.argv.slice(2);
const { ctx, page, errors } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-probe' });
const el = () => page.evaluate(() => (window as any).__rally.school.mini().elapsed as number);
for (const hash of hashes) {
  await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-minisim'); await page.waitForTimeout(Number(ms));
  const kind = (await page.evaluate(() => (window as any).__rally.school.mini())).kind;
  if (await page.locator('.s2-miniacts [data-action=start-card]').count()) await tap(page, '.s2-miniacts [data-action=start-card]');
  else console.log('  (no Start button)');
  const o = await page.evaluate(() => (window as any).__rally.school.oracle());
  const seq: [string, number][] = o?.taps?.length ? o.taps.map((t: number, k: number) => [k === 0 ? 'startstop' : 'lap', t]) : o?.tapSeconds !== undefined ? [['go', o.tapSeconds]] : [];
  for (const [act, t] of seq) {
    const b = (await page.locator(`.s2-miniacts [data-action=${act}]`).first().boundingBox())!;
    while ((await el()) < t + 0.05) await page.waitForTimeout(8);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  await page.waitForTimeout(300);
  console.log(`${hash} ${kind} read ${ms} ms, oracle ${JSON.stringify(o)} -> ${(await page.locator('[data-testid=mini-verdict]').innerText().catch(() => 'no verdict')).replace(/\n+/g, ' | ').slice(0, 120)}`);
}
console.log('errors', errors); await ctx.close();
