/** PT-11: Dad's card print. Fresh scratch profile: the protocol lesson, page 2, "Print this card" with window.print stubbed so the print classes stay,
 *  then Chromium's PDF at Letter and A4, with and without background graphics (Chrome's print dialog leaves them off by default). */
import { launch, goto, log, reset, OUT } from './pt11-common.js';
const F = '05-dadcard.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/school/protocol'); await page.waitForTimeout(300);
const np = page.locator('#lesson-next-page'); if (await np.count() && await np.isVisible()) await np.click();
await page.evaluate(() => { (window as any).__printed = 0; (window as any).print = () => { (window as any).__printed++; }; });
await page.locator('#print-card').click();
await page.waitForTimeout(200);
const st = await page.evaluate(() => ({ cls: document.documentElement.className, root: !!document.getElementById('print-root'), printed: (window as any).__printed }));
log(F, 'after the click: ' + JSON.stringify(st));
await page.emulateMedia({ media: 'print' });
for (const fmt of (process.env.PT11_FMT ? [process.env.PT11_FMT] : ['Letter', 'A4']) as ('Letter' | 'A4')[]) for (const bg of (process.env.PT11_BG ? [process.env.PT11_BG === '1'] : [false, true])) {   // only the FIRST PDF of a run is the card (later ones lose the print classes in this harness): pick one with PT11_FMT / PT11_BG
  log(F, `${fmt} ${bg}: before pdf ` + JSON.stringify(await page.evaluate(() => ({ cls: document.documentElement.className, root: !!document.getElementById('print-root'), hash: location.hash }))));
  const path = `${OUT}/dad-card-${fmt}-${bg ? 'bg' : 'nobg'}.pdf`;
  await page.pdf({ path, format: fmt, printBackground: bg, preferCSSPageSize: true });
  log(F, 'wrote ' + path);
}
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
