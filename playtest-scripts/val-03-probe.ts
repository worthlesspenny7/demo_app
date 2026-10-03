import { launch, shot, BASE, adv, obs, pause } from './val-common.js';
const { page, browser } = await launch();
await page.goto(`${BASE}/#/cockpit/drill/D01/0/1`); await page.waitForTimeout(400); await pause(page);
await page.keyboard.press('d'); await adv(page, 56);
await page.keyboard.press(' ');
for (let i = 0; i < 40; i++) { const o = await obs(page); console.log(o.tod.toFixed(1), o.phase, JSON.stringify(o.ahead.map((f:any)=>[f.kind,f.label,f.approxDistanceFt, f.sign?.text])), o.driver.state, o.stopwatch.reading.toFixed(1)); await adv(page, 1.5); }
await browser.close();
