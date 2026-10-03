/** EDUCATION validation: how often does the best-practice bot fail to earn 3 stars (seed fairness / unwinnable seeds). */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot } from '../src/agent/bots.js';
const ids = (process.argv[2] ?? 'D03,D04,D05,D07,D08,D10,D16,D18,D11').split(',');
for (const id of ids) for (const t of [0, 1, 2]) {
  const d = drillById(id)!; const hist = [0, 0, 0, 0]; const bad: string[] = [];
  for (let s = 1; s <= 20; s++) { const sc = d.scenario(s, t); const sim = new Simulator(sc); const r = runBot(sim, makeBot((process.argv[3] ?? 'oracle') as any, sim, s)); const rb = d.rubric(r, sc); hist[rb.stars]!++; if (rb.stars <= 1) bad.push(`s${s}[${r.score.legs.map(l => l.error).join(',')}]`); }
  console.log(`${id} t${t}: 0*=${hist[0]} 1*=${hist[1]} 2*=${hist[2]} 3*=${hist[3]}  ${bad.slice(0, 6).join(' ')}`);
}
