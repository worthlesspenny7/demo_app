/** PT-06 area 6: missed checkpoint at exactly 30 min late, through the simulator (timeout vs scoring rounding). */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, aidsRung } from './pt06-common.js';
import { PERFECT_TIMEWISE } from '../src/core/builder.js';
const T0 = hms(8, 0, 0);
const mk = () => new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, skill: 'perfect', inconsistency: 0 } as never, speedo: PERFECT_TIMEWISE, aids: aidsRung(0), prereadSeconds: 5 }).start(30).advanceFt(3000).checkpoint().advanceFt(200).finish().build();
// perfect time to the CP: 3000 ft at 30 mph = 68.18 s. The car crawls at v mph and arrives at T0 + 3000/(v*1.4667).
for (const arrive of [68.18 + 1798, 68.18 + 1799, 68.18 + 1799.6, 68.18 + 1800, 68.18 + 1800.4, 68.18 + 1800.6, 68.18 + 1801.5]) {
  const sc = mk(); const sim = new Simulator(sc); sim.act({ type: 'start' }); const mph = 3000 / (arrive * 1.4666667) * 3600 / 3600 * 1; // ft / s -> mph
  sim.act({ type: 'call.speed', mph }); let t = 0; while (sim.phase !== 'finished' && t < 4000) { sim.step(0.1); t += 0.1; }
  const r = sim.result(); const l = r.score.legs[0]!; const rec = r.records.find(x => x.cpId === 'cp1');
  log(`arrive +${(arrive - 68.18).toFixed(1)} s late: finished tod ${sim.tod.toFixed(1)} (${(sim.tod - T0).toFixed(1)} s), cp recorded ${rec?.actualTod ?? 'none'}, raw ${l.rawError} missed ${l.extras.missed} penalty ${l.penalty} dnf ${r.dnf} finishReason ${sim.events.find(e => e.type === 'finished')?.detail?.reason ?? 'normal'}`);
}
