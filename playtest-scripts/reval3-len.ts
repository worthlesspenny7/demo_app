/** RE-VALIDATION v3: claimed minutes vs simulated driving minutes and book length per drive drill (tier 0, seed 1..3). */
import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
for (const d of allDrills().filter(x => x.kind === 'drive' && x.id !== 'D13')) {
  const out: string[] = [];
  for (const s of [1, 2, 3]) { const sc = d.scenario(s, 0); const sim = new Simulator(sc, (sc.tags ?? []).includes('watch:digital') ? { watch: 'digital' } : {}); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); out.push(`${sc.book.length} lines, ${(r.drivingSeconds / 60).toFixed(0)} min driving, preread ${sc.prereadSeconds}s, ${sc.checkpoints.filter(c => c.kind === 'timing').length} timing CPs`); }
  console.log(d.id.padEnd(5), `card ${String(d.minutes).padStart(4)} min |`, out.join(' | '));
}
