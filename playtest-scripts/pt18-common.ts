/** PT-18 newcomer replay 2 School playtest: shared helpers. One persistent fresh profile (wiped only by pt17-01), 390x844 touch, Chromium. */
import { chromium, type Page, type BrowserContext } from 'playwright';
export const BASE = 'http://127.0.0.1:4190';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export const PROFILE = process.env.PT18_PROFILE ?? '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt18-profile';
export async function open(opts: { width?: number; height?: number; profile?: string } = {}): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await chromium.launchPersistentContext(opts.profile ?? PROFILE, { headless: true, executablePath: '/opt/pw-browsers/chromium', viewport: { width: opts.width ?? 390, height: opts.height ?? 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  return { ctx, page, errors };
}
export const shot = (page: Page, n: string) => page.screenshot({ path: `${SHOTS}/pt18-${n}.png` });
/** Real touch tap at the centre of the first match. */
export async function tap(page: Page, sel: string): Promise<void> {
  const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {});
  const b = await l.boundingBox(); if (!b) throw new Error('no box for ' + sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
export const words = (s: string) => s.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
/** What a reader sees on the School page: the page text, its word count, whether it scrolls, chips, buttons. */
export async function look(page: Page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-testid=page]') as HTMLElement | null;
    const scr = document.scrollingElement!;
    const vis = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    return {
      hash: location.hash,
      text: (p ?? document.body).innerText,
      all: (document.querySelector('[data-screen]') as HTMLElement | null)?.innerText ?? document.body.innerText,
      pageScroll: p ? { s: p.scrollHeight, c: p.clientHeight } : null,
      docScroll: { s: scr.scrollHeight, c: innerHeight, w: scr.scrollWidth, vw: innerWidth },
      chips: [...document.querySelectorAll('.s2-chip')].map(c => (c as HTMLElement).innerText),
      buttons: [...document.querySelectorAll('button, a')].filter(vis).map(b => ((b as HTMLElement).innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean),
      school: (window as any).__rally?.school?.state?.() ?? null,
    };
  });
}
/** Real touch drag (CDP touch events) from (x0,y0) to (x1,y1) in n steps. */
export async function touchDrag(page: Page, x0: number, y0: number, x1: number, y1: number, n = 12): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
