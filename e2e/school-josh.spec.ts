// Josh's scope addition (SCH-021..027), the DOM parts: Start before timers, the Module 0 photo strip, the Module 1 sign cases, Correct
// instead of Right, the driver. Unit parts: tests/sch-josh.test.ts.
import { test, expect, type Page } from '@playwright/test';
import { PHONES, state, type W as DW } from './mobile-helpers.js';

type School = { mini(): { kind: string | null; attempt: number; complete: boolean; elapsed: number; started: boolean; round: number; rounds: number; options: string[] }; oracle(): { optionId?: string } | null };
type W = { __rally: { school: School } };
const mini = (page: Page) => page.evaluate(() => (window as unknown as W).__rally.school.mini());

test.describe('Josh phone 390x844', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });

  for (const [route, kind] of [['m2/6', 'pause'], ['m2/4', 'speedChange'], ['m5/7', 'timedStart'], ['m6/3', 'restart']] as const) {
    test(`SCH-022 a ${kind} mini-sim (#/school/${route}) shows its instructions with Start; the clock, watch and bar stay frozen until Start`, async ({ page }) => {
      await page.goto(`/?mode=mobile#/school/${route}`);
      await expect(page.locator('.s2-minisim .mprompt')).toBeVisible();
      const start = page.locator('.s2-miniacts [data-action=start-card]');
      await expect(start).toBeVisible(); await expect(start).toContainText('Start');
      expect((await mini(page)).kind).toBe(kind);
      const snap = async () => page.evaluate(() => ({ digits: document.querySelector('.s2-miniacts [data-testid=watch-digits]')?.textContent ?? '', tod: document.querySelector('.s2-miniacts [data-testid=tod-digits]')?.textContent ?? '', bar: (document.querySelector('.s2-minisim .msign-fill') as HTMLElement | null)?.style.width ?? '' }));
      const a = await snap(); await page.waitForTimeout(1300); const b = await snap();
      expect(b).toEqual(a); const m = await mini(page); expect(m.started).toBe(false); expect(m.elapsed).toBe(0);
      await start.click();
      await expect(start).toHaveCount(0);
      await page.waitForTimeout(1300);
      const c = await snap(); expect((await mini(page)).elapsed).toBeGreaterThan(1);
      expect(c.tod !== a.tod || c.digits !== a.digits || c.bar !== a.bar).toBe(true);
    });
  }

  test('SCH-022 a run card with a timer (Module 4 try-it, pause) waits under Start; its elapsed time stays 0 until Start', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m4/try');
    await expect(page.locator('[data-screen=run] .mob-actions [data-action=start-card]')).toBeVisible();
    await page.waitForTimeout(1200);
    let st = await state(page); expect(st.kind).toBe('pause'); expect(st.elapsed).toBe(0); expect((st as unknown as { started: boolean }).started).toBe(false);
    await page.locator('.mob-actions [data-action=start-card]').click();
    await page.waitForTimeout(800);
    st = await state(page); expect(st.elapsed).toBeGreaterThan(0.5);
    expect(await page.evaluate(() => (window as unknown as DW).__rally.decision.elapsed())).toBeGreaterThan(0.5);
  });

  test('SCH-024 Module 0 opens the Great Race with a credited photo strip of rally school stills', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m0/5');
    await expect(page.locator('.s2-photos img')).toHaveCount(3);
    await expect(page.locator('[data-testid=photo-credit]')).toHaveText(/Stills from Great Race rally school videos/);
    expect(await page.locator('.s2-photos img').first().evaluate(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0 ? true : new Promise(r => { (i as HTMLImageElement).onload = () => r(true); (i as HTMLImageElement).onerror = () => r(false); }))).toBe(true);
    await page.goto('/?mode=mobile#/school/m0/6');
    await expect(page.locator('[data-testid=page]')).toContainText('Course Instructions');
    await expect(page.locator('[data-testid=page]')).toContainText('co-driver');
  });

  test('SCH-025 SCH-021 Module 1 plays its sign cases one after another; each correct answer says Correct and names the trap', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m1/6');
    const m = await mini(page); expect(m.rounds).toBe(3);
    for (let r = 0; r < 3; r++) {
      expect((await mini(page)).round).toBe(r);
      const o = await page.evaluate(() => (window as unknown as W).__rally.school.oracle());
      await page.locator(`.s2-miniacts [data-option="${o!.optionId}"]`).click();
      await expect(page.locator('[data-testid=mini-verdict] .mv-head span')).toHaveText('Correct');
      if (r > 0) await expect(page.locator('[data-testid=why]')).toHaveText(/^Trap: /);
      if (r < 2) await page.locator('[data-action=next-case]').click();
    }
    expect((await mini(page)).complete).toBe(true);
  });

  test('SCH-027 Home offers the Driver\'s card and the driver\'s voice; nothing says Dad', async ({ page }) => {
    await page.goto('/?mode=mobile#/m');
    await expect(page.locator('[data-testid=drivers-card]')).toHaveText("Driver's card");
    expect(await page.locator('body').innerText()).not.toMatch(/\bDad\b/i);
    await page.locator('[data-testid=drivers-card]').click();
    await expect(page).toHaveURL(/#\/school\/driver-card$/);
    expect(await page.locator('body').innerText()).not.toMatch(/\bDad\b/i);
  });
});
