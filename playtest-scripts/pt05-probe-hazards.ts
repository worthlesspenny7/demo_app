/** PT-05 probe: list every hazard feature that comes into view during a drill and what Dad says about it (fresh profile, not recorded). */
import { launch, goto, hold } from './pt05-common.js';
const [hash] = process.argv.slice(2);
const h = await launch({ width: 1366, height: 768 }, true);
const { page } = h;
await goto(page, `#/cockpit/${hash}`); await hold(page);
const out = await page.evaluate(() => {
  const r = (window as any).__rally; const seen: string[] = []; const kinds = new Set<string>(); let w = 0;
  r.act({ type: 'skipPreread', secondsBefore: 4 }); r.act({ type: 'start' });
  const book = r.observe().book; let lastMsg = 0;
  for (let i = 0; i < 40000 && r.sim.phase !== 'finished'; i++) {
    const o = r.observe();
    for (const f of o.ahead) { const ins = book.find((x: any) => x.nodeId === f.nodeId); if (ins?.turn && f.approxDistanceFt < 500) r.act({ type: 'call.turn', dir: ins.turn }); if (!f.nodeId && !kinds.has(f.kind + Math.floor(o.tod / 60))) { kinds.add(f.kind + Math.floor(o.tod / 60)); seen.push(`${o.tod.toFixed(0)} ${f.kind} ${Math.round(f.approxDistanceFt)}ft ${f.label ?? ''} state=${o.driver.state} v=${o.driver.targetIndicated}`); } }
    const msgs = o.driver.messages; for (const m of msgs.slice(lastMsg)) seen.push(`   dad: ${m.text}`); lastMsg = msgs.length;
    if (o.driver.waitingForGo && o.driver.state === 'waiting:stop') { w += 0.5; if (w > 8) { r.act({ type: 'call.go' }); w = 0; } }
    if (o.driver.state === 'waiting:hold') r.act({ type: 'call.go' });
    r.advance(0.5);
  }
  return seen;
});
console.log(out.join('\n'));
await h.browser.close();
