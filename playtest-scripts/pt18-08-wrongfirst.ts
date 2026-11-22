/** PT-18 (from pt17-06): timed mini-sim, wrong tap first, by touch: checks the clock is frozen before Start, the verdict stays after a wrong tap,
 *  Try again needs its own tap, and a second attempt (after Start again if offered) can succeed.
 *  usage: <hash> <wrong offset s (e.g. -3 or +2)> [shot prefix] [right offset s, default 0.15] */
import { open, shot, tap, BASE } from './pt18-common.js';
const [hash, off = '-3', prefix = '', rightOff = '0.15'] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-minisim');
await page.waitForTimeout(300);
const mini = () => page.evaluate(() => (window as any).__rally.school.mini());
const orc = () => page.evaluate(() => (window as any).__rally.school.oracle());
const txt = () => page.evaluate(() => (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '));
const el = () => page.evaluate(() => (window as any).__rally.school.mini().elapsed as number);
async function play(offset: number, label: string) {
  const m0 = await mini(); const hasStart = await page.locator('.s2-miniacts [data-action=start-card]').count();
  await page.waitForTimeout(1000); const m1 = await mini();
  console.log(`[${label}] kind=${m0.kind} attempt=${m0.attempt} Start button=${hasStart} elapsed before Start ${m0.elapsed.toFixed(2)} -> ${m1.elapsed.toFixed(2)} after 1 s`);
  console.log('  page:', (await txt()).slice(0, 420));
  if (hasStart) { await tap(page, '.s2-miniacts [data-action=start-card]'); await page.waitForTimeout(80); }
  const o = await orc(); console.log('  oracle', JSON.stringify(o));
  const seq: [string, number][] = o.taps?.length ? o.taps.map((t: number, k: number) => [k === 0 ? 'startstop' : 'lap', t]) : [['go', o.tapSeconds]];
  for (let k = 0; k < seq.length; k++) {
    const [act, t] = seq[k]!; const target = Math.max(0.3, t + (k === seq.length - 1 ? offset : 0.1));
    let loc = page.locator(`.s2-miniacts [data-action=${act}]`); if (!(await loc.count())) loc = page.locator('.s2-miniacts [data-action=go]');
    const b = (await loc.first().boundingBox())!;
    while ((await el()) < target) await page.waitForTimeout(10);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    console.log(`  tapped ${act} at ${(await el()).toFixed(2)} (truth ${t.toFixed(2)})`);
  }
  await page.waitForTimeout(200);
  const v = page.locator('[data-testid=mini-verdict]');
  console.log('  verdict right after:', await v.count() ? `${await v.getAttribute('data-correct')} "${(await v.innerText()).replace(/\n+/g, ' | ')}"` : 'NONE');
  if (prefix) await shot(page, `${prefix}-${label}`);
  await page.waitForTimeout(1500);
  console.log('  1.5 s later: verdict', await v.count() ? 'still there' : 'GONE', 'attempt', (await mini()).attempt);
}
await play(Number(off), 'wrong');
if (await page.locator('[data-action=try-again]').count()) { await page.waitForTimeout(500); await tap(page, '[data-action=try-again]'); await page.waitForTimeout(400); }
else console.log('NO Try again button');
await play(Number(rightOff), 'retry');
console.log('  final:', (await txt()).slice(-300), '| complete', (await mini()).complete);
console.log('errors', errors); await ctx.close();
