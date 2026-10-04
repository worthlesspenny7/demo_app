/** PT-06 area 3: exact transits. Scripted go times at IN + 600 s +- offsets; IN while stopped; early/late departures; minute/hour rollovers. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, until, adv, log, aidsRung } from './pt06-common.js';

function stage(T0: number, inFt = 5280, opts: { stopAtIn?: boolean } = {}) {
  const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
  const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsRung(0), prereadSeconds: 30 }).start(40).advanceFt(inFt);
  if (opts.stopAtIn) b.stop('S', 40, { pause: 15 });
  b.transit({ exact: true, seconds: 600, miles: 6 });
  b.advanceMiles(6).endTransit({ speed: 35 });
  b.advanceMiles(2).checkpoint().advanceFt(400).finish();
  return b.build();
}
function run(sc: ReturnType<typeof stage>, goOffset: number, label: string) {
  const sim = new Simulator(sc); const T0 = sc.startTime;
  sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' });
  // follow assigned speed 40; the transit has no speed: drive 40 mph (arrives at ~9 min, waits)
  let called = false; let goAt: number | null = null;
  while (sim.phase !== 'finished' && sim.tod < T0 + 6000) {
    sim.step(0.1);
    const ins = sc.book.find(i => i.transit?.end)!;
    if (sim.waitingForGo && sim.waitReason === 'hold' && !called) {
      const out = sim.transitOutFor(ins)!; if (goAt === null) goAt = out + goOffset;
      if (sim.tod >= goAt - 1e-9) { called = true; sim.act({ type: 'call.go' }); }
    }
    if (!called && sim.car.v === 0 && sim.waitingForGo && sim.waitReason === 'stop') sim.act({ type: 'call.go' });
  }
  const r = sim.result();
  const inT = Object.entries(sim.transitIn); const out = sim.events.filter(e => e.type === 'transit.out').map(e => e.detail);
  log(`${label}: IN ${JSON.stringify(inT)} out ${JSON.stringify(out)} goAt ${goAt} released ${sim.events.filter(e => e.type === 'release').map(e => e.tod.toFixed(1)).join(',')} legs ${r.score.legs.map(l => `err ${l.error}`).join(' ')} findings ${r.findings.map(f => f.kind + ':' + f.seconds).join(',')} disc ${r.instrumentDiscipline.map(f => f.kind).join(',')} startDeltas ${r.startDeltas.length}`);
  return { sim, r };
}
for (const off of [-65, -60, -30, -3, 0, 3, 30, 60, 65]) run(stage(hms(8, 0, 0)), off, `offset ${off}`);
// rollovers: IN in minute 41-57 so OUT rolls the hour
for (const T0 of [hms(8, 41, 30), hms(8, 49, 59), hms(11, 59, 20), hms(23, 55, 0)]) run(stage(T0), 0, `T0 ${T0}`);
// IN while stopped: transit begin line on a STOP node
{ const { sim } = run(stage(hms(8, 0, 0), 5280, { stopAtIn: true }), 0, 'IN at a stop sign'); void sim; }
