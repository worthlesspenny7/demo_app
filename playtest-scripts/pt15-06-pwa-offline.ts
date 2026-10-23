/** PT-15 session 6 (replay of pt14-06) (shared profile): manifest, service worker, install hint, then offline (context.setOffline): reload, start a run, play two cards. */
import { open, shot, writeJson, state, tapEl, sleep, BASE } from './pt15-common.js';
import { playRun, summarize, seedPlayer } from './pt15-player.js';

seedPlayer(156);
const h = await open(); const { page, ctx } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
await sleep(1500);
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel=manifest]') as HTMLLinkElement | null;
  if (!link) return { link: null };
  const r = await fetch(link.href); const j = await r.json();
  const icons = await Promise.all((j.icons ?? []).map(async (i: any) => { const u = new URL(i.src, link.href).href; const rr = await fetch(u); return { src: i.src, sizes: i.sizes, purpose: i.purpose, status: rr.status, type: rr.headers.get('content-type') }; }));
  return { link: link.href, status: r.status, contentType: r.headers.get('content-type'), name: j.name, short_name: j.short_name, start_url: j.start_url, display: j.display, orientation: j.orientation, theme: j.theme_color, bg: j.background_color, icons };
});
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys(); const cached: Record<string, number> = {};
  for (const k of keys) cached[k] = (await (await caches.open(k)).keys()).length;
  return { registered: !!reg, scope: reg?.scope, active: reg?.active?.state ?? null, controller: !!navigator.serviceWorker.controller, helper: (window as any).__rally?.decision?.pwa?.() ?? null, caches: cached };
});
const cdp = await ctx.newCDPSession(page);
let installability: unknown = null;
try { installability = await cdp.send('Page.getInstallabilityErrors' as any); } catch (e) { installability = `n/a: ${String(e)}`; }
let appManifest: unknown = null;
try { const m: any = await cdp.send('Page.getAppManifest' as any); appManifest = { errors: m.errors, url: m.url }; } catch (e) { appManifest = `n/a: ${String(e)}`; }
// offline
await ctx.setOffline(true);
const offline: Record<string, unknown> = {};
try { await page.reload({ waitUntil: 'load', timeout: 15000 }); offline.reload = 'ok'; } catch (e) { offline.reload = `failed: ${String(e).slice(0, 200)}`; }
offline.homeVisible = await page.locator('[data-screen=home]').isVisible().catch(() => false);
await shot(page, '50-offline-home');
try { await page.goto(`${BASE}/?mode=mobile`, { timeout: 15000 }); offline.startUrl = await page.locator('[data-screen=home]').isVisible().catch(() => false); } catch (e) { offline.startUrl = `failed: ${String(e).slice(0, 160)}`; }
try { await page.goto(`${BASE}/#/reference`, { timeout: 15000 }); await sleep(600); offline.reference = await page.evaluate(() => (document.querySelector('#app')?.textContent ?? '').trim().length > 200); } catch (e) { offline.reference = `failed: ${String(e).slice(0, 160)}`; }
await page.goto(`${BASE}/?mode=mobile#/m/play/practice`).catch(() => undefined);
await page.waitForSelector('[data-screen=run], [data-screen=confirm]', { timeout: 15000 }).catch(() => undefined);
if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]', { timeout: 15000 }).catch(() => undefined); }
let run: Awaited<ReturnType<typeof playRun>> | null = null;
if (await page.locator('[data-screen=run]').count()) { run = await playRun(page, { policy: 'rules', label: 'offline practice, 2 cards', stopAfterDecisions: 2 }); offline.played = run.cards.filter(c => c.phase === 'decision').length; }
await shot(page, '51-offline-run');
await ctx.setOffline(false);
const out = { manifest, sw, installability, appManifest, offline, run: run ? summarize(run) : null, errors: h.errors };
writeJson('s06-pwa', out);
console.log(JSON.stringify(out, null, 1));
await h.close();
