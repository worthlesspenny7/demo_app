/** PT-06: oracle on every drill x tier x 4 seeds: startDeltas, findings (false positives for a perfect navigator), DNF, NaN. */
import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const out: string[] = []; const kinds: Record<string, number> = {};
for (const d of allDrills()) for (let tier = 0; tier < d.tiers.length; tier++) for (const seed of [1, 2, 3, 4]) {
  try {
    const sc = d.scenario(seed, tier); const sim = new Simulator(sc, { watch: (sc.tags ?? []).includes('watch:digital') ? 'digital' : 'analog' });
    const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
    for (const f of r.findings) { const k = `${d.id}:${f.kind}`; kinds[k] = (kinds[k] ?? 0) + 1; if (f.kind !== 'timedIntervalDisturbed') out.push(`${d.id} tier ${tier} seed ${seed} asp ${sc.asp}: ${f.kind} line ${f.line} ${f.seconds ?? ''} ${f.text.slice(0, 90)}`); }
    if (/NaN|Infinity/.test(JSON.stringify(r))) out.push(`${d.id} tier ${tier} seed ${seed}: NaN in result`);
    if (r.dnf) out.push(`${d.id} tier ${tier} seed ${seed}: DNF`);
    for (const sd of r.startDeltas) if (sd.delta === null || Math.abs(sd.delta) > 2.5) out.push(`${d.id} tier ${tier} seed ${seed}: startDelta line ${sd.line} ${sd.kind} delta ${sd.delta}`);
  } catch (e) { out.push(`${d.id} tier ${tier} seed ${seed}: threw ${(e as Error).message}`); }
}
console.log(kinds); console.log(out.join('\n'));
