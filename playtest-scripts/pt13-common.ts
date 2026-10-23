/**
 * PT-13 phone playtest harness: Chromium at /opt/pw-browsers/chromium, a phone viewport with touch, ONE shared persistent profile
 * (so progress, streak, Continue and the service worker carry from script to script like Josh's phone), real taps (touchscreen),
 * and a "human" player model: option cards are answered after a 2-3 s read pause, timing cards are tapped in real time from what the
 * screen shows (the prompt, the facts, the watch digits and the TOD strip), verdicts are read for 2.5 s.
 * The oracle (window.__rally.decision.oracle) is only LOGGED for comparison, never used to answer, unless a policy says so explicitly.
 */
import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ??= '1';

export const BASE = process.env.PT13_BASE ?? 'http://127.0.0.1:4185';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export const OUT = process.env.PT13_OUT ?? '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13';
export const PROFILE = `${OUT}/profile`;
fs.mkdirSync(OUT, { recursive: true });

export const PHONE = { width: 390, height: 844 };
export interface H { ctx: BrowserContext; page: Page; errors: string[]; close(): Promise<void> }

export async function open(opts: { fresh?: boolean; viewport?: { width: number; height: number } } = {}): Promise<H> {
  if (opts.fresh) fs.rmSync(PROFILE, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: true, executablePath: '/opt/pw-browsers/chromium', viewport: opts.viewport ?? PHONE, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    args: ['--mute-audio'],
  });
  await ctx.addInitScript('globalThis.__name = globalThis.__name || ((f) => f);');   // tsx keepNames shim for page.evaluate bodies
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors: string[] = [];
  const hook = (p: Page): void => {
    p.on('pageerror', e => errors.push(`pageerror: ${String(e)}`));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
  };
  hook(page); ctx.on('page', hook);
  return { ctx, page, errors, close: () => ctx.close() };
}

export async function shot(page: Page, name: string): Promise<string> {
  const p = `${SHOTS}/pt13-${name}.png`;
  await page.screenshot({ path: p });
  return p;
}

export type St = { screen: string; phase: string; kind: string | null; id: string | null; timing: any; options: string[]; elapsed: number; n: number; of: number; correct: number; answered: number };
export async function state(page: Page): Promise<St | null> {
  return page.evaluate(() => { const r = (window as any).__rally?.decision; return r ? r.state() : null; });
}
export const oracle = (page: Page): Promise<any> => page.evaluate(() => (window as any).__rally?.decision?.oracle() ?? null);
export const cardElapsed = (page: Page): Promise<number> => page.evaluate(() => (window as any).__rally?.decision?.elapsed() ?? 0);

/** Visible words on the phone screen (text nodes inside .mob that are visible, SVG text excluded), split by region. */
export async function screenWords(page: Page): Promise<{ total: number; card: number; actions: number; strip: number; text: string; cardText: string }> {
  return page.evaluate(() => {
    const vis = (e: Element): boolean => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
    const collect = (root: Element | null): string => {
      if (!root) return '';
      const out: string[] = [];
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        const p = n.parentElement; if (!p || p.closest('svg') || !vis(p)) continue;
        const t = (n.textContent ?? '').trim(); if (t) out.push(t);
      }
      return out.join(' ');
    };
    const count = (s: string): number => s.split(/\s+/).filter(x => /[A-Za-z0-9]/.test(x)).length;
    const card = collect(document.querySelector('.mob-main')), actions = collect(document.querySelector('.mob-actions')), strip = collect(document.querySelector('.mob-strip'));
    const all = collect(document.querySelector('.mob'));
    return { total: count(all), card: count(card), actions: count(actions), strip: count(strip), text: all, cardText: card };
  });
}

