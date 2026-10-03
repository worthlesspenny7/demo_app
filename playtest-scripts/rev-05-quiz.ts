import { launch, shot, goto, txt } from './rev-common.js';
const h = await launch(); const { page } = h;
await goto(page, '#/');
await page.locator('.card[data-drill="D09"] button.primary').click(); await page.waitForTimeout(300);
console.log('hash', await page.evaluate(() => location.hash), 'navnote', JSON.stringify(await txt(page, '#navnote')));
console.log('card1:', (await txt(page, '.quiz')).slice(0, 700));
await shot(page, 'd09-card1');
const seen = new Set<string>(); let revealOk = 0, wrongN = 0, firstOptsSame = 0;
const optOrders: string[][] = [];
for (let i = 0; i < 20; i++) {
  seen.add(await page.locator('.panel p').first().innerText());
  const key = String((i * 7) % 4 + 1);
  await page.keyboard.press(key);
  await page.waitForSelector('#quiz-next', { timeout: 2000 });
  const wrong = await page.locator('.opt.wrong').count();
  if (wrong) { wrongN++; if (await page.locator('.opt.reveal').count() === 1) revealOk++; }
  if (i === 1) await shot(page, 'd09-feedback');
  await page.keyboard.press('Enter');
}
console.log('distinct prompts', seen.size, 'wrong', wrongN, 'reveal shown on', revealOk);
console.log('result:', (await txt(page, '.quiz')).slice(0, 300));
await shot(page, 'd09-result');
await goto(page, '#/');
console.log('home D09:', (await txt(page, '.card[data-drill="D09"]')).replace(/\n/g, ' | '));
console.log('lastruns:', await txt(page, '#lastruns'));
// D14 duplicates
await goto(page, '#/math/D14'); let dupes = 0; const sample: string[] = [];
for (let r = 0; r < 6; r++) {
  await goto(page, '#/math/D14');
  for (let i = 0; i < 20; i++) { const opts = await page.locator('.opt').allInnerTexts(); const clean = opts.map(o => o.replace(/^\d\s*/, '')); if (new Set(clean).size !== clean.length) { dupes++; sample.push(clean.join(' / ')); } await page.keyboard.press('1'); await page.keyboard.press('Enter'); }
}
console.log('D14: 120 cards, cards with duplicate options =', dupes, sample.slice(0, 3));
console.log('errors', h.errors);
await h.save(); await h.browser.close();
