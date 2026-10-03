/** Validation harness (playability): Chromium vs vite preview on :4174. */
import { chromium, type Browser, type Page } from 'playwright';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
export const BASE = 'http://127.0.0.1:4174';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export async function launch(viewport = { width: 1366, height: 768 }) {
  const browser: Browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page: Page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept());
  return { browser, ctx, page, errors };
}
export const shot = (page: Page, name: string, full = false) => page.screenshot({ path: `${SHOTS}/val-${name}.png`, fullPage: full });
export const adv = (page: Page, s: number) => page.evaluate(s => (window as any).__rally?.advance(s), s);
export const obs = (page: Page) => page.evaluate(() => (window as any).__rally ? (window as any).__rally.observe() : null);
export async function pause(page: Page) { const p = await page.evaluate(() => document.querySelector('#scale')?.textContent?.includes('PAUSED')); if (!p) { await page.locator('#view').focus(); await page.keyboard.press('Escape'); } }
export async function resume(page: Page) { const p = await page.evaluate(() => document.querySelector('#scale')?.textContent?.includes('PAUSED')); if (p) await page.keyboard.press('Escape'); }
