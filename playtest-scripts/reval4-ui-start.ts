import { launch, BASE, SHOTS } from './reval4-common.js';
const { browser, page, errors } = await launch(1366, 800);
await page.goto(`${BASE}/#/cockpit/drill/D16/0/1`); await page.waitForSelector('#cockpit');
await page.locator('#pause').click().catch(() => {}); await page.locator('#view').focus();
const info = await page.evaluate(() => { const o = window.__rally!.observe(); return { tod: o.tod, launch: o.launch, rung: window.__rally!.sim.sc.aids.rung, queue: o.startQueue }; });
console.log('rung', info.rung, 'launch', JSON.stringify(info.launch), 'carAheadLeaves', info.queue?.carAheadLeavesTod);
console.log('preread text:', (await page.locator('#preread').innerText()).replace(/\n+/g, ' | ').slice(0, 700));
// wait for car ahead to leave, then Q
await page.evaluate(() => { const R = window.__rally!; const o = R.observe(); const to = (o.startQueue?.carAheadLeavesTod ?? o.tod) + 1; R.advance(Math.max(0, to - o.tod)); });
await page.keyboard.press('q'); await page.waitForTimeout(100);
// advance to launch - 31, press W
await page.evaluate(() => { const R = window.__rally!; const o = R.observe(); R.advance(o.launch!.launchTime - 31 - o.tod); });
await page.keyboard.press('w');
const seq: string[] = [];
for (let i = 0; i < 34; i++) {
  const o = await page.evaluate(() => { const R = window.__rally!; const o = R.observe(); return { t: o.launch ? o.launch.launchTime - o.tod : null, phase: o.phase }; });
  const c = (await page.locator('#start-count').innerText().catch(() => '')).trim();
  seq.push(`${o.t?.toFixed(0)}:${c}`);
  if (i === 20) await page.screenshot({ path: `${SHOTS}/v4-14-start-count-sim.png` });
  await page.evaluate(() => window.__rally!.advance(1)); await page.waitForTimeout(40);
}
console.log(seq.join('  '));
const log = await page.locator('#driverlog').innerText(); console.log('driver log:', log.replace(/\n+/g, ' | ').slice(-600));
console.log('errors', errors);
await browser.close();
