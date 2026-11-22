/** Follow the screen on a CALL card: Start, watch the bar, tap (touch or mouse) when the fill reaches the CALL tick; print what the
 *  grader says vs the oracle. usage: <hash> <touch|mouse|oracle-touch|oracle-mouse> [ms spent reading before Start] */
import { open, tap, BASE } from './pt17-common.js';
const [hash, how = 'touch'] = process.argv.slice(2);
const { ctx, page, errors } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt17-probe' });
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-minisim'); await page.waitForTimeout(Number(process.argv[4] ?? 300)); /* reading time before Start, ms */
await tap(page, '.s2-miniacts [data-action=start-card]');
const o = await page.evaluate(() => (window as any).__rally.school.oracle());
const geo = await page.evaluate(() => { const t = document.querySelector('.msign-track')!.getBoundingClientRect(); const c = document.querySelector('.msign-call') as HTMLElement | null; return { left: t.left, width: t.width, call: c ? parseFloat(c.style.left) : null }; });
console.log('oracle', JSON.stringify(o), 'call tick at', geo.call, '% of the track');
const b = (await page.locator('.s2-miniacts [data-action=go]').boundingBox())!;
let tAt = 0;
for (;;) {
  const s = await page.evaluate(() => ({ e: (window as any).__rally.school.mini().elapsed, w: parseFloat((document.querySelector('.msign-fill') as HTMLElement).style.width), ft: document.querySelector('.msign-ft')?.textContent, mark: document.querySelector('.msign-mark')?.textContent }));
  const follow = how.startsWith('oracle') ? s.e >= o.tapSeconds : geo.call !== null && s.w <= geo.call;
  if (follow) { tAt = s.e; console.log('tap at', s); break; }
  await page.waitForTimeout(10);
}
if (how.endsWith('mouse')) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(300);
console.log('verdict', (await page.locator('[data-testid=mini-verdict]').innerText().catch(() => 'none')).replace(/\n+/g, ' | '));
const tr = await page.evaluate(() => (window as any).__rally.school.mini().timing);
console.log('timing', JSON.stringify(tr), 'tapped at', tAt.toFixed(2));
console.log('errors', errors); await ctx.close();
