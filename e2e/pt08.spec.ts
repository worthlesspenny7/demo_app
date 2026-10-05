// Fix sprint PT-08 / PT-09 (2026-10-04): the playability items of docs/playtest/PT-08-playability-v3-curriculum.md as the player meets them, at 1366x768.
import { test, expect, type Page } from '@playwright/test';
import { PROGRESS_KEY } from '../src/ui/viewmodels/progress.js';
import { CHART_NOTES_KEY } from '../src/ui/viewmodels/chartnotes.js';
import { LESSONS } from '../content/lessons.js';

test.use({ viewport: { width: 1366, height: 768 } });

const p1 = (stars: number, tiers: number[]) => ({ stars, tierStars: tiers, aces: 0, runs: 1, bestScore: 0.2, lastScore: 0.2, bestRaw: 0, lastPlayed: Date.now() });
async function setProgress(page: Page, drills: Record<string, unknown>, lessons: Record<string, boolean>): Promise<void> {
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [PROGRESS_KEY, JSON.stringify({ version: 1, drills, lessons, runs: [], maneuvers: {} })]);
}
const ALL_LESSONS = ['four-s', 'transits', 'which-timer', 'ghost-car', 'griid-cameo', 'protocol', 'lost', 'pause-arithmetic', 'timed-leads', 'measure-car', 'recovery', 'calibration'];

test('PLAY-023 Home prints the Four S headings in the handbook order, says why starts and course come first, and Next goes to the lesson when one is due', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('#starthere-panel .path-s')).toHaveText(['1. Safety first', '2. Start on time', '3. Stay on course', '4. Stay on time']);
  await expect(page.locator('#path-why')).toContainText('Starts and course come before time');
  await expect(page.locator('#starthere')).toHaveText(/Next: School: the Four S's/);
  // every lesson read except the ghost car, D16 not played: Next opens the ghost-car lesson, not D16
  await setProgress(page, {}, Object.fromEntries(ALL_LESSONS.filter(l => l !== 'ghost-car').map(l => [l, true])));
  await page.goto('/#/');
  await expect(page.locator('#starthere')).toHaveText(/Next: School: the ghost car/); await page.locator('#starthere').click(); await expect(page).toHaveURL(/#\/school\/ghost-car$/);
  // the lesson's own "Next on your path" then opens D16
  await page.locator('.quiz .opt', { hasText: LESSONS.find(l => l.id === 'ghost-car')!.check.options[LESSONS.find(l => l.id === 'ghost-car')!.check.answer]! }).click();   // PT-10: the options are shuffled each time
  await expect(page.locator('#next-path')).toHaveText(/Next on your path: D16 Start on the second/);
});

test('PLAY-024 the path\'s end: D18 shows its lock, Next replays a prerequisite at Silver and never opens D18', async ({ page }) => {
  const bronze = Object.fromEntries(['D16', 'D09', 'D10', 'D01', 'D03', 'D04', 'D05', 'D06', 'D08', 'D07'].map(id => [id, p1(2, id === 'D09' ? [2] : [2, 0, 0])]));
  await setProgress(page, bronze, Object.fromEntries(ALL_LESSONS.map(l => [l, true])));
  await page.goto('/#/');
  const d18 = page.locator('#starthere-panel li[data-step="D18"]'); await expect(d18).toHaveClass(/locked/); await expect(d18).toContainText('🔒'); await expect(d18).toContainText(/needs D03 ★★/);
  await expect(page.locator('#starthere')).toHaveText(/Next: Replay D03 at Silver \(D18 needs D03 ★★ at Silver or Gold\)/);
  await page.locator('#starthere').click(); await expect(page).toHaveURL(/#\/cockpit\/drill\/D03\/1\/1$/);
});

test('PLAY-025 D09 asks what you do, never "which statement is right"', async ({ page }) => {
  await page.goto('/#/quiz/D09');
  await expect(page.locator('h1')).toHaveText(/Trap quiz: which way, and what do you do\?/);
  await expect(page.locator('.quiz .panel p').first()).toContainText(/(Which way, and what do you do\?|What do you do\?)$/);
  await expect(page.locator('.quiz')).not.toContainText('Which statement is right');
});

test('PLAY-026 "Fast-forward" on the D16 full start stops 45 s before the launch second; the count still runs', async ({ page }) => {
  await page.goto('/#/cockpit/drill/D16/0/1'); await expect(page.locator('#cockpit')).toBeVisible(); await page.locator('#pause').click();
  await expect(page.locator('#skip')).toHaveText('Fast-forward to 45 s before the launch');
  await page.locator('#skip').click();
  const left = await page.evaluate(() => window.__rally!.observe().launch!.secondsToLaunch); expect(left).toBeGreaterThan(44); expect(left).toBeLessThan(46);
  await page.evaluate(() => window.__rally!.advance(20));
  await expect(page.locator('#driverlog')).toContainText('Give me about 30 seconds before we go');
});

test('PLAY-027 PLAY-043 D06 chart notes from the last run of the seed are kept on a Bronze retry; a Silver retry is a new hidden car with no notes carried over', async ({ page }) => {
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [CHART_NOTES_KEY, JSON.stringify({ 'D06:0:1': ['stopgo 30>40 = 8.4', 'turn 40>35 = 4.0'], 'D06:1:1': ['stopgo 30>40 = 8.4'] })]);
  await page.goto('/#/cockpit/drill/D06/0/1'); await expect(page.locator('#cockpit')).toBeVisible();
  const notes = await page.evaluate(() => window.__rally!.observe().notes); expect(notes).toEqual(['stopgo 30>40 = 8.4', 'turn 40>35 = 4.0']);
  await expect(page.locator('#alert')).toContainText(/2 chart notes are kept from the last run of this seed/);
  // PT-11 N-D2: Silver measures the car in front of it: the retry (attempt 2) draws a new hidden car and carries no notes
  await page.goto('/#/cockpit/drill/D06/1/1/1'); await page.reload(); await expect(page.locator('#cockpit')).toBeVisible();
  expect(await page.evaluate(() => window.__rally!.observe().notes)).toEqual([]); await expect(page.locator('#alert')).toContainText(/Attempt 2 of this seed: a new hidden car/);
});

test('PLAY-031 Dad\'s card prints on one page', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { (window as unknown as { __printed: number }).__printed = ((window as unknown as { __printed?: number }).__printed ?? 0) + 1; }; });
  await page.goto('/#/school/protocol');   // PT-11 (PLAY-048): one page again, the card on it
  const pagesOf = (b: Buffer): number => (b.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  expect(pagesOf(await page.pdf({ format: 'Letter' }))).toBeGreaterThan(1);   // control: the whole lesson is several pages
  await page.locator('#print-card').click();
  await expect(page.locator('html')).toHaveClass(/print-card-only/); await expect(page.locator('#print-root .printcard li')).toHaveCount(21);
  expect(pagesOf(await page.pdf({ format: 'Letter' }))).toBe(1);
  await page.goto('/#/'); await expect(page.locator('html')).not.toHaveClass(/print-card-only/);
});

test('PLAY-032 the day stage is "Day stage 1" in the pre-read and the hint bar, never "fullStage #1"', async ({ page }) => {
  await page.goto('/#/cockpit/builtin/stage/1'); await expect(page.locator('#cockpit')).toBeVisible(); await page.locator('#pause').click();
  await expect(page.locator('#preread h2')).toHaveText('Day stage 1'); await expect(page.locator('#hintbar')).not.toContainText('fullStage');
  await expect(page.locator('#cockpit')).not.toContainText('fullStage #1');
});
