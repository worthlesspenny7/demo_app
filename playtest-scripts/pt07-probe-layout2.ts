/** PT-07 probe: is the pre-read's primary button reachable at 1366x768, and what does the stage cockpit look like before the start? usage: tsx pt07-probe-layout2.ts <hash> <shotname> */
import { launch, goto, log, shot, hold } from './pt07-common.js';
const [hash = 'drill/D01/0/1', name = 'probe'] = process.argv.slice(2);
const F = 'probe-layout.txt';
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/' + hash); await hold(page); await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const at = (s: string) => { const e = document.querySelector(s) as HTMLElement | null; if (!e) return 'missing'; const b = e.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) as HTMLElement | null; return { y: Math.round(b.y), topIs: top ? (top.id || top.className || top.tagName) : null, same: top === e || e.contains(top!) }; };
  return { skip: at('#skip'), depart: at('#preread .depart, #depart'), scrollY: scrollY, docH: document.documentElement.scrollHeight };
});
log(F, name + ' reach ' + JSON.stringify(r));
if (name !== 'probe') await shot(page, name);
await h.browser.close();   // probes never write the shared profile
