/** PT-09: D06 section A stops are L/R turning stops, but the graded truth is the straight chart (b). Measure stop&go with S vs L vs R. */
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, FORD_1939 } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { matrixAt, buildPerfTable, stopLoss } from '../src/core/perf-table.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { instructionS } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
const perf = buildPerfTable(FORD_1939);
for (const [vi, vo] of [[30, 30], [35, 40], [40, 35], [45, 30], [50, 50]] as [number, number][]) {
  const out: string[] = [];
  for (const dir of ['S', 'L', 'R'] as const) {
    const sc = new ScenarioBuilder({ id: 't', name: 't', startTime: hms(8, 0, 0), seed: 1, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE, prereadSeconds: 30, car: FORD_1939 })
      .start(vi).advanceMiles(1).instruction({ label: 'MARK in', sightDistance: 400 }, { text: 'MARK A1 in' }).advanceMiles(0.2).stop(dir, vo, { pause: 15 }).advanceMiles(0.2).instruction({ label: 'MARK out', sightDistance: 400 }, { text: 'MARK A1 out' }).advanceMiles(0.3).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true })); const g = buildGhost(sc);
    const a = sc.book.find(i => i.text === 'MARK A1 in')!, b = sc.book.find(i => i.text === 'MARK A1 out')!;
    const ea = r.events.find(e => e.type === 'node' && e.detail?.nodeId === a.nodeId)!, eb = r.events.find(e => e.type === 'node' && e.detail?.nodeId === b.nodeId)!;
    const w = r.events.find(e => e.type === 'wait' && e.tod > ea.tod && e.tod < eb.tod)!, rel = r.events.find(e => e.type === 'release' && e.tod > w.tod)!;
    const measured = (rel.tod - w.tod) + ((ghostTimeAt(g, instructionS(sc.course, b)) - ghostTimeAt(g, instructionS(sc.course, a))) - (eb.tod - ea.tod));
    out.push(`${dir}: ${measured.toFixed(2)}`);
  }
  console.log(`${vi}>${vo} chart (b) ${matrixAt(perf.stopGo, vi, vo).toFixed(2)} (15 - stopLoss ${(15 - stopLoss(vi, vo, FORD_1939)).toFixed(2)}) measured by a faithful team: ${out.join('  ')}`);
}
