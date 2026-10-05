/** PT-12: the printable book (#/book/...) for the generator's new rows: dump each row's four columns as text and screenshot the sheet that holds it,
 *  to compare with docs/research/frames/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-13.jpg. usage: tsx pt12-21-book.ts builtin/stage/1 45,50,58,83,120,141,143,173 [label] */
import { launch, goto, shot, log, reset } from './pt12-common.js';
const [path = 'builtin/stage/1', rowsS = '', label = 'book'] = process.argv.slice(2);
const want = rowsS.split(',').filter(Boolean).map(Number);
const F = `21-book-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, `#/book/${path}`); await page.waitForTimeout(800);
log(F, '== toolbar ==\n' + await page.locator('.book-toolbar').innerText().catch(() => '?'));
const sheets = page.locator('.book-sheet'); log(F, `sheets ${await sheets.count()}`);
const shotPages = new Set<string>();
for (const n of want) {
  const row = page.locator(`.grow[data-n="${n}"]`).first();
  if (!(await row.count())) { log(F, `row ${n}: not found`); continue; }
  const cells = await row.locator(':scope > *').allInnerTexts();
  const sheet = row.locator('xpath=ancestor::section[contains(@class,"book-sheet")]');
  const pg = await sheet.getAttribute('data-page');
  log(F, `row ${n} (page ${pg}): ${cells.map(c => JSON.stringify(c.replace(/\n/g, ' / '))).join(' | ')}`);
  const svgText = await row.locator('svg text').allInnerTexts().catch(() => []); if (svgText.length) log(F, `   cameo text: ${svgText.join(' / ')}`);
  if (pg && !shotPages.has(pg) && shotPages.size < 4) { shotPages.add(pg); await sheet.scrollIntoViewIfNeeded(); await sheet.screenshot({ path: `${process.env.PT12_SHOTS ?? (process.env.PT12_OUT + '/shots')}/pt12-${label}-page${pg}.png` }); log(F, `   screenshot of page ${pg}`); }
}
const foot = await page.locator('.sheet-foot').first().innerText().catch(() => '?'); log(F, 'footer of page 1: ' + foot.replace(/\n/g, ' / '));
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
