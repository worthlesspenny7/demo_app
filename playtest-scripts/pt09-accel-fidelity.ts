/**
 * PT-09 (D06 fairness): does a speed change called AT the sign cost the simulated car what the chart (a) says it costs?
 * Straight course, speed v1 -> v2 at a sign, call.speed v2 the instant the bumper crosses the sign, the loss = time at a far mark minus the ghost's.
 * Also: stop and go (zero-dwell) and standing start vs the chart.
 */
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, FORD_1939 } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { speedChangeLoss, stopLoss, accelLoss, buildPerfTable, matrixAt } from '../src/core/perf-table.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { instructionS } from '../src/core/course.js';
import { hms } from '../src/core/units.js';

const perf = buildPerfTable(FORD_1939);
console.log('pair      chart(a)  table-model  measured(sim)  err');
for (const [v1, v2] of [[30, 40], [40, 30], [20, 40], [40, 20], [35, 20], [25, 50], [50, 25], [35, 45], [45, 35], [30, 35], [35, 30]] as [number, number][]) {
  const meas: number[] = [];
  for (const seed of [1, 2, 3]) {
    const sc = new ScenarioBuilder({ id: 'f', name: 'f', startTime: hms(8, 0, 0), seed, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE, prereadSeconds: 30, car: FORD_1939 })
      .start(v1).advanceMiles(1.5).speedAtSign(`SPEED ${v2}`, v2).advanceMiles(0.15).instruction({ label: 'MARK', sightDistance: 300 }, { text: 'MARK' }).advanceMiles(0.2).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc, { watch: 'digital' }); const sign = sc.book.find(i => i.speed === v2 && i.n > 1)!; const mark = sc.book.find(i => i.text === 'MARK')!;
    let called = false, t = 0;
    while (sim.phase !== 'finished' && t < 3000) {
      if (sim.phase === 'preread' && sim.tod >= sc.startTime - 1) sim.act({ type: 'start' });
      if (sim.phase === 'running' && !called && sim.car.s >= instructionS(sc.course, sign)) { called = true; sim.act({ type: 'call.speed', mph: v2 }); }
      sim.step(0.1); t += 0.1;
    }
    const r = sim.result(); const g = buildGhost(sc);
    const eS = r.events.find(e => e.type === 'node' && e.detail?.nodeId === sign.nodeId)!, eM = r.events.find(e => e.type === 'node' && e.detail?.nodeId === mark.nodeId)!;
    meas.push((eM.tod - eS.tod) - (ghostTimeAt(g, instructionS(sc.course, mark)) - ghostTimeAt(g, instructionS(sc.course, sign))));
  }
  const m = meas.reduce((a, b) => a + b, 0) / meas.length;
  console.log(`${v1}>${v2}`.padEnd(8), matrixAt(perf.accel, v1, v2).toFixed(2).padStart(8), speedChangeLoss(v1, v2, FORD_1939).toFixed(2).padStart(11), m.toFixed(2).padStart(13), (m - matrixAt(perf.accel, v1, v2)).toFixed(2).padStart(7), ' runs', meas.map(x => x.toFixed(2)).join(' '));
}
