/** PT-09: why does the oracle miss 3 stars on a drill seed? Usage: tsx pt09-why.ts D10 0 2 */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const [id, tier, seed] = [process.argv[2]!, Number(process.argv[3]), Number(process.argv[4])];
const d = drillById(id)!; const sc = d.scenario(seed, tier); const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); const rb = d.rubric(r, sc);
console.log(`${id} t${tier} s${seed}: stars ${rb.stars} raw ${r.score.raw} legs ${r.score.legs.map(l => l.error).join('/')} oc ${r.offCourseCount} findings ${r.findings.map(f => f.kind)} disc ${r.instrumentDiscipline.map(f => f.kind)}`);
for (const a of r.attribution) console.log(' leg', a.legIndex, JSON.stringify(Object.fromEntries(Object.entries(a.buckets).filter(([, v]) => Math.abs(v) >= 0.5).map(([k, v]) => [k, +v.toFixed(1)]))), 'stops', a.stops.map(s => `${s.line}:${s.pause}/${s.actualCost.toFixed(1)}`).join(' '));
console.log(' tip:', rb.tip?.slice(0, 200)); console.log(' hazards:', sc.hazards.map(h => h.kind).join(','), '| tags', (sc.tags ?? []).join(','));
