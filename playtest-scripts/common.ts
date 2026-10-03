/** PT-03 harness: launch headless Chromium against the vite preview, collect page errors, drive sim time via window.__rally. */
import { chromium, type Browser, type Page } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ??= '1';

export const BASE = 'http://127.0.0.1:4173';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';

export interface Harness { browser: Browser; page: Page; errors: string[]; consoleErrors: string[]; close(): Promise<void> }

export async function launch(viewport = { width: 1366, height: 800 }): Promise<Harness> {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors: string[] = []; const consoleErrors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`); });
  return { browser, page, errors, consoleErrors, close: () => browser.close() };
}

export async function goto(page: Page, hash: string): Promise<void> {
  await page.goto(`${BASE}/${hash}`);
  await page.waitForTimeout(150);
}

export async function shot(page: Page, name: string, fullPage = false): Promise<string> {
  const p = `${SHOTS}/pt03-${name}.png`;
  await page.screenshot({ path: p, fullPage });
  return p;
}

/** Pause the frame loop (Esc) so wall-clock does not move the sim while the script thinks. */
export async function pause(page: Page): Promise<void> {
  await page.locator('#view').focus();
  const paused = await page.evaluate(() => document.querySelector('#scale')?.textContent?.includes('PAUSED'));
  if (!paused) await page.keyboard.press('Escape');
}
export async function resume(page: Page): Promise<void> {
  const paused = await page.evaluate(() => document.querySelector('#scale')?.textContent?.includes('PAUSED'));
  if (paused) await page.keyboard.press('Escape');
}

export const adv = (page: Page, s: number) => page.evaluate(s => window.__rally ? window.__rally.advance(s) : null, s);
/** Observation, or a synthetic finished one when the cockpit has already been torn down (route moved to the debrief). */
export const obs = (page: Page) => page.evaluate(() => window.__rally ? window.__rally.observe() : { phase: 'finished', gone: true, book: [], ahead: [], driver: {}, stopwatch: {}, tod: 0, startTime: 0 });
export const text = (page: Page, sel: string) => page.locator(sel).first().textContent().then(t => (t ?? '').trim());

/** Play the book like the smoke test (call turns, speeds; go at every stop with zero thought) until finished. */
export async function autoDrive(page: Page, maxSeconds = 2000, goDelay = 0): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const phase = await page.evaluate(({ goDelay }) => {
      const r = window.__rally; if (!r) return 'gone';
      const w = window as unknown as { __called?: Set<number>; __waitSince?: number | null }; w.__called ??= new Set<number>(); w.__waitSince ??= null;
      const book = r.observe().book;
      for (let k = 0; k < 120 && r.sim.phase !== 'finished'; k++) {
        const o = r.observe();
        for (const f of o.ahead) {
          if (!f.nodeId) continue;
          const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
          if (ins.turn && !w.__called!.has(ins.n)) { r.act({ type: 'call.turn', dir: ins.turn }); w.__called!.add(ins.n); }
          if (ins.speed !== undefined && f.approxDistanceFt <= 100 && !w.__called!.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); w.__called!.add(ins.n + 10000); }
        }
        if (o.driver.waitingForGo) { if (w.__waitSince === null) w.__waitSince = o.tod; if (o.tod - w.__waitSince >= goDelay) { r.act({ type: 'call.go' }); w.__waitSince = null; } }
        else w.__waitSince = null;
        r.advance(1);
      }
      return r.sim.phase;
    }, { goDelay });
    if (phase === 'finished' || phase === 'gone') return phase;
  }
  return 'timeout';
}

declare global { interface Window { __rally?: any } }
