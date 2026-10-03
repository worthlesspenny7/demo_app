/** PT-03 stress: viewport sizes (1280x720, 1920x1080, 1366x768) in the cockpit, plus home/debrief at 1280. */
import { launch, goto, shot, pause, adv } from './common.js';
const log = (...a: unknown[]) => console.log(...a);
const MEASURE = `(() => {
  const q = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const rows = [...document.querySelectorAll('#book .row')]; const bookR = q('#book');
  const vis = rows.filter(r => { const b = r.getBoundingClientRect(); return b.top >= bookR.top - 1 && b.bottom <= bookR.bottom + 1; }).length;
  const hudRight = Math.max(...[...document.querySelectorAll('.hud > *')].map(e => e.getBoundingClientRect().right));
  const cur = q('#book .row.current');
  return { innerW: innerWidth, innerH: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, cockpit: q('#cockpit'), road: q('.cockpit .road'), instruments: q('.instruments'), sw: q('#stopwatch'), cl: q('#clock'), sp: q('#speedo'), drawer: q('.drawer'), book: bookR, rowsVisible: vis, rowsTotal: rows.length, lapboardH: (q('.lapboard')||{}).height, hudRight, laps: q('#laps'), curRow: cur, swCap: q('.instruments .instrument:nth-child(2) .caption') };
})()`;
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  const f = (r: any) => r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} (bottom ${Math.round(r.bottom)})` : 'none';
  for (const vp of [[1280, 720], [1920, 1080], [1366, 768], [1024, 700]] as const) {
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.goto('about:blank'); await goto(page, '#/cockpit/builtin/varied/3'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await page.locator('#skip').click(); await page.keyboard.press('d'); await page.keyboard.press(' '); await pause(page); await adv(page, 20); await page.keyboard.press('l'); await page.keyboard.press('l');
    await page.waitForTimeout(100);
    const m: any = await page.evaluate(MEASURE);
    log(`viewport ${vp[0]}x${vp[1]}: page scroll ${m.scrollW}x${m.scrollH} (overflow x ${m.scrollW > m.innerW}, y ${m.scrollH > m.innerH})`);
    log(`   cockpit ${f(m.cockpit)} | road ${f(m.road)} | instruments ${f(m.instruments)} | drawer ${f(m.drawer)} | book ${f(m.book)} rows visible ${m.rowsVisible}/${m.rowsTotal} | lapboard h ${m.lapboardH}`);
    log(`   stopwatch ${f(m.sw)} clock ${f(m.cl)} speedo ${f(m.sp)} laps ${f(m.laps)} swCaption ${f(m.swCap)} | hud right ${Math.round(m.hudRight)} vs road right ${Math.round(m.road.right)} | road fraction ${(m.road.height / (m.road.height + m.instruments.height)).toFixed(2)} | dial>=240 ${m.sw.width >= 240} | instruments overflow (laps bottom > instruments bottom) ${m.laps.bottom > m.instruments.bottom + 1}`);
    await shot(page, `layout-${vp[0]}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await goto(page, '#/'); await shot(page, 'home-1280', true);
  await goto(page, '#/reference'); const ref: any = await page.evaluate(`({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth, tables: [...document.querySelectorAll('.ref table')].map(t => t.getBoundingClientRect().right), panels: [...document.querySelectorAll('.ref .panel')].map(p => Math.round(p.getBoundingClientRect().right)) })`);
  log('reference at 1280: overflow x', ref.scrollW > ref.innerW, 'table rights', ref.tables.map((x: number) => Math.round(x)), 'panel rights', ref.panels);
  await shot(page, 'reference-1280', true);
  log('page errors:', h.errors);
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });
