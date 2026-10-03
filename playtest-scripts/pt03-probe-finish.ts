/** Probe: D18 Silver seed 1, why is the observation checkpoint missed although S (hold) was called when the finish came into view? */
import { launch, goto, pause, adv, obs } from './common.js';
const log = (...a: unknown[]) => console.log(...a);
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  await goto(page, '#/cockpit/drill/D18/1/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  await adv(page, 56); await page.keyboard.press('d'); await adv(page, 4); await page.keyboard.press(' ');
  const res = await page.evaluate(`(() => {
    const r = window.__rally; const book = r.observe().book; const called = new Set(); let hold = null; const trace = []; let ws = null; const timers = []; let seen = 0;
    for (let k = 0; k < 4000 && r.sim.phase !== 'finished'; k++) {
      const o = r.observe();
      const evs = r.sim.events; for (let i = seen; i < evs.length; i++) { const e = evs[i]; if (e.type === 'node') { const ins = book.find(b => b.nodeId === e.detail.nodeId); if (ins && ins.timed) timers.push({ at: e.tod + (ins.pause || 0) + ins.timed.seconds - 2, mph: ins.timed.thenSpeed }); } } seen = evs.length;
      for (const t of timers) if (!t.done && o.tod >= t.at) { r.act({ type: 'call.speed', mph: t.mph }); t.done = true; }
      for (const f of o.ahead) {
        if (f.kind === 'finish' && hold === null) { r.act({ type: 'call.stop' }); hold = { tod: o.tod - o.startTime, dist: f.approxDistanceFt, ahead: o.ahead.map(a => a.kind + '@' + Math.round(a.approxDistanceFt)) }; }
        if (!f.nodeId) continue; const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 250) { r.act({ type: 'call.turn', dir: ins.turn }); called.add(ins.n); }
        if (ins.speed !== undefined && !ins.timed && f.approxDistanceFt <= 100 && !called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.speed }); called.add(ins.n + 10000); }
        if (ins.timed && f.approxDistanceFt <= 100 && !called.has(ins.n + 10000)) { r.act({ type: 'call.speed', mph: ins.timed.holdSpeed }); called.add(ins.n + 10000); }
      }
      if (o.driver.waitingForGo && o.driver.state.includes('stop')) { if (ws === null) ws = o.tod; if (o.tod - ws >= 6.6) { r.act({ type: 'call.go' }); ws = null; } } else ws = null;
      if (hold && trace.length < 60 && k % 4 === 0) trace.push('t+' + (o.tod - o.startTime).toFixed(0) + ' ' + o.driver.state + ' v=' + o.speedo.reading.toFixed(0) + ' ahead=' + o.ahead.map(a => a.kind + '@' + Math.round(a.approxDistanceFt)).join(','));
      r.advance(0.5);
    }
    const res = r.result();
    return { hold, trace, phase: r.sim.phase, observationMissed: res.observationMissed, tail: res.events.filter(e => e.type !== 'mainRoad').slice(-12).map(e => (e.tod - 28800).toFixed(1) + ' ' + Math.round(e.s) + 'ft ' + e.type + ' ' + JSON.stringify(e.detail || {})), msgs: [...document.querySelectorAll('#driverlog div')].map(d => d.textContent) };
  })()`);
  log(JSON.stringify(res, null, 1));
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });
