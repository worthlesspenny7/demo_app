/** PT-18: m0 p4 whereCheckpoint. Reads under Start 3 s, taps Start, taps when the car nose reaches the sign (offset s via arg), checks Try again. */
import { open, shot, tap, BASE } from './pt18-common.js';
const [OFF = '0', OUT = '04-where-result'] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile#/school/m0/4'); await page.waitForSelector('[data-action=start-widget]');
await page.waitForTimeout(3000);
console.log('clock after 3 s reading', await page.locator('[data-testid=leg-clock]').textContent());
await tap(page, '[data-action=start-widget]'); const t0 = Date.now();
await page.waitForSelector('[data-action=leg-ended]');
for (let i = 0; i < 600; i++) {
  const g = await page.evaluate(() => { const car = document.querySelector('[data-widget=whereCheckpoint] .s2-car:not(.s2-ghost)')?.getBoundingClientRect(); const s = document.querySelector('[data-testid=checkpoint]')?.getBoundingClientRect(); return { nose: car?.right ?? 0, sign: s ? s.left + s.width / 2 : 9999, clock: document.querySelector('[data-testid=leg-clock]')?.textContent }; });
  if (g.nose >= g.sign) { console.log('nose at sign', g); if (Number(OFF)) await page.waitForTimeout(Number(OFF) * 1000); await tap(page, '[data-action=leg-ended]'); break; }
  await page.waitForTimeout(40);
}
await page.waitForTimeout(500);
console.log('wall from Start', (Date.now() - t0) / 1000);
console.log((await page.locator('[data-testid=page]').innerText()).replace(/\n+/g, ' | '));
console.log('buttons', await page.evaluate(() => [...document.querySelectorAll('[data-testid=page] button')].map(b => (b as HTMLElement).innerText + ((b as HTMLButtonElement).disabled ? '(disabled)' : ''))));
await shot(page, OUT);
console.log('errors', errors); await ctx.close();
