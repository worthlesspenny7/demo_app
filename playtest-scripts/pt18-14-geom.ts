/** PT-18 geometry at 360x780 (and 390x844): every mini-sim/check/widget page AFTER a wrong answer (verdict + rule + Try again on screen):
 *  page or document scroll, horizontal overflow, elements off the right edge. usage: <w> <h> */
import { open, BASE } from './pt18-common.js';
import { COURSE } from '../content/course.js';
const W = Number(process.argv[2] ?? 360), H = Number(process.argv[3] ?? 780);
const { ctx, page, errors } = await open({ width: W, height: H, profile: `/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt18-geom-${W}` });
let bad = 0, n = 0;
for (const m of COURSE) for (let p = 1; p <= m.pages.length; p++) {
  const pg = m.pages[p - 1]!; if (pg.kind === 'concept' || pg.kind === 'example') continue;
  await page.goto(`${BASE}/?mode=mobile#/school/${m.id}/${p}`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(150);
  if (pg.kind === 'check') await page.locator('.s2-checkopts [data-right=false]').first().click();
  else if (pg.kind === 'minisim') {
    const st = page.locator('.s2-miniacts [data-action=start-card]'); if (await st.count()) { await st.click(); await page.waitForTimeout(400); }
    const opt = page.locator('.s2-miniacts [data-option]'); const go = page.locator('.s2-miniacts [data-action=go], .s2-miniacts [data-action=startstop]');
    if (await opt.count()) { const o = await page.evaluate(() => (window as any).__rally.school.oracle()); const ids = await opt.evaluateAll(es => es.map(e => (e as HTMLElement).dataset.option)); await page.locator(`.s2-miniacts [data-option="${ids.find(i => i !== o.optionId)}"]`).click(); }
    else if (await go.count()) { await go.first().click(); if (await page.locator('.s2-miniacts [data-action=lap]').count() && !(await page.locator('[data-testid=mini-verdict]').count())) { await page.waitForTimeout(300); await page.locator('.s2-miniacts [data-action=lap]').click(); } }
  } else if (pg.kind === 'widget') { const sw = page.locator('[data-action=start-widget]'); if (await sw.count()) await sw.click(); await page.waitForTimeout(300); const q = page.locator('[data-widget=readScorecard] button[data-right=false]'); if (await q.count()) await q.first().click(); }
  await page.waitForTimeout(350); n++;
  const g = await page.evaluate(() => { const pg = document.querySelector('[data-testid=page]') as HTMLElement; const se = document.scrollingElement!; return { ps: pg.scrollHeight > pg.clientHeight + 1, ds: se.scrollHeight > innerHeight + 1, hs: se.scrollWidth > innerWidth + 1, off: [...pg.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => (e.textContent ?? '').trim().slice(0, 30)), verdict: !!document.querySelector('[data-testid=mini-verdict], .s2-result, .s2-checkfb') }; });
  if (g.ps || g.ds || g.hs || g.off.length) { bad++; console.log(`${m.id}/${p} ${pg.kind} after answer: pageScroll=${g.ps} docScroll=${g.ds} hscroll=${g.hs} off=${JSON.stringify(g.off)}`); }
}
console.log(`${W}x${H}: ${n} interactive pages answered wrong, ${bad} with overflow; errors ${JSON.stringify(errors)}`);
await ctx.close();
