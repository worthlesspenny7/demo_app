/** PT-06 area 3/5: oneMinuteMistake fires for a car that simply ARRIVED 50-70 s after the OUT time (slow transit), though no minute was misread. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, aidsRung } from './pt06-common.js';
const T0 = hms(8, 0, 0);
const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, aids: aidsRung(0), prereadSeconds: 30 }).start(40).advanceFt(5280);
b.transit({ exact: true, seconds: 600, miles: 6 }).advanceMiles(6).endTransit({ speed: 35 }).advanceMiles(2).checkpoint().advanceFt(400).finish();
const sc = b.build(); const sim = new Simulator(sc);
sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' });
let slowed = false;
while (sim.phase !== 'finished' && sim.tod < T0 + 6000) {
  sim.step(0.1);
  if (!slowed && sim.transitIn[2] !== undefined) { slowed = true; sim.act({ type: 'call.speed', mph: 33 }); }   // 6 mi at 33 mph = 654.5 s: arrives ~55 s after OUT
  if (sim.waitingForGo && sim.waitReason === 'hold') { sim.act({ type: 'call.speed', mph: 35 }); sim.act({ type: 'call.go' }); }
}
const out = sim.transitOutFor(sc.book.find(i => i.transit?.end)!)!;
const arrive = sim.events.find(e => e.type === 'wait' && (e.detail as { reason?: string })?.reason === 'hold')!.tod;
log(`OUT ${out}, car arrived and left at ${arrive.toFixed(1)} (${(arrive - out).toFixed(1)} s after OUT); findings:`, JSON.stringify(sim.result().findings.map(f => f.text.slice(0, 110))));
