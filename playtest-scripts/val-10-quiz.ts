import { launch, shot, BASE } from './val-common.js';
const { page, browser } = await launch();
await page.goto(`${BASE}/#/quiz/D09`); await page.waitForTimeout(300);
await shot(page, 'd09-card1');
console.log('scrollH', await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]));
console.log((await page.locator('.quiz').innerText()).slice(0, 600));
// keyboard test
await page.keyboard.press('1'); await page.waitForTimeout(100);
console.log('after key 1, feedback present?', (await page.locator('.quiz p').last().innerText()).slice(0, 80));
let n = 0;
const seen = new Set<string>();
for (let i = 0; i < 20; i++) {
  const prompt = await page.locator('.quiz p').first().innerText(); seen.add(prompt);
  const opts = page.locator('.opt'); const c = await opts.count();
  await opts.nth(i % c).click();
  if (i === 0) await shot(page, 'd09-feedback');
  await page.locator('button.primary', { hasText: 'Next' }).click();
}
await page.waitForTimeout(200); await shot(page, 'd09-result');
console.log((await page.locator('.quiz').innerText()).slice(0, 400));
console.log('distinct prompts in 20 cards:', seen.size);
await browser.close();
