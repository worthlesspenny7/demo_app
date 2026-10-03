import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot, type BotName } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { allDrills } from '../src/core/drills/registry.js';
await registerAll();
const seeds = [1, 2, 3];
const bots: BotName[] = ['oracle', 'rookie', 'noPause'];
for (const d of allDrills()) {
  const row: string[] = [];
  for (const b of bots) {
    const stars: number[] = [];
    for (const t of [0, 1, 2]) for (const seed of seeds) {
      try { const sc = d.scenario(seed, t); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, makeBot(b, sim, seed), 6 * 3600); const ru = d.rubric(r, sc); stars.push(ru.stars); } catch (e) { stars.push(-1); }
    }
    row.push(`${b}:${stars.join('')}`);
  }
  console.log(d.id.padEnd(5), d.title.padEnd(32), row.join('  '));
}
