import { launch, BASE, SHOTS, FRAMES, sideBySide } from './reval4-common.js';
const { browser, page } = await launch(1366, 1000);
for (const path of ['drill/D12/2/1', 'drill/D12/0/1']) {
  await page.goto(`${BASE}/#/book/${path}`); await page.waitForSelector('.book-sheet', { timeout: 5000 }).catch(() => {});
  const n = await page.locator('.book-sheet').count(); if (!n) { console.log(path, 'no sheets'); continue; }
  const r = await page.evaluate(() => [...document.querySelectorAll('.book-sheet')].map(s => s.querySelectorAll('.grow').length));
  const D = await page.locator('.book-sheet').first().locator('.grow').first().locator('.gd, [class*=gd]').first().innerText().catch(() => '?');
  console.log(path, 'pages', n, 'rows/page', r.join(''), 'row1 colD:', JSON.stringify(D));
}
await page.goto(`${BASE}/#/book/drill/D12/2/1`); await page.waitForSelector('.book-sheet');
await page.locator('.book-sheet').nth(1).screenshot({ path: `${SHOTS}/v4-18-book-race-style-page2-sim.png` });
await sideBySide(browser, `${SHOTS}/v4-19-race-style-vs-2024-frame.png`, { path: `${FRAMES}/2024-85m14s+0-calibration-page-interval-4m03-4s-cumulative.jpg`, crop: { x: 435, y: 85, w: 435, h: 560 } }, `${SHOTS}/v4-18-book-race-style-page2-sim.png`, ['Real 2014 page 1 (2024 school, frame 85m14s)', 'Simulator, legal rung (race style), page 2'], 640);
await browser.close();
