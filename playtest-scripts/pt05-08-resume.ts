/** PT-05 step 8: the resume flow. The stage run that sat at the start is still saved: Home shows it; Resume restores it; the cockpit's own
 *  pre-read banner on a fresh open of the same source; F5 mid-run; then Discard. */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt05-common.js';
const F = '08-resume.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, '#/');
log(F, 'home resume panel: ' + await txt(page, '#resume-panel, .resume, #resume'));
log(F, 'home top: ' + (await page.locator('#view').innerText()).slice(0, 700));
await shot(page, 'home-resume-panel');
// open the same source directly: the cockpit banner
await goto(page, '#/cockpit/builtin/stage/1'); await hold(page);
log(F, 'cockpit banner: ' + await txt(page, '#resume-banner'));
await shot(page, 'cockpit-resume-banner');
await page.keyboard.press('d'); await adv(page, 0.1); log(F, 'D with a save waiting -> ' + await txt(page, '#alert'));
await page.locator('#resume-run').click(); await page.waitForTimeout(300); await hold(page);
let o = await obs(page); log(F, `resumed: phase ${o?.phase} tod ${o?.tod} state ${o?.driver?.state} watch ${o?.stopwatch?.reading}`);
await shot(page, 'cockpit-resumed');
// F5 mid-run
await page.reload(); await page.waitForTimeout(400); await hold(page);
o = await obs(page); log(F, `after F5: phase ${o?.phase} tod ${o?.tod}; banner: ${await txt(page, '#resume-banner')}`);
await shot(page, 'cockpit-after-f5');
await goto(page, '#/');
const btns = await page.locator('#view button').allInnerTexts(); log(F, 'home buttons: ' + btns.slice(0, 8).join(' | '));
const discard = page.locator('#view button', { hasText: /Discard/i });
if (await discard.count()) { await discard.first().click(); await page.waitForTimeout(200); log(F, 'after discard dialogs ' + JSON.stringify(h.dialogs) + ' home: ' + (await page.locator('#view').innerText()).slice(0, 300)); }
log(F, 'errors ' + JSON.stringify(h.errors));
await h.close();
