import { chromium } from 'playwright';
import { BASE, SHOTS, FRAMES, sideBySide } from './reval4-common.js';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 3 });
await ctx.addInitScript('window.__name = (f) => f;');
const page = await ctx.newPage();
await page.goto(`${BASE}/#/cockpit/builtin/stage/1`); await page.waitForSelector('#clock');
await page.evaluate(() => { window.__rally!.advance(0); });
// advance sim to roughly 07:59:... keep: just shoot at 07:59:33 (pre-read) - hands near 12
await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' } as never); r.advance(37 * 60 + 3 - 3); });
await page.waitForTimeout(400);
const c = page.locator('#clock'); await c.screenshot({ path: `${SHOTS}/v4-07-clock-sim.png` });
const info = await page.evaluate(() => ({ t: window.__rally!.observe().tod, clk: window.__rally!.observe().clock, cap: document.querySelector('#clock')?.parentElement?.innerText }));
console.log(JSON.stringify(info));
await sideBySide(browser as any, `${SHOTS}/v4-10-clock-vs-sawtooth-frame.png`, { path: `${FRAMES}/clock-00m40s+4-close-up-of-the-clock-hands.jpg`, crop: { x: 700, y: 130, w: 460, h: 400 } }, `${SHOTS}/v4-07-clock-sim.png`, ['Real Sawtooth clock (Stumb, frame clock-00m40s+4)', 'Simulator default clock face'], 440);
await browser.close();
