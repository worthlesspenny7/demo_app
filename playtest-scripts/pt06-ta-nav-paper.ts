/** PT-06 area 2: declaring a TA for a leg that also holds a navigation error (train 100 s + wrong turn); the committee must credit the train only, never the wrong turn. Then paper mode. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, until, adv } from './pt06-common.js';
import { EXITS } from '../src/core/builder.js';
const T0 = hms(8, 0, 0);
function build(paper: boolean) {
  const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, rules: paper ? { taMode: 'paper' } as never : undefined }).start(35).advanceMiles(0.5);
  b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
  b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: 100 });
  b.advanceMiles(0.7); b.instruction({ exits: EXITS.crossroads('R'), sightDistance: 600 }, { turn: 'R', speed: 35 });
  b.advanceMiles(1.2).checkpoint().advanceFt(500);
  if (!paper) b.endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 120, miles: 0.4 } }).advanceMiles(0.4);
  b.observationFinish(); return b.build();
}
for (const [paper, wrong] of [[false, false], [false, true], [true, true]] as const) {
  const sc = build(paper); const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' });
  const nd = sc.course.nodes.find(n => n.kind === 'intersection')!; let turned = false, u = false;
  while (sim.phase !== 'finished' && !(paper ? false : sim.taState().windowOpen)) {
    sim.step(0.1);
    if (sim.waitingForGo && sim.waitReason === 'train') { /* auto-releases */ }
    if (!turned && sim.car.s > nd.s - 500) { turned = true; sim.act({ type: 'call.turn', dir: wrong ? 'L' : 'R' }); }
    if (sim.offCourseCount > 0 && !u && (sim as any).off?.phase === 'out' && (sim as any).off.branchDist > 800) { u = true; sim.act({ type: 'call.uturn' }); }
    if (sim.tod > T0 + 4000) break;
  }
  const adv1 = sim.taAdvice(1); const amount = Math.floor(adv1.measuredDelay / 10) * 10;
  sim.act({ type: 'ta.request', legIndex: 1, seconds: Math.max(10, amount), fromLine: 2, toLine: 2 }); const rq = sim.taRequests.at(-1)!;
  const l = sim.result().score.legs[0]!;
  log(`paper ${paper} wrongTurn ${wrong}: offCourse ${sim.offCourseCount}; measured ${adv1.measuredDelay.toFixed(1)} possible ${adv1.possible.toFixed(1)}; request ${rq.status} ${rq.reason ?? ''}; leg raw ${l.rawError} credit ${l.taCredit} error ${l.error} | ${l.taReason}`);
}
