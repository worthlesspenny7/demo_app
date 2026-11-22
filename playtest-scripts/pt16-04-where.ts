/** Pass 1: Module 0 page 4 whereCheckpoint as a newcomer: watch the car, tap when it looks like it reached the end of the strip. */
import { open, shot, tap, BASE } from './pt16-common.js';
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile#/school/m0/4'); await page.waitForSelector('[data-action=leg-ended]');
const carX = () => page.evaluate(() => { const w = document.querySelector('[data-widget=whereCheckpoint]') ?? document.querySelector('[data-testid=page]')!; const els = [...w.querySelectorAll('*')].filter(e => getComputedStyle(e).backgroundColor === 'rgb(240, 180, 90)' || (e as HTMLElement).className?.toString().includes('car')); return els.map(e => { const r = e.getBoundingClientRect(); return `${(e as HTMLElement).className} x=${r.x.toFixed(0)} w=${r.width.toFixed(0)}`; }).slice(0, 4); });
const clock = () => page.evaluate(() => (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '));
let tapped = false;
for (let i = 0; i < 60 && !tapped; i++) {
  await page.waitForTimeout(1000);
  const cx = await carX(); const c = await clock();
  if (i % 5 === 4) console.log(i + 1, c, cx);
  if (i === 9) await shot(page, '03-where-mid');
  const m = cx.map(s => /x=(\d+) w=(\d+)/.exec(s)).find(Boolean);
  if (m && Number(m[1]) + Number(m[2]) >= 360) { console.log('car at the end at', i + 1, c, cx); await tap(page, '[data-action=leg-ended]'); tapped = true; }
}
if (!tapped) { console.log('car never reached the end; tapping at 32 s-ish anyway'); await tap(page, '[data-action=leg-ended]'); }
await page.waitForTimeout(600);
console.log('after', await clock());
console.log((await page.evaluate(() => (window as any).__rally.school.state())));
await shot(page, '04-where-result');
console.log('errors', errors); await ctx.close();
