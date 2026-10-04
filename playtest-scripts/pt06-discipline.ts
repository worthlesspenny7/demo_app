/** PT-06 area 5: instrumentDiscipline false positives. Count findings by kind and by section of the anchoring line for the shipped oracle on generated days, and for a hand-played perfect navigator. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const agg: Record<string, number> = {}; const sections: Record<string, number> = {};
for (let seed = 1; seed <= 12; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  for (const watch of ['digital', 'analog'] as const) {
    const sim = new Simulator(sc, { watch }); const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
    for (const f of res.instrumentDiscipline) { const ins = sc.book.find(i => i.n === f.line)!; const k = `${watch}:${f.kind}:${ins.section ?? 'none'}`; agg[k] = (agg[k] ?? 0) + 1; }
  }
  for (const i of sc.book) if (i.pause || i.timed) { const k = `${i.pause ? 'pause' : 'timed'} in ${i.section ?? 'none'}`; sections[k] = (sections[k] ?? 0) + 1; }
}
console.log(agg); console.log(sections);
