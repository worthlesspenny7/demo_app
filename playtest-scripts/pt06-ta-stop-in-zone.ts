/** PT-06 area 2/TA-004: a normal printed-pause STOP inside an accident / tractor zone: the stopped seconds count as qualifying delay (de = dt - ds/vg with vg = ghost speed before the stop line), though the book's pause already pays them. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log } from './pt06-common.js';
import { OracleBot } from '../src/agent/bots.js';
function run(stopInZone: boolean, kind: 'accident' | 'tractor') {
  const T0 = hms(8, 0, 0); const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 } }).start(35).advanceMiles(0.5);
  const zoneS = b.position;
  if (kind === 'accident') b.hazard({ kind: 'accident', s: zoneS, speedMph: 20, lengthFt: 2500 }); else b.hazard({ kind: 'tractor', s: zoneS, speedMph: 20, lengthFt: 2500 } as never);
  if (stopInZone) b.advanceFt(1200); else b.advanceFt(3000);
  b.stop('S', 35, { pause: 15 });
  b.advanceMiles(1.0).checkpoint().advanceFt(500).endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 120, miles: 0.5 } }).advanceMiles(0.5).observationFinish();
  const sc = b.build(); const sim = new Simulator(sc); const bot = new OracleBot(sim, { noRecovery: true }); (bot as any).declareTA = () => {};
  sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
  const stopBucket = sim.result().attribution[0]!.buckets;
  return { q: sim.taQualifying[1] ?? 0, hazard: stopBucket.hazard, stop: stopBucket.stop, advice: sim.taAdvice(1) };
}
for (const kind of ['accident', 'tractor'] as const) { const a = run(true, kind), c = run(false, kind); log(`${kind}: STOP inside the zone: qualifying ${a.q.toFixed(1)} s (hazard bucket ${a.hazard.toFixed(1)}, stop bucket ${a.stop.toFixed(1)}); STOP outside the zone: qualifying ${c.q.toFixed(1)} s (hazard ${c.hazard.toFixed(1)}, stop ${c.stop.toFixed(1)})`); }
