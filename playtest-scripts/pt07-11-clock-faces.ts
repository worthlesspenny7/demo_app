/** PT-07 step 11: close-ups of the two dash clock faces (INST-003) at 2x device scale with the pre-read hidden; and the ambiguous loose
 *  minute hand at Gold (rung 0) near the top of a minute. Scratch profile. */
import { chromium } from 'playwright';
import { BASE, SHOTS, log, reset } from './pt07-common.js';
const F = '11-clock.txt'; reset(F);
const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 2 }); await ctx.addInitScript('window.__name = (f) => f;');
const page = await ctx.newPage();
const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
for (const face of ['sawtooth', 'bezel']) {
  await page.goto(BASE + '/#/settings'); await page.waitForTimeout(200);
  await page.locator('select').filter({ hasText: /Sawtooth/ }).selectOption(face);
  await page.goto(BASE + '/#/cockpit/drill/D16/2/1'); await page.waitForTimeout(300);
  if ((await page.locator('#pause').innerText()) === 'Pause') await page.locator('#pause').click();
  await page.locator('#preread button', { hasText: /Hide the pre-read/ }).click().catch(() => {});
  const o: any = await page.evaluate(() => (window as any).__rally.observe());
  const toTop = (60 - (o.tod % 60)) % 60; await page.evaluate(s => (window as any).__rally.advance(s), toTop - 2);
  const c: any = await page.evaluate(() => (window as any).__rally.observe().clock);
  log(F, `${face}: clock obs ${JSON.stringify(c)} warn "${await page.locator('#clock-warn').innerText().catch(() => '')}"`);
  await page.locator('#clock').screenshot({ path: `${SHOTS}/pt07-clock-${face}.png` });
}
log(F, 'errors ' + JSON.stringify(errors));
await b.close();
