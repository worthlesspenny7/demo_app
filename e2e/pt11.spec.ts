// Fix sprint PT-11 / realism v4 (2026-10-05): the playability items of docs/playtest/PT-11-playability-v3-3.md as the player meets them, at 1366x768.
import { test, expect, type Page } from '@playwright/test';
import { PROGRESS_KEY } from '../src/ui/viewmodels/progress.js';
import { START_PATH } from '../src/ui/viewmodels/curriculum.js';

test.use({ viewport: { width: 1366, height: 768 } });

const p1 = (stars: number, tiers: number[]) => ({ stars, tierStars: tiers, aces: 0, runs: 1, bestScore: 0.2, lastScore: 0.2, bestRaw: 0, lastPlayed: Date.now() });
async function setProgress(page: Page, drills: Record<string, unknown>, lessons: Record<string, boolean>): Promise<void> {
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [PROGRESS_KEY, JSON.stringify({ version: 1, drills, lessons, runs: [], maneuvers: {} })]);
}

test('PLAY-048 a lesson links its moved table to the Reference page, which opens at that section', async ({ page }) => {
  await page.goto('/#/school/four-s');
  const link = page.locator('.lesson-ref a', { hasText: 'The real penalties' }); await expect(link).toHaveAttribute('href', '#/reference/penalties');
  await link.click(); await expect(page).toHaveURL(/#\/reference\/penalties$/);
  const sec = page.locator('#ref-lesson-penalties'); await expect(sec).toHaveClass(/ref-target/); await expect(sec).toContainText('1 s per second'); await expect(sec.locator('a', { hasText: "The Four S's" })).toHaveAttribute('href', '#/school/four-s');
  await expect(page.locator('#ref-from-lessons .ref-lesson')).toHaveCount(12);
  await expect(page.locator('#ref-speed-caution')).toContainText('66 mph');   // ENG-028: the 20 % column carries the speed-limit caution
});

test('PLAY-047 N-D9 "Path complete" keeps a button toward D12, and the markup lesson offers the path\'s Next', async ({ page }) => {
  const drills: Record<string, unknown> = {}; for (const s of START_PATH) if (s.kind === 'drill') drills[s.id] = p1(2, s.id === 'D09' ? [2] : [2, 2, 0]);
  Object.assign(drills, { D18: p1(1, [1, 1, 0]), D07: p1(2, [2, 2, 0]), D11: p1(1, [1, 0, 0]) });
  const lessons = Object.fromEntries(['four-s', 'transits', 'which-timer', 'ghost-car', 'griid-cameo', 'protocol', 'lost', 'pause-arithmetic', 'timed-leads', 'measure-car', 'recovery', 'calibration', 'markup'].map(l => [l, true]));
  await setProgress(page, drills, lessons); await page.goto('/#/');
  await expect(page.locator('#path-complete')).toContainText('Path complete'); await expect(page.locator('#beyond-path')).toHaveText(/^Next: .*D12 needs/);
  await page.goto('/#/school/markup'); await expect(page.locator('#next-path')).toHaveText(/^Next on your path: .*D12 needs/);
});

test('PLAY-047 N-D7 the Silver pre-read and launch card print no launch second; Bronze still does', async ({ page }) => {
  await page.goto('/#/cockpit/drill/D04/1/1'); await expect(page.locator('#cockpit')).toBeVisible();
  await expect(page.locator('#preread')).not.toContainText(/launch(es)?( itself)? at \d\d:\d\d:\d\d/); await expect(page.locator('#preread')).not.toContainText('minus 0 s'); await expect(page.locator('#preread')).toContainText('simple chart, Acc at');
  await page.goto('/#/cockpit/drill/D04/0/1'); await page.reload(); await expect(page.locator('#preread')).toContainText(/launches itself at \d\d:\d\d:\d\d/);
});

test('PLAY-043 N-D2 the D06 Silver Debrief Retry opens the next attempt (a new hidden car)', async ({ page }) => {
  await page.goto('/#/cockpit/drill/D06/1/3'); await expect(page.locator('#cockpit')).toBeVisible();
  await page.evaluate(() => window.__rally!.finish()); await expect(page).toHaveURL(/#\/debrief/);
  await page.locator('#retry').click(); await expect(page).toHaveURL(/#\/cockpit\/drill\/D06\/1\/3\/1$/);
  await expect(page.locator('#alert')).toContainText(/Attempt 2 of this seed: a new hidden car/);
});
