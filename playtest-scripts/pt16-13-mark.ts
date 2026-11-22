/** Does the screen ever show "Mark!" on a School speed-change mini-sim? Sample the page text every 0.25 s; tap at the moment "Mark" appears (what the page says to do). usage: <hash> */
import { open, shot, BASE } from './pt16-common.js';
const [hash = '#/school/m5/4'] = process.argv.slice(2);
const { ctx, page } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-miniacts button');
const t0 = Date.now(); let tapped = false; let shotDone = false;
while (Date.now() - t0 < 16000 && !tapped) {
  const r = await page.evaluate(() => ({ el: (window as any).__rally.school.mini().elapsed, t: (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | ') }));
  const body = r.t.split(' | ').slice(1).join(' | ').replace(/Dad's Mark!/g, ''); const mark = /Mark/.test(body);
  if (Math.round(r.el * 4) % 4 === 0) console.log(r.el.toFixed(2), mark ? 'MARK SHOWN' : '', r.t.slice(r.t.indexOf('MPH |') , r.t.indexOf('MPH |') + 60));
  if (mark && !shotDone) { await shot(page, '15-m5-mark-shown'); shotDone = true; const b = (await page.locator('.s2-miniacts button').first().boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); tapped = true; console.log('tapped at Mark', r.el.toFixed(2)); }
  await page.waitForTimeout(250);
}
await page.waitForTimeout(500);
console.log(await page.evaluate(() => [(window as any).__rally.school.mini().attempt, (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | ').slice(-300)]));
await ctx.close();
