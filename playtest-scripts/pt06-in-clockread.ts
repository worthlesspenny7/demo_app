/** PT-06 area 5: clockForTimeOfDay false positive on an exact-transit IN: the finding is decided at the instant the IN sign is crossed, so a clock read taken as the sign passes (up to a second or two AFTER the crossing, which is how a navigator takes an IN time) is too late. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, aidsRung } from './pt06-common.js';
function run(readAt: number | null, label: string) {
  const T0 = hms(8, 0, 0);
  const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, aids: aidsRung(0), prereadSeconds: 30 }).start(40).advanceFt(5280);
  b.transit({ exact: true, seconds: 600, miles: 6 }).advanceMiles(6).endTransit({ speed: 35 }).advanceMiles(2).checkpoint().advanceFt(400).finish();
  const sc = b.build(); const sim = new Simulator(sc, { watch: 'analog' });
  sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); let inAt: number | null = null, read = false;
  while (sim.phase !== 'finished' && sim.tod < T0 + 700) {
    sim.step(0.1);
    if (inAt === null && sim.transitIn[2] !== undefined) inAt = sim.tod;
    if (readAt !== null && !read && inAt !== null && sim.tod >= inAt + readAt - 1e-9) { read = true; sim.act({ type: 'clock.read' }); }
    if (readAt !== null && readAt < 0 && !read && sim.car.s >= 5280 + readAt * 58 && inAt === null) { read = true; sim.act({ type: 'clock.read' }); }
  }
  log(`${label}: IN at ${inAt}, clock.read at IN${readAt! >= 0 ? '+' : ''}${readAt}: findings ${JSON.stringify(sim.result().instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay').map(f => f.text.slice(0, 40)))}`);
}
run(0.5, 'read 0.5 s after the sign'); run(1, 'read 1 s after'); run(-1, 'read ~1 s before the sign (feet before)');
