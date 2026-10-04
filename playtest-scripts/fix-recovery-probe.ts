/** Fix sprint PT-09 M3: hazard loss vs cruise recovery per bot on D08/D18 (and the stars). Usage: npx tsx playtest-scripts/fix-recovery-probe.ts D08 [seeds] */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const id = process.argv[2] ?? 'D08'; const N = Number(process.argv[3] ?? 10); const d = drillById(id)!;
const bots: Record<string, (s: Simulator) => OracleBot> = { oracle: s => new OracleBot(s, { useWatch: true }), rookie: s => new OracleBot(s, { ignoreLosses: true }), noPause: s => new OracleBot(s, { forgetPauses: true }) };
for (let tier = 0; tier < 3; tier++) for (const [name, mk] of Object.entries(bots)) {
  const row: string[] = [];
  for (let seed = 1; seed <= N; seed++) { const sc = d.scenario(seed, tier); const sim = new Simulator(sc); const r = runBot(sim, mk(sim)); const rb = d.rubric(r, sc);
    const t: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) t[k] = (t[k] ?? 0) + v;
    const mu = r.events.filter(e => e.type === "makeUp.begin" || e.type === "call.over").length; const owed = Math.max(0, t.hazard ?? 0) + Math.max(0, t.turn ?? 0) + Math.max(0, t.speedChange ?? 0) + Math.max(0, t.start ?? 0); row.push(`${rb.stars}(o${Math.round(owed)} mu${mu} h${Math.round(t.hazard ?? 0)} c${Math.round(t.cruise ?? 0)} s${Math.round(t.stop ?? 0)} m${rb.score})`); }
  console.log(id, ['B', 'S', 'G'][tier], name.padEnd(8), row.join(' '));
}
