/** PT-09: why does the oracle score >= 14 raw on some 'day' seeds? Buckets per leg, TA, findings. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const seeds = (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20').split(',').map(Number);
for (const seed of seeds) {
  const sc = generateStage(seed, PROFILES.fullStage); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
  if (r.score.raw < 14) continue;
  const tot: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) tot[k] = (tot[k] ?? 0) + v;
  console.log(`seed ${seed} raw ${r.score.raw} legs ${r.score.legs.map(l => l.error).join('/')} TA ${r.score.legs.map(l => l.taCredit ?? 0).join('/')} tags ${(sc.tags ?? []).filter(t => /train|trap:missing|delay/.test(t)).join(',')} buckets ${Object.entries(tot).filter(([, v]) => Math.abs(v) >= 1).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(' ')} findings ${r.findings.map(f => f.kind).join(',')} hazards ${sc.hazards.map(h => h.kind).join(',')}`);
}
