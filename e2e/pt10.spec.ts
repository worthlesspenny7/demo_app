// Fix sprint PT-10 (2026-10-04): the playability items of docs/playtest/PT-10-playability-v3-2.md as the player meets them, at 1366x768.
import { test, expect, type Page } from '@playwright/test';
import { PROGRESS_KEY } from '../src/ui/viewmodels/progress.js';
import { LESSONS } from '../content/lessons.js';

test.use({ viewport: { width: 1366, height: 768 } });

async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function hold(page: Page): Promise<void> { await page.locator('#pause').click(); }
const p1 = (stars: number, tiers: number[]) => ({ stars, tierStars: tiers, aces: 0, runs: 1, bestScore: 0.2, lastScore: 0.2, bestRaw: 0, lastPlayed: Date.now() });
async function setProgress(page: Page, drills: Record<string, unknown>, lessons: Record<string, boolean>): Promise<void> {
  await page.goto('/#/settings');
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [PROGRESS_KEY, JSON.stringify({ version: 1, drills, lessons, runs: [], maneuvers: {} })]);
}
const ALL_LESSONS = Object.fromEntries(['four-s', 'transits', 'which-timer', 'ghost-car', 'griid-cameo', 'protocol', 'lost', 'pause-arithmetic', 'timed-leads', 'measure-car', 'recovery', 'calibration', 'markup'].map(l => [l, true]));

