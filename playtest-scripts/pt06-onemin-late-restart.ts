/** PT-06 area 5: same false positive on a time-of-day restart: the car arrives 55-65 s after the restart time through no misreading. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, aidsRung } from './pt06-common.js';
const T0 = hms(8, 0, 0);
const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, aids: aidsRung(0), prereadSeconds: 30 }).start(40).advanceFt(2000)
  .transit({ exact: false, seconds: 300, miles: 3 }).advanceMiles(3).restart(35, T0 + 240).advanceMiles(1).checkpoint().advanceFt(400).finish().build();
const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' });
while (sim.phase !== 'finished' && sim.tod < T0 + 3000) { sim.step(0.1); if (sim.waitingForGo && sim.waitReason === 'hold') { sim.act({ type: 'call.speed', mph: 35 }); sim.act({ type: 'call.go' }); } }
const arrive = sim.events.find(e => e.type === 'wait' && (e.detail as { reason?: string })?.reason === 'hold')!.tod;
log(`restart time ${T0 + 240}, car arrived and left at ${arrive.toFixed(1)} (${(arrive - T0 - 240).toFixed(1)} s late); findings:`, JSON.stringify(sim.result().findings.map(f => f.kind + ': ' + f.text.slice(0, 90))));
