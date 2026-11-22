/** PT-18 pass 1: holdSpeed widget by touch. Reads the gate for 3 s (checks nothing moves), taps Start, drags toward target+10 then target.
 *  usage: [hash] [target] [shot] */
import { open, shot, tap, touchDrag, BASE } from './pt18-common.js';
const { ctx, page, errors } = await open();
const [H = '#/school/m0/2', TGT = '35', OUT = '03-hold-done'] = process.argv.slice(2);
await page.goto(BASE + '/?mode=mobile' + H); await page.waitForSelector('[data-action=start-widget]');
const read = () => page.evaluate(() => ({ car: document.querySelector('[data-testid=car-speed]')?.textContent, drift: document.querySelector('[data-testid=drift]')?.textContent, done: !!document.querySelector('.s2-widget.s2-done'), w: (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '), st: (window as any).__rally.school.state() }));
console.log('at show', await read()); await page.waitForTimeout(3000); console.log('after reading 3 s', await read());
const t0 = Date.now();
await tap(page, '[data-action=start-widget]'); await page.waitForTimeout(300);
const sl = (await page.locator('[data-testid=speed-slider]').boundingBox())!;
const attr = await page.locator('[data-testid=speed-slider]').evaluate((e: HTMLInputElement) => ({ min: e.min, max: e.max, step: e.step, v: e.value }));
console.log('slider', attr, sl, await read());
const xOf = (v: number) => sl.x + 8 + (sl.width - 16) * (v - Number(attr.min)) / (Number(attr.max) - Number(attr.min));
const y = sl.y + sl.height / 2;
await touchDrag(page, xOf(Number(attr.v)), y, xOf(Number(TGT) + 10), y);
for (let i = 0; i < 3; i++) { await page.waitForTimeout(1000); console.log('t+', i + 1, await read()); }
await touchDrag(page, xOf(Number(TGT) + 10), y, xOf(Number(TGT)), y);
for (let i = 0; i < 20; i++) { await page.waitForTimeout(1000); const r = await read(); console.log('hold t+', i + 1, r.car, r.drift, r.done, r.st.complete); if (r.done) break; }
console.log('widget wall s from Start', ((Date.now() - t0) / 1000).toFixed(1));
await shot(page, OUT);
console.log(await read());
console.log('errors', errors); await ctx.close();
