import { launch, goto } from './rev-common.js';
const h = await launch(undefined, true); const { page } = h;
await goto(page, '#/quiz/D09');
for (let i = 0; i < 20; i++) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); }
console.log('on result screen:', (await page.locator('.quiz h2').innerText()));
console.log('errors before extra key', h.errors.length);
await page.keyboard.press('1'); await page.waitForTimeout(100);
console.log('errors after pressing 1 on the result screen', h.errors);
await h.browser.close();
