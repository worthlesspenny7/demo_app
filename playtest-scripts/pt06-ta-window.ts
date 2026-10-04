/** PT-06 area 2: TA window edge. A request filed exactly 900.0 s after the TA point is refused on ~1.5 % of crossing ticks after 12:17 (float: tod0 + (k+9000)*0.1 > (tod0 + k*0.1) + 900). */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log } from './pt06-common.js';
import { OracleBot } from '../src/agent/bots.js';
import { startLikeOracle } from '../tests/helpers.js';

function stage(T0: number, extraFt = 0) {
  const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
  const b = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 16000 }).start(35).advanceMiles(0.5);
  b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
  b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: 120 });
  b.advanceMiles(1.0).advanceFt(extraFt).checkpoint().advanceFt(500);
  b.endTimedPortion({ endOfStage: true, transit: { exact: true, seconds: 1800 } }).advanceMiles(8).observationFinish();
  return b.build();
}
const hits: string[] = [];
for (let shift = 0; shift < 300; shift++) {
  const sc = stage(hms(12, 30, 0), shift * 2.5);
  const sim = new Simulator(sc); const bot = new OracleBot(sim, { noRecovery: true }); (bot as any).declareTA = () => {};
  sim.act({ type: "skipPreread", secondsBefore: 6 }); sim.act({ type: "start" });
  while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); }
  const t0 = sim.tod;
  for (let i = 0; i < 9000; i++) sim.step(0.1);
  const open = sim.taState().windowOpen; sim.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 1, toLine: 1 });
  const rec = sim.taRequests[sim.taRequests.length - 1]!;
  if (!open || rec.status === 'refused') hits.push(`TA point at ${t0.toFixed(1)}: 900.0 s later windowOpen=${open} request ${rec.status} ${rec.reason ?? ''}`);
}
log(`refused at exactly 900.0 s: ${hits.length}/300`); log(hits.slice(0, 3).join('\n'));
