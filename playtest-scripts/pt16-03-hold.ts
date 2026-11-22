/** Pass 1: Module 0 page 2 holdSpeed, played by touch: drag the slider toward 35 as a newcomer would, watch the readout. */
import { open, shot, look, tap, touchDrag, BASE } from './pt16-common.js';
const { ctx, page, errors } = await open();
const [H = '#/school/m0/2', TGT = '35', OUT = '02-holdspeed-done'] = process.argv.slice(2);
await page.goto(BASE + '/?mode=mobile' + H); await page.waitForSelector('[data-testid=speed-slider]');
const read = () => page.evaluate(() => ({ car: document.querySelector('[data-testid=car-speed]')?.textContent, drift: document.querySelector('[data-testid=drift]')?.textContent, done: !!document.querySelector('.s2-widget.s2-done'), w: (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '), st: (window as any).__rally.school.state() }));
await page.waitForTimeout(3000); console.log('after reading 3 s', await read());
const sl = (await page.locator('[data-testid=speed-slider]').boundingBox())!;
const attr = await page.locator('[data-testid=speed-slider]').evaluate((e: HTMLInputElement) => ({ min: e.min, max: e.max, step: e.step, v: e.value }));
console.log('slider', attr, sl);
// a newcomer first overshoots to "catch up" (drag to ~45), then back to ~35
const xOf = (v: number) => sl.x + 8 + (sl.width - 16) * (v - Number(attr.min)) / (Number(attr.max) - Number(attr.min));
const thumbX = xOf(Number(attr.v)), y = sl.y + sl.height / 2;
await touchDrag(page, thumbX, y, xOf(Number(TGT) + 10), y);
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); console.log('t+', i + 1, await read()); }
await touchDrag(page, xOf(Number(TGT) + 10), y, xOf(Number(TGT)), y);
for (let i = 0; i < 14; i++) { await page.waitForTimeout(1000); const r = await read(); console.log('hold t+', i + 1, r.car, r.drift, r.done, r.st.complete); if (r.done) break; }
await shot(page, OUT);
console.log(await read());
console.log('errors', errors); await ctx.close();
