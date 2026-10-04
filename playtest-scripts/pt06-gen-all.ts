/** PT-06 area 7 extension: every profile x 30 seeds (and the day with asp 1..8): validateScenario + checkRouteExits clean, oracle finishes without DNF and with a sane score. */
import { generateStage, generateLeg, PROFILES, checkRouteExits } from '../src/core/generator/generate.js';
import { validateScenario } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const problems: string[] = []; const stats: Record<string, { n: number; raw: number; max: number }> = {};
const profiles = Object.entries(PROFILES).filter(([k]) => k !== 'fullStage') as [string, typeof PROFILES.fullLeg][];
const N = Number(process.argv[2] ?? 30);
for (const [name, p] of profiles) for (let seed = 1; seed <= N; seed++) {
  try {
    const sc = generateLeg(seed, p);
    const v = validateScenario(sc); const e = checkRouteExits(sc); if (v.length || e.length) problems.push(`${name} ${seed}: ${[...v, ...e].join('; ')}`);
    const sim = new Simulator(sc, { watch: 'digital' }); const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
    const st = (stats[name] ??= { n: 0, raw: 0, max: 0 }); st.n++; st.raw += res.score.raw; st.max = Math.max(st.max, res.score.raw);
    if (sim.phase !== 'finished' || res.dnf || res.score.raw > 60) problems.push(`${name} ${seed}: oracle raw ${res.score.raw} dnf ${res.dnf} phase ${sim.phase} legs ${res.score.legs.map(l => l.error).join('/')}`);
    const nan = JSON.stringify(res).includes('null,') && /NaN/.test(JSON.stringify(res)); void nan;
  } catch (e) { problems.push(`${name} ${seed}: threw ${(e as Error).message}`); }
}
for (let asp = 1; asp <= 8; asp++) for (const seed of [1, 2, 3]) {
  try {
    const sc = generateStage(seed, { ...PROFILES.fullStage, asp, timeZone: asp % 2 ? 'CDT' : 'EDT' } as never);
    const v = validateScenario(sc); if (v.length) problems.push(`day asp ${asp} seed ${seed}: ${v.join('; ')}`);
    const sim = new Simulator(sc, { watch: 'digital' }); const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
    const bad = res.score.legs.filter(l => l.extras.missed).length; const first = res.startDeltas[0]!;
    if (sim.phase !== 'finished' || res.dnf || bad || res.score.raw > 60 || Math.abs(first.delta ?? 99) > 1 || res.startDeltas.some(d => d.delta === null || Math.abs(d.delta) > 2)) problems.push(`day asp ${asp} seed ${seed}: raw ${res.score.raw} dnf ${res.dnf} missed ${bad} startDeltas ${res.startDeltas.map(d => d.delta).join(',')} findings ${res.findings.map(f => f.kind).join(',')}`);
  } catch (e) { problems.push(`day asp ${asp} seed ${seed}: threw ${(e as Error).message}`); }
}
console.log(Object.entries(stats).map(([k, v]) => `${k}: mean raw ${(v.raw / v.n).toFixed(1)} max ${v.max}`).join('\n')); console.log('PROBLEMS', problems.length); console.log(problems.join('\n'));
