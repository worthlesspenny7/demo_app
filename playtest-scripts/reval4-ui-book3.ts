import { launch, BASE, SHOTS } from './reval4-common.js';
const { browser, page } = await launch(1366, 1000);
await page.goto(`${BASE}/#/book/builtin/stage/1`); await page.waitForSelector('.book-sheet');
await page.locator('.book-sheet').nth(19).screenshot({ path: `${SHOTS}/v4-04-book-ta-row-sim.png` });
await page.locator('.book-sheet').nth(38).screenshot({ path: `${SHOTS}/v4-05-book-finish-infobox-sim.png` });
await browser.close();
