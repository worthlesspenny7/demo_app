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
const panel = page.locator('#ta-panel');
await panel.locator('input[type=checkbox]').first().check(); await page.waitForTimeout(400);
const txt = (await panel.innerText()).replace(/\n+/g, ' | '); console.log('PAPER:', txt.slice(0, 2600));
await panel.screenshot({ path: `${SHOTS}/v4-21-ta-paper-sim.png` });
console.log('errors', errors); await browser.close();
