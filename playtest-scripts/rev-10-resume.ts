import { launch, shot, goto, txt, obs, adv, BASE } from './rev-common.js';
import { startRun, drive } from './rev-player.js';
const h = await launch(); const { page } = h;
await goto(page, '#/cockpit/drill/D03/0/2'); await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await startRun(page, { noWatch: true });
await drive(page, { name: 'D03', bezel: true }, 'o.stoppedAtLine === 2 && o.driver.waitingForGo && o.stopwatch.running && o.stopwatch.bezelRemaining < 15');
// jot a note and a GO-at on the line to see that they survive
await page.locator('.lapboard input[placeholder^="note"]').click(); await page.keyboard.type('k=1.01 test note'); await page.keyboard.press('Enter');
const goBox = page.locator('#book .row[data-n="2"] input.go-time'); await goBox.fill('20.2'); await goBox.press('Enter'); await goBox.blur();
await page.waitForTimeout(100);
const snap = async () => page.evaluate(() => { const r = (window as any).__rally; const o = r.observe(); return { tick: r.sim.tick, tod: +o.tod.toFixed(1), running: o.stopwatch.running, reading: o.stopwatch.reading, bezel: o.stopwatch.bezel, rem: o.stopwatch.bezelRemaining, stopped: o.stoppedAtLine, cur: o.currentLine, notes: o.notes, speedTarget: o.driver.targetIndicated, actions: r.sim.actions.length, phase: o.phase }; });
const before = await snap(); console.log('BEFORE reload', JSON.stringify(before));
await shot(page, 'resume-before-reload');
// real reload, with beforeunload dialog
await page.waitForTimeout(3500); // let the 3 s autosave run too
await page.reload(); await page.waitForTimeout(600);
console.log('dialogs seen', h.dialogs);
console.log('after reload hash', await page.evaluate(() => location.hash), 'phase', (await snap()).phase, '| preread visible', await page.locator('#preread').isVisible());
await shot(page, 'resume-after-reload-cockpit');
await goto(page, '#/');
const panel = await txt(page, '#resume-panel'); console.log('RESUME PANEL:', panel.replace(/\n/g, ' | '));
await shot(page, 'resume-home-panel');
await page.locator('#resume').click(); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); // pause rt loop if not paused
const paused = await txt(page, '#scale'); console.log('scale chip after resume', paused);
if (!/PAUSED/.test(paused)) { /* pressed Escape once toggled it on */ }
const after = await snap(); console.log('AFTER resume ', JSON.stringify(after));
console.log('notes list:', (await page.locator('.lapboard .mono').first().innerText()), '| GO-at box:', await page.locator('#book .row[data-n="2"] input.go-time').inputValue());
console.log('perfcard:', (await txt(page, '#perfcard')).replace(/\n/g, ' | '));
await shot(page, 'resume-after-resume');
console.log('matches tick?', before.tick === after.tick, 'running', before.running === after.running, 'bezel', before.bezel === after.bezel);
// continue to the end of the run properly to be sure the run is finishable
const log = await drive(page, { name: 'D03', bezel: true });
await page.waitForSelector('#debrief', { timeout: 30000 });
console.log('finished after resume; headline:', (await txt(page, '#debrief')).split('\n').slice(0, 4).join(' | '));
await goto(page, '#/'); console.log('resume panel after finish present?', await page.locator('#resume-panel').count());
// second scenario: leave by nav (SPA), Discard, Restart same seed
await goto(page, '#/cockpit/drill/D04/0/3'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await startRun(page);
await adv(page, 30);
await page.locator('nav a, a').filter({ hasText: 'Home' }).first().click(); await page.waitForTimeout(300);
console.log('after nav-away: resume panel:', (await txt(page, '#resume-panel')).replace(/\n/g, ' | '), '| dialogs', h.dialogs.slice(-2));
await page.locator('#restart-seed').click(); await page.waitForTimeout(400);
console.log('restart-seed phase:', (await snap()).phase, 'tick', (await snap()).tick);
await page.locator('a', { hasText: 'Home' }).first().click(); await page.waitForTimeout(300);
console.log('panel after restart-seed + immediate leave (no actions):', await page.locator('#resume-panel').count());
console.log('errors', h.errors);
await h.save(); await h.browser.close();