/** Geometry of the screen (MOB-020/041): hscroll, text under 16 px, controls and their position, tap targets under 48 px. */
export async function geometry(page: Page): Promise<{ hscroll: boolean; small: string[]; controls: { label: string; top: number; bottom: number; height: number; width: number; inBottom40: boolean }[]; tiny: string[]; vh: number; vw: number; minFont: number }> {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const hscroll = document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1;
    const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const small: string[] = []; let minFont = 99;
    for (const e of document.querySelectorAll('.mob *, .mob-back, .mob-back *')) {
      if (e.closest('svg') || !visible(e)) continue;
      if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize); minFont = Math.min(minFont, fs);
      if (fs < 16 - 0.01) small.push(`${e.tagName}.${(e as HTMLElement).className}: ${fs}px "${(e.textContent ?? '').trim().slice(0, 30)}"`);
    }
    const controls = [...document.querySelectorAll('.mob button, .mob a, .mob [role=button]')].filter(visible).map(e => { const r = e.getBoundingClientRect(); return { label: (e.textContent ?? e.getAttribute('aria-label') ?? '').trim().replace(/\s+/g, ' ').slice(0, 30), top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width), inBottom40: r.top >= vh * 0.6 - 1 }; });
    const tiny = controls.filter(c => c.width < 47.5 || c.height < 47.5).map(c => `${c.label} ${c.width}x${c.height}`);
    return { hscroll, small, controls, tiny, vh, vw, minFont };
  });
}

/** Text of the card parts. */
export async function cardInfo(page: Page): Promise<{ kind: string; prompt: string; facts: string[]; chart: string; chartV: string; rowC: string; rowD: string; note: string; options: { id: string; label: string }[]; tod: string; hasCameo: boolean }> {
  return page.evaluate(() => {
    const t = (s: string): string => (document.querySelector(s)?.textContent ?? '').trim().replace(/\s+/g, ' ');
    return {
      kind: t('.mcard-kind'), prompt: t('.mprompt'), facts: [...document.querySelectorAll('.mfacts span')].map(e => (e.textContent ?? '').trim()),
      chart: t('.mchart'), chartV: t('.mchart-v'), rowC: t('.mrow-c'), rowD: t('.mrow-d'), note: t('.mnote'), tod: t('.mw-tod'),
      options: [...document.querySelectorAll('.mob-actions [data-option]')].map(e => ({ id: (e as HTMLElement).dataset.option!, label: (e.textContent ?? '').trim() })),
      hasCameo: !!document.querySelector('.mrow-a svg'),
    };
  });
}

export async function verdictInfo(page: Page): Promise<{ head: string; sec: string; rule: string; detail: string; correct: boolean; words: number }> {
  return page.evaluate(() => {
    const t = (s: string): string => (document.querySelector(s)?.textContent ?? '').trim().replace(/\s+/g, ' ');
    const v = document.querySelector('[data-testid=verdict]') as HTMLElement | null;
    const all = (v?.textContent ?? '').trim();
    return { head: t('.mv-head span'), sec: t('.mv-sec'), rule: t('.mv-rule'), detail: t('.mv-detail'), correct: v?.dataset.correct === 'true', words: all.split(/\s+/).filter(x => /[A-Za-z0-9]/.test(x)).length };
  });
}

/** A real tap at the centre of an element (touchscreen, so pointerdown/touch events fire as on a phone). */
export async function tapEl(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox(); if (!box) throw new Error(`no ${selector}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return Date.now();
}
/** Wait (in the page, per animation frame) until the card's elapsed seconds reach `t`, then tap. Returns the elapsed value at the tap. */
export async function tapAtElapsed(page: Page, selector: string, t: number, max = 120): Promise<void> {
  const box = await page.locator(selector).first().boundingBox(); if (!box) throw new Error(`no ${selector}`);
  await page.waitForFunction(x => ((window as any).__rally.decision.elapsed() >= x - 0.03) || (window as any).__rally.decision.state().phase !== 'decision', t, { polling: 'raf', timeout: max * 1000 });
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
/** Wait until the watch's TOD strip reads `tod` (H:MM:SS), as a person watching the strip, then tap after `react` s. */
export async function tapAtTod(page: Page, selector: string, tod: string, react = 0.2, max = 120): Promise<boolean> {
  const box = await page.locator(selector).first().boundingBox(); if (!box) throw new Error(`no ${selector}`);
  try {
    await page.waitForFunction(x => { const s = (document.querySelector('.mw-tod')?.textContent ?? '').replace('TOD ', '').trim(); return s.replace(/^0/, '') === x.replace(/^0/, '') || (window as any).__rally.decision.state().phase !== 'decision'; }, tod, { polling: 'raf', timeout: max * 1000 });
  } catch { return false; }
  await page.waitForTimeout(react * 1000);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}

export const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
export function writeJson(name: string, data: unknown): string { const p = `${OUT}/${name}.json`; fs.writeFileSync(p, JSON.stringify(data, null, 2)); return p; }
export const median = (a: number[]): number => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
