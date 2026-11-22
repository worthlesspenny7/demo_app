/** Desk width (1366x768, mouse) and landscape phone (844x390, touch): School pages, a mini-sim, keyboard advance, rotate card. */
import { chromium } from 'playwright';
import { BASE, SHOTS } from './pt17-common.js';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const d = await b.newPage({ viewport: { width: 1366, height: 768 } });
for (const h of ['#/school/m0/1', '#/school/m4/3', '#/school/m1/6', '#/school/m11/7']) {
  await d.goto(BASE + '/?mode=desk' + h); await d.waitForSelector('[data-testid=page]'); await d.waitForTimeout(400);
  const g = await d.evaluate(() => { const p = document.querySelector('[data-testid=page]')!.getBoundingClientRect(); const c = document.querySelector('.s2-minicard, .s2-minisim .mcard')?.getBoundingClientRect(); return { page: [p.x, p.y, p.width, p.height].map(Math.round), card: c ? [c.x, c.y, c.width, c.height].map(Math.round) : null, scroll: document.scrollingElement!.scrollHeight > innerHeight + 1 }; });
  console.log('desk', h, JSON.stringify(g));
  if (h === '#/school/m4/3') await d.screenshot({ path: `${SHOTS}/pt17-36-desk-minisim.png` });
}
await d.goto(BASE + '/?mode=desk#/school/m0/1'); await d.waitForSelector('[data-testid=page]'); await d.keyboard.press('ArrowRight'); await d.waitForTimeout(300);
console.log('desk ArrowRight ->', d.url().replace(/.*#/, '#'));
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const l = await ctx.newPage();
for (const h of ['#/school/m0/1', '#/school/m2/4', '#/m']) {
  await l.goto(BASE + '/?mode=mobile' + h); await l.waitForSelector('[data-screen]'); await l.waitForTimeout(400);
  const r = await l.evaluate(() => ({ rotate: !!document.querySelector('[data-testid=rotate]') && getComputedStyle(document.querySelector('[data-testid=rotate]')!).display !== 'none', text: (document.querySelector('[data-testid=rotate]') as HTMLElement | null)?.innerText ?? '', scroll: document.scrollingElement!.scrollHeight > innerHeight + 1 }));
  console.log('landscape', h, JSON.stringify(r));
  if (h === '#/school/m2/4') await l.screenshot({ path: `${SHOTS}/pt17-37-landscape.png` });
}
await b.close();
