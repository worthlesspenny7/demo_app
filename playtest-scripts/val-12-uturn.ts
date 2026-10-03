import { launch, shot, BASE, pause, obs } from './val-common.js';
import { startRun } from './val-player.js';
const { page, browser } = await launch();
await page.goto(`${BASE}/#/cockpit/drill/D11/0/1`); await page.waitForTimeout(500); await pause(page);
await startRun(page);
let deadAt = 0;
for (let i = 0; i < 200; i++) { const o: any = await page.evaluate(() => (window as any).__rally.advance(5)); if (o.driver.messages.some((m: any) => /Dead end/.test(m.text))) { deadAt = o.tod; break; } }
let o: any = await obs(page); console.log('dead end at', deadAt, 'state', o.driver.state, 'hint', o.offCourseHint);
await page.keyboard.press('u');
let t = 0; const log: string[] = [];
for (let i = 0; i < 400; i++) { o = await page.evaluate(() => (window as any).__rally.advance(2)); t += 2; for (const m of o.driver.messages) log.push(`${t}s ${m.text}`); if (/Back on course/.test(log.join())) break; }
console.log(log.join(' | ')); console.log('hint', o.offCourseHint, 'state', o.driver.state);
console.log('line', o.currentLine, 'ledger', o.ledger);
await shot(page, 'after-uturn');
await browser.close();
