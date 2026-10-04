/** Fix sprint PT-09 M3: D04 call errors at the STOP + timed lines per bot. Usage: npx tsx playtest-scripts/fix-d04-probe.ts [seeds] */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { callErrors } from '../src/core/drills/rubrics.js';
const d = drillById('D04')!; const N = Number(process.argv[2] ?? 10);
for (let tier = 0; tier < 3; tier++) for (const [name, o] of [['oracle', { useWatch: true }], ['goCount', { goCount: true }], ['rookie', { ignoreLosses: true }]] as const) {
  const row: string[] = [];
  for (let seed = 1; seed <= N; seed++) { const sc = d.scenario(seed, tier); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, o as never)); const rb = d.rubric(r, sc);
    const e = callErrors(r, sc, 'timed', 5, i => !!i.pause); row.push(`${rb.stars}(${e.map(x => x.toFixed(1)).join(',')})`); }
  console.log(['B', 'S', 'G'][tier], name.padEnd(8), row.join(' '));
}
