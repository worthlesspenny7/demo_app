import { launch, shot, goto, txt, obs, adv } from './rev-common.js';
import { startRun } from './rev-player.js';
const h = await launch(); const { page } = h;
await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(400); await page.keyboard.press('Escape');
await startRun(page);
// run to the first stop without calling the turn
for (let i = 0; i < 400; i++) { await adv(page, 0.5); const o = await obs(page); if (o.stoppedAtLine) break; }
let o = await obs(page); console.log('stopped at line', o.stoppedAtLine, 'tod', o.tod.toFixed(1));
await adv(page, 21); await page.keyboard.press('g');   // go with no turn called
const seen: string[] = [];
for (let t = 0; t < 40; t++) { await adv(page, 5); const d = (await page.locator('#driverlog').innerText()).split('\n'); for (const l of d) if (!seen.includes(l)) seen.push(l); }
console.log('Dad lines:\n' + seen.join('\n'));
o = await obs(page);
console.log('state', o.driver.state, 'offCourseHint', JSON.stringify(o.offCourseHint), 'phase', o.phase, 'tod', o.tod.toFixed(0));
console.log('HUD chip:', await txt(page, '#phase'), '| callout hint:', (await page.locator('.hud').innerText()).replace(/\n/g, ' | '));
await shot(page, 'lost-no-turn-call-1366');
await page.keyboard.press('u'); await adv(page, 90); o = await obs(page);
console.log('after U + 90s: state', o.driver.state, JSON.stringify(o.offCourseHint));
console.log((await page.locator('#driverlog').innerText()).replace(/\n/g, ' | '));
console.log('errors', h.errors);
await h.browser.close();
