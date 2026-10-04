/** PT-06 area 1: V3 start procedure. */
import { simpleStart, Simulator, adv, until, log } from './pt06-common.js';

// A: asp 1..5, which minute, queue, pullUp timing
for (const asp of [0, 1, 2, 5]) {
  const sc = simpleStart(asp, 0, 3, 120);
  const sim = new Simulator(sc);
  const q0 = sim.startQueue(sc.book[0]!);
  log(`asp ${asp}: startTime ${sc.startTime} (base ${sc.baseStartTime}) = base + ${(sc.startTime - sc.baseStartTime!) / 60} min; restartTime ${sc.book[0]!.restartTime}; queue ${JSON.stringify(q0.cars.map(c => [c.position, c.relative, c.leavesTod - sc.startTime, c.sitting]))}`);
  // pullUp until the car ahead leaves
  const leaves = q0.carAheadLeavesTod;
  if (leaves !== null) {
    sim.act({ type: 'pullUp' });
    const refused = sim.events.filter(e => e.type === 'pullUp.refused').length;
    log(`   t=${(sim.tod - sc.startTime).toFixed(1)} pullUp refused=${refused} (car leaves at ${(leaves - sc.startTime).toFixed(1)})`);
    until(sim, () => sim.tod >= leaves - 0.05, 400);
    sim.act({ type: 'pullUp' }); log(`   t=${(sim.tod - sc.startTime).toFixed(1)} 0.05 before leave: refused total ${sim.events.filter(e => e.type === 'pullUp.refused').length}`);
    until(sim, () => sim.tod >= leaves, 10);
    sim.act({ type: 'pullUp' }); log(`   t=${(sim.tod - sc.startTime).toFixed(1)} at leave: refused total ${sim.events.filter(e => e.type === 'pullUp.refused').length}, pullUp ok ${sim.events.filter(e => e.type === 'pullUp').length}`);
  }
  const li = sim.launchInfo(); log('   launch', JSON.stringify(li));
}
// B: pace cars at each rung with asp 3
for (const rung of [0, 1, 2, 3]) {
  const sc = simpleStart(3, rung as 0, 5, 60);
  const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 5 }); until(sim, () => sim.tod >= sc.startTime - 3); sim.act({ type: 'start' });
  let vis = 0, n = 0, gain = 0, aheadFeat = 0, behindVis = 0, maxAheadSeen = 0;
  for (let t = 0; t < 400; t += 1) { adv(sim, 1); const o = sim.observe({ peek: true }); n++; if (o.paceCars.ahead) { vis++; maxAheadSeen = Math.max(maxAheadSeen, o.paceCars.ahead.distanceFt); } if (o.paceCars.behind) behindVis++; if (o.cues.gainingOnCarAhead) gain++; if (o.ahead.some(f => f.kind === 'car')) aheadFeat++; }
  log(`rung ${rung}: ahead visible ${vis}/${n}, behind visible ${behindVis}/${n}, gaining ${gain}, ahead[] car ${aheadFeat}, max dist ${maxAheadSeen.toFixed(0)}`);
}
// C: asp 0: no pace cars, no cues
{ const sc = simpleStart(0, 3, 5, 60); const sim = new Simulator(sc); sim.act({ type: 'start' }); adv(sim, 60); const o = sim.observe({ peek: true }); log('asp0 paceCars', JSON.stringify(o.paceCars), 'cues', JSON.stringify(o.cues), 'startQueue', JSON.stringify(o.startQueue)); }
