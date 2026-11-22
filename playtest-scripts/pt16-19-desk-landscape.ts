/** Pass 2: the School at desk width (1366x768, no touch) and phone landscape (844x390 touch): fit, columns, chips, mini-sim; Desk unlock on Home. */
import { chromium } from 'playwright';
import { open, shot, BASE, PROFILE } from './pt16-common.js';
// desk width, mouse (a desktop visitor)
const b = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
const dp = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
for (const h of ['#/school/m0/1', '#/school/m0/2', '#/school/m1/3', '#/school/m11/7', '#/school/m5/2']) {
  await dp.goto(`${BASE}/?mode=desk${h}`); await dp.waitForSelector('[data-testid=page]'); await dp.waitForTimeout(300);
  const r = await dp.evaluate(() => { const s = document.querySelector('.s2') as HTMLElement; const pg = document.querySelector('[data-testid=page]') as HTMLElement; const c = document.querySelector('.s2-concept, .s2-minisim') as HTMLElement | null; return { w: s.getBoundingClientRect().width, x: s.getBoundingClientRect().x, scroll: `${pg.scrollHeight}/${pg.clientHeight}`, doc: document.scrollingElement!.scrollHeight, cols: c ? getComputedStyle(c).gridTemplateColumns : null, nav: !!document.querySelector('.nav'), btns: [...document.querySelectorAll('.s2 button')].map(x => (x as HTMLElement).innerText).filter(Boolean).slice(-4) }; });
  console.log('desk', h, JSON.stringify(r));
  if (h === '#/school/m0/1') await dp.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt16-20-desk-m0.png' });
  if (h === '#/school/m1/3') await dp.screenshot({ path: '/home/user/demo_app/docs/playtest/screenshots/pt16-21-desk-minisim.png' });
}
// keyboard on desk
await dp.goto(`${BASE}/?mode=desk#/school/m0/3`); await dp.waitForSelector('[data-testid=page]'); await dp.keyboard.press('ArrowRight'); await dp.waitForTimeout(200); console.log('desk ArrowRight ->', await dp.evaluate(() => location.hash));
await b.close();
// landscape phone
const { ctx, page } = await open({ width: 844, height: 390, profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt16-land' });
for (const h of ['#/school/m0/1', '#/school/m0/2', '#/school/m1/3', '#/school/m2/4', '#/school/m11/7', '#/school/m3/4']) {
  await page.goto(`${BASE}/?mode=mobile${h}`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const pg = document.querySelector('[data-testid=page]') as HTMLElement; const acts = [...document.querySelectorAll('.s2-miniacts button, [data-action=next], [data-action=lap], [data-action=leg-ended], .s2-checkopts button, [data-widget] button')].map(x => { const r = x.getBoundingClientRect(); return `${(x as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 12)}@${Math.round(r.top)}-${Math.round(r.bottom)}`; }); return { scroll: `${pg.scrollHeight}/${pg.clientHeight}`, doc: `${document.scrollingElement!.scrollHeight}/${innerHeight}`, acts }; });
  console.log('landscape', h, JSON.stringify(r));
  if (h === '#/school/m1/3') await shot(page, '22-landscape-minisim');
  if (h === '#/school/m11/7') await shot(page, '23-landscape-scorecard');
}
await ctx.close();
// Desk unlocked for the course taker (main profile: all 13 modules done)
const m = await open();
await m.page.goto(`${BASE}/?mode=mobile#/m`); await m.page.waitForSelector('[data-screen]'); await m.page.waitForTimeout(300);
console.log('home after m12:', await m.page.evaluate(() => (document.querySelector('[data-screen]') as HTMLElement).innerText.replace(/\n+/g, ' | ')));
console.log('desk link', await m.page.locator('[data-testid=desk-mode]').count());
await m.ctx.close();
