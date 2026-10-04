/**
 * PT-09 area 5: determinism after the keyed RNG change. For every bot x 20 seeds x several scenario families:
 *  (a) two live runs give identical result() JSON, (b) replay(actions) equals the live result, (c) extra observe() peeks do not change the run,
 *  (d) cross-traffic holds at a STOP are identical for every bot (keyed by seed + node), (e) step chunking (0.1 vs 1.0 vs 0.37) does not matter for a bot-less run.
 * Usage: npx tsx playtest-scripts/pt09-determinism.ts [seeds=20]
 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { generateLeg, generateStage, PROFILES } from '../src/core/generator/generate.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { Simulator, replay } from '../src/core/sim.js';
import { OracleBot, RandomBot, runBot, type Bot } from '../src/agent/bots.js';
import type { Scenario } from '../src/core/course.js';

const N = Number(process.argv[2] ?? 20);
const BOTS: Record<string, (s: Simulator, seed: number) => Bot> = {
  oracle: s => new OracleBot(s, { useWatch: true }), rookie: s => new OracleBot(s, { ignoreLosses: true }), noPause: s => new OracleBot(s, { forgetPauses: true }),
  lateCall: s => new OracleBot(s, { latency: 1.5 }), goCount: s => new OracleBot(s, { goCount: true }), wrongMinute: s => new OracleBot(s, { useWatch: true, wrongMinute: true }),
  noClockReads: s => new OracleBot(s, { useWatch: true, noClockReads: true }), noCalibration: s => new OracleBot(s, { useWatch: true, noCalibration: true }), random: (s, seed) => new RandomBot(s, seed),
};
const families: Record<string, (seed: number) => Scenario> = {
  varied: seed => builtinScenario('varied', seed),
  D18g: seed => drillById('D18')!.scenario(seed, 2),
  D03g: seed => drillById('D03')!.scenario(seed, 2),
  D16s: seed => drillById('D16')!.scenario(seed, 1),
  fullLeg: seed => generateLeg(seed, { ...PROFILES.fullLeg, trafficWaitProbability: 0.5 } as never),
};
const problems: string[] = []; let runs = 0; let replays = 0;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const keysDiff = (a: unknown, b: unknown): string => { const x = JSON.parse(JSON.stringify(a)), y = JSON.parse(JSON.stringify(b)); return Object.keys(x).filter(k => !same(x[k], y[k])).join(','); };
const holds = new WeakMap<Simulator, Map<string, number>>();
const play = (sc: Scenario, bot: string, seed: number, peek = false) => {
  const sim = new Simulator(sc, { watch: 'digital' }); const b = BOTS[bot]!(sim, seed); let t = 0; const hm = new Map<string, number>(); holds.set(sim, hm);
  while (sim.phase !== 'finished' && t < 12 * 3600) { b.onTick(sim); if (peek) { sim.observe({ peek: true }); sim.pace(); } sim.step(0.1); t += 0.1;
    const any = sim as unknown as { waitReason: string | null; curStop?: { nodeId: string } | null; trafficClearTod: number };
    if (sim.waitingForGo && any.waitReason === 'stop' && any.curStop && !hm.has(any.curStop.nodeId)) hm.set(any.curStop.nodeId, Math.max(0, Math.round((any.trafficClearTod - sim.tod) * 5) / 5)); }
  if (sim.phase === 'finished' && sc.rules.taMode === 'paper') b.onTick(sim);
  return { sim, r: sim.result() };
};
const trafficHolds = (sim: Simulator): string => JSON.stringify([...(holds.get(sim) ?? new Map())].sort());

for (const [fam, mk] of Object.entries(families)) {
  const holdsBy = new Map<number, Map<string, string>>();
  for (let seed = 1; seed <= N; seed++) {
    const sc = mk(seed);
    for (const bot of Object.keys(BOTS)) {
      const label = `${fam} seed ${seed} ${bot}`;
      try {
        const A = play(sc, bot, seed), B = play(sc, bot, seed); runs += 2;
        if (!same(A.r, B.r)) problems.push(`${label}: two live runs differ (keys ${keysDiff(A.r, B.r)})`);
        const rep = replay(sc, A.sim.actions, { watch: 'digital', engineVersion: A.r.engineVersion }); replays++;
        if (!same(A.r, rep.result())) problems.push(`${label}: replay != live (keys ${keysDiff(A.r, rep.result())}; ticks ${A.sim.tick}/${rep.tick})`);
        if (seed <= 4 && bot !== 'random') { const P = play(sc, bot, seed, true); if (!same(A.r, P.r)) problems.push(`${label}: observe() peeks change the run (keys ${keysDiff(A.r, P.r)})`); }
        let m = holdsBy.get(seed); if (!m) holdsBy.set(seed, m = new Map()); m.set(bot, trafficHolds(A.sim));
      } catch (e) { problems.push(`${label}: threw ${(e as Error).message.slice(0, 100)}`); }
    }
  }
  // (d) cross-traffic holds identical across bots (only over the nodes each reached)
  let diverged = 0, total = 0, withTraffic = 0;
  for (const [seed, m] of holdsBy) { total++; const base = new Map<string, number>(JSON.parse(m.get('oracle')!)); if ([...base.values()].some(x => x > 0)) withTraffic++;
    for (const [bot, hs] of m) { if (bot === 'random') continue; const mine = new Map<string, number>(JSON.parse(hs)); for (const [node, h] of mine) { const o = base.get(node); if (o !== undefined && Math.abs(o - h) > 0.45) { diverged++; problems.push(`${fam} seed ${seed}: traffic hold at ${node} differs ${bot} ${h} vs oracle ${o}`); } } } }
  console.log(`${fam}: seeds ${total}, with traffic holds ${withTraffic}, divergent bots ${diverged}`);
}
// (e) chunking
for (const seed of [1, 2, 3, 4, 5]) {
  const sc = builtinScenario('varied', seed);
  const go = (dt: number) => { const sim = new Simulator(sc, { watch: 'digital' }); const b = new OracleBot(sim, { useWatch: true }); let t = 0; while (sim.phase !== 'finished' && t < 7200) { b.onTick(sim); sim.step(dt); t += dt; } return sim.result(); };
  const A = go(0.1), B = go(0.1);
  if (!same(A, B)) problems.push(`chunking baseline differs seed ${seed}`);
  // an idle (no bot) run stepped in different chunk sizes must reach the same state
  const idle = (dt: number) => { const sim = new Simulator(sc, { watch: 'digital' }); sim.act({ type: 'start' } as never); let t = 0; while (t < 300) { sim.step(dt); t += dt; } return [sim.tick, sim.car.s.toFixed(3), sim.car.v.toFixed(4)].join('|'); };
  const a = idle(0.1), b = idle(1), c = idle(0.5), d = idle(2.5); if (!(a === b && b === c && c === d)) problems.push(`idle chunking differs seed ${seed}: ${a} / ${b} / ${c} / ${d}`);
}
console.log(`runs ${runs}, replays ${replays}`); console.log('PROBLEMS', problems.length); console.log(problems.slice(0, 40).join('\n'));
