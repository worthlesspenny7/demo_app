/** PT-08 step 13 (copy of pt07-09; B20): the campaign screen. It is locked behind D12 Silver; to look at it a returning player's progress (D12 Silver star) is
 *  written into a fresh profile, then #/campaign is opened, a stage is started and ended to see the record. */
import { launch, goto, shot, txt, log, reset, hold } from './pt08-common.js';
const F = '13-campaign.txt'; reset(F);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, '#/settings');
await page.evaluate(() => localStorage.setItem('rally-trainer.progress.v1', JSON.stringify({ version: 1, drills: { D12: { bestRaw: 90, tierStars: [0, 1, 0], stars: 1, aces: 0, bestScore: 90, runs: 1, lastScore: 90, lastPlayed: Date.now() } }, lessons: {}, runs: [], maneuvers: {} })));
await goto(page, '#/');
log(F, 'nav campaign link visible: ' + await page.locator('#nav-campaign').isVisible());
await goto(page, '#/campaign'); await page.waitForTimeout(200);
log(F, '== CAMPAIGN ==\n' + await page.locator('#view').innerText());
await shot(page, "campaign");
const play = page.locator('#view button', { hasText: /Play|Start|Drive/ });
log(F, 'play buttons ' + await play.count());
if (await play.count()) { await play.first().click(); await page.waitForTimeout(300); await hold(page); log(F, 'after play: ' + page.url() + '\n' + (await txt(page, '#preread')).slice(0, 600) + '\ndrawer ' + await txt(page, '.drawer .bar'));  }
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
