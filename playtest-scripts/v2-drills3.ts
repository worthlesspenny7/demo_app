import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot, type BotName } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
await registerAll();
for (const id of ['D12', 'D13', 'D11', 'D16', 'D18', 'D08b']) {
  for (const t of [0, 1, 2]) {
    const out: string[] = [];
    for (const b of ['oracle', 'rookie', 'noPause'] as BotName[]) {
      const res: string[] = [];
      for (const seed of [1, 2]) { const d = drillById(id)!; const sc = d.scenario(seed, t); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, makeBot(b, sim, seed), 16 * 3600); const ru = d.rubric(r, sc); res.push(`${ru.stars}*(${r.score.raw}s raw)`); }
      out.push(`${b}: ${res.join(' ')}`);
    }
    console.log(id, 'tier', t, out.join(' | '));
  }
}
