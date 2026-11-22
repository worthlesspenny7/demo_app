/** Pass 1: tapLap as a newcomer: watch the car and LAP when it reaches each marker (by eye from the DOM positions). */
import { open, shot, BASE } from './pt16-common.js';
const { ctx, page } = await open();
await page.goto(BASE + '/?mode=mobile#/school/m3/4'); await page.waitForSelector('[data-action=lap]');
const pos = () => page.evaluate(() => { const w = document.querySelector('[data-widget=tapLap]')!; const car = w.querySelector('.s2-car')?.getBoundingClientRect(); const marks = [...w.querySelectorAll('[class*=mark]')].map(m => { const r = m.getBoundingClientRect(); return Math.round(r.x + r.width / 2); }); return { car: car ? Math.round(car.x + car.width) : null, marks, t: (w as HTMLElement).innerText.replace(/\n+/g, ' | ') }; });
console.log(await pos()); await page.waitForTimeout(1500); await shot(page, '13-taplap-running'); console.log(await pos());
const b = (await page.locator('[data-action=lap]').boundingBox())!;
let k = 0; const t0 = Date.now();
while (k < 3 && Date.now() - t0 < 60000) { const p = await pos(); const target = p.marks[k]; if (p.car !== null && target !== undefined && p.car >= target) { await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); console.log('lap', k + 1, ((Date.now() - t0) / 1000).toFixed(1), p); k++; } await page.waitForTimeout(50); }
await page.waitForTimeout(400); console.log((await pos()).t); await shot(page, '14-taplap-laps');
await ctx.close();
