/** PT-07 probe: geometry of the pre-read box, its buttons, the instruments and the book rows at 1366x768 (fresh profile). usage: tsx pt07-probe-layout.ts <hash> */
import { launch, goto, log, reset, hold } from './pt07-common.js';
const [hash = 'drill/D01/0/1', W = '1366', Hh = '768'] = process.argv.slice(2);
const F = 'probe-layout.txt';
const h = await launch({ width: Number(W), height: Number(Hh) }, true); const { page } = h;
await goto(page, '#/cockpit/' + hash); await hold(page);
const r = await page.evaluate(() => {
  const q = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), ov: cs.overflowY, sh: e.scrollHeight, ch: e.clientHeight }; };
  const rows = [...document.querySelectorAll('#book .row, #book tr, #book .griid-row')].slice(0, 4).map(e => Math.round(e.getBoundingClientRect().height));
  return { preread: q('#preread'), skip: q('#skip'), depart: q('#preread .depart, #depart'), clock: q('#clock, .clock'), watch: q('#stopwatch'), book: q('#book'), view: q('#view'), road: q('#road, .road'), startcard: q('.startcard, #startcard'), rows, vh: innerHeight };
});
log(F, hash + ' ' + W + 'x' + Hh + ' ' + JSON.stringify(r));
await h.browser.close();   // probes never write the shared profile
