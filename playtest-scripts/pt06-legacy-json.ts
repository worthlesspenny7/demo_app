/** PT-06 area 8: a scenario file written before V2/V3 (no asp, timeZone, bookStyle, partial rules) loaded through `--scenario file:`. */
import { simpleStart, Simulator, adv, log } from './pt06-common.js';
import { validateScenario } from '../src/core/course.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const base = JSON.parse(JSON.stringify(simpleStart(0, 3, 2, 60)));
for (const [label, mut] of [['no asp', (s: any) => { delete s.asp; }], ['no asp/timeZone/baseStartTime/bookStyle', (s: any) => { delete s.asp; delete s.timeZone; delete s.baseStartTime; delete s.bookStyle; }], ['rules without maxLate/maxEarly/missedCheckpoint', (s: any) => { s.rules = { sightZonePenalty: 30 }; }], ['no rules', (s: any) => { delete s.rules; }]] as const) {
  const sc = JSON.parse(JSON.stringify(base)); mut(sc);
  try {
    const v = validateScenario(sc); const sim = new Simulator(sc); const bot = new OracleBot(sim, { useWatch: true }); sim.act({ type: 'start' }); adv(sim, 30);
    const o = sim.observe({ peek: true }); const r = runBot(sim, bot);
    log(`${label}: validate ${v.length ? v.join(';') : 'clean'} | pace cars at +30 s: ${JSON.stringify(o.paceCars)} queue ${JSON.stringify(sim.startQueue(sc.book[0]).cars.map(c => c.position))} | result raw ${r.score.raw} score ${r.score.score} legs ${JSON.stringify(r.score.legs.map(l => l.penalty))}`);
  } catch (e) { log(`${label}: threw ${(e as Error).message.slice(0, 120)}`); }
}
