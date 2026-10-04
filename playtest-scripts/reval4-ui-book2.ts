import { launch, BASE, SHOTS, FRAMES, sideBySide } from './reval4-common.js';
const { browser, page } = await launch(1366, 1000);
await page.goto(`${BASE}/#/book/builtin/stage/1`); await page.waitForSelector('.book-sheet');
// page 2 (calibration rows) and page with restart + end timed + TA row
const find = async (sel: string) => page.evaluate((s) => [...document.querySelectorAll('.book-sheet')].findIndex(x => x.querySelector(s)), sel);
const iCal = await find('.cbox, [class*=cbox]'); console.log('cal page', iCal);
await page.locator('.book-sheet').nth(1).screenshot({ path: `${SHOTS}/v4-03-book-calibration-sim.png` });
// column widths
const widths = await page.evaluate(() => { const g = document.querySelector('.book-sheet .grow')!; return [...g.children].map(c => Math.round(c.getBoundingClientRect().width)); });
console.log('col widths gutter,A,B,C,D', widths, widths.map(w => (100 * w / widths.reduce((a, b) => a + b, 0)).toFixed(1) + '%').join(' '));
// special rows
const spec = await page.evaluate(() => {
  const out: Record<string, number | null> = {};
  const sheets = [...document.querySelectorAll('.book-sheet')];
  const q = (name: string, sel: string) => { const i = sheets.findIndex(s => s.querySelector(sel)); out[name] = i < 0 ? null : i + 1; };
  q('restart watch', '[data-sym="restart"], .gicon-restart, .gwatch'); q('TA banner', '.tabanner, [class*=tabanner]'); q('info box', '.infobox, [class*=infobox]'); q('end-timed', '.gicon-end-timed, [data-sym="end-timed"]'); q('freezone', '[data-sym="freezone-begin"]'); q('meal', '[data-sym="meal"]'); q('finish', '[data-sym="finish"]'); q('countdown', '.countdown');
  return out; });
console.log(JSON.stringify(spec));
for (const [k, p] of Object.entries(spec)) if (p) console.log(k, 'page', p);
await browser.close();
