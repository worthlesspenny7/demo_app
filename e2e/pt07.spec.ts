// UI fix sprint PT-07 (2026-10-04): the top ten of docs/playtest/PT-07-playability-v3-fixed.md at the laptop size Josh uses (1366x768).
import { test, expect, type Page } from '@playwright/test';
import { Simulator } from '../src/core/sim.js';
import { OracleBot } from '../src/agent/bots.js';
import { drillById } from '../src/core/drills/registry.js';
import '../src/core/drills/index.js';
import { snapshotRun, LIVE_KEY } from '../src/ui/viewmodels/resume.js';

async function hold(page: Page): Promise<void> { await page.locator('#pause').click(); }
async function advance(page: Page, seconds: number): Promise<void> { await page.evaluate(s => { window.__rally!.advance(s); }, seconds); }
async function open(page: Page, hash: string): Promise<void> { await page.goto(`/#/cockpit/${hash}`); await expect(page.locator('#cockpit')).toBeVisible(); }
async function onTop(page: Page, sel: string): Promise<boolean> {
  return page.evaluate(s => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return false; const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && (hit === e || e.contains(hit)); }, sel);
}
const box = (page: Page, sel: string) => page.evaluate(s => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);

test.use({ viewport: { width: 1366, height: 768 } });

/** A saved D08b run at the end-of-stage TA window with the delay measured but nothing filed (the rookie bot never files). */
async function resumeD08bUnfiled(page: Page): Promise<void> {
  const sc = drillById('D08b')!.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { ignoreLosses: true } as never);
  for (let n = 0; n < 3_000_000 && sim.phase !== 'finished'; n++) { bot.onTick(); sim.step(0.1); const t = sim.taState(); if (t.windowOpen && t.endOfStage && !sim.scorecardAcked) break; }
  expect(sim.taState().endOfStage).toBe(true); expect(sim.taRequests.length).toBe(0);
  const stored = snapshotRun(sim, { kind: 'drill', drillId: 'D08b', tier: 0, seed: 2 }, { driverSkill: 'scenario', watch: 'digital', annotations: null, scaleMax: 1 });
  await page.goto('/#/settings'); await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [LIVE_KEY, JSON.stringify(stored)]);
  await page.goto('/#/'); await page.locator('#resume').click(); await expect(page.locator('#cockpit')).toBeVisible(); await hold(page);
}

test('PLAY-012 UI-009 the full day stage at 1366x768 keeps the road >= 45 % of the left pane, the stopwatch, the book and the pre-read buttons on screen before and after the launch', async ({ page }) => {
  await open(page, 'builtin/stage/1'); await hold(page);
  const check = async (when: string, buttons = true): Promise<void> => {
    const left = (await box(page, '.left'))!, road = (await box(page, '.road'))!, drawer = (await box(page, '.drawer'))!, book = (await box(page, '#book'))!, watch = (await box(page, '#stopwatch'))!;
    expect(road.h / left.h, `${when}: road share of the left pane`).toBeGreaterThanOrEqual(0.45);
    expect(drawer.h, `${when}: drawer`).toBeLessThanOrEqual(768 * 0.34); expect(book.h, `${when}: book column`).toBeGreaterThanOrEqual(250);
    expect(watch.h, `${when}: watch`).toBeGreaterThanOrEqual(150); expect(watch.y + watch.h, `${when}: watch inside the window`).toBeLessThanOrEqual(768);
    if (buttons) expect(await onTop(page, '#dw-start'), `${when}: watch buttons`).toBe(true);   // an open pre-read box covers the instruments by design (PLAY-004)
    const card = (await box(page, '#perfcard'))!; expect(card.h, `${when}: perf card is capped`).toBeLessThanOrEqual(768 * 0.34);
  };
  await check('pre-read (folded)');
  await expect(page.locator('#preread')).toHaveClass(/collapsed/);                      // 30 s before the launch the box has folded itself into a strip over the road
  for (const id of ['#depart', '#skip', '#preread-toggle']) { await expect(page.locator(id)).toBeVisible(); expect(await onTop(page, id), id).toBe(true); }
  await page.locator('#preread-toggle').click(); await expect(page.locator('#preread')).not.toHaveClass(/collapsed/);
  for (const id of ['#depart', '#skip']) { expect(await onTop(page, id), `expanded ${id}`).toBe(true); const b = (await box(page, id))!; expect(b.y + b.h, id).toBeLessThanOrEqual(768); }
  await check('pre-read (open)', false);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  await advance(page, 10);
  await check('after the launch');
  expect(await onTop(page, '#dw-lap')).toBe(true);
});

test('PLAY-012 the drawer\'s perf card scrolls instead of growing: a card with launch, hold and transit blocks stays inside 34 % of the window at 1366x768 and 1024x700', async ({ page }) => {
  for (const [w, h] of [[1366, 768], [1024, 700]] as const) {
    await page.setViewportSize({ width: w, height: h }); await open(page, 'drill/D16/0/1'); await hold(page);
    const card = (await box(page, '#perfcard'))!; const road = (await box(page, '.road'))!; const left = (await box(page, '.left'))!;
    expect(card.h).toBeLessThanOrEqual(h * 0.34); expect(road.h / left.h).toBeGreaterThanOrEqual(0.4);
  }
});

