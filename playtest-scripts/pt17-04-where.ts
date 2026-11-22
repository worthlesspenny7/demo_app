/** Module 0 page 4 whereCheckpoint as a newcomer: the clock runs on page show (no Start); watch the car, tap when its nose reaches the green sign. */
import { open, shot, tap, BASE } from './pt17-common.js';
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile#/school/m0/4'); await page.waitForSelector('[data-action=leg-ended]');
const clock0 = await page.locator('[data-testid=leg-clock]').textContent();
await page.waitForTimeout(1000); const clock1 = await page.locator('[data-testid=leg-clock]').textContent();
console.log('clock at show', clock0, 'after 1 s', clock1, 'start button?', await page.locator('[data-action=start-card]').count());
let shotMid = false;
for (let i = 0; i < 400; i++) {
  const g = await page.evaluate(() => { const car = document.querySelector('[data-widget=whereCheckpoint] .s2-car:not(.s2-ghost)')!.getBoundingClientRect(); const s = document.querySelector('[data-testid=checkpoint]')!.getBoundingClientRect(); return { nose: car.right, sign: s.left + s.width / 2, clock: document.querySelector('[data-testid=leg-clock]')?.textContent }; });
  if (!shotMid && parseFloat(g.clock ?? '0') > 8) { shotMid = true; await shot(page, '06-where-mid'); }
  if (g.nose >= g.sign) { console.log('nose at sign', g); await tap(page, '[data-action=leg-ended]'); break; }
  await page.waitForTimeout(50);
}
await page.waitForTimeout(500);
console.log((await page.locator('[data-testid=page]').innerText()).replace(/\n+/g, ' | '));
await shot(page, '07-where-result');
console.log('errors', errors); await ctx.close();
