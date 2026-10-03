// UI-006 Playwright smoke: app loads, Home shows the curriculum, a playable card opens the cockpit,
// D departs, Space starts the stopwatch, window.__rally.advance drives sim time (never wall-clock waits), the debrief appears.
import { test, expect, type Page } from '@playwright/test';

const SHOTS = 'docs/playtest/screenshots';

/** Drive the rest of the leg through sim time only: call the book's turns and speeds as their landmarks appear, go at every stop. */
async function advanceUntilFinished(page: Page): Promise<void> {
  for (let i = 0; i < 80; i++) {
    const phase = await page.evaluate(() => {
      const r = window.__rally; if (!r) return 'gone';
      const w = window as unknown as { __called?: Set<number> }; w.__called ??= new Set<number>();
      const book = r.observe().book;
      for (let k = 0; k < 300 && r.sim.phase !== 'finished'; k++) {
        const o = r.observe();
        for (const f of o.ahead) {
          if (!f.nodeId) continue;
          const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
          if (ins.turn && !w.__called!.has(ins.n)) { r.act({ type: 'call.turn', dir: ins.turn }); w.__called!.add(ins.n); }
          if (ins.speed !== undefined && f.approxDistanceFt <= 100 && !w.__called!.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); w.__called!.add(ins.n + 10000); }
        }
        if (o.driver.waitingForGo) r.act({ type: 'call.go' });
        r.advance(1);
      }
      return r.sim.phase;
    });
    if (phase === 'finished' || phase === 'gone') break;
  }
}

test('UI-006 smoke: home -> cockpit -> stopwatch -> debrief', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?test=1#/');
  await expect(page.locator('h1')).toHaveText(/Rally Trainer/);
  const cards = page.locator('.card.playable');
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(page.locator('.card[data-drill="D03"]')).toBeVisible();     // curriculum present
  await page.screenshot({ path: `${SHOTS}/home.png`, fullPage: false });

  // open D03 (pause arithmetic) via its Play button
  await page.locator('.card[data-drill="D03"] button.primary').click();
  await expect(page.locator('#cockpit')).toBeVisible();
  await expect(page.locator('#preread')).toBeVisible();
  await page.locator('#view').focus();
  await page.keyboard.press('d');                                           // depart
  await expect(page.locator('#preread')).toBeHidden();
  await page.keyboard.press(' ');                                           // stopwatch start
  const running = await page.evaluate(() => window.__rally!.observe().stopwatch.running);
  expect(running).toBe(true);
  await page.evaluate(() => window.__rally!.advance(12));
  const reading = await page.evaluate(() => window.__rally!.observe().stopwatch.reading);
  expect(reading).toBeGreaterThan(11);
  // call the first speed and a lap, keep the car moving
  await page.keyboard.type('35'); await page.keyboard.press('Enter');
  await page.keyboard.press('l');
  const laps = await page.evaluate(() => window.__rally!.observe().stopwatch.laps.length);
  expect(laps).toBe(1);
  await page.evaluate(() => window.__rally!.advance(40));
  await page.screenshot({ path: `${SHOTS}/cockpit.png` });

  // drive to the end through sim time only; the driver releases stops himself after his patience runs out
  await advanceUntilFinished(page);
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#cp-table tbody tr').first()).toBeVisible();
  await expect(page.locator('#tip')).toContainText(/./);
  await expect(page.locator('#counterfactuals .cf-row').first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/debrief.png`, fullPage: true });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('UI-006 built-in scenario card is playable and the keyboard works', async ({ page }) => {
  await page.goto('/#/');
  await page.locator('.card[data-scenario="onestop-1"] button.primary').click();
  await expect(page.locator('#cockpit')).toBeVisible();
  await page.locator('#skip').click();                                     // fast-forward to the start time
  await page.keyboard.press('d');
  await page.keyboard.press(' ');
  await page.keyboard.press(']');                                           // bezel +1 s
  const bezel = await page.evaluate(() => window.__rally!.observe().stopwatch.bezel);
  expect(bezel).toBeCloseTo(1, 5);
  await page.keyboard.press('e'); await page.keyboard.type('3'); await page.keyboard.press('Enter');
  const ledger = await page.evaluate(() => window.__rally!.observe().ledger);
  expect(ledger).toBe(3);
  // wait for the STOP, then go on the count
  await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 120 && !r.observe().driver.waitingForGo; i++) r.advance(1); });
  expect(await page.evaluate(() => window.__rally!.observe().driver.waitingForGo)).toBe(true);
  await page.evaluate(() => window.__rally!.advance(7.4));
  await page.keyboard.press('g');
  await advanceUntilFinished(page);
  await expect(page.locator('#debrief')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#worked li').first()).toContainText(/Stop, line 2/);
});
