/** PT-10 peek: open a cockpit drill in a scratch fresh profile, hold the loop, dump the hint bar, pre-read, perf card, book head and aids. usage: tsx pt11-00-peekdrill.ts drill/D06/1/1 [overlay] */
import { launch, goto, txt, hold, obs } from './pt11-common.js';
const [hash = 'drill/D03/1/1', extra = ''] = process.argv.slice(2);
const h = await launch({ width: 1366, height: 768 }, true); const { page } = h;
await goto(page, `#/cockpit/${hash}`); await hold(page);
console.log('== HINT ==\n' + await txt(page, '#hintbar'));
console.log('== PREREAD ==\n' + await txt(page, '#preread'));
console.log('== PERF ==\n' + await txt(page, '#perfcard'));
console.log('== BOOK ==\n' + (await txt(page, '#book')).slice(0, Number(process.env.BOOKN ?? 1500)));
const o = await obs(page); console.log('aids ' + JSON.stringify(o.aids) + ' launch ' + JSON.stringify(o.launch) + ' lines ' + o.book.length);
if (process.env.BOOKJSON) console.log(JSON.stringify(o.book.map((b: any) => ({ n: b.n, text: b.text, pause: b.pause, speed: b.speed, timed: b.timed, turn: b.turn, section: b.section })), null, 0));
if (extra === 'overlay') { await page.keyboard.press('c'); await page.waitForTimeout(200); const t = await page.locator('body').innerText(); const i = t.indexOf('(a)'); console.log('== OVERLAY ==\n' + t.slice(Math.max(0, i - 300), i + 4000)); }
console.log('errors', JSON.stringify(h.errors));
await h.browser.close();
