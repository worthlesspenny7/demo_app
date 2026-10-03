import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
await registerAll();
for (const [id, seed, tier] of [['D16', 3, 0], ['D12', 1, 0], ['D12', 1, 2], ['D13', 1, 0]] as const) {
  const d = drillById(id)!; const sc = d.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' });
  const t0 = Date.now(); const r = runBot(sim, makeBot('oracle', sim, seed), 14 * 3600); const ru = d.rubric(r, sc);
  console.log(`--- ${id} seed ${seed} tier ${tier} rows ${sc.book.length} phase ${sim.phase} ms ${Date.now() - t0} stars ${ru.stars} score ${ru.score} headline ${ru.headline}`);
  console.log(ru.feedback.slice(0, 8).join('\n').slice(0, 1800));
  console.log('stage score', r.score.score, 'raw', r.score.raw, 'dnf', r.score.dnf, r.score.dnfReason ?? '', 'legs', r.score.legs.length, 'missed', r.score.legs.filter(l => l.extras.missed).length);
}
