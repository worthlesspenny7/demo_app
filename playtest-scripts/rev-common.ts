/** Re-validation harness: Chromium vs vite preview on :4175, persistent localStorage between scripts via a storageState file. */
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { existsSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
export const BASE = 'http://127.0.0.1:4175';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export const STATE = '/tmp/claude-0/rv/state.json';
export interface H { browser: Browser; ctx: BrowserContext; page: Page; errors: string[]; dialogs: string[]; save(): Promise<void> }
export async function launch(viewport = { width: 1366, height: 768 }, fresh = false): Promise<H> {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport, ...(!fresh && existsSync(STATE) ? { storageState: STATE } : {}) });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = await ctx.newPage();
  const errors: string[] = []; const dialogs: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => { dialogs.push(d.type() + ': ' + d.message()); void d.accept(); });
  return { browser, ctx, page, errors, dialogs, save: async () => { await ctx.storageState({ path: STATE }); } };
}
export const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${SHOTS}/reval-${name}.png`, fullPage: full });
export const adv = (page: Page, s: number) => page.evaluate(s => (window as any).__rally?.advance(s), s);
export const obs = (page: Page) => page.evaluate(() => (window as any).__rally ? (window as any).__rally.observe() : null);
export const goto = async (page: Page, hash: string) => { await page.goto(BASE + '/' + hash); await page.waitForTimeout(150); };
export const txt = (page: Page, sel: string) => page.locator(sel).first().innerText().catch(() => '(none)');
