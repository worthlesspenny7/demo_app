import { Simulator } from '../src/core/sim.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { accelLoss } from '../src/core/perf-table.js';
const T0 = 8 * 3600;
const mk = () => new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(10).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
for (const v of [11.5, 10]) {
  const sc = mk(); const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' }); sim.act({ type: 'call.speed', mph: v });
  let t = 0; while (sim.phase !== 'finished' && t < 80000) { sim.step(0.5); t++; }
  const r = sim.result(); console.log(`${v} mph =>`, r.score.legs.map(x => `err ${Math.round(x.error)} pen ${x.penalty} capped ${x.capped} missed ${x.extras.missed}`).join(' | '), `raw ${r.score.raw} dnf ${r.score.dnf} ${r.score.dnfReason ?? ''}`);
}
