import { launch, BASE, SHOTS } from './reval4-common.js';
const { browser, page, errors } = await launch(1366, 800);
await page.goto(`${BASE}/#/cockpit/drill/D03/0/1`); await page.waitForSelector('#cockpit');
await page.locator('#pause').click().catch(() => {}); await page.locator('#view').focus();
await page.evaluate(() => { const R = window.__rally!; R.act({ type: 'skipPreread', secondsBefore: 3 } as never); });
await page.evaluate(() => window.__rally!.advance(4));
// run until the driver waits for go at a STOP, calling the line speeds by oracle-less simple approach: just advance in 0.5 s slices
let waited = false;
for (let i = 0; i < 4000 && !waited; i++) { const o = await page.evaluate(() => { const R = window.__rally!; R.advance(0.5); const o = R.observe(); return { w: o.driver.waitingForGo, st: o.driver.state, v: o.speedo.reading, line: o.currentLine, ph: o.phase }; }); if (o.ph === 'finished') break; if (o.w) waited = true; }
console.log('waiting for go:', waited);
if (waited) {
  const seq: string[] = [];
  for (let k = 0; k < 14; k++) { await page.keyboard.press('x'); await page.evaluate(() => window.__rally!.advance(1)); await page.waitForTimeout(60); seq.push((await page.locator('#driverlog').innerText()).split('\n').slice(-1)[0]!); const o = await page.evaluate(() => window.__rally!.observe().driver); seq.push('['+o.state+']'); }
  console.log('seq', seq.join(' '));
  console.log('driver log:', (await page.locator('#driverlog').innerText()).replace(/\n+/g, ' | ').slice(-700));
  await page.screenshot({ path: `${SHOTS}/v4-20-stop-count-sim.png` });
}
console.log('errors', errors);
await browser.close();
