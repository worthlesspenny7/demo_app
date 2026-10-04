// Phase VI (INST-003, CHART-007, PREREAD-002, TAF-003, GRIID-015, GRIID-016, GRIID-014): what the video frames add to the cockpit and the printable book.
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { generateStage } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';

async function openStage(page: Page, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/builtin/stage/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function resumeAtFirstTaWindow(page: Page, seed: number): Promise<void> {
  const sim = new Simulator(generateStage(seed), { watch: 'digital' });
  const bot = new OracleBot(sim);
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && !sim.taState().windowOpen; n++) { bot.onTick(); sim.step(0.1); }
  expect(sim.taState().windowOpen).toBe(true);
  const stored = snapshotRun(sim, { kind: 'builtin', name: 'stage', seed }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/');
  await page.locator('#resume').click();
  await expect(page.locator('#cockpit')).toBeVisible();
}

test('INST-003 the dash clock is the Sawtooth-style rally clock by default and the bezel clock on request; the digital watch carries a lanyard', async ({ page }) => {
  await openStage(page, 1);
  await expect(page.locator('canvas#clock')).toHaveAttribute('data-face', 'sawtooth');
  await expect(page.locator('#stopwatch .dw-lanyard')).toHaveCount(1);
  await page.goto('/#/settings');
  await expect(page.locator('body')).toContainText('Sawtooth style');
  await page.locator('select').nth(4).selectOption('bezel');                                                  // the dash clock face
  await openStage(page, 1);
  await expect(page.locator('canvas#clock')).toHaveAttribute('data-face', 'bezel');
  await page.evaluate(() => localStorage.clear());
});

test('CHART-007 the performance card shows the simple chart by default (12 speeds, Dec / Acc / S/G / T@15 / T@20) and the three matrices stay behind the Charts overlay', async ({ page }) => {
  await openStage(page, 1);
  const rows = page.locator('#simplechart-table tbody tr');
  await expect(rows).toHaveCount(12);
  expect(await page.locator('#simplechart-table tbody tr').evaluateAll(trs => trs.map(t => t.getAttribute('data-speed')))).toEqual(['55', '50', '48', '45', '40', '35', '30', '25', '20', '15', '12', '10']);
  expect(await page.locator('#simplechart-table thead th').allInnerTexts()).toEqual(['SPEED', 'DEC', 'ACC', 'S/G', 'T@15', 'T@20']);
  // S/G = Dec + Acc, as printed
  const first = await rows.first().locator('td').allInnerTexts(); expect(Math.round((Number(first[0]) + Number(first[1])) * 10) / 10).toBeCloseTo(Number(first[2]), 1);
  await page.goto('/#/cockpit/drill/D18/0/1'); await expect(page.locator('#cockpit')).toBeVisible();
  await expect(page.locator('#simplechart-table tr.cur')).not.toHaveCount(0);                                  // the speeds of the current line are highlighted (aids rung 2)
  await page.locator('#chart-view').selectOption('matrices');
  await expect(page.locator('#matrices-note')).toContainText('three matrices');
  await page.locator('#charts-btn').click();
  await expect(page.locator('#charts-overlay')).toBeVisible(); await expect(page.locator('#chart-accel th.axis-side')).toHaveText('BRAKING');
  await page.locator('#charts-close').click();
  await page.locator('#chart-view').selectOption('simple'); await expect(rows).toHaveCount(12);
  await page.evaluate(() => localStorage.clear());
});

test('PREREAD-002 a preset mark is written on the book row as the real hand mark and sent to the engine as line.annotate text: P10.2 beside a struck 0m15s, a circled loss, a TRAIN delay with a star', async ({ page }) => {
  await openStage(page, 1);
  const n = await page.evaluate(() => window.__rally!.observe().book.find(i => i.pause && (!i.turn || i.turn === 'S'))!.n);
  const row = page.locator(`#book .row[data-n="${n}"]`);
  await row.locator('select.mark-sel').selectOption('pause');
  await page.locator('#prompt input').fill('10.2'); await page.locator('#prompt input').press('Enter');
  await expect(row.locator('.struck-text')).toHaveText('0m15s');                                              // the printed pause is struck
  await expect(row.locator('.hand.pnote')).toHaveText('P10.2');                                               // and "P10.2" is written beside it
  await row.locator('select.mark-sel').selectOption('loss');
  await page.locator('#prompt input').fill('2.9'); await page.locator('#prompt input').press('Enter');
  await expect(row.locator('.hand.circled')).toHaveText('-2.9');
  await row.locator('select.mark-sel').selectOption('train');
  await page.locator('#prompt input').fill('3:47'); await page.locator('#prompt input').press('Enter');
  await expect(row.locator('.hand.dnote')).toContainText('TRAIN Delay 3:47'); await expect(row.locator('.hand.dnote .star')).toHaveCount(1);
  const sent = await page.evaluate(m => window.__rally!.sim.actions.filter(a => a.action.type === 'line.annotate' && (a.action as { n: number }).n === m).map(a => (a.action as { text: string }).text), n);
  expect(sent).toEqual(expect.arrayContaining(['P10.2', '-2.9', 'TRAIN Delay 3:47 *']));
});

test('GRIID-015 GRIID-016 the book draws the CAMEO with its sign inside the cell and the Information Box row of the end of the day spans B and C', async ({ page }) => {
  await page.goto('/#/book/builtin/stage/1');
  await expect(page.locator('.book-sheet').first()).toBeVisible();
  expect(await page.locator('.book-sheet .ga svg.cameo').count()).toBeGreaterThan(30);
  expect(await page.locator('.book-sheet .cameo-signface').count()).toBeGreaterThan(5);                       // sign faces live inside the drawing
  expect(await page.locator('.book-sheet .ga .sign-box').count()).toBe(0);                                      // no boxes beside it any more
  const info = page.locator('.book-sheet .grow.info-row'); await expect(info).toHaveCount(1);
  await expect(info.locator('.infobox')).toContainText('Reception and awards'); await expect(info.locator('.gb')).toHaveCount(0);
  const w = await info.evaluate(el => { const r = (s: string) => (el.querySelector(s) as HTMLElement).getBoundingClientRect().width; return { box: r('.gbc'), a: r('.ga'), d: r('.gd') }; });
  expect(w.box).toBeGreaterThan(w.a); expect(w.box).toBeGreaterThan(w.d);                                       // the box spans two columns
  // the column proportions 4 : 30 : 20 : 23.5 : 26.5
  const cols = await page.locator('.book-sheet .grow').nth(1).evaluate(el => [...el.children].slice(0, 5).map(c => c.getBoundingClientRect().width));
  const total = cols.reduce((a, b) => a + b, 0); const frac = cols.map(c => c / total);
  expect(frac[1]).toBeGreaterThan(0.28); expect(frac[1]).toBeLessThan(0.32); expect(frac[2]).toBeGreaterThan(0.18); expect(frac[2]).toBeLessThan(0.22); expect(frac[3]).toBeGreaterThan(0.22); expect(frac[3]).toBeLessThan(0.25); expect(frac[4]).toBeGreaterThan(0.25); expect(frac[4]).toBeLessThan(0.28);
});

test('TAF-003 the classic paper Time Delay Form is filled in and handed in with the request type, status and the witness rows; a Formal Problem Resolution Request needs no allowance', async ({ page }) => {
  await resumeAtFirstTaWindow(page, 6);
  await page.locator('#ta-paper').check();
  await expect(page.locator('#tapaper')).toBeVisible();
  await page.locator('#ta-car').fill('99'); await page.locator('#ta-stage').fill('2');
  await page.locator('#ta-circumstances').fill('caught by a train at the crossing on Hwy. 49.');
  await page.locator('#ta-w1-car').fill('8'); await page.locator('#ta-w1-name').fill('black 32 Ford'); await page.locator('#ta-w2-car').fill('77'); await page.locator('#ta-w2-name').fill('57 Chevy'); await page.locator('#ta-w2-role').selectOption('official');
  await page.locator('#ta-status').selectOption('navigator'); await page.locator('#ta-signature').fill('J. Scribble');
  await page.locator('#ta-submit').click();
  await expect(page.locator('#ta-filed')).toContainText(/Leg 3: /);
  const rec = await page.evaluate(() => window.__rally!.sim.taRequests[0] as unknown as Record<string, unknown>);
  expect(rec['requestType']).toBe('time-allowance'); expect(rec['contestantStatus']).toBe('navigator'); expect(rec['carNumber']).toBe(99); expect(rec['cause']).toBe('train');
  expect(rec['witnessedBy']).toEqual([{ car: '8', description: 'black 32 Ford' }, { car: '77', description: '57 Chevy', role: 'official' }]); expect(rec['password']).toBeUndefined();
  // a Formal Problem Resolution Request: no allowance, +30 s on the stage score
  const before = await page.evaluate(() => window.__rally!.result().score.formalProblemPenalty ?? 0);
  await page.locator('#ta-types input[value="formal-problem"]').check(); await page.locator('#ta-min').fill(''); await page.locator('#ta-sec').fill(''); await page.locator('#ta-circumstances').fill('the sign was missing');
  await page.locator('#ta-submit').click();
  const after = await page.evaluate(() => window.__rally!.result().score.formalProblemPenalty ?? 0);
  expect(before).toBe(0); expect(after).toBe(30);
});
