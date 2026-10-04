/** PT-05 probe: dump book entries and perf-card texts for a drill (to write the human model's reading rules). */
import { launch, goto, adv, obs, hold, txt } from './pt05-common.js';
const id = process.argv[2] ?? 'D03'; const tier = process.argv[3] ?? '0';
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, `#/cockpit/drill/${id}/${tier}/1`); await hold(page);
let o = await obs(page);
console.log('BOOK', JSON.stringify(o.book.map((b: any) => { const { text, ...r } = b; return { ...r, text: text?.slice(0, 80) }; }), null, 0).slice(0, 6000));
console.log('PERF0', await txt(page, '#perfcard'));
await page.evaluate(() => { const r = (window as any).__rally; r.act({ type: 'skipPreread', secondsBefore: 4 }); r.act({ type: 'start' }); });
const seen = new Set<string>();
for (let i = 0; i < 4000; i++) {
  o = await page.evaluate(() => { const r = (window as any).__rally; const o = r.observe(); const b = o.book; for (const f of o.ahead) { const ins = b.find((x: any) => x.nodeId === f.nodeId); if (ins?.turn && f.approxDistanceFt < 500) r.act({ type: 'call.turn', dir: ins.turn }); } if (o.driver.waitingForGo && o.driver.state !== 'restartHold') { (window as any).__w = ((window as any).__w ?? 0) + 0.5; if ((window as any).__w > 8) { r.act({ type: 'call.go' }); (window as any).__w = 0; } } r.advance(0.5); return r.observe(); });
  if (!o || o.phase === 'finished') break;
  const t = await txt(page, '#perfcard'); const key = t.slice(0, 120);
  if (!seen.has(key)) { seen.add(key); console.log('--- tod', o.tod.toFixed(1), 'line', o.currentLine, 'stopped', o.stoppedAtLine, 'state', o.driver.state, '\n' + t); console.log('NEXTCALL', await txt(page, '#next-call'), '| CHIP', await txt(page, '#phase'), await txt(page, '#scale')); }
}
await h.browser.close();
