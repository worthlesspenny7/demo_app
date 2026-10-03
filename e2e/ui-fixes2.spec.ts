// UI fix sprint 2: resume banner (N4), Keys overlay, scale keys and locked scale buttons (N8), quiz result keys (N3), campaign lock (N9), perfect-run headline.
import { test, expect, type Page } from '@playwright/test';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { snapshotRun } from '../src/ui/viewmodels/resume.js';

async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function depart(page: Page): Promise<void> {
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
}

test('UI-022 N4 after a reload mid-run the pre-read offers Resume / Start fresh; the save is never overwritten silently', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await openDrill(page, 'D03');
  await depart(page);
  await page.keyboard.press(' ');
  await page.evaluate(() => window.__rally!.advance(12));
  const before = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('rally-trainer.live-run.v1')!); return { tick: v.tick as number, actions: v.actions.length as number }; }).catch(() => null);
  await page.reload();                                       // beforeunload saves the live run
  await expect(page.locator('#cockpit')).toBeVisible();
  await expect(page.locator('#resume-banner')).toBeVisible();
  await expect(page.locator('#resume-banner')).toContainText(/unfinished run of this drill/);
  await expect(page.locator('#preread')).toBeVisible();
  // starting without choosing is held back and the save survives, even if the engine is driven programmatically
  await page.keyboard.press('d');
  await expect(page.locator('#preread')).toBeVisible();
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); r.advance(5); });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.live-run.v1')!));
  expect(saved.tick).toBeGreaterThan(100);
  if (before) expect(saved.tick).toBeGreaterThanOrEqual(before.tick);
  // Resume restores the saved run exactly like Home does
  await page.reload();
  await expect(page.locator('#resume-banner')).toBeVisible();
  await page.locator('#resume-run').click();
  await expect(page.locator('#resume-banner')).toHaveCount(0);
  const resumed = await page.evaluate(() => ({ tick: window.__rally!.sim.tick, running: window.__rally!.observe().stopwatch.running, phase: window.__rally!.sim.phase }));
  expect(resumed.tick).toBeGreaterThanOrEqual(saved.tick); expect(resumed.tick - saved.tick).toBeLessThan(10); expect(resumed.running).toBe(true); expect(resumed.phase).toBe('running');
  // Start fresh discards the save
  await page.reload();
  await expect(page.locator('#resume-banner')).toBeVisible();
  await page.locator('#start-fresh').click();
  await expect(page.locator('#resume-banner')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('rally-trainer.live-run.v1'))).toBeNull();
  await page.keyboard.press('d');
  await expect(page.locator('#preread')).toBeHidden();
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1024, height: 700 }]) {
  test(`UI-023 Keys overlay is fully visible, above the HUD, scrollable, and closes on Esc / outside click at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openDrill(page, 'D03');
    await page.locator('#keys-btn').click();
    const panel = page.locator('#keys-panel');
    await expect(panel).toBeVisible();
    const r = await page.evaluate(() => {
      const p = document.querySelector('#keys-panel')!.getBoundingClientRect();
      const hud = document.querySelector('.hud')!.getBoundingClientRect();
      const cx = p.left + p.width / 2, cy = p.top + 20;
      const top = document.elementFromPoint(cx, cy);
      // every HUD button is covered by the overlay backdrop (the overlay sits above the HUD)
      const hb = document.querySelector('#keys-btn')!.getBoundingClientRect();
      const over = document.elementFromPoint(hb.left + hb.width / 2, hb.top + hb.height / 2);
      return { l: p.left, t: p.top, r: p.right, b: p.bottom, iw: window.innerWidth, ih: window.innerHeight, inPanel: !!top && !!top.closest('#keys-panel'), hudOnTop: !!over && !over.closest('#keys-overlay'), cx: (p.left + p.right) / 2, hudB: hud.bottom };
    });
    expect(r.l).toBeGreaterThanOrEqual(0); expect(r.t).toBeGreaterThanOrEqual(0); expect(r.r).toBeLessThanOrEqual(r.iw); expect(r.b).toBeLessThanOrEqual(r.ih);
    expect(Math.abs(r.cx - r.iw / 2)).toBeLessThan(4);                  // centered
    expect(r.inPanel).toBe(true); expect(r.hudOnTop).toBe(false);       // panel and backdrop are above the HUD
    expect(await panel.evaluate(e => getComputedStyle(e).overflowY)).toBe('auto');
    await expect(panel).toContainText('Space'); await expect(panel).toContainText('time scale');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => window.__rally!.sim.phase)).toBe('preread');   // Esc closed the overlay, it did not pause/start anything
    await page.locator('#keys-btn').click(); await expect(panel).toBeVisible();
    await page.mouse.click(5, 5);                                          // outside the panel
    await expect(panel).toBeHidden();
    await page.keyboard.press('?'); await expect(panel).toBeVisible();
    await page.locator('#keys-close').click(); await expect(panel).toBeHidden();
  });
}

test('UI-023 hint bar names the scale keys with the live scale chip; D01/D03 scale buttons are disabled; other drills change scale', async ({ page }) => {
  await openDrill(page, 'D01');
  await expect(page.locator('#hint-scalekeys')).toContainText(/locked at 1x/);
  for (const s of [1, 2, 4, 8]) await expect(page.locator(`button[data-scale="${s}"]`)).toBeDisabled();
  await page.locator('button[data-scale="4"]').click({ force: true });
  await expect(page.locator('#scale')).toContainText('1x'); await expect(page.locator('#scale')).not.toContainText('asked');
  await page.keyboard.press('>');
  await expect(page.locator('#hint-scale')).toContainText('1x locked');
  await openDrill(page, 'D04');
  await expect(page.locator('#hint-scalekeys')).toContainText(/> faster/); await expect(page.locator('#hint-scalekeys')).toContainText(/< slower/);
  await expect(page.locator('button[data-scale="4"]')).toBeEnabled();
  await expect(page.locator('#hint-scale')).toHaveText('1x');
  await page.keyboard.press('>');
  await expect(page.locator('#hint-scale')).toContainText('2x');
  await expect(page.locator('#hint-scalekeys')).toBeVisible();
  const inView = await page.evaluate(() => { const b = document.querySelector('#hint-scalekeys')!.getBoundingClientRect(); return b.right <= window.innerWidth + 1 && b.left >= 0; });
  expect(inView).toBe(true);
});

test('UI-027 N3 pressing a digit on the quiz result screen raises no page error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/#/quiz/D09');
  for (let i = 0; i < 20; i++) { await page.keyboard.press('1'); await page.keyboard.press('Enter'); }
  await expect(page.locator('h2')).toContainText(/\/ 20 correct/);
  await page.keyboard.press('2'); await page.keyboard.press('1'); await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

test('UI-025 N9 #/campaign redirects Home with a note while D13 is locked, and the nav only links it once unlocked', async ({ page }) => {
  await page.goto('/#/campaign');
  await expect(page.locator('#home-note')).toContainText(/locked/i);
  await expect(page.locator('h1')).toHaveText(/Rally Trainer/);
  await expect(page.locator('#nav-campaign')).toBeHidden();
  // unlock D13 through Silver stars on D12 (progress is plain localStorage)
  await page.evaluate(() => {
    const k = 'rally-trainer.progress.v1';
    const p = { version: 1, drills: { D12: { stars: 1, aces: 0, bestScore: null, runs: 1, lastScore: null, lastPlayed: 1, tierStars: [0, 1, 0] } }, lessons: {}, runs: [], maneuvers: {} };
    localStorage.setItem(k, JSON.stringify(p));
  });
  await page.goto('/#/');
  await page.reload();
  await expect(page.locator('#nav-campaign')).toBeVisible();
  await page.locator('#nav-campaign').click();
  await expect(page.locator('#campaign')).toBeVisible();
});

test('RUB-001 a perfect D16 run shows "Clean run" with no contradicting "Fix this next"; the card minutes are computed', async ({ page }) => {
  await page.goto('/#/');
  const d07 = await page.locator('.card[data-drill="D07"] .meta').innerText();
  const mins = Number(/~(\d+) min/.exec(d07)?.[1] ?? 0);
  expect(mins).toBeGreaterThan(40);                           // 1x ghost time (~45 min), not the old "~12"
  // the oracle bot plays D16 seed 1 perfectly; its action log is stored as the last run and the Debrief is rebuilt from it
  const d = drillById('D16')!; const sc = d.scenario(1, 0);
  const sim = new Simulator(sc); const res = runBot(sim, new OracleBot(sim));
  expect(res.score.raw).toBeLessThanOrEqual(3 * res.score.legs.length);
  const stored = snapshotRun(sim, { kind: 'drill', drillId: 'D16', tier: 0, seed: 1 }, { driverSkill: 'scenario', watch: 'analog', annotations: null, scaleMax: 1 });
  await page.evaluate(v => localStorage.setItem('rally-trainer.last-run.v1', JSON.stringify(v)), stored);
  await page.goto('/#/debrief'); await page.reload();
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  const tip = await page.locator('#tip').innerText();
  expect(tip).toMatch(/Clean run/);
  expect(tip).not.toMatch(/Fix this next/);                     // the label turns into "Verdict:" so nothing contradicts the headline
  expect(tip).not.toMatch(/mistimed|half a ramp early/);
  await expect(page.locator('.tip')).toHaveCount(1);             // no "Also:" follow-up on a clean run
  // bias rows with fewer than 2 maneuvers are hidden, with an explanation when none are left
  for (const row of await page.locator('.panel:has(h3:text("Bias or noise?")) tbody tr').all()) expect(Number(await row.locator('td').nth(1).innerText())).toBeGreaterThanOrEqual(2);
});

test('UI-026 the pending callout asks for S when the finish is in sight, and the perf card shows Turn loss on a turning line', async ({ page }) => {
  await page.goto('/#/cockpit/builtin/straight/1');
  await depart(page);
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 600 && !r.observe().ahead.some(f => f.kind === 'finish'); i++) r.advance(1); });
  await expect(page.locator('#callout')).toContainText(/S: stop at the observation checkpoint/);
  await page.keyboard.press('s');
  await expect(page.locator('#callout')).not.toContainText(/S: stop/);
  // D11 line with a turn: the card carries the turn-loss rows
  await openDrill(page, 'D11');
  await depart(page);
  await page.evaluate(() => { const r = window.__rally!; const b = r.observe().book; const n = b.find(i => i.turn === 'L' || i.turn === 'R')!.n; r.act({ type: 'line.set', n }); });
  await expect(page.locator('#perfcard .turnloss')).toContainText(/Turn loss/);
  await expect(page.locator('#perfcard .turnloss')).toContainText(/90°/);
});
