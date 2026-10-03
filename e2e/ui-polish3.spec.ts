// Polish sprint 3: N5 perf card fits at small viewports, N11 pace aid during a restart hold.
import { test, expect, type Page } from '@playwright/test';

async function openDrill(page: Page, id: string, tier = 0, seed = 1): Promise<void> {
  await page.goto(`/#/cockpit/drill/${id}/${tier}/${seed}`);
  await expect(page.locator('#cockpit')).toBeVisible();
}
async function depart(page: Page): Promise<void> {
  await page.evaluate(() => { const r = window.__rally!; r.act({ type: 'skipPreread', secondsBefore: 3 } as never); r.act({ type: 'start' }); });
}

for (const [w, h] of [[1280, 720], [1366, 768], [1024, 700]] as const) {
  test(`UI-028 N5 the perf card hint "Book is on line N: press N" is fully visible and not clipped at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openDrill(page, 'D03');
    await depart(page);
    await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 600 && r.observe().stoppedAtLine === null; i++) r.advance(1); });
    const o = await page.evaluate(() => { const x = window.__rally!.observe(); return { stopped: x.stoppedAtLine, cur: x.currentLine }; });
    expect(o.stopped).not.toBeNull();
    expect(o.cur).not.toBe(o.stopped);                       // Bronze: the book pointer waits for N
    const hint = page.locator('#perfcard .hintline');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText(/press N/);
    await page.screenshot({ path: `docs/playtest/screenshots/polish3-perfcard-${w}x${h}.png` });
    const m = await page.evaluate(() => {
      const hint = document.querySelector('#perfcard .hintline')!.getBoundingClientRect();
      const card = document.getElementById('perfcard')!; const cs = getComputedStyle(card); const r = card.getBoundingClientRect();
      return { top: hint.top, bottom: hint.bottom, left: hint.left, right: hint.right, vw: window.innerWidth, vh: window.innerHeight, overflow: cs.overflowY, cardBottom: r.bottom, scrollH: card.scrollHeight, clientH: card.clientHeight };
    });
    expect(m.top).toBeGreaterThanOrEqual(0); expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.bottom).toBeLessThanOrEqual(m.vh); expect(m.right).toBeLessThanOrEqual(m.vw);
    expect(['hidden', 'auto', 'scroll']).not.toContain(m.overflow);
    expect(m.scrollH).toBeLessThanOrEqual(m.clientH);        // nothing hidden inside the card box
    expect(m.bottom).toBeLessThanOrEqual(m.cardBottom + 0.5);// the hint sits inside the box
  });
}

test('UI-028 N11 the ledger pace aid reads "holding for restart" (no number) while the car waits at a restart line', async ({ page }) => {
  await openDrill(page, 'D16');
  await depart(page);
  const found = await page.evaluate(() => { const r = window.__rally!; for (let i = 0; i < 1200 && r.sim.waitReason !== 'hold'; i++) r.advance(1); return { reason: r.sim.waitReason, aid: r.observe().aids.earlyLate ?? null }; });
  expect(found.reason).toBe('hold');
  expect(found.aid).not.toBeNull();                          // the engine still has a number; the UI must not show it
  const ledger = page.locator('#ledgerbox');
  await expect(ledger).toContainText('Pace aid: holding for restart');
  await expect(ledger).not.toContainText(/Pace aid: [+-]?\d/);
  const m = await page.evaluate(() => { const b = document.getElementById('ledgerbox')!; return { scrollH: b.scrollHeight, clientH: b.clientHeight }; });
  expect(m.scrollH).toBeLessThanOrEqual(m.clientH);          // the Pace aid row is not clipped by the box
});
