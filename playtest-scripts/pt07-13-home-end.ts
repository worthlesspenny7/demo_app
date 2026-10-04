/** PT-07 step 13: Home at the end of the evening (shared profile, read-only): path, unlocks, last runs. */
import { launch, goto, log, reset } from './pt07-common.js';
const F = '13-home-end.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
await goto(page, '#/'); log(F, (await page.locator('#view').innerText()).slice(0, 4000));
await h.browser.close();
