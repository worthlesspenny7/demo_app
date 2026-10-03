import { launch, shot, goto, txt, adv, obs } from './rev-common.js';
import { startRun, drive } from './rev-player.js';
const h = await launch(); const { page } = h;
await goto(page, '#/school/ghost-car');
console.log('lesson text:\n', (await txt(page, '.lesson')).slice(0, 2600));
await page.locator('.opt').first().click(); console.log('wrong ->', await txt(page, '.quiz p:last-of-type')); await shot(page, 'school-lesson1-wrong');
await page.locator('.opt').nth(1).click(); console.log('right ->', await page.locator('.quiz').innerText().then(t => t.slice(-300)));
await shot(page, 'school-lesson1-right');
console.log('nav buttons:', await page.locator('.lesson .actions button').allInnerTexts());
await goto(page, '#/');
console.log('startpath after lesson:', await page.locator('#starthere-panel li').evaluateAll(l => l.map(x => x.className + ':' + x.textContent)));
await shot(page, 'home-after-lesson');
await page.click('#starthere'); await page.waitForTimeout(500);
console.log('hash', await page.evaluate(() => location.hash));
// pre-read
console.log('PREREAD:\n', await txt(page, '#preread'));
console.log('hintbar:', await txt(page, '#hintbar'));
await shot(page, 'd01-preread-1366x768');
// HUD buttons clickable above preread
await page.locator('button[data-scale="4"]').click({ timeout: 2000 }).then(() => console.log('HUD click ok')).catch(e => console.log('HUD click FAIL', String(e).slice(0, 80)));
await page.keyboard.press('Escape'); // pause real-time loop for deterministic sim
console.log('scale chip', await txt(page, '#scale'));
await startRun(page);
await adv(page, 12); await shot(page, 'd01-run-1366x768');
const log = await drive(page, { name: 'D01', lapMarkers: true, reaction: 0.28 });
console.log('D01 run', JSON.stringify({ keys: log.keys, sim: log.wall1x.toFixed(0), a4: log.wallAdaptive4x.toFixed(0) }));
await page.waitForSelector('#debrief', { timeout: 15000 }); await page.waitForSelector('#counterfactuals .cf-row', { timeout: 10000 }).catch(() => {});
console.log((await txt(page, '#debrief')).slice(0, 3000));
await shot(page, 'd01-debrief-1366x768'); await shot(page, 'd01-debrief-full', true);
await goto(page, '#/');
console.log('home D01:', (await txt(page, '.card[data-drill="D01"]')).replace(/\n/g, ' | '));
console.log('lastruns:', await txt(page, '#lastruns'));
console.log('startpath:', await page.locator('#starthere-panel li').evaluateAll(l => l.map(x => x.className + ':' + x.textContent)));
console.log('errors', h.errors, 'dialogs', h.dialogs);
await h.save(); await h.browser.close();
