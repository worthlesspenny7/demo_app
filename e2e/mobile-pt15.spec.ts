// Final sprint PT-15 (docs/playtest/PT-15-phone-replay-2.md): the run is kept for Continue from the moment it starts (MOB-075, N13) and a
// compressed hold jumps only after the START tap, so a START 2.5 s late reads "START 2.5 s late" and the CALL stays reachable (MOB-073).
import { test, expect } from '@playwright/test';
import { PHONES, state, collectErrors, type W } from './mobile-helpers.js';
import { Scheduler, DecisionRun, emptyProgress, type DecisionResponse } from '../src/core/decision/index.js';

test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

test('MOB-075 a run is saved as the unfinished run before the first answer, and Home offers Continue (0 of N done)', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?mode=mobile#/m');
  await page.evaluate(() => localStorage.removeItem('rally-trainer.decision.v1'));
  await page.goto('/?mode=mobile#/m/play/practice');
  await expect.poll(async () => (await state(page)).screen).toBe('run');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rally-trainer.decision.v1') ?? 'null'));
  expect(saved?.unfinished?.responses).toEqual([]); expect(saved.unfinished.plan.decisionCount).toBeGreaterThan(5);
  await page.goto('/?mode=mobile#/m');
  await expect(page.locator('[data-testid=continue]')).toHaveText(new RegExp(`Continue run \\(0 of ${saved.unfinished.plan.decisionCount} done\\)`));
  expect(errors).toEqual([]);
});

test('MOB-073 on a compressed Boss hold the watch jumps only after the START tap; a START 2.5 s late reads "START 2.5 s late" and the CALL is still reachable', async ({ page }) => {
  test.setTimeout(180_000);
  let found: { plan: ReturnType<Scheduler['plan']>; responses: (DecisionResponse | null)[] } | null = null;
  for (let s = 1; s <= 200 && !found; s++) {
    const plan = Scheduler.boss(s * 1237, null, 2).plan(); const run = new DecisionRun(plan); const responses: (DecisionResponse | null)[] = [];
    for (let i = 0; i < 40; i++) {
      const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
      if (st.decision.timing?.skip && st.decision.kind === 'timedStart') { found = { plan, responses }; break; }
      const o = run.oracle(); responses.push(o); run.answer(o);
    }
  }
  expect(found).not.toBeNull();
  const p = emptyProgress(); p.unfinished = { plan: found!.plan, responses: found!.responses };
  await page.goto('/?mode=mobile#/m');
  await page.evaluate(s => localStorage.setItem('rally-trainer.decision.v1', s), JSON.stringify(p));
  await page.goto('/?mode=mobile#/m/continue');
  await expect.poll(async () => (await state(page)).kind, { timeout: 20_000 }).toBe('timedStart');
  const t = (await state(page)).timing as { truthSeconds: number; secondTapSeconds: number; skip: { at: number; to: number } };
  const o = await page.evaluate(() => (window as unknown as W).__rally.decision.oracle());
  const tapCard = async (sel: string, sec: number): Promise<void> => {
    const box = (await page.locator(sel).boundingBox())!;
    await page.waitForFunction(x => (window as unknown as W).__rally.decision.elapsed() >= x - 0.04, sec, { polling: 'raf', timeout: 60_000 });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  await tapCard('.mob-actions [data-action=startstop]', t.truthSeconds + 2.5);
  // no jump before the START: the card clock was wall time up to the tap; the jump follows it
  await expect(page.locator('[data-testid=skip-note]')).toBeVisible({ timeout: 10_000 });
  const card = await page.evaluate(() => (window as unknown as W).__rally.decision.elapsed()); expect(card).toBeGreaterThanOrEqual(t.skip.to);
  // the CALL is reachable: the card is still open and the lap button answers at the CALL second
  await tapCard('.mob-actions [data-action=lap]', o!.taps![1]!);
  await expect(page.locator('[data-testid=verdict]')).toHaveAttribute('data-correct', 'false');
  await expect(page.locator('.mv-head span').first()).toHaveText(/^Not quite: START 2\.[3-7] s late$/);
});
