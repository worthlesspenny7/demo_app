import { Simulator } from '../src/core/sim.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { accelLoss } from '../src/core/perf-table.js';
const T0 = 8 * 3600;
for (const mph of [11.5]) {
  const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(10).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).observationFinish().build();
  const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' }); sim.act({ type: 'call.speed', mph });
  let t = 0; while (sim.phase !== 'finished' && t < 80000) { sim.step(0.1); t += 0.1; if (sim.car.s > 10 * 5280 + 200) { sim.act({ type: 'call.speed', mph: 30 }); } }
  const r = sim.result();
  console.log(`${mph} mph over leg 1 (perfect 20:00): legs`, r.score.legs.map(x => `err ${x.error} raw ${x.rawError} pen ${x.penalty} capped ${x.capped} missed ${x.extras.missed}`).join(' | '), 'raw', r.score.raw, 'phase', sim.phase, 'dnf', r.score.dnf, r.score.dnfReason ?? '');
}
