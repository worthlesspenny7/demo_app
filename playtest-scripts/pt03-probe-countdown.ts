/** PT-03 probe: does the D04 countdown aid count from the ghost departure (arrival + pause) on a STOP + timed line? */
import { launch, goto, pause, adv, obs } from './common.js';
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  await goto(page, '#/cockpit/drill/D04/1/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  const res = await page.evaluate(`(() => {
    const r = window.__rally; let o = r.observe(); r.advance(Math.max(0, o.secondsToStart - 3)); r.act({type:'start'}); o = r.observe(); r.advance(o.secondsToStart);
    const book = r.observe().book; const tl = book.filter(b => b.timed); let ti = 0; const called = new Set(); const rows = []; let lastWait = null; let goAt = null; const timers = [];
    for (let k = 0; k < 4000 && r.sim.phase !== 'finished'; k++) {
      o = r.observe();
      for (const f of o.ahead) { if (!f.nodeId) continue; const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 250) { r.act({type:'call.turn', dir: ins.turn}); called.add(ins.n); }
        const sp = ins.timed ? ins.timed.holdSpeed : ins.speed;
        if (sp !== undefined && f.approxDistanceFt <= 100 && !called.has(ins.n+10000)) { r.act({type:'call.speed', mph: sp}); called.add(ins.n+10000); } }
      if (o.aids.countdown !== undefined && o.aids.countdown !== null) rows.push([o.tod.toFixed(1), o.aids.countdown.toFixed(1), o.driver.state, o.currentLine]);
      if (o.aids.countdown !== undefined && o.aids.countdown !== null && o.aids.countdown <= 2.3 && !called.has('c'+o.currentLine+Math.floor(o.tod/30))) { called.add('c'+o.currentLine+Math.floor(o.tod/30)); }
      if (o.aids.countdown !== undefined && o.aids.countdown !== null && o.aids.countdown <= 2.1 && o.aids.countdown > 1.4 && ti < tl.length) { r.act({type:'call.speed', mph: tl[ti].timed.thenSpeed}); rows.push(['CALL', 'timed line '+tl[ti].n+' at countdown '+o.aids.countdown.toFixed(1), o.tod.toFixed(1), '']); ti++; }
      if (o.driver.waitingForGo) { if (lastWait === null) lastWait = o.tod; if (o.tod - lastWait >= 7.5) { r.act({type:'call.go'}); goAt = o.tod; lastWait = null; rows.push(['GO', o.tod.toFixed(1), '', '']); } } else lastWait = null;
      r.advance(0.5);
      if (rows.length > 3000) break;
    }
    return rows.filter((x,i)=> x[0]==='GO' || x[0]==='CALL' || x[2]==='waiting:stop' || i%10===0).slice(0,200).map(x=>x.join(' '));
  })()`);
  console.log((res as string[]).join('\n'));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });
