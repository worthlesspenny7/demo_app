import { launch, shot, BASE, pause, obs } from './val-common.js';
import { startRun, drive } from './val-player.js';
const { page, browser } = await launch();
// 1. realtime scale
await page.goto(`${BASE}/#/cockpit/drill/D11/0/1`); await page.waitForTimeout(500);
await page.locator('#view').focus();
await page.click('#skip'); await page.waitForTimeout(200);
await page.keyboard.press('d'); await page.keyboard.press(' ');
let a = (await obs(page)).tod; await page.waitForTimeout(3000); let b = (await obs(page)).tod;
console.log('1x: sim s per 3 wall s =', (b - a).toFixed(1), 'chip:', await page.locator('#scale').innerText());
await page.keyboard.press('>'); await page.keyboard.press('>'); await page.waitForTimeout(150);
a = (await obs(page)).tod; await page.waitForTimeout(3000); b = (await obs(page)).tod;
console.log('after > > : sim s per 3 wall s =', (b - a).toFixed(1), 'chip:', await page.locator('#scale').innerText());
await page.keyboard.press('>'); await page.waitForTimeout(150);
a = (await obs(page)).tod; await page.waitForTimeout(3000); b = (await obs(page)).tod;
console.log('after > (8x): per 3 wall s =', (b - a).toFixed(1), 'chip:', await page.locator('#scale').innerText());
// keys overlay
await page.getByRole('button', { name: 'Keys' }).click(); await page.waitForTimeout(150); await page.keyboard.press('Escape'); await shot(page, 'cockpit-keys-overlay');
// 2. lost: never call turn at first STOP; just watch what Dad says at 8x until something resolves
await page.keyboard.press('Escape'); // resume if paused
await page.evaluate(() => { (window as any).__rally.act({ type: 'abort' }); }).catch(() => {});
await browser.close();
const h2 = await launch(); const p2 = h2.page;
await p2.goto(`${BASE}/#/cockpit/drill/D11/0/1`); await p2.waitForTimeout(500); await pause(p2);
await startRun(p2);
// advance to first stop and then just wait with no turn call
const msgs: string[] = [];
let off = 0;
for (let i = 0; i < 400; i++) {
  const o: any = await p2.evaluate(() => { const r = (window as any).__rally; const o = r.advance(5); return { tod: o.tod, st: o.driver.state, hint: o.offCourseHint, msg: o.driver.messages, ph: o.phase, cur: o.currentLine, wait: o.driver.waitingForGo }; });
  if (i % 8 === 0) console.log(`t+${(i * 5)}s`, o.st, 'offHint', o.hint, 'line', o.cur);
  if (o.ph === 'finished') break;
}
await p2.waitForTimeout(500);
console.log('dad log shown:', (await p2.locator('#driverlog').innerText()).replace(/\n/g, ' | ').slice(0, 600));
console.log('url now', p2.url());
await shot(p2, 'lost-no-turn-call');
// reload mid-run
await p2.goto(`${BASE}/#/cockpit/drill/D11/0/1`);
await p2.reload(); await p2.waitForTimeout(500);
console.log('after reload: phase', (await obs(p2))?.phase, 'tod', (await obs(p2))?.tod);
await h2.browser.close();
