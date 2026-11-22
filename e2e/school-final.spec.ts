// PT-18 final sprint (SCH-038, SCH-042), the DOM parts: a fair, retryable checkpoint widget; a wrong check answer explains; figures fit at
// 360x780. Unit parts: tests/sch-final.test.ts.
import { test, expect } from '@playwright/test';

test.describe('SCH-038 checkpoint widget', () => {
  test('SCH-038 tapping as the car reaches the drawn sign scores 0, and Try again restarts it (a fresh Start)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/?mode=mobile#/school/m0/4');
    await page.locator('[data-action=start-widget]').click();
    await page.waitForFunction(() => {
      const road = document.querySelector('[data-widget=whereCheckpoint] .s2-car:not(.s2-ghost)')?.getBoundingClientRect(); const sign = document.querySelector('[data-testid=checkpoint]')?.getBoundingClientRect();
      return !!road && !!sign && road.right >= sign.left - 0.5;
    }, null, { timeout: 40_000, polling: 'raf' });
    await page.locator('[data-action=leg-ended]').click();
    await expect(page.locator('[data-testid=cp-result]')).toHaveAttribute('data-points', '0');
    const retry = page.locator('[data-action=leg-retry]');
    await expect(retry).toHaveText('Try again'); await expect(retry).toBeEnabled();
    await expect(page.locator('[data-widget=whereCheckpoint]').getByText('Done', { exact: true })).toHaveCount(0);
    await retry.click();
    await expect(page.locator('[data-action=start-widget]')).toBeVisible();   // nothing is timed before Start
    await expect(page.locator('[data-testid=cp-result]')).toHaveText('');
    await expect(page.locator('[data-testid=leg-clock]')).toHaveText('0.0 s');
    await page.locator('[data-action=start-widget]').click();
    await page.waitForTimeout(1200);
    await page.locator('[data-action=leg-ended]').click();
    await expect(page.locator('[data-testid=cp-result]')).toHaveText(/You tapped at 1\.\d s/);
    await expect(page.locator('[data-action=leg-retry]')).toBeVisible();
  });
});

test.describe('SCH-042 reasons and figures', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });
  test('SCH-042 a wrong check answer shows one line of reason under the right option', async ({ page }) => {
    await page.goto('/?mode=mobile#/school/m0/8');
    await page.locator('[data-option][data-right=false]').first().click();
    const why = page.locator('[data-testid=check-why]');
    await expect(why).toBeVisible();
    await expect(page.locator('[data-testid=check-result]')).toHaveText('Not quite.');
    expect(await why.evaluate(e => (e.previousElementSibling as HTMLElement).dataset['right'])).toBe('true');   // directly under the right option
    expect(((await why.textContent()) ?? '').length).toBeGreaterThan(10);
    expect((await why.boundingBox())!.height).toBeLessThan(60);   // one short line (two at most on a narrow phone)
  });
  for (const [route, label] of [['m0/6', 'two seats'], ['m4/1', 'stop sign']] as const) {
    test(`SCH-042 the ${label} figure's text sits inside the figure at 360 px and nothing overlaps`, async ({ page }) => {
      await page.goto(`/?mode=mobile#/school/${route}`);
      const svg = page.locator('.s2-fig svg').first(); await expect(svg).toBeVisible();
      // text boxes in the figure's own units (viewBox 300 x 120), so the check does not depend on the phone's scale or font fallback
      const r = await svg.evaluate(s => {
        const vb = (s as SVGSVGElement).viewBox.baseVal; const texts = [...s.querySelectorAll('text')].map(t => { const b = (t as SVGTextElement).getBBox(); const fs = Number(t.getAttribute('font-size')); const y = Number(t.getAttribute('y'));   // width from the rendered text, height from the font size (getBBox's height is the font's line box)
          return { t: t.textContent, l: b.x, r: b.x + b.width, top: y - fs * 0.85, bot: y + fs * 0.2 }; });
        const overlaps: string[] = [];
        texts.forEach((a, i) => texts.slice(i + 1).forEach(b => { if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.top < b.bot - 0.5 && b.top < a.bot - 0.5) overlaps.push(`${a.t} / ${b.t}`); }));
        return { texts, outside: texts.filter(t => t.l < 0 || t.r > vb.width || t.top < 0 || t.bot > vb.height).map(t => t.t), overlaps, vw: window.innerWidth, right: s.getBoundingClientRect().right };
      });
      expect(r.outside, JSON.stringify(r)).toEqual([]); expect(r.overlaps, JSON.stringify(r.texts)).toEqual([]); expect(r.right).toBeLessThanOrEqual(r.vw);
    });
  }
});
