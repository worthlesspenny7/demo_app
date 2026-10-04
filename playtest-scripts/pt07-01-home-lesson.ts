/** PT-07 step 1: fresh profile -> Home -> Start here -> lesson 1 (wrong answer first, then right) -> where the lesson's Next goes (PLAY-001). */
import { launch, goto, shot, txt, log, reset } from './pt07-common.js';
const F = '01-home.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/');
await shot(page, 'home-fresh');
log(F, '== HOME (fresh) ==\n' + (await page.locator('#view').innerText()).slice(0, 3000));
log(F, 'starthere button: ' + await txt(page, '#starthere'));
await page.locator('#starthere').click(); await page.waitForTimeout(200);
log(F, 'after Next: ' + page.url());
const body = await page.locator('#view').innerText();
log(F, '== LESSON == (' + body.split(/\s+/).length + ' words)\n' + body);
const opts = page.locator('.lesson button, .check button, .options button');
const labels = await opts.allInnerTexts(); log(F, 'options: ' + labels.join(' | '));
const naive = labels.findIndex(l => /plus the braking/.test(l));
if (naive >= 0) { await opts.nth(naive).click(); await page.waitForTimeout(150); log(F, '== after wrong ==\n' + (await page.locator('#view').innerText()).slice(-900)); }
const right = labels.findIndex(l => /Exactly 15/.test(l));
if (right >= 0) { await opts.nth(right).click().catch(e => log(F, 'right click failed ' + e)); await page.waitForTimeout(150); log(F, '== after right ==\n' + (await page.locator('#view').innerText()).slice(-900)); }
await shot(page, 'lesson1-after-check');
const buttons = await page.locator('#view a, #view button').allInnerTexts(); log(F, 'links/buttons now: ' + buttons.join(' | '));
const prim = page.locator('#view button.primary, #view a.primary, #view .primary');
log(F, 'primary: ' + (await prim.allInnerTexts()).join(' | '));
await goto(page, '#/');
log(F, '== HOME after lesson ==\n' + (await txt(page, '#starthere-panel')));
log(F, 'starthere button: ' + await txt(page, '#starthere'));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
