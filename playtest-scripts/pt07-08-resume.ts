/** PT-07 step 8: resume flow in a scratch profile (never saved): start D04 Bronze, drive 90 s, leave for Home (resume panel), reopen the
 *  same source (banner, D refused), Resume, F5 mid-run, Start fresh (confirm?), then Home Discard (confirm? PLAY-010). */
import { launch, goto, shot, txt, log, reset, hold, obs, adv } from './pt07-common.js';
const F = '08-resume.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/drill/D04/0/1'); await hold(page);
await page.locator('#skip').click().catch(() => {}); await page.locator('#view').focus().catch(() => {});
let o = await obs(page); await adv(page, (o.launch?.secondsToLaunch ?? 5) + 1); await page.keyboard.press(' '); await adv(page, 90);
await page.waitForTimeout(3500);   // the cockpit saves the live run every 3 s of wall time
o = await obs(page); log(F, `driving: tod ${o.tod} line ${o.currentLine} watch ${o.stopwatch.reading}`);
await goto(page, '#/');
log(F, 'home top: ' + (await page.locator('#view').innerText()).slice(0, 600));
await shot(page, 'home-resume-panel');
await goto(page, '#/cockpit/drill/D04/0/1'); await hold(page);
log(F, 'cockpit banner: ' + await txt(page, '#resume-banner'));
await page.keyboard.press('d'); await adv(page, 0.1); log(F, 'D with a save waiting -> ' + await txt(page, '#alert'));
await page.locator('#resume-run').click(); await page.waitForTimeout(300); await hold(page);
o = await obs(page); log(F, `resumed: phase ${o?.phase} tod ${o?.tod} line ${o?.currentLine} watch ${o?.stopwatch?.reading} running ${o?.stopwatch?.running}`);
await adv(page, 20); await page.waitForTimeout(3500);
await page.reload(); await page.waitForTimeout(500); await hold(page);
o = await obs(page); log(F, `after F5: phase ${o?.phase} tod ${o?.tod}; banner: ${await txt(page, '#resume-banner')}`);
const fresh = page.locator('#view button', { hasText: /Start fresh/i });
log(F, 'Start fresh buttons ' + await fresh.count());
if (await fresh.count()) { const before = h.dialogs.length; await fresh.first().click(); await page.waitForTimeout(300); log(F, 'Start fresh dialogs: ' + JSON.stringify(h.dialogs.slice(before)) + ' url ' + page.url()); }
// make another save to discard from Home
await goto(page, '#/cockpit/drill/D05/0/1'); await hold(page); await page.locator('#skip').click().catch(() => {}); o = await obs(page); await adv(page, (o.launch?.secondsToLaunch ?? 5) + 30); await page.waitForTimeout(3500);
await goto(page, '#/');
const discard = page.locator('#view button', { hasText: /Discard/i });
log(F, 'discard buttons ' + await discard.count());
if (await discard.count()) { const before = h.dialogs.length; await discard.first().click(); await page.waitForTimeout(300); log(F, 'Discard dialogs: ' + JSON.stringify(h.dialogs.slice(before)) + ' home now: ' + (await page.locator('#view').innerText()).slice(0, 200)); }
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
