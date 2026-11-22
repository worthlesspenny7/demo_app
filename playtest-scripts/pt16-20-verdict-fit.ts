/** Pass 2 geometry: after-answer states at 360x780 (wrong-answer rule text, lap list) - does the page still fit, is "Try again" on screen? Mouse clicks (no ghost click). */
import { open, shot, BASE } from './pt16-common.js';
const { ctx, page } = await open({ width: 360, height: 780, profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-audit-360' });
const fit = async (label: string) => console.log(label, JSON.stringify(await page.evaluate(() => { const pg = document.querySelector('[data-testid=page]') as HTMLElement; const t = document.querySelector('[data-action=try-again]'); const r = t?.getBoundingClientRect(); const pr = pg.getBoundingClientRect(); return { scroll: `${pg.scrollHeight}/${pg.clientHeight}`, tryAgain: r ? `${Math.round(r.top)}-${Math.round(r.bottom)} (page ends ${Math.round(pr.bottom)})` : null }; })));
for (const [h, wrongSel] of [['#/school/m1/5', '.s2-miniacts [data-option="R"]'], ['#/school/m2/2', '.s2-miniacts [data-option="S"]'], ['#/school/m9/5', '.s2-miniacts [data-option="c70"]'], ['#/school/m4/3', '.s2-miniacts [data-action=go]'], ['#/school/m5/6', '.s2-miniacts [data-action=startstop]']] as const) {
  await page.goto(`${BASE}/?mode=mobile${h}`); await page.waitForSelector('.s2-miniacts button'); await page.waitForTimeout(1200);
  await page.locator(wrongSel).first().click(); await page.waitForTimeout(400); await fit(`${h} after wrong`);
  if (h === '#/school/m2/2') await shot(page, '24-360-wrong-verdict');
}
await page.goto(`${BASE}/?mode=mobile#/school/m3/4`); await page.waitForSelector('[data-action=lap]');
for (let i = 0; i < 3; i++) { await page.waitForTimeout(1500); await page.locator('[data-action=lap]').click(); } await page.waitForTimeout(300); await fit('m3/4 after 3 laps');
await ctx.close();
