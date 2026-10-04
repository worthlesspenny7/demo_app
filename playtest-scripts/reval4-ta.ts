/** V4: Time Allowance rounding, committee credit, window, caps, one-per-leg; formal problem. Generated stages with a train. */
import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
let found = 0;
for (let seed = 1; seed <= 14 && found < 2; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  (bot as any).declareTA = () => {}; // we file ourselves
  let t = 0;
  for (; t < 2_000_000 && sim.phase !== 'finished'; t++) {
    bot.onTick(sim); sim.step(0.1);
    const ta = sim.taState();
    if (ta.windowOpen && ta.eligibleLegs.some(l => (sim.taAdvice(l).measuredDelay ?? 0) >= 10)) break;
  }
  if (sim.phase === 'finished') continue;
  const ta = sim.taState(); const leg = ta.eligibleLegs.find(l => sim.taAdvice(l).measuredDelay >= 10)!; const adv = sim.taAdvice(leg);
  found++;
  console.log(`seed ${seed}: leg ${leg} advice ${JSON.stringify({ measured: adv.measured, stopped: adv.stoppedSeconds, chart: adv.chartLoss, measuredDelay: adv.measuredDelay, recoverable: adv.recoverable, possible: adv.possible, suggested: adv.suggested, makeUp: adv.makeUpToRound })} windowEnds ${(ta.secondsLeft ?? 0).toFixed(0)} s left, eligible ${ta.eligibleLegs}`);
  const from = adv.fromLine ?? 1, to = adv.toLine ?? from;
  const req = (legIndex: number, seconds: number) => { sim.act({ type: 'ta.request', legIndex, seconds, fromLine: from, toLine: to, cause: 'Delayed by train' } as any); const r = sim.taRequests[sim.taRequests.length - 1]!; return `${seconds}->${r.status}${r.status === 'filed' ? ' adj ' + r.adjusted : ' (' + r.reason + ')'}`; };
  console.log('  tiny/odd/huge:', [4, 1780, 0.4].map(s => req(leg, s)).join(' | '));
  console.log('  wrong leg:', req(leg + 5, 30));
  const odd = Math.round(adv.measuredDelay) % 10 === 0 ? adv.measuredDelay + 7 : adv.measuredDelay;
  console.log('  odd amount', odd.toFixed(1), '->', req(leg, Math.round(odd)));
  console.log('  second request same leg:', req(leg, 30));
  // run to end
  for (; sim.phase !== 'finished' && t < 3_000_000; t++) { bot.onTick(sim); sim.step(0.1); }
  const r = sim.result(); const L = r.score.legs[leg - 1]!;
  console.log('  leg score', JSON.stringify({ error: L.error, penalty: L.penalty, ta: L.taReason }), 'requests', JSON.stringify(r.ta.requests.map(x => ({ req: x.requested, adj: x.adjusted, st: x.status }))));
}
