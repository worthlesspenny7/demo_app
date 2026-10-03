import { Simulator } from '../src/core/sim.js';
import { OracleBot } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
await registerAll();
for (const seed of [1, 2, 3]) {
  const d = drillById('D16')!; const sc = d.scenario(seed, 0); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: true });
  let t = 0; let lastRead = -99;
  while (sim.phase !== 'finished' && t < 40000) {
    if (sim.tod - lastRead > 20) { lastRead = sim.tod; sim.act({ type: 'clock.read' }); }
    bot.onTick(sim); sim.step(0.1); t += 0.1; }
  const r = sim.result(); const ru = d.rubric(r, sc);
  console.log('seed', seed, 'stars', ru.stars, ru.headline, '| findings', r.instrumentDiscipline.map(f => f.kind + '@' + f.line).join(','));
}
