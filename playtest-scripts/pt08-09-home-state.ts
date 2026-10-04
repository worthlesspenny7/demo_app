/** PT-08 step 9: Home after the evening: the Start-here panel, the Next button, and every drill card's lock/minutes text (for D18 and the path's end). */
import { launch, goto, shot, txt, log, reset } from './pt08-common.js';
const [label = 'home-end'] = process.argv.slice(2);
const F = `09-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/'); await shot(page, label);
log(F, (await page.locator('#view').innerText()));
log(F, 'starthere: ' + await txt(page, '#starthere'));
await page.locator('#starthere').click().catch(() => {}); await page.waitForTimeout(400); log(F, 'starthere goes to ' + page.url());
log(F, 'page: ' + (await page.locator('#view').innerText()).slice(0, 800));
await shot(page, `${label}-next`);
await h.browser.close();
