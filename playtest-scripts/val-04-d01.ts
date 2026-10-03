import { launch, shot, BASE, adv, obs, pause } from './val-common.js';
import { startRun, drive } from './val-player.js';
const { page, browser, errors } = await launch();
async function run(seed: number, tier: number) {
  await page.goto(`${BASE}/#/cockpit/drill/D01/${tier}/${seed}`); await page.waitForTimeout(400); await pause(page);
  await startRun(page);
  const log = await drive(page, { name: 'D01', lapMarkers: true, reaction: 0.28 });
  console.log('D01 tier', tier, 'seed', seed, JSON.stringify({ keys: log.keys, sim: log.wall1x.toFixed(0), a4: log.wallAdaptive4x.toFixed(0), notes: log.notes.slice(0, 5) }));
  await page.waitForSelector('#debrief', { timeout: 10000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 10000 }).catch(() => {});
}
await run(1, 0);
await shot(page, 'd01-debrief-1366x768'); await shot(page, 'd01-debrief-full', true);
console.log((await page.locator('#debrief').innerText()).slice(0, 4000));
console.log('debrief scrollH', await page.evaluate(() => document.documentElement.scrollHeight));
await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(300); await shot(page, 'd01-debrief-1920x1080');
console.log('errors', errors);
await browser.close();
