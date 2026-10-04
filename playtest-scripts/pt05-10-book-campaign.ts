/** PT-05 step 10: the printable book (#/book/...), its print layout, the Debrief's "Printable book" link, the campaign screen (locked and
 *  by URL), the protocol lesson's driver card print, and the Reference "Rally school" panel. Shared profile, nothing recorded. */
import { launch, goto, shot, txt, log, reset } from './pt05-common.js';
const F = '10-book-campaign.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
for (const hash of ['#/book/drill/D11/1/1', '#/book/builtin/stage/1', '#/book/last', '#/book/drill/D03/0/1']) {
  await goto(page, hash); await page.waitForTimeout(300);
  const t = await page.locator('#view').innerText();
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  log(F, `== ${hash}: ${t.length} chars, page ${H} px, pages ${(t.match(/Page \d+ of \d+/g) ?? []).slice(0, 3).join(',')} ... ${(t.match(/Page \d+ of \d+/g) ?? []).length}`);
  log(F, t.slice(0, 900));
  const name = hash.replace(/[#/]+/g, '-').replace(/^-/, '');
  await shot(page, `${name}`);
}
await goto(page, '#/book/drill/D11/1/1'); await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(200);
await shot(page, 'book-d11-print-media'); await page.pdf({ path: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt05/book-d11.pdf', format: 'Letter' }).catch(e => log(F, 'pdf ' + e));
await page.emulateMedia({ media: 'screen' });
await goto(page, '#/campaign'); await page.waitForTimeout(200);
log(F, '== #/campaign (locked) -> url ' + page.url() + ' note: ' + await txt(page, '#home-note'));
await shot(page, 'campaign-locked-redirect');
await goto(page, '#/reference'); await page.waitForTimeout(200);
log(F, '== reference rally school ==\n' + await txt(page, '#ref-rally-school'));
await shot(page, 'reference-full', true);
await goto(page, '#/school/protocol'); await page.waitForTimeout(200);
await page.locator('.printcard').first().screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt05-driver-card.png' }).catch(e => log(F, 'card shot ' + e));
await goto(page, '#/settings'); log(F, '== settings ==\n' + await page.locator('#view').innerText()); await shot(page, 'settings');
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
