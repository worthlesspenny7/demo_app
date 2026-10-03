import { launch, shot, goto, txt, obs, adv } from './rev-common.js';
const h = await launch({ width: 1280, height: 720 }); const { page } = h;
const measure = () => page.evaluate(() => {
  const se = document.scrollingElement!;
  const box = (s: string) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const laps = document.querySelector('#laps') as HTMLElement | null;
  const bookRows = [...document.querySelectorAll('#book .row')].filter(r => { const b = r.getBoundingClientRect(); const c = document.querySelector('#book')!.getBoundingClientRect(); return b.bottom > c.top && b.top < c.bottom; }).length;
  return { vp: `${innerWidth}x${innerHeight}`, scrollH: se.scrollHeight, scrollW: se.scrollWidth, road: box('.road'), roadCanvas: box('#road'), inst: box('.instruments'), stopwatch: box('#stopwatch'), clock: box('#clock'), speedo: box('#speedo'), book: box('.book'), drawer: box('.drawer'), laps: box('#laps'), lapsScroll: laps ? [laps.scrollHeight, laps.clientHeight] : null, bookRowsVisible: bookRows, perfcard: box('#perfcard') };
});
const verdict = (m: any) => {
  const p: string[] = [];
  if (m.scrollH > Number(m.vp.split('x')[1])) p.push(`V-scroll ${m.scrollH - Number(m.vp.split('x')[1])}px`);
  if (m.scrollW > Number(m.vp.split('x')[0])) p.push(`H-scroll ${m.scrollW - Number(m.vp.split('x')[0])}px`);
  if (m.stopwatch.t < m.inst.t - 1 || m.stopwatch.b > m.inst.b + 1) p.push('stopwatch outside instruments pane');
  if (m.stopwatch.t < m.road.b - 1) p.push(`stopwatch overlaps road by ${m.road.b - m.stopwatch.t}px`);
  if (m.clock.r > m.stopwatch.l + 1 || m.stopwatch.r > m.speedo.l + 1) p.push('dials overlap');
  if (m.road.r > m.book.l + 1) p.push(`road overlaps book by ${m.road.r - m.book.l}px`);
  if (m.inst.b > m.drawer.t + 1) p.push(`instruments overlap drawer by ${m.inst.b - m.drawer.t}px`);
  if (m.laps && m.laps.b > m.inst.b + 1) p.push(`laps clipped ${m.laps.b - m.inst.b}px`);
  return p.length ? p.join('; ') : 'OK';
};
async function setup(w: number, hgt: number, tag: string) {
  await page.setViewportSize({ width: w, height: hgt });
  await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(500); await page.keyboard.press('Escape');
  await shot(page, `layout-${tag}-preread`);
  await page.keyboard.press('d'); await page.keyboard.press(' '); await adv(page, 25);
  // add a few laps so the lap list has content
  for (let i = 0; i < 3; i++) { await adv(page, 4); await page.keyboard.press('l'); }
  await page.waitForTimeout(200);
  const m = await measure(); console.log(`[${tag}] ${verdict(m)} | `, JSON.stringify(m));
  await shot(page, `layout-${tag}-run`);
}
for (const [w, hh] of [[1280, 720], [1366, 768], [1920, 1080], [1024, 700]]) await setup(w, hh, `${w}x${hh}`);
// live resize sequence on one cockpit
await page.setViewportSize({ width: 1920, height: 1080 }); await goto(page, '#/cockpit/drill/D03/0/1'); await page.waitForTimeout(400); await page.keyboard.press('Escape'); await page.keyboard.press('d'); await adv(page, 10);
for (const [w, hh] of [[1366, 768], [1280, 720], [1920, 1080], [1280, 720]]) { await page.setViewportSize({ width: w, height: hh }); await page.waitForTimeout(400); const m = await measure(); console.log(`[live ->${w}x${hh}] ${verdict(m)}`); }
await shot(page, 'layout-live-resize-1280x720');
// Home / debrief height at sizes
for (const [w, hh] of [[1280, 720], [1920, 1080]]) { await page.setViewportSize({ width: w, height: hh }); await goto(page, '#/'); console.log(`home ${w}x${hh} scrollH`, await page.evaluate(() => document.scrollingElement!.scrollHeight), 'cards per row', await page.evaluate(() => { const c = [...document.querySelectorAll('.cards')][0]!; const t = [...c.children].map(x => (x as HTMLElement).offsetTop); return t.filter(x => x === t[0]).length; })); await shot(page, `home-${w}x${hh}`); }
console.log('errors', h.errors);
await h.browser.close();