test('PLAY-014 a 0-2 star run never reads "Clean run", and the Debrief leads with its tip', async ({ page }) => {
  await open(page, 'drill/D05/0/1'); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); r.advance(20); r.finish(); });
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#debrief .pill').first()).toContainText('☆☆☆');
  await expect(page.locator('#tip')).not.toContainText(/^Verdict: Clean run|Clean run/);
  expect(await page.locator('#debrief').innerText()).not.toMatch(/Clean run/);
});

test('PLAY-016 PLAY-017 D16 Bronze: the start card is titled "Start", the hold card says "Say go at ..." and, 60 s before the launch second, "Read the clock now (K)"', async ({ page }) => {
  await open(page, 'drill/D16/0/1'); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  const rs = await page.evaluate(() => window.__rally!.observe().book.find(i => i.section === 'restart')!.n);
  await page.evaluate(n => { const r = window.__rally!; for (let i = 0; i < 4000 && r.observe().stoppedAtLine !== n; i++) { const o = r.observe(); if (o.driver.waitingForGo && o.stoppedAtLine !== n) r.act({ type: 'call.go' }); r.advance(1); } }, rs);
  expect(await page.evaluate(() => window.__rally!.observe().stoppedAtLine)).toBe(rs);
  const left = await page.evaluate(() => { const s = window.__rally!.sim; return s.launchInfo()!.launchTime - s.tod; });
  expect(left).toBeGreaterThan(130);
  await advance(page, left - 100);
  await expect(page.locator('#holdcard')).toContainText(/^Restart, line \d+/); await expect(page.locator('#holdlead')).toContainText(/Say go at \d\d:\d\d:\d\d: the out-time minus the \d+ s standing-start loss/);
  await expect(page.locator('#readclock')).toHaveCount(0);                                  // 100 s out: not yet
  await advance(page, 45);                                                                 // 55 s out
  await expect(page.locator('#readclock')).toContainText('Read the clock now (K)');
  await page.keyboard.press('k'); await expect(page.locator('#alert')).toContainText('Clock read noted');
});

test('PLAY-017 D01 (a drill start): no "Warn the driver" line and no "Restart, line 1" block on the card, and Fast-forward is in the first screenful of the pre-read box', async ({ page }) => {
  await open(page, 'drill/D01/0/1'); await hold(page);
  const skip = (await box(page, '#skip'))!, pre = (await box(page, '#preread .box'))!;
  expect(await onTop(page, '#skip')).toBe(true); expect(skip.y + skip.h).toBeLessThanOrEqual(pre.y + pre.h); expect(skip.y - pre.y).toBeLessThan(160);
  const obj = (await box(page, '#preread .objective'))!; expect(skip.y).toBeLessThan(obj.y);   // above the objective
  await page.locator('#skip').click(); await advance(page, 3);
  const card = page.locator('#perfcard'); await expect(card).not.toContainText(/Warn the driver/); await expect(card).not.toContainText(/Restart, line 1/);
  await expect(card.locator('#launchcard')).toContainText(/launches itself/);
});

test('PLAY-018 no early / late number in the warm-up transit: the ledger says nothing is timed, and the echoed count is one line in the driver log', async ({ page }) => {
  await open(page, 'builtin/stage/1'); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  await advance(page, 40);
  await expect(page.locator('#ledgerbox #untimed-note')).toContainText('Nothing is timed here'); await expect(page.locator('#ledgerbox')).not.toContainText(/Pace aid:/);
  await open(page, 'drill/D16/0/1'); await hold(page);
  await page.locator('#warn-driver').click();
  const L = await page.evaluate(() => { const s = window.__rally!.sim; return s.launchInfo()!.launchTime - s.tod; });
  await advance(page, L - 10); for (let i = 0; i < 8; i++) await advance(page, 1);
  await expect(page.locator('#driverlog .dl-count')).toHaveCount(1);
});

test('PLAY-019 T focuses the first field of the Time Allowance form; the red Done button asks first while a measured delay has no request filed', async ({ page }) => {
  await resumeD08bUnfiled(page);
  await expect(page.locator('#ta-panel')).toBeVisible();
  await page.keyboard.press('t');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('ta-car');
  await page.locator('#ta-car').press('Escape');
  const dialogs: string[] = []; page.once('dialog', d => { dialogs.push(d.message()); void d.dismiss(); });
  await page.locator('#ta-done-pin').click();
  expect(dialogs.length).toBe(1); expect(dialogs[0]).toMatch(/measured delay .* no Time Allowance request filed/);
  await expect(page.locator('#ta-acked')).toHaveCount(0);                                   // cancelled: the day is still open
  page.once('dialog', d => { void d.accept(); });
  await page.locator('#ta-done-pin').click(); await expect(page.locator('#ta-acked')).toBeVisible();
});

