/** PT-10 step 13: the D06 Silver "hidden car" charts behind C (scratch fresh profile): screenshot the overlay heading and the book's "card N s" on a STOP row. */
import { launch, goto, shot, hold } from './pt10-common.js';
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/drill/D06/1/1'); await hold(page);
await page.locator('#book .row[data-n="4"]').scrollIntoViewIfNeeded().catch(() => {});
await shot(page, 'd06-silver-card-row');
await page.keyboard.press('c'); await page.waitForTimeout(250); await shot(page, 'd06-silver-overlay');
await h.browser.close();
