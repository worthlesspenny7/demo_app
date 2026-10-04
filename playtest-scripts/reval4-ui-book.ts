import { launch, BASE, SHOTS, FRAMES, sideBySide } from './reval4-common.js';
const { browser, page, errors } = await launch(1366, 1000);
await page.goto(`${BASE}/#/book/builtin/stage/1`); await page.waitForSelector('.book-sheet');
const n = await page.locator('.book-sheet').count(); console.log('sheets', n);
const first = page.locator('.book-sheet').nth(0); const bb = await first.boundingBox(); console.log('sheet1 box', JSON.stringify(bb));
await first.screenshot({ path: `${SHOTS}/v4-02-book-page1-sim.png` });
// find the calibration page
const idx = await page.evaluate(() => { const s = [...document.querySelectorAll('.book-sheet')]; return s.findIndex(x => x.querySelector('.cbox, .cal-box, [class*=cbox]')); });
console.log('calibration page index', idx);
await page.locator('.book-sheet').nth(Math.max(idx, 0)).screenshot({ path: `${SHOTS}/v4-03-book-calibration-sim.png` });
const html = await first.innerHTML(); console.log(html.slice(0, 1500));
console.log('footer', await first.locator('.sheet-foot, [class*=foot]').first().innerText().catch(() => 'none'));
console.log('rows on page1', await first.locator('.grow').count(), 'colheads', await first.locator('.colheads').innerText().catch(() => 'none'));
await sideBySide(browser, `${SHOTS}/v4-01-book-vs-2026-frame.png`, { path: `${FRAMES}/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-26.jpg`, crop: { x: 385, y: 10, w: 540, h: 700 } }, `${SHOTS}/v4-02-book-page1-sim.png`, ['Real 2014 Trophy Run page 1 (2026 school slide, frame 73m54s)', 'Simulator, day stage 1, printable book page 1'], 780);
console.log('errors', errors);
await browser.close();
