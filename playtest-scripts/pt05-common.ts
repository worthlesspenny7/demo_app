/** PT-05 harness (V3 playability): Chromium vs vite preview on :4177; localStorage persists between scripts via a storageState file
 *  so the session plays like one browser profile (Josh's first two hours). Real key presses; sim time only via window.__rally.advance. */
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
export const BASE = 'http://127.0.0.1:4177';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export const OUT = process.env.PT05_OUT ?? '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt05';
export const STATE = `${OUT}/state.json`;
mkdirSync(OUT, { recursive: true });
export interface H { browser: Browser; ctx: BrowserContext; page: Page; errors: string[]; dialogs: string[]; save(): Promise<void>; close(): Promise<void> }
export async function launch(viewport = { width: 1366, height: 768 }, fresh = false): Promise<H> {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport, ...(!fresh && existsSync(STATE) ? { storageState: STATE } : {}) });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = await ctx.newPage();
  const errors: string[] = []; const dialogs: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); void d.accept(); });
  return { browser, ctx, page, errors, dialogs, save: async () => { await ctx.storageState({ path: STATE }); }, close: async () => { await ctx.storageState({ path: STATE }); await browser.close(); } };
}
export const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${SHOTS}/pt05-${name}.png`, fullPage: full });
export const adv = (page: Page, s: number) => page.evaluate(s => (window as any).__rally?.advance(s), s);
export const obs = (page: Page): Promise<any> => page.evaluate(() => (window as any).__rally ? (window as any).__rally.observe() : null);
export const goto = async (page: Page, hash: string) => { await page.goto(BASE + '/' + hash); await page.waitForTimeout(200); };
export const txt = (page: Page, sel: string) => page.locator(sel).first().innerText({ timeout: 1500 }).catch(() => '(none)');
export function log(file: string, s: string): void { appendFileSync(`${OUT}/${file}`, s + '\n'); console.log(s); }
export function reset(file: string): void { writeFileSync(`${OUT}/${file}`, ''); }
/** Hold the frame loop (Pause button) so wall clock never moves the sim. */
export async function hold(page: Page): Promise<void> { const t = await txt(page, '#pause'); if (t === 'Pause') await page.locator('#pause').click(); await page.locator('#view').focus().catch(() => {}); }
export async function key(page: Page, k: string, n = 1): Promise<void> { for (let i = 0; i < n; i++) await page.keyboard.press(k); }
export async function type(page: Page, s: string): Promise<void> { for (const ch of s) await page.keyboard.press(ch); }
/** Step sim time in small slices until pred(observation) is true or maxS elapses. Returns the observation. */
export async function until(page: Page, pred: string, maxS = 600, dt = 0.1): Promise<any> {
  return page.evaluate(({ pred, maxS, dt }) => {
    const R = (window as any).__rally; if (!R) return null; const f = new Function('o', 'R', `return (${pred});`);
    let t = 0; let o = R.observe();
    while (t < maxS && o.phase !== 'finished' && !f(o, R)) { R.advance(dt); t += dt; o = R.observe(); }
    return { ...o, __waited: t };
  }, { pred, maxS, dt });
}
