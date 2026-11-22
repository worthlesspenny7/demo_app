/** tapLap: does the LAP button move after each lap? Re-measure before each tap; LAP when the car's nose reaches each marker. */
import { open, shot, BASE } from './pt16-common.js';
const { ctx, page } = await open();
await page.goto(BASE + '/?mode=mobile#/school/m3/4'); await page.waitForSelector('[data-action=lap]');
const pos = () => page.evaluate(() => { const w = document.querySelector('[data-widget=tapLap]')!; const car = w.querySelector('.s2-car')?.getBoundingClientRect(); const marks = [...w.querySelectorAll('[class*=mark]')].map(m => { const r = m.getBoundingClientRect(); return Math.round(r.x + r.width / 2); }); return { car: car ? Math.round(car.x + car.width) : null, marks, t: (w as HTMLElement).innerText.replace(/\n+/g, ' | ') }; });
let k = 0; const t0 = Date.now();
while (k < 3 && Date.now() - t0 < 60000) { const p = await pos(); if (p.car !== null && p.car >= p.marks[k]!) { const b = (await page.locator('[data-action=lap]').boundingBox())!; console.log('LAP button y', Math.round(b.y)); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); k++; } await page.waitForTimeout(40); }
await page.waitForTimeout(400); console.log((await pos()).t); await shot(page, '14-taplap-laps');
const o = await page.evaluate(() => [...document.querySelectorAll('.s2-q button')].map(b => (b as HTMLElement).innerText + ' ' + (b as HTMLElement).dataset.right));
console.log(o); await ctx.close();
