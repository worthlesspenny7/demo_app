// Phase VIII: installable PWA and offline play (MOB-023), and the agent-style validation run on a 390 x 844 phone (MOB-040, MOB-042).
import { test, expect } from '@playwright/test';
import { PHONES, state, step, geometry, collectErrors, type W } from './mobile-helpers.js';

test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

test('MOB-023 the service worker caches the app shell: after one visit the app loads offline and plays a run', async ({ page, context }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.goto('/?mode=mobile#/m');
  await expect(page.locator('[data-screen=home]')).toBeVisible();
  // the worker is active (install has precached the whole shell before it activates)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys.find(k => k.startsWith('rally-trainer-'))!); return (await c.keys()).map(r => new URL(r.url).pathname); });
  expect(cached).toContain('/index.html');
  expect(cached.some(p => /\/assets\/index-.*\.js$/.test(p))).toBe(true);
  expect(cached).toContain('/manifest.webmanifest');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-screen=home]')).toBeVisible();
  await page.locator('[data-testid=play-daily]').click();
  await expect(page.locator('[data-screen=run]')).toBeVisible();
  let answered = 0;
  for (let i = 0; i < 12 && answered < 3; i++) if ((await step(page)) === 'decision') answered++;
  expect(answered).toBe(3);
  // a fresh navigation offline also comes from the cache
  await page.goto('/?mode=mobile#/m');
  await expect(page.locator('[data-testid=continue]')).toBeVisible();
  await context.setOffline(false);
  expect(errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e))).toEqual([]);
});

test('MOB-040 MOB-042 a new player on a 390x844 phone: first decision within 20 s, one run of 10-15 cards played right, median gap under 15 s, >= 4 decisions a minute, under 5 minutes; manifest valid, worker registered, no console errors, tap targets >= 48 px', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = collectErrors(page);
  const t0 = Date.now();
  await page.goto('/');                                 // fresh: no storage, no ?mode (the width opens the phone shell)
  await expect(page.locator('[data-screen=home]')).toBeVisible();
  await page.locator('[data-testid=play-daily]').click();
  const shown: number[] = []; const tiny: string[] = [];
  let lastId: string | null = null; let firstDecisionAt = 0;
  for (let i = 0; i < 120; i++) {
    const st = await state(page);
    if (st.screen === 'recap') break;
    if (st.phase === 'decision' && st.id !== lastId) {
      const at = Date.now() - st.elapsed * 1000;        // when the card appeared
      if (!shown.length) firstDecisionAt = at;
      shown.push(at); lastId = st.id;
      tiny.push(...(await geometry(page)).tiny);
    }
    await step(page);
  }
  const end = Date.now();
  await expect(page.locator('[data-screen=recap]')).toBeVisible();
  tiny.push(...(await geometry(page)).tiny);
  const firstSeconds = (firstDecisionAt - t0) / 1000;
  const gaps = shown.slice(1).map((t, i) => (t - shown[i]!) / 1000).sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 0;
  const runMinutes = (end - firstDecisionAt) / 60_000;
  const perMinute = shown.length / runMinutes;
  const verdicts = await page.evaluate(() => (window as unknown as W).__rally.decision.verdicts());
  const summary = `first ${firstSeconds.toFixed(1)} s, ${shown.length} cards, median gap ${median.toFixed(1)} s, ${perMinute.toFixed(1)}/min, run ${(runMinutes * 60).toFixed(0)} s, ${verdicts.filter(v => v.correct).length}/${verdicts.length} right, engine ${await page.evaluate(() => (window as unknown as W).__rally.decision.source())}`;
  test.info().annotations.push({ type: 'MOB-040', description: summary }); console.log(`MOB-040: ${summary}`);
  expect(firstSeconds).toBeLessThan(20);
  expect(shown.length).toBeGreaterThanOrEqual(10); expect(shown.length).toBeLessThanOrEqual(15);
  expect(median).toBeLessThan(15);
  expect(perMinute).toBeGreaterThanOrEqual(4);
  expect(runMinutes).toBeLessThan(5);
  expect(verdicts.length).toBe(shown.length);
  expect(verdicts.filter(v => v.correct).length / verdicts.length).toBeGreaterThanOrEqual(0.8);
  // MOB-042: manifest valid, worker registered, tap targets, no console errors
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')!.getAttribute('href')!;
    const res = await fetch(href); const m = await res.json() as { name: string; display: string; orientation: string; theme_color: string; start_url: string; icons: { src: string; sizes: string; type: string }[] };
    const icons = await Promise.all(m.icons.map(async i => { const r = await fetch(new URL(i.src, new URL(href, location.href)).href); return { sizes: i.sizes, ok: r.ok, type: r.headers.get('content-type') }; }));
    return { ok: res.ok, m, icons };
  });
  expect(manifest.ok).toBe(true);
  expect(manifest.m.name).toBe('Rally Trainer'); expect(manifest.m.display).toBe('standalone'); expect(manifest.m.orientation).toBe('portrait'); expect(manifest.m.theme_color).toMatch(/^#[0-9a-f]{6}$/i); expect(manifest.m.start_url).toBeTruthy();
  for (const size of ['192x192', '512x512']) { const i = manifest.icons.find(x => x.sizes === size); expect(i?.ok, size).toBe(true); expect(i?.type).toContain('image/png'); }
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { has: !!r, active: !!(r?.active ?? r?.installing ?? r?.waiting), helper: (window as unknown as W).__rally.decision.pwa().registered }; });
  expect(reg).toEqual({ has: true, active: true, helper: true });
  expect(tiny).toEqual([]);
  expect(errors).toEqual([]);
});
