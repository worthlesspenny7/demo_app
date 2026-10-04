/** PT-06 area 3/5: D16 with oracle (no oneMinuteMistake false positive) and the wrongMinute bot (must flag), seeds 1-30, tiers 0-2. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot } from '../src/agent/bots.js';
const d = drillById('D16')!; const out: string[] = []; let wm = 0, wmFlag = 0, orFlag = 0, n = 0;
for (let tier = 0; tier < d.tiers.length; tier++) for (let seed = 1; seed <= 30; seed++) {
  const sc = d.scenario(seed, tier);
  for (const bot of ['oracle', 'wrongMinute'] as const) {
    const sim = new Simulator(sc, { watch: 'digital' }); const r = runBot(sim, makeBot(bot, sim, seed)); n++;
    const one = r.findings.filter(f => f.kind === 'oneMinuteMistake');
    if (bot === 'oracle' && one.length) { orFlag++; out.push(`oracle flagged tier ${tier} seed ${seed}: ${one.map(f => f.text.slice(0, 60)).join(';')}`); }
    if (bot === 'wrongMinute') { wm++; if (one.length) wmFlag++; else out.push(`wrongMinute NOT flagged tier ${tier} seed ${seed}: startDeltas ${r.startDeltas.map(x => `${x.line}:${x.delta}`).join(',')} stars ${d.rubric(r, sc).stars}`); }
    const fd = r.instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay'); if (bot === 'oracle' && fd.length) out.push(`oracle clockForTimeOfDay tier ${tier} seed ${seed}: ${fd.map(f => f.line).join(',')}`);
  }
}
console.log(`runs ${n}; oracle false positives ${orFlag}; wrongMinute flagged ${wmFlag}/${wm}`); console.log(out.join('\n'));
