/** PT-06 area 2: ta.request validation at / outside TA points, rounding both ways, duplicates, tiny amounts, ack ordering, request after the finish. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log } from './pt06-common.js';
import { OracleBot } from '../src/agent/bots.js';
import { Session } from '../src/agent/protocol.js';
const T0 = hms(8, 0, 0);
function trainStage(trainSeconds = 140, endOfStage = true, transitMiles = 0.6) {
  const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 } }).start(35).advanceMiles(0.5);
  b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
  b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: trainSeconds });
  b.advanceMiles(1.0).checkpoint().advanceFt(500);
  b.endTimedPortion({ endOfStage, transit: { exact: false, seconds: 120, miles: transitMiles } }).advanceMiles(transitMiles).observationFinish();
  return b.build();
}
function toWindow(sc: ReturnType<typeof trainStage>) { const sim = new Simulator(sc); const bot = new OracleBot(sim, { noRecovery: true }); (bot as any).declareTA = () => {}; sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); } return { sim, bot }; }
{ const { sim } = toWindow(trainStage());
  const m = sim.taQualifying[1]!; log('measured', m.toFixed(1));
  const req = (seconds: number) => { sim.act({ type: 'ta.request', legIndex: 1, seconds, fromLine: 2, toLine: 2 }); const r = sim.taRequests[sim.taRequests.length - 1]!; return `${seconds}->${r.status}${r.status === 'filed' ? ' adj ' + r.adjusted : ' (' + r.reason + ')'}`; };
  log('tiny/odd amounts:', [0.4, 3, 4.9, 5, 9.99, 10, 10.5, 1769.9, 1770, 1770.5, 1771].map(req).join(' | '));
  log('declared per leg', JSON.stringify(sim.taDeclared), 'requests', sim.taRequests.length, 'filed', sim.taRequests.filter(r => r.status === 'filed').length);
}
{ const { sim } = toWindow(trainStage());
  sim.act({ type: 'ta.request', legIndex: 1, seconds: 100, fromLine: 2, toLine: 2 }); sim.act({ type: 'ta.request', legIndex: 1, seconds: 10, fromLine: 2, toLine: 2 });
  log('duplicate request for one leg: filed rows', sim.taRequests.filter(r => r.status === 'filed').map(r => r.adjusted).join(','), 'taDeclared', JSON.stringify(sim.taDeclared)); }
{ // ack ordering and requests after ack
  const { sim } = toWindow(trainStage()); sim.act({ type: 'scorecard.ack' }); sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2, toLine: 2 }); log('ack first, then a request: acked', sim.scorecardAcked, 'request', sim.taRequests[sim.taRequests.length - 1]!.status); }
{ // request AFTER the finish (window still open because time stops): result() peeking
  const { sim, bot } = toWindow(trainStage(140, true, 0.3)); while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
  const before = sim.result().score.legs[0]!; sim.act({ type: 'ta.request', legIndex: 1, seconds: 40, fromLine: 2, toLine: 2 }); const after = sim.result().score.legs[0]!;
  log(`after finish (window secondsLeft ${sim.taState().secondsLeft?.toFixed(0)}): request ${sim.taRequests.at(-1)!.status}; leg error ${before.error} -> ${after.error}; reason: ${after.taReason}`); }
{ // leg numbers: legNumberFor around the checkpoint
  const { sim } = toWindow(trainStage()); const rec = sim.records.find(r => r.kind === 'timing')!; log('legNumberFor before/at/after cp', sim.legNumberFor(rec.rawTod! - 0.01), sim.legNumberFor(rec.rawTod!), sim.legNumberFor(rec.rawTod! + 0.01), 'future tod', sim.legNumberFor(sim.tod + 1e5), 'now', sim.legNumberFor()); }
{ // Session level: ta.request with legIndex as string, huge, negative
  const { sim } = toWindow(trainStage()); const sess = new Session(sim.sc); (sess as any).sim = sim;
  for (const a of [{ legIndex: '1', seconds: 30, fromLine: 2, toLine: 2 }, { legIndex: 1.5, seconds: 30, fromLine: 2, toLine: 2 }, { legIndex: 1, seconds: 30, fromLine: 2.5, toLine: 2.5 }, { legIndex: 1, seconds: 30, fromLine: 2, toLine: 99999 }]) { const r = sess.handle({ type: 'act', action: { type: 'ta.request', ...a } as any }); log('ta.request', JSON.stringify(a), '->', r.type, r.type === 'error' ? (r as any).message : sim.taRequests.at(-1)!.status + ' ' + (sim.taRequests.at(-1)!.reason ?? '')); } }
