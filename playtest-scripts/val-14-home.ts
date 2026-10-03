import { launch, shot, BASE, pause, obs } from './val-common.js';
import { startRun, drive } from './val-player.js';
const { page, browser } = await launch();
// D01 approach
await page.goto(`${BASE}/#/cockpit/drill/D01/0/1`); await page.waitForTimeout(500); await pause(page);
await startRun(page);
await drive(page, { name: 'D01', lapMarkers: true }, `o.ahead.some((f) => f.kind === 'sign' && f.approxDistanceFt <= 150)`);
await page.waitForTimeout(150); await shot(page, 'd01-marker-approach');
console.log('road canvas ahead:', JSON.stringify((await obs(page)).ahead));
await drive(page, { name: 'D01', lapMarkers: true }, `o.stopwatch.laps.length >= 2`);
await page.waitForTimeout(150); await shot(page, 'd01-after-laps');
console.log('laps panel:', (await page.locator('#laps').innerText()).replace(/\n/g, ' '));
await drive(page, { name: 'D01', lapMarkers: true });
await page.waitForSelector('#debrief'); 
// D03 x2
for (const naive of [true, false]) {
  await page.goto(`${BASE}/#/`); await page.goto(`${BASE}/#/cockpit/drill/D03/0/1`); await page.waitForTimeout(400); await pause(page);
  await startRun(page); await drive(page, { name: 'D03', dwellFull: naive, goNoise: 0.6 }); await page.waitForSelector('#debrief');
}
await page.goto(`${BASE}/#/cockpit/drill/D04/0/1`); await page.waitForTimeout(400); await pause(page);
await startRun(page); await drive(page, { name: 'D04' }); await page.waitForSelector('#debrief');
await page.goto(`${BASE}/#/quiz/D09`); for (let i = 0; i < 20; i++) { await page.locator('.opt').nth(i % 3).click(); await page.locator('button.primary', { hasText: 'Next' }).click(); }
await page.goto(`${BASE}/#/`); await page.waitForTimeout(400);
await shot(page, 'home-after-session-1366');
console.log('last runs:', await page.locator('.page > p.muted').nth(1).innerText());
for (const d of ['D01', 'D03', 'D04', 'D09', 'D18']) console.log((await page.locator(`.card[data-drill="${d}"]`).innerText()).replace(/\n/g, ' | '));
await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(300); await shot(page, 'home-after-session-1920');
await page.goto(`${BASE}/#/settings`); await page.waitForTimeout(200); await shot(page, 'settings');
await page.goto(`${BASE}/#/reference`); await page.waitForTimeout(300); await shot(page, 'reference'); console.log('reference height', await page.evaluate(() => document.documentElement.scrollHeight));
await browser.close();
