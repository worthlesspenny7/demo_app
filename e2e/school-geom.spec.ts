// Phase IX Rally School 2.0 (SCH-006): no page of any module scrolls or clips at 390x844 or 360x780 (phone, touch), and the desk player
// shows the same pages at most two columns wide.
import { test, expect, type Page } from '@playwright/test';
import { PHONES } from './mobile-helpers.js';

type S = { __rally: { school: { course(): { id: string; pages: number; kinds: string[] }[]; state(): { module: string; page: number; of: number; kind: string } } } };

async function overflow(page: Page): Promise<{ page: number; client: number; docScroll: boolean; hscroll: boolean; clipped: string[] }> {
  return page.evaluate(() => {
    const p = document.querySelector<HTMLElement>('[data-testid=page]')!;
    const r = p.getBoundingClientRect(); const clipped: string[] = [];
    p.querySelectorAll<HTMLElement>('*').forEach(n => { if (n.closest('.s2-verdict,[hidden],details:not([open]) > :not(summary)')) return; const b = n.getBoundingClientRect(); if (b.height > 0 && b.width > 0 && getComputedStyle(n).visibility !== 'hidden' && b.bottom > r.bottom + 1) clipped.push(`${n.tagName.toLowerCase()}.${n.className}`.slice(0, 60)); });
    const se = document.scrollingElement!;
    return { page: p.scrollHeight, client: p.clientHeight, docScroll: se.scrollHeight > window.innerHeight + 1, hscroll: se.scrollWidth > window.innerWidth + 1, clipped: clipped.slice(0, 5) };
  });
}

for (const vp of PHONES) {
  test.describe(`school phone ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: true, isMobile: true });
    test(`SCH-006 no page of any module scrolls or clips (${vp.width}x${vp.height})`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.goto('/?mode=mobile#/school/m0/1');
      await expect(page.locator('[data-screen=school]')).toBeVisible();
      const mods = await page.evaluate(() => (window as unknown as S).__rally.school.course());
      expect(mods.length).toBeGreaterThanOrEqual(13);
      const bad: string[] = [];
      for (const m of mods) {
        for (let i = 1; i <= m.pages; i++) {
          await page.goto(`/?mode=mobile#/school/${m.id}/${i}`);
          await expect(page.locator(`[data-testid=page][data-page="${i}"]`)).toBeVisible();
          const o = await overflow(page);
          if (o.page > o.client + 1 || o.docScroll || o.hscroll || o.clipped.length) bad.push(`${m.id} p${i} ${m.kinds[i - 1]}: ${o.page}/${o.client} doc=${o.docScroll} h=${o.hscroll} ${o.clipped.join(' ')}`);
        }
      }
      expect(bad).toEqual([]);
    });
  });
}

test.describe('school newcomer 390x844', () => {
  test.use({ viewport: PHONES[0], hasTouch: true, isMobile: true });
  test('SCH-009 targets a newcomer can check automatically: first interactive page within 90 s of opening the School, no page shows over 70 words, at most 2 chips, Module 0 and 1 hold at least 8 interactions', async ({ page }) => {
    test.setTimeout(120_000);
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.locator('[data-testid=first-visit]')).toBeVisible();
    let firstInteraction = 0;
    for (let i = 0; i < 10 && !firstInteraction; i++) {
      const k = await page.locator('[data-testid=page]').getAttribute('data-kind');
      if (k === 'minisim' || k === 'widget' || k === 'check') firstInteraction = Date.now() - t0; else await page.locator('[data-action=next]').click();
    }
    expect(firstInteraction).toBeGreaterThan(0); expect(firstInteraction / 1000).toBeLessThan(90);
    const mods = await page.evaluate(() => (window as unknown as S).__rally.school.course());
    let interactions = 0;
    for (const m of mods) for (let i = 1; i <= m.pages; i++) {
      const kind = m.kinds[i - 1]!;
      if ((m.id === 'm0' || m.id === 'm1') && ['minisim', 'widget', 'check'].includes(kind)) interactions++;
      if (kind !== 'concept' && kind !== 'example') continue;
      await page.goto(`/?mode=mobile#/school/${m.id}/${i}`);
      const n = await page.locator('[data-testid=page]').evaluate(e => (e as HTMLElement).innerText.replace(/^What is this\?.*$/m, '').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w) && !/^\d+$/.test(w)).length);
      const svgWords = await page.locator('[data-testid=page] svg').evaluateAll(es => es.reduce((a, e) => a + (e.textContent ?? '').split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length, 0));
      expect(n - svgWords, `${m.id} p${i}`).toBeLessThanOrEqual(75);   // 70 words + the title
      expect(await page.locator('.s2-chip').count()).toBeLessThanOrEqual(2);
    }
    expect(interactions).toBeGreaterThanOrEqual(8);
  });
});
