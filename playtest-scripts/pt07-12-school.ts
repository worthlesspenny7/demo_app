/** PT-07 step 12: skim the School as a returning rookie: the index (minutes per lesson), word counts, and where each lesson's buttons lead. Scratch profile. */
import { launch, goto, log, reset } from './pt07-common.js';
const F = '12-school.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/school');
log(F, '== SCHOOL INDEX ==\n' + await page.locator('#view').innerText());
const hrefs = await page.locator('#view a[href^="#/school/"]').evaluateAll(as => [...new Set(as.map(a => (a as HTMLAnchorElement).getAttribute('href')))]);
for (const href of hrefs) {
  await goto(page, href!); const body = await page.locator('#view').innerText();
  log(F, `${href}: ${body.split(/\s+/).length} words (~${Math.round(body.split(/\s+/).length / 200)} min); buttons: ${(await page.locator('#view button, #view a.primary').allInnerTexts()).filter(t => t.length < 60).slice(-4).join(' | ')}`);
}
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
