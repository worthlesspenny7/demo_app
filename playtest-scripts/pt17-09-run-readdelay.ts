/** SCH-022 on run cards (try-it / daily): for each timed card read N ms, tap Start, tap at the oracle second (touch). usage: <ms> <hash> */
import { open, tap, BASE } from './pt17-common.js';
const [ms, hash] = process.argv.slice(2);
const { ctx, page, errors } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-probe' });
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(500);
const st = () => page.evaluate(() => (window as any).__rally.decision.state());
const el = () => page.evaluate(() => (window as any).__rally.decision.elapsed() as number);
for (let i = 0; i < 40; i++) {
  const s = await st(); if (s.screen !== 'run') break;
  if (s.phase === 'rule') { await tap(page, '.mob-actions [data-action=ack]'); await page.waitForTimeout(200); continue; }
  if (s.phase === 'verdict') { await tap(page, '.mob-actions [data-action=next]'); await page.waitForTimeout(200); continue; }
  if (s.phase !== 'decision') { await page.waitForTimeout(100); continue; }
  const o = await page.evaluate(() => (window as any).__rally.decision.oracle());
  if (o?.optionId !== undefined) { await tap(page, `.mob-actions [data-option="${o.optionId}"]`); await page.waitForTimeout(250); continue; }
  await page.waitForTimeout(Number(ms));
  const hadStart = await page.locator('.mob-actions [data-action=start-card]').count();
  if (hadStart) await tap(page, '.mob-actions [data-action=start-card]');
  const o2 = await page.evaluate(() => (window as any).__rally.decision.oracle());
  const seq: [string, number][] = o2?.taps?.length ? o2.taps.map((t: number, k: number) => [k === 0 ? 'startstop' : 'lap', t]) : [['go', o2.tapSeconds]];
  for (const [act, t] of seq) { const b = (await page.locator(`.mob-actions [data-action=${act}]`).first().boundingBox())!; while ((await el()) < t + 0.05) await page.waitForTimeout(8); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  await page.waitForTimeout(300);
  console.log(`#${s.n} ${s.kind} Start=${hadStart} read ${ms} -> ${(await page.locator('[data-testid=verdict]').innerText().catch(() => 'none')).replace(/\n+/g, ' | ').slice(0, 110)}`);
}
console.log('errors', errors); await ctx.close();
