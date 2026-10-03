import { launch, shot, BASE, adv, obs, pause } from './val-common.js';
import { startRun, drive } from './val-player.js';
const { page, browser, errors } = await launch();
const tier = Number(process.argv[2] ?? 0);
async function run(seed: number, tag: string, opts: any) {
  await page.goto(`${BASE}/#/cockpit/drill/D03/${tier}/${seed}`); await page.waitForTimeout(400); await pause(page);
  await startRun(page);
  // mid-run snapshot at first stop
  const mid = await drive(page, { name: 'D03', ...opts, verbose: true }, "o.driver.waitingForGo && /stop/.test(o.driver.state) && o.tod > 28800+20");
  await page.waitForTimeout(100); await shot(page, `d03-${tag}-at-stop`);
  console.log('dad log at first stop:', (await page.locator('#driverlog').innerText()).replace(/\n/g, ' | '));
  const log = await drive(page, { name: 'D03', ...opts, verbose: true });
  log.keys += mid.keys; log.wall1x += mid.wall1x;
  console.log(tag, JSON.stringify({ keys: log.keys, sim: log.wall1x.toFixed(0), waiting: log.waitingSeconds.toFixed(0) }));
  await page.waitForSelector('#debrief', { timeout: 15000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  console.log((await page.locator('#debrief').innerText()).slice(0, 3800));
  await shot(page, `d03-${tag}-debrief`); await shot(page, `d03-${tag}-debrief-full`, true);
}
await run(1, `t${tier}-run1-naive`, { dwellFull: true, goNoise: 0.8 });
console.log('========== RETRY ==========');
await run(1, `t${tier}-run2-card`, { goNoise: 0.5 });
await page.goto(`${BASE}/#/`); await page.waitForTimeout(300); await shot(page, `home-after-d03-t${tier}`);
console.log('D03 card:', (await page.locator('.card[data-drill="D03"]').innerText()).replace(/\n/g, ' | '));
console.log('Last runs:', await page.locator('.page > p.muted').nth(1).innerText().catch(() => ''));
console.log('errors', errors);
await browser.close();
