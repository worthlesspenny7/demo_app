/** PT-03 probe: D07 restart handling. Go at the restart time on the clock; report events around the restart and the checkpoints. */
import { launch, goto, pause, adv, obs } from './common.js';
async function main(): Promise<void> {
  const h = await launch(); const { page } = h;
  await goto(page, '#/cockpit/drill/D07/0/1'); await page.waitForSelector('#cockpit'); await page.locator('#view').focus(); await pause(page);
  const res = await page.evaluate(`(() => {
    const r = window.__rally; r.act({type:'skipPreread'}); r.act({type:'start'}); const book = r.observe().book; const called = new Set(); const log = []; let goDone = false;
    const sc = r.sim.sc;
    for (let k = 0; k < 60000 && r.sim.phase !== 'finished'; k++) {
      const o = r.observe();
      for (const f of o.ahead) {
        if (f.kind === 'finish' && f.approxDistanceFt < 700 && !called.has('stop')) { r.act({type:'call.stop'}); called.add('stop'); }
        if (!f.nodeId) continue; const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
        if (ins.turn && !called.has(ins.n) && f.approxDistanceFt < 250) { r.act({type:'call.turn', dir: ins.turn}); called.add(ins.n); }
        if (ins.speed !== undefined && f.approxDistanceFt <= 100 && !called.has(ins.n+10000)) { r.act({type:'call.speed', mph: ins.speed}); called.add(ins.n+10000); }
      }
      if (o.driver.waitingForGo) { log.push('wait@'+o.tod.toFixed(1)+' state='+o.driver.state+' line='+o.currentLine); if (!called.has('w'+Math.floor(o.tod/50))) {} r.act({type:'call.go'}); }
      r.advance(0.25);
    }
    const evs = r.sim.events.filter(e => ['restart','checkpoint','wait','stop.begin','stop.end','finished','offCourse','driver'].includes(e.type)).map(e => e.tod.toFixed(1)+' '+e.type+' '+JSON.stringify(e.detail||{}).slice(0,120));
    return { log: log.slice(0,12), evs: evs.slice(0,60), startTime: o0(r), restartAt: JSON.stringify(sc.restartAt ?? null) };
    function o0(r){ return r.observe().startTime; }
  })()`);
  console.log(JSON.stringify((res as any).log));
  await page.waitForSelector('#debrief'); const t=(sel:string)=>page.locator(sel).first().innerText();
  console.log('HEAD', (await t('.debrief .panel')).replace(/\n/g,' | '));
  console.log('CP', (await page.locator('#cp-table tbody tr').allInnerTexts()).join(' ; '));
  console.log('TIP', await t('#tip'));
  for (const w of await page.locator('#worked li').allInnerTexts()) console.log('W', w);
  await page.screenshot({path:'/home/user/demo_app/docs/playtest/screenshots/pt03-debrief-d07-restart-go.png', fullPage:true});
  await h.close();
}
main().catch(e => { console.error(e); process.exit(1); });
