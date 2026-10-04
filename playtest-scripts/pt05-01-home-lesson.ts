/** PT-05 step 1: fresh profile -> Home -> Start here -> lesson 1 (wrong answer first, then right) -> what next. */
import { launch, goto, shot, txt, log, reset, BASE } from './pt05-common.js';
const F = '01-home.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/');
await shot(page, 'home-fresh-1366');
await shot(page, 'home-fresh-full', true);
log(F, '== HOME (fresh) ==\n' + (await page.locator('#view').innerText()).slice(0, 3000));
log(F, 'scrollHeight ' + await page.evaluate(() => document.documentElement.scrollHeight));
// press "Next"
await page.locator('#starthere').click(); await page.waitForTimeout(200);
log(F, 'after Next: ' + page.url());
await shot(page, 'lesson1-top');
await shot(page, 'lesson1-full', true);
log(F, '== LESSON ==\n' + await page.locator('#view').innerText());
// answer wrong (option 3 = '15 seconds plus braking')
const opts = page.locator('.lesson button, .check button, .options button');
log(F, 'option buttons: ' + await opts.count());
const labels = await opts.allInnerTexts(); log(F, labels.join(' | '));
// choose the naive answer: plus braking
const naive = labels.findIndex(l => /plus the braking/.test(l));
if (naive >= 0) { await opts.nth(naive).click(); await page.waitForTimeout(150); await shot(page, 'lesson1-wrong', true); log(F, '== after wrong ==\n' + (await page.locator('#view').innerText()).slice(-1200)); }
const right = labels.findIndex(l => /Exactly 15/.test(l));
if (right >= 0) { await opts.nth(right).click().catch(e => log(F, 'right click failed ' + e)); await page.waitForTimeout(150); await shot(page, 'lesson1-right', true); log(F, '== after right ==\n' + (await page.locator('#view').innerText()).slice(-1200)); }
const buttons = await page.locator('#view a, #view button').allInnerTexts(); log(F, 'links/buttons now: ' + buttons.join(' | '));
await goto(page, '#/');
log(F, '== HOME after lesson ==\n' + (await txt(page, '#starthere-panel')));
await shot(page, 'home-after-lesson');
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
