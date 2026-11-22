/** A timed School mini-sim played by touch: tap the page's timing control at a chosen second (naive: after reading, N s) or at the oracle second + reaction.
 *  usage: tsx pt16-07-timed.ts <hash> <naive seconds | oracle[+r]> <shot|-> [retry: oracle] */
import { open, shot, BASE } from './pt16-common.js';
const [hash, when, name = '-', retry] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-miniacts button'); await page.waitForTimeout(200);
const txt = () => page.evaluate(() => (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '));
async function play(w: string) {
  const o = await page.evaluate(() => (window as any).__rally.school.oracle());
  const m = await page.evaluate(() => (window as any).__rally.school.mini());
  console.log('oracle', JSON.stringify(o), 'mini', JSON.stringify(m));
  const acts: [string, number][] = o?.taps?.length ? o.taps.map((t: number, i: number) => [i === 0 ? 'startstop' : 'lap', t]) : [[(await page.locator('.s2-miniacts [data-action=go]').count()) ? 'go' : 'call', o?.tapSeconds ?? 0]];
  const sel0 = await page.evaluate(() => [...document.querySelectorAll('.s2-miniacts button')].map(b => (b as HTMLElement).dataset.action + ':' + (b as HTMLElement).innerText.replace(/\s+/g, ' ')));
  console.log('controls', sel0);
  for (const [act, t] of acts) {
    const at = w.startsWith('oracle') ? t + Number(w.slice(6) || 0) : Number(w);
    const loc = page.locator(`.s2-miniacts [data-action=${act}]`).first();
    const b = (await loc.count()) ? await loc.boundingBox() : await page.locator('.s2-miniacts button').first().boundingBox();
    await page.waitForFunction(x => (window as any).__rally.school.mini().elapsed >= x, at, { polling: 'raf', timeout: 120000 });
    await page.touchscreen.tap(b!.x + b!.width / 2, b!.y + b!.height / 2);
    console.log(`tapped ${act} at ${at.toFixed(2)}`);
  }
  await page.waitForTimeout(500); console.log('->', await txt());
}
await play(when);
if (name !== '-') await shot(page, name);
if (retry && await page.locator('[data-action=try-again]').count()) {
  const b = (await page.locator('[data-action=try-again]').boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
  await play(retry);
}
console.log('state', JSON.stringify(await page.evaluate(() => (window as any).__rally.school.state())));
console.log('errors', errors); await ctx.close();