test('PLAY-033 D06 Silver and Gold hide the car\'s charts everywhere: the overlay, the card\'s simple chart, "card N s" on the STOP rows and the card\'s stop numbers; Bronze keeps them', async ({ page }) => {
  for (const tier of [1, 2]) {
    await openDrill(page, 'D06', tier); await hold(page);
    await page.keyboard.press('c');
    await expect(page.locator('#charts-hidden')).toContainText("Your car's chart is what you measure today");
    await expect(page.locator('#charts-overlay .charttable')).toHaveCount(0); await expect(page.locator('#charts-panel h3')).toHaveText("Your car's charts");
    await page.keyboard.press('Escape');
    await expect(page.locator('#simplechart-hidden')).toContainText("Your car's chart is what you measure today"); await expect(page.locator('#simplechart-table')).toHaveCount(0);
    await expect(page.locator('.row .ann', { hasText: /card \d/ })).toHaveCount(0);
    const stopLine = await page.evaluate(() => window.__rally!.observe().book.find(i => i.pause)!.n);
    await page.evaluate(n => { window.__rally!.act({ type: 'line.set', n } as never); }, stopLine);
    await expect(page.locator('#hidden-car-card')).toContainText(/No car numbers on this line/); await expect(page.locator('#perfcard')).toContainText(/Silver and Gold hide the car's numbers/); expect((await page.locator('#perfcard').innerText()).split("Your car's chart is what you measure today").length - 1).toBe(1);   // PT-11 N-D8: the sentence once await expect(page.locator('#perfcard')).not.toContainText(/dwell \d|loss \d|Chart \(b\)/);
  }
  await openDrill(page, 'D06', 0); await hold(page);
  await page.keyboard.press('c'); await expect(page.locator('#charts-overlay .charttable')).toHaveCount(3); await expect(page.locator('#charts-hidden')).toHaveCount(0); await page.keyboard.press('Escape');
  await expect(page.locator('#simplechart-table')).toBeVisible(); await expect(page.locator('.row .ann', { hasText: /card \d/ }).first()).toBeVisible();
});

test('PLAY-034 the D06 pre-read has one launch statement: Bronze copies (no "measuring run"), Silver and Gold measure and launch ON the second; the MARK lines read net = out minus in', async ({ page }) => {
  await openDrill(page, 'D06', 0);
  const bronze = await page.locator('#preread').innerText();
  expect(bronze).toMatch(/Copy mode: leave ON your second \(no launch lead\)/); expect(bronze).toMatch(/launch ON your second/); expect(bronze).not.toMatch(/standing-start loss early/); expect(bronze).not.toMatch(/measuring run|Measure the car/i);
  await openDrill(page, 'D06', 1);
  const silver = await page.locator('#preread').innerText();
  expect(silver).toMatch(/A measuring run: leave ON your second \(no launch lead\)/); expect(silver).toMatch(/launch ON your second/); expect(silver).not.toMatch(/standing-start loss early/); expect(silver.match(/launch/gi)!.length).toBeGreaterThan(0);
  const marks = await page.evaluate(() => window.__rally!.observe().book.filter(i => /^MARK A\d out/.test(i.text ?? '')).map(i => i.text));
  for (const m of marks) expect(m).toMatch(/Net = the pace-aid reading at MARK A\d out minus the reading at MARK A\d in \(example: \+9\.5 at out and \+3\.0 at in: net 6\.5\)/);
});

test('PLAY-036 a lesson check shuffles its options each time it is drawn, and clicking the right option passes the lesson', async ({ page }) => {
  const right = LESSONS.find(l => l.id === 'ghost-car')!; const rightText = right.check.options[right.check.answer]!;
  const seen = new Set<number>();
  for (let i = 0; i < 14; i++) { await page.goto('/#/school/ghost-car'); await page.reload(); const opts = await page.locator('.quiz .opt').allInnerTexts(); expect([...opts].sort()).toEqual([...right.check.options].sort()); seen.add(opts.indexOf(rightText)); }
  expect(seen.size).toBeGreaterThanOrEqual(3);
  await page.locator('.quiz .opt', { hasText: rightText }).click(); await expect(page.locator('.quiz .opt.right')).toHaveText(rightText); await expect(page.locator('.quiz .ok')).toContainText('Right.');
  await page.goto('/#/'); await expect(page.locator('#starthere-panel li[data-step="ghost-car"]')).toHaveClass(/done/);
});

test('PLAY-037 the simple chart has a turning-stop column on a model car (D08 Bronze drives the Ford) and none on the Packard (D03 Bronze)', async ({ page }) => {
  await openDrill(page, 'D08', 0); await hold(page);
  await expect(page.locator('#simplechart-table thead th')).toHaveText(['Speed', 'Dec', 'Acc', 'S/G', 'TS/G', 'T@15', 'T@20', 'Lead']);   // PT-11 N-D1: the Lead column
  await expect(page.locator('#simplechart-table')).toHaveAttribute('id', 'simplechart-table'); await expect(page.locator('#simplechart')).toHaveAttribute('title', /TS\/G: a stop and go that turns 90 degrees/);
  await openDrill(page, 'D03', 0); await hold(page);
  await expect(page.locator('#simplechart-table thead th')).toHaveText(['Speed', 'Dec', 'Acc', 'S/G', 'T@15', 'Lead']);   // PT-11 N-D1: the Lead column (the Packard too)
});

test('PLAY-038 a finished path\'s Next replays D18 at Silver, then D07 at Silver, then opens D11', async ({ page }) => {
  const done = (id: string) => [id, p1(3, id === 'D09' ? [3] : [3, 3, 0])] as const;
  const mk = (extra: Record<string, unknown>) => ({ ...Object.fromEntries(['D16', 'D09', 'D10', 'D01', 'D03', 'D04', 'D05', 'D06', 'D08', 'D07'].map(done)), ...extra });
  await setProgress(page, mk({ D18: p1(1, [1, 0, 0]), D07: p1(2, [2, 0, 0]) }), ALL_LESSONS); await page.goto('/#/');
  await expect(page.locator('#starthere')).toHaveText(/Next: Replay D18 at Silver \(D11 needs D18 ★ at Silver or Gold\)/);
  await page.locator('#starthere').click(); await expect(page).toHaveURL(/#\/cockpit\/drill\/D18\/1\/1$/);
  await setProgress(page, mk({ D18: p1(1, [1, 1, 0]), D07: p1(2, [2, 0, 0]) }), ALL_LESSONS); await page.goto('/#/');
  await expect(page.locator('#starthere')).toHaveText(/Next: Replay D07 at Silver \(D11 needs D07 ★★ at Silver or Gold\)/);
  await setProgress(page, mk({ D18: p1(1, [1, 1, 0]), D07: p1(2, [2, 2, 0]) }), ALL_LESSONS); await page.goto('/#/');
  await expect(page.locator('#starthere')).toHaveText(/Next: D11 Full leg/); await page.locator('#starthere').click(); await expect(page).toHaveURL(/#\/cockpit\/drill\/D11\/0\/1$/);
  await setProgress(page, mk({ D18: p1(1, [1, 1, 0]), D07: p1(2, [2, 2, 0]), D11: p1(1, [1, 0, 0]) }), ALL_LESSONS); await page.goto('/#/');
  await expect(page.locator('#starthere')).toHaveCount(0); await expect(page.locator('#path-complete')).toContainText('Path complete.');
});

test('PLAY-039 at Silver the perf card prints no dwell and no call times (it names the arithmetic); at Bronze it prints them', async ({ page }) => {
  for (const [tier, withheld] of [[0, false], [1, true]] as const) {
    await openDrill(page, 'D03', tier); await hold(page);
    const line = await page.evaluate(() => window.__rally!.observe().book.find(i => i.pause && i.turn === undefined)?.n ?? window.__rally!.observe().book.find(i => i.pause)!.n);
    await page.evaluate(n => { window.__rally!.act({ type: 'line.set', n } as never); }, line);
    if (withheld) { await expect(page.locator('#withheld-stop')).toContainText(/work the dwell out from the simple chart \(pause - Dec at \d+ - Acc at \d+/); await expect(page.locator('#perfcard')).not.toContainText(/dwell \d+\.\d/); await expect(page.locator('.row .ann', { hasText: /card \d/ })).toHaveCount(0); }
    else { await expect(page.locator('#perfcard')).toContainText(/dwell \d+\.\d s after "Stopped"/); await expect(page.locator('#withheld-stop')).toHaveCount(0); }
  }
  await openDrill(page, 'D04', 1); await hold(page);
  const timedLine = await page.evaluate(() => window.__rally!.observe().book.find(i => i.timed)!.n); await page.evaluate(n => { window.__rally!.act({ type: 'line.set', n } as never); }, timedLine);
  await expect(page.locator('#withheld-timed')).toContainText(/call \d+ at \d+ s minus the lead for \d+ → \d+ \(simple chart, Lead column, row \d+, [↑↓]\)/);   // PT-11 N-D1: never chart (a)
  await openDrill(page, 'D04', 0); await hold(page); await page.evaluate(n => { window.__rally!.act({ type: 'line.set', n } as never); }, timedLine);
  await expect(page.locator('#perfcard')).toContainText(/call \d+ at [\d.]+ s \(lead [\d.]+\)/);
});

test('PLAY-040 a long lesson is two pages (page 1, Next page, then the source, the check and the path button); D16 starts at 8x', async ({ page }) => {
  await page.goto('/#/school/transits'); await expect(page.locator('#lesson-next-page')).toHaveCount(0); await expect(page.locator('.lesson-ref a').first()).toHaveAttribute('href', /^#\/reference\/[a-z-]+$/);   // PT-11 (PLAY-048): one page, its lists on the Reference page
  await page.goto('/#/school/recovery');
  await expect(page.locator('#lesson-pageno')).toHaveText('Page 1 of 2'); await expect(page.locator('#lesson-page-2')).toBeHidden(); await expect(page.locator('.quiz')).toBeHidden();
  await page.locator('#lesson-next-page').click(); await expect(page.locator('#lesson-pageno')).toHaveText('Page 2 of 2'); await expect(page.locator('#lesson-page-1')).toBeHidden(); await expect(page.locator('.quiz')).toBeVisible();
  await page.locator('#lesson-prev-page').click(); await expect(page.locator('#lesson-page-1')).toBeVisible();
  await page.goto('/#/school/four-s'); await expect(page.locator('#lesson-next-page')).toHaveCount(0); await expect(page.locator('.quiz')).toBeVisible();
  await expect(page.locator('.lesson')).not.toContainText('What qualifies');
  await page.goto('/#/school/recovery'); await page.locator('#lesson-next-page').click(); await expect(page.locator('.lesson')).toContainText('What qualifies');
  await openDrill(page, 'D16', 0); await hold(page); await page.locator('#pause').click();
  await expect(page.locator('#scale')).toHaveText(/^8x/); await hold(page);
  await openDrill(page, 'D08', 0); await expect(page.locator('#scale')).toHaveText(/^[124]x/);
});

test('PLAY-041 status line says Dad, the D03 keys say "digital watch: lap L", the lock chip names the lesson, the folded pre-read does not overlap', async ({ page }) => {
  await openDrill(page, 'D16', 0);
  const bar = await page.locator('.drawer .bar').innerText(); expect(bar).toMatch(/Dad \(expert\)/); expect(bar).not.toMatch(/\bPro\b/);
  await page.locator('#preread-toggle').click(); await expect(page.locator('.preread.collapsed')).toBeVisible();
  const title = await page.locator('.preread.collapsed .preread-top h2').boundingBox(); const btn = await page.locator('#preread-toggle').boundingBox(); const hud = await page.locator('.hud').boundingBox(); const box = await page.locator('.preread.collapsed .box').boundingBox();
  expect(title).not.toBeNull(); expect(btn).not.toBeNull();
  expect(btn!.x).toBeGreaterThanOrEqual(title!.x + title!.width - 1);   // side by side: the button starts where the title ends
  expect(Math.abs((btn!.y + btn!.height / 2) - (title!.y + title!.height / 2))).toBeLessThan(14);   // on one line
  expect(box!.y).toBeGreaterThanOrEqual(hud!.y + hud!.height - 1);   // the strip sits below the scale toolbar
  await openDrill(page, 'D03', 0); await expect(page.locator('#hintbar')).toContainText('digital watch: lap L'); await expect(page.locator('#hintbar')).not.toContainText(/bezel/i);
  await setProgress(page, {}, {}); await page.goto('/#/');
  await expect(page.locator('#starthere-panel li[data-step="D10"]')).toContainText('needs pass the lesson "When you are lost"'); await expect(page.locator('#starthere-panel li[data-step="D10"]')).not.toContainText('"lost"');
});

test('PLAY-041 Dad\'s card prints on one page with 0.6 in margins at 13 pt', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => undefined; });
  await page.goto('/#/school/protocol');   // PT-11 (PLAY-048): one page, the card on it
  const margin = await page.evaluate(() => { for (const sh of Array.from(document.styleSheets)) for (const r of Array.from(sh.cssRules)) if (r instanceof CSSPageRule) return r.style.margin; return null; });
  expect(margin).toBe('0.6in');
  await page.locator('#print-card').click(); await expect(page.locator('html')).toHaveClass(/print-card-only/);
  await page.emulateMedia({ media: 'print' });
  const fs = await page.evaluate(() => getComputedStyle(document.querySelector('#print-root .printcard ol')!).fontSize); expect(parseFloat(fs)).toBeCloseTo(13 * 96 / 72, 1);
  const pagesOf = (b: Buffer): number => (b.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
  expect(pagesOf(await page.pdf({ format: 'Letter' }))).toBe(1);   // the @page margin of 0.6 in applies and the 21 lines at 13 pt still fit one Letter page
  await page.locator('#print-card').click();   // printing un-mounts the card (afterprint): mount it again for the A4 page
  expect(pagesOf(await page.pdf({ format: 'A4' }))).toBe(1);
});

test('ENG-026 D10 Bronze: the player\'s call of the left at the prompt is kept for the T, and the Debrief-side driver log has no "too late" or "did not call a turn" at the STOP-Ts', async ({ page }) => {
  await openDrill(page, 'D10', 0); await hold(page);
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 2 } as never); r.act({ type: 'start' } as never); });
  // the player's habit: call each turn the moment the prompt names it, then drive on with the driver's own speed
  const result = await page.evaluate(() => {
    const r = window.__rally!; const log: string[] = []; const called = new Set<number>();
    for (let i = 0; i < 6000 && r.observe().phase !== 'finished'; i++) {
      const o = r.observe(); const nc = o.nextCall;
      if (nc && /^call\.turn (\w+)$/.test(nc.call) && !called.has(nc.line)) { called.add(nc.line); r.act({ type: 'call.turn', dir: nc.call.split(' ')[1] } as never); }
      else if (nc && /^call\.speed (\d+)$/.test(nc.call) && !called.has(nc.line)) { called.add(nc.line); r.act({ type: 'call.speed', mph: Number(nc.call.split(' ')[1]) } as never); }
      if (o.driver.waitingForGo && o.stoppedAtLine) { r.advance(10); r.act({ type: 'call.go' } as never); }
      r.advance(1);
    }
    for (const m of r.sim.driverMsgs) log.push(m.text);
    return { off: r.sim.offCourseCount, log };
  });
  expect(result.log.filter(t => /Too late|you did not call a turn/.test(t))).toEqual([]);
  expect(result.log.some(t => /^Did the left at the T/.test(t))).toBe(true);
});