test('PLAY-020 the legal rung: the clock caption does not do base + ASP, and the driver asks "what is our time?" at the restart', async ({ page }) => {
  await open(page, 'drill/D16/2/1'); await hold(page);
  await expect(page.locator('.instruments .caption').first()).toContainText(/^official start = printed base \d\d:\d\d:\d\d \+ your ASP/);
  expect(await page.locator('#preread').innerText()).not.toMatch(/launches? (itself )?at \d\d:\d\d:\d\d/);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
  const rs = await page.evaluate(() => window.__rally!.observe().book.find(i => i.section === 'restart')!.n);
  await page.evaluate(n => { const r = window.__rally!; for (let i = 0; i < 4000 && r.observe().stoppedAtLine !== n; i++) { const o = r.observe(); if (o.driver.waitingForGo && o.stoppedAtLine !== n) r.act({ type: 'call.go' }); r.advance(1); } }, rs);
  await expect(page.locator('#driverlog')).toContainText('Restart line. What is our time?'); await expect(page.locator('#driverlog')).not.toContainText(/Our time is/);
});

test('PLAY-021 the printable stage book has the section arrows down B and C, the stage name in the footer and the hand marks written in the cockpit', async ({ page }) => {
  await open(page, 'builtin/stage/1'); await hold(page);
  const n = await page.evaluate(() => window.__rally!.observe().book.find(i => i.pause && (!i.turn || i.turn === 'S'))!.n);
  const row = page.locator(`#book .row[data-n="${n}"]`);
  await row.locator('select.mark-sel').selectOption('pause'); await row.locator('input.mark-input').fill('10.2'); await row.locator('input.mark-input').press('Enter');
  await expect(row.locator('.hand.pnote')).toHaveText('P10.2');
  const tool = (await box(page, `#book .row[data-n="${n}"] .ann`))!; expect(tool.h).toBeLessThanOrEqual(26);          // the light tool strip
  expect(await page.locator('#book-print').getAttribute('href')).toContain('builtin/stage/1');
  const [book] = await Promise.all([page.waitForEvent('popup'), page.locator('#book-print').click()]);   // the link saves the run first, so the new tab can read the marks
  await expect(book.locator('.book-sheet').first()).toBeVisible();
  expect(await book.locator('.book-sheet .vseg').count()).toBeGreaterThan(4);                                        // arrows down Columns B and C
  await expect(book.locator('.book-sheet').first().locator('.gb .vseg.tail')).toHaveCount(1);
  await expect(book.locator('.book-sheet').nth(1).locator('.sheet-foot')).toContainText('Day stage 1'); await expect(book.locator('.sheet-foot').first()).not.toContainText('fullStage');
  await expect(book.locator(`.grow[data-n="${n}"] .hand.pnote`)).toHaveText('P10.2'); await expect(book.locator(`.grow[data-n="${n}"] .struck-text`)).toHaveText('0m15s');
});

test('PLAY-021 at 1366x768 five or more race-style book rows fit the book column with the light tool strip (D16 Silver)', async ({ page }) => {
  await open(page, 'drill/D16/1/1'); await hold(page);
  const vis = await page.evaluate(() => { const bk = document.querySelector('#book')!.getBoundingClientRect(); return [...document.querySelectorAll('#book .row')].filter(r => { const x = r.getBoundingClientRect(); return x.top >= bk.top - 1 && x.bottom <= bk.bottom + 1; }).length; });
  expect(vis).toBeGreaterThanOrEqual(5);
});

test('PLAY-022 an empty mark entry says what to type, beside the row; the School index and the campaign read right', async ({ page }) => {
  await open(page, 'drill/D03/0/1'); await hold(page);
  const row = page.locator('#book .row[data-n="2"]'); await row.locator('select.mark-sel').selectOption('pause');
  const inp = row.locator('input.mark-input'); await expect(inp).toBeVisible(); await inp.fill(''); await inp.press('Enter');
  await expect(page.locator('#alert')).toContainText(/Nothing written on line 2: type chart pause time in seconds/); await expect(page.locator('#alert')).not.toContainText('identify');
  await page.goto('/#/school'); await expect(page.locator('.page .muted').first()).toContainText(/readings, \d+ to \d+ minutes each/); await expect(page.locator('.page .muted').first()).not.toContainText('three to six');
  await page.evaluate(() => localStorage.setItem('rally-trainer.progress.v1', JSON.stringify({ version: 1, drills: { D12: { stars: 1, aces: 0, bestScore: null, runs: 1, lastScore: null, lastPlayed: 1, tierStars: [0, 1, 0] } }, lessons: {}, runs: [], maneuvers: {} })));
  await page.goto('/#/campaign'); await expect(page.locator('#camp-tier option')).toHaveText(['Bronze', 'Silver', 'Gold']);
  await expect(page.locator('#camp-standings tbody tr').last()).toContainText('You'); await expect(page.locator('#camp-standings tbody tr').first()).not.toContainText('You');
});
