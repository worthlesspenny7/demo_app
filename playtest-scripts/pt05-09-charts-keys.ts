/** PT-05 step 9: the charts overlay (C) and the keys help (?) as Josh meets them: at Bronze (pair highlighted) and at the legal rung
 *  (D11 Bronze), plus the D11 pre-read and drawer. Not recorded (fresh profile). */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt05-common.js';
const F = '09-charts-keys.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/cockpit/drill/D03/0/1'); await hold(page);
await page.keyboard.press('c'); await page.waitForTimeout(150); await shot(page, 'charts-overlay-d03-bronze');
log(F, '== CHARTS D03 Bronze ==\n' + await txt(page, '#charts-panel'));
await page.keyboard.press('Escape'); await page.keyboard.press('?'); await page.waitForTimeout(150); await shot(page, 'keys-overlay');
log(F, '== KEYS ==\n' + await txt(page, '#keys-panel'));
const r = await page.locator('#keys-panel').boundingBox(); log(F, 'keys panel box ' + JSON.stringify(r) + ' scrollH ' + await page.locator('#keys-panel').evaluate(e => e.scrollHeight + '/' + e.clientHeight));
await page.keyboard.press('Escape');
for (const t of [0, 1, 2]) {
  await goto(page, `#/cockpit/drill/D11/${t}/1`); await hold(page);
  log(F, `== D11 tier ${t} drawer: ` + await txt(page, '.drawer .bar') + '\nperf: ' + (await txt(page, '#perfcard')).slice(0, 300) + '\npreread: ' + (await txt(page, '#preread')).slice(0, 1200));
  const o = await obs(page); log(F, 'book lines ' + o.book.length + ' aids ' + JSON.stringify(o.aids) + ' asp ' + o.asp);
}
await goto(page, '#/cockpit/drill/D11/0/1'); await hold(page);
await page.keyboard.press('c'); await page.waitForTimeout(150); await shot(page, 'charts-overlay-d11-legal');
log(F, '== CHARTS D11 legal ==\n' + await txt(page, '#charts-panel'));
await page.keyboard.press('Escape');
await shot(page, 'd11-legal-preread');
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
