/** PT-07 probe: which element of the pre-read scrolls, and can a mouse reach "Fast-forward to the launch" at 1366x768 (wheel over the box, then click). */
import { launch, goto, log, hold, shot } from './pt07-common.js';
const [hash = 'drill/D01/0/1', name = ''] = process.argv.slice(2);
const F = 'probe-layout.txt';
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, '#/cockpit/' + hash); await hold(page); await page.waitForTimeout(300);
const sc = await page.evaluate(() => [...document.querySelectorAll('#view *')].filter(e => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 2; }).map(e => `${e.tagName}#${e.id}.${(e as HTMLElement).className} sh=${e.scrollHeight} ch=${e.clientHeight} y=${Math.round(e.getBoundingClientRect().y)}`));
log(F, hash + ' scrollables: ' + JSON.stringify(sc));
await page.mouse.move(460, 300); await page.mouse.wheel(0, 400); await page.waitForTimeout(200);
const r = await page.evaluate(() => { const e = document.querySelector('#skip')!; const b = e.getBoundingClientRect(); const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { y: Math.round(b.y), reachable: top === e || e.contains(top) }; });
log(F, hash + ' after wheel over the pre-read: skip ' + JSON.stringify(r));
if (name) await shot(page, name);
await h.browser.close();
