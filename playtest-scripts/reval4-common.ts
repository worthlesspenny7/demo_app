import { chromium, type Browser, type Page } from 'playwright';
import { readFileSync } from 'node:fs';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
export const BASE = 'http://127.0.0.1:4182';
export const SHOTS = '/home/user/demo_app/docs/playtest/screenshots';
export const FRAMES = '/home/user/demo_app/docs/research/frames';
export async function launch(w = 1366, h = 800): Promise<{ browser: Browser; page: Page; errors: string[] }> {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript('window.__name = (f) => f;');
  const page = await ctx.newPage(); const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { browser, page, errors };
}
export const dataUri = (p: string, mime = 'image/jpeg') => `data:${mime};base64,${readFileSync(p).toString('base64')}`;
/** Side-by-side composite of a real frame (left, optionally cropped) and a simulator screenshot (right). */
export async function sideBySide(browser: Browser, out: string, left: { path: string; crop?: { x: number; y: number; w: number; h: number } }, rightPng: string, labels: [string, string], height = 640): Promise<void> {
  const p = await browser.newPage({ viewport: { width: 1500, height: height + 60 } });
  const c = left.crop; const lf = dataUri(left.path); const rt = dataUri(rightPng, 'image/png');
  const leftHtml = c ? `<div style="width:${Math.round(c.w * height / c.h)}px;height:${height}px;overflow:hidden;position:relative"><img src="${lf}" style="position:absolute;height:${Math.round(720 * height / c.h)}px;left:-${Math.round(c.x * height / c.h)}px;top:-${Math.round(c.y * height / c.h)}px"></div>` : `<img src="${lf}" style="height:${height}px">`;
  await p.setContent(`<body style="margin:0;background:#888;font:14px sans-serif;color:#fff"><div style="display:flex;gap:12px;align-items:flex-start;padding:6px"><div>${leftHtml}<div>${labels[0]}</div></div><div><img src="${rt}" style="height:${height}px;max-width:760px;object-fit:contain;object-position:top left;background:#fff"><div>${labels[1]}</div></div></div></body>`);
  await p.waitForTimeout(300); await p.screenshot({ path: out }); await p.close();
}
