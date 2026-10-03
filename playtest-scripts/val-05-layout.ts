import { launch, shot, BASE, adv, obs, pause } from './val-common.js';
import { startRun } from './val-player.js';
const { page, browser } = await launch();
for (const [w, h] of [[1366, 768], [1920, 1080], [1280, 720]] as const) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}/#/cockpit/drill/D03/0/1`); await page.waitForTimeout(500); await pause(page);
  await startRun(page); await page.evaluate(() => (window as any).__rally.advance(40)); await page.waitForTimeout(150);
  const rects = await page.evaluate(() => { const q = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }; return { vp: [innerWidth, innerHeight], road: q('.road'), clock: q('#clock'), sw: q('#stopwatch'), sp: q('#speedo'), instruments: q('.instruments'), book: q('.book'), drawer: q('.drawer'), cockpit: q('#cockpit'), laps: q('#laps'), sd: [document.documentElement.scrollHeight, document.documentElement.scrollWidth] }; });
  console.log(w, h, JSON.stringify(rects));
  await shot(page, `d03-run-${w}x${h}`);
}
await browser.close();
