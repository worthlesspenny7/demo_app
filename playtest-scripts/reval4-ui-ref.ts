import { launch, BASE } from './reval4-common.js';
import { writeFileSync } from 'node:fs';
const { browser, page } = await launch(1366, 900);
await page.goto(`${BASE}/#/reference`); await page.waitForTimeout(500);
writeFileSync('/tmp/claude-0/reference-page.txt', await page.locator('#view').innerText());
await browser.close();
