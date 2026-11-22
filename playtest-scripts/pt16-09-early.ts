/** Bug probe: an early tap on a timed mini-sim (mouse click and touch) - what does the page do? usage: <hash> <tapSeconds> */
import { open, BASE } from './pt16-common.js';
const [hash = '#/school/m2/4', at = '3'] = process.argv.slice(2);
const { ctx, page } = await open();
for (const how of ['click', 'touch']) {
  await page.goto(BASE + '/?mode=mobile' + hash); await page.reload(); await page.waitForSelector('.s2-miniacts button');
  await page.waitForTimeout(Number(at) * 1000);
  const before = await page.evaluate(() => (window as any).__rally.school.mini());
  if (how === 'click') await page.locator('.s2-miniacts button').first().click();
  else { const b = (await page.locator('.s2-miniacts button').first().boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => [(window as any).__rally.school.mini(), (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | ').slice(-220)]);
  console.log(how, 'before', before.elapsed.toFixed(2), 'attempt', before.attempt, '-> after', JSON.stringify(after));
}
await ctx.close();
