/** RE-VALIDATION: 20-seed star distributions for oracle (fairness of gates). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
for (const id of (process.argv[2] ?? 'D03,D04,D05,D08,D08b,D18,D11,D07').split(',')) for (const t of [0, 2]) {
  const c = [0, 0, 0, 0]; for (let s = 1; s <= 20; s++) { const d = drillById(id)!; const sc = d.scenario(s, t); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); c[d.rubric(r, sc).stars]!++; }
  console.log(`${id} t${t} oracle 20 seeds: 0*:${c[0]} 1*:${c[1]} 2*:${c[2]} 3*:${c[3]}`);
}
