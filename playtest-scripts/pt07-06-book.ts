/** PT-07 step 6: the printable book (#/book/...) and the cockpit book against the real 2026 sheet
 *  (docs/research/frames/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-13.jpg). Element screenshots of page 1 and one middle page,
 *  page counts and rows per page, and the cockpit book column. Fresh profile, never saved. */
import { launch, goto, log, reset, hold, SHOTS } from './pt07-common.js';
const F = '06-book.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
for (const [src, tag] of [['builtin/stage/1', 'stage'], ['drill/D11/1/1', 'd11'], ['drill/D16/0/1', 'd16']] as const) {
  await goto(page, '#/book/' + src); await page.waitForTimeout(500);
  const info = await page.evaluate(() => { const s = [...document.querySelectorAll('.book-sheet')]; return { pages: s.length, rows: s.map(x => x.querySelectorAll('.griid-row, .row, tr').length), w: s[0] ? Math.round(s[0].getBoundingClientRect().width) : 0, h: s[0] ? Math.round(s[0].getBoundingClientRect().height) : 0, foot: s[0] ? (s[0].querySelector('.sheet-foot, .foot, footer') as HTMLElement | null)?.innerText : null, toolbar: (document.querySelector('.book-toolbar') as HTMLElement | null)?.innerText }; });
  log(F, `${src}: ${JSON.stringify(info)}`);
  const sheets = page.locator('.book-sheet');
  if (tag !== 'd16') await sheets.nth(0).screenshot({ path: `${SHOTS}/pt07-book-${tag}-p1.png` });
  if (tag === 'stage') { await sheets.nth(4).screenshot({ path: `${SHOTS}/pt07-book-stage-p5.png` }); log(F, 'stage p1 text:\n' + await sheets.nth(0).innerText()); log(F, 'stage p5 text:\n' + await sheets.nth(4).innerText()); }
}
// print emulation: does a sheet fit a Letter page?
await goto(page, '#/book/builtin/stage/1'); await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(300);
const pr = await page.evaluate(() => { const s = document.querySelector('.book-sheet') as HTMLElement; const r = s.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), nav: !!(document.querySelector('nav, header') as HTMLElement | null)?.offsetParent }; });
log(F, 'print media sheet 1: ' + JSON.stringify(pr));
const pdf = await page.pdf({ format: 'Letter', printBackground: true }).catch(e => { log(F, 'pdf ' + e); return null; });
if (pdf) log(F, 'pdf bytes ' + pdf.length);
await page.emulateMedia({ media: 'screen' });
// the cockpit book at 1366x768 (stage pre-read), and with the pre-read hidden
await goto(page, '#/cockpit/builtin/stage/1'); await hold(page); await page.waitForTimeout(300);
await page.locator('.cockpit .book, #book').first().screenshot({ path: `${SHOTS}/pt07-book-cockpit-stage.png` }).catch(e => log(F, 'cockpit book shot ' + e));
const cb = await page.evaluate(() => { const b = document.querySelector('#book') as HTMLElement; const rows = [...b.children].slice(0, 6).map(r => Math.round(r.getBoundingClientRect().height)); return { box: [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)], rows }; });
log(F, 'cockpit book (stage): ' + JSON.stringify(cb));
await goto(page, '#/cockpit/drill/D16/0/1'); await hold(page); await page.waitForTimeout(300);
await page.locator('#book').screenshot({ path: `${SHOTS}/pt07-book-cockpit-d16.png` });
log(F, 'cockpit book text (D16, first 1500):\n' + (await page.locator('#book').innerText()).slice(0, 1500));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
