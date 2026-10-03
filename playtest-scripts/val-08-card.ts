import { launch, BASE, pause } from './val-common.js';
const { page, browser } = await launch();
await page.goto(`${BASE}/#/cockpit/drill/D03/0/1`); await page.waitForTimeout(500); await pause(page);
for (let n = 1; n <= 7; n++) {
  const strip = await page.evaluate(n => (document.querySelector(`#book .row[data-n="${n}"] .ann`) as HTMLElement)?.innerText.replace(/\n/g, ' '), n);
  await page.locator('#view').focus(); if (n > 1) await page.keyboard.press('n');
  const card = (await page.locator('.drawer .box').nth(1).innerText()).replace(/\n/g, ' | ');
  console.log(n, 'strip:', strip, '|| drawer:', card);
}
await browser.close();
