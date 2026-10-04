/** PT-06 area 9: oracle live run vs replay(); two identical live runs. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator, replay } from '../src/core/sim.js';
import { OracleBot, runBot, makeBot, type BotName } from '../src/agent/bots.js';
import { builtinScenario } from '../src/agent/scenarios.js';
const problems: string[] = [];
const cases: [string, () => ReturnType<typeof generateStage>, BotName][] = [];
for (const seed of [2, 5, 9]) for (const bot of ['oracle', 'rookie', 'noPause', 'lateCall', 'goCount', 'wrongMinute', 'random'] as BotName[]) cases.push([`day ${seed} ${bot}`, () => generateStage(seed, { ...PROFILES.fullStage, asp: seed % 3 }), bot]);
for (const bot of ['oracle', 'rookie', 'random'] as BotName[]) cases.push([`varied ${bot}`, () => builtinScenario('varied', 3), bot]);
for (const [name, mk, bot] of cases) {
  const sc = mk(); const watch = 'digital';
  const run = () => { const sim = new Simulator(sc, { watch }); const r = runBot(sim, makeBot(bot, sim, 7)); return { sim, r }; };
  const A = run(), B = run();
  if (JSON.stringify(A.r) !== JSON.stringify(B.r)) problems.push(`${name}: two live runs differ`);
  try {
    const rep = replay(sc, A.sim.actions, { watch, engineVersion: A.r.engineVersion });
    const ra = JSON.stringify(A.r), rb = JSON.stringify(rep.result());
    if (ra !== rb) { const a = JSON.parse(ra), b = JSON.parse(rb); const keys = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); problems.push(`${name}: replay != live (keys ${keys.join(',')}; live tick ${A.sim.tick} replay tick ${rep.tick}; phase ${A.sim.phase}/${rep.phase})`); }
  } catch (e) { problems.push(`${name}: replay threw ${(e as Error).message}`); }
}
console.log('PROBLEMS', problems.length); console.log(problems.join('\n'));
