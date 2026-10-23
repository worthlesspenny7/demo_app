/** Shared helpers for the phone-shell e2e specs (e2e/mobile*.spec.ts). Sim time is never advanced by wall-clock waits except for the
 *  timing cards, which are tapped in real time at the oracle's second (MOB-004). */
import { expect, type Page } from '@playwright/test';
import type { DecisionHelpers } from '../src/ui/mobile/index.js';

export type W = { __rally: { decision: DecisionHelpers } };
export const PHONES = [{ width: 390, height: 844 }, { width: 360, height: 780 }] as const;

export async function state(page: Page): Promise<ReturnType<DecisionHelpers['state']>> {
  return page.evaluate(() => (window as unknown as W).__rally.decision.state());
}

/** Tap a timing card at `seconds` after the card was shown (real time; the tap lands on the button centre via the mouse). */
async function tapAt(page: Page, selector: string, seconds: number): Promise<void> {
  const box = await page.locator(selector).boundingBox(); if (!box) throw new Error(`no ${selector}`);
  await page.waitForFunction(t => (window as unknown as W).__rally.decision.elapsed() >= t - 0.04, seconds, { polling: 'raf', timeout: 60_000 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Play one step of the run: acknowledge a rule card, answer a decision (correctly, by the oracle, unless `wrong`), or dismiss a verdict.
 * Returns what it did.
 */
export async function step(page: Page, opts: { wrong?: boolean } = {}): Promise<'rule' | 'decision' | 'next' | 'recap' | 'other'> {
  const st = await state(page);
  if (st.screen === 'recap') return 'recap';
  if (st.phase === 'rule') { await page.locator('.mob-actions [data-action=ack]').click(); return 'rule'; }
  if (st.phase === 'verdict') { await page.locator('.mob-actions [data-action=next]').click(); return 'next'; }
  if (st.phase !== 'decision') return 'other';
  const o = await page.evaluate(() => (window as unknown as W).__rally.decision.oracle());
  if (o?.optionId !== undefined) {
    const id = opts.wrong ? (st.options.find(x => x !== o.optionId) ?? o.optionId) : o.optionId;
    await page.locator(`.mob-actions [data-option="${id}"]`).click();
  } else if (o?.taps && o.taps.length) {
    await tapAt(page, '.mob-actions [data-action=startstop]', o.taps[0]!);
    if (o.taps.length > 1) await tapAt(page, '.mob-actions [data-action=lap]', o.taps[1]! + (opts.wrong ? 3 : 0));
  } else if (o?.tapSeconds !== undefined) {
    await tapAt(page, '.mob-actions [data-action=go]', o.tapSeconds + (opts.wrong ? 3 : 0));
  } else if (st.options.length) {
    await page.locator(`.mob-actions [data-option="${st.options[0]}"]`).click();
  } else throw new Error(`no way to answer ${st.kind}`);
  await expect(page.locator('[data-testid=verdict]')).toBeVisible();
  return 'decision';
}

/** Play until a decision card is on screen (acknowledging rule cards, dismissing verdicts). */
export async function toDecision(page: Page, maxSteps = 10): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const st = await state(page);
    if (st.phase === 'decision') return;
    if (st.phase === 'rule') await page.locator('.mob-actions [data-action=ack]').click();
    else if (st.phase === 'verdict') await page.locator('.mob-actions [data-action=next]').click();
    else await page.waitForTimeout(50);
  }
  throw new Error('no decision card reached');
}

/** MOB-020 / MOB-041 geometry of the screen on show: no horizontal scroll, no text under 16 px, controls in the bottom 40 % and >= 56 px tall. */
export async function geometry(page: Page): Promise<{ hscroll: boolean; small: string[]; controls: { label: string; top: number; bottom: number; height: number; width: number }[]; vh: number; vw: number; tiny: string[] }> {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const hscroll = document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1;
    const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const small: string[] = [];
    for (const e of document.querySelectorAll('.mob *')) {
      if (e.closest('svg') || !visible(e)) continue;
      if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue;
      const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16 - 0.01) small.push(`${e.tagName}.${(e as HTMLElement).className}: ${fs}px "${(e.textContent ?? '').trim().slice(0, 30)}"`);
    }
    const controls = [...document.querySelectorAll('.mob-actions button, .mob-actions a')].filter(visible).map(e => { const r = e.getBoundingClientRect(); return { label: (e.textContent ?? '').trim().slice(0, 30), top: r.top, bottom: r.bottom, height: r.height, width: r.width }; });
    const tiny = [...document.querySelectorAll('.mob button, .mob a')].filter(visible).map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width < 48 - 0.5 || x.r.height < 48 - 0.5).map(x => `${(x.e.textContent ?? '').trim().slice(0, 20)} ${x.r.width.toFixed(0)}x${x.r.height.toFixed(0)}`);
    return { hscroll, small, controls, vh, vw, tiny };
  });
}

export function expectPhoneGeometry(g: Awaited<ReturnType<typeof geometry>>, where: string): void {
  expect(g.hscroll, `${where}: horizontal scroll`).toBe(false);
  expect(g.small, `${where}: text under 16 px`).toEqual([]);
  expect(g.tiny, `${where}: tap targets under 48 px`).toEqual([]);
  expect(g.controls.length, `${where}: 1-4 action controls`).toBeGreaterThanOrEqual(1);
  expect(g.controls.length, `${where}: 1-4 action controls`).toBeLessThanOrEqual(4);
  for (const c of g.controls) {
    expect(c.top, `${where}: "${c.label}" in the bottom 40 %`).toBeGreaterThanOrEqual(g.vh * 0.6 - 1);
    expect(c.bottom, `${where}: "${c.label}" on screen`).toBeLessThanOrEqual(g.vh + 1);
    expect(c.height, `${where}: "${c.label}" >= 56 px tall`).toBeGreaterThanOrEqual(56);
    expect(c.width, `${where}: "${c.label}" >= 44 px wide`).toBeGreaterThanOrEqual(44);
  }
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`pageerror: ${String(e)}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}
