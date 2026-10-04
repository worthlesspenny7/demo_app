import { launch, BASE, SHOTS, FRAMES, sideBySide } from './reval4-common.js';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';
const { browser, page, errors } = await launch(1366, 800);
// run an oracle to the first TA window with a measured delay (seed 1: train leg 1)
const seed = 1; const sim = new Simulator(generateStage(seed), { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true }); (bot as any).declareTA = () => {};
for (let n = 0; n < 2_000_000 && sim.phase !== 'finished'; n++) { bot.onTick(sim); sim.step(0.1); const ta = sim.taState(); if (ta.windowOpen && ta.eligibleLegs.some(l => sim.taAdvice(l).measuredDelay >= 10)) break; }
const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
await page.goto(`${BASE}/#/settings`); await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
await page.goto(`${BASE}/#/`); await page.locator('#resume').click(); await page.waitForSelector('#cockpit');
await page.locator('#view').focus(); await page.keyboard.press('Escape').catch(() => {});
await page.keyboard.press('t'); await page.waitForTimeout(400);
const panel = page.locator('#ta-panel'); console.log('panel visible', await panel.isVisible());
console.log('LOGIN text:', (await panel.innerText()).replace(/\n+/g, ' | ').slice(0, 900));
await panel.screenshot({ path: `${SHOTS}/v4-11-ta-login-sim.png` });
await page.locator('#ta-car').fill('99'); await page.locator('#ta-password').fill('4821'); await page.locator('#ta-phone').fill('555-0142'); await page.locator('#ta-login').click(); await page.waitForTimeout(300);
console.log('ENTRY text:', (await panel.innerText()).replace(/\n+/g, ' | ').slice(0, 1800));
await panel.screenshot({ path: `${SHOTS}/v4-12-ta-entry-sim.png` });
await sideBySide(browser, `${SHOTS}/v4-13-ta-form-vs-2026-frame.png`, { path: `${FRAMES}/2026-110m28s+0-TA-web-form-fields.jpg`, crop: { x: 650, y: 210, w: 570, h: 430 } }, `${SHOTS}/v4-12-ta-entry-sim.png`, ['Real 2026 TA web form (frame 110m28s): login, entry', 'Simulator TA panel, entry page'], 560);
console.log('errors', errors);
await browser.close();
