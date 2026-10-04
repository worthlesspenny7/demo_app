import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds) {
  const sc = generateStage(seed, PROFILES.fullStage);
  const sim = new Simulator(sc, { watch: 'digital' });
  const res = runBot(sim, new OracleBot(sim, { useWatch: true }));
  console.log(`seed ${seed} asp ${sc.asp} raw ${res.score.raw} aids rung ${sc.aids.rung} driver ${sc.driver.skill} speedo ${sc.speedo.kind} tags ${sc.tags?.join(',')}`);
  for (const l of res.score.legs) console.log(`  leg ${l.index} raw ${l.rawError} err ${l.error} taCredit ${l.taCredit} pen ${l.penalty}`);
  const kinds: Record<string, number> = {}; for (const f of res.instrumentDiscipline) { kinds[f.kind] = (kinds[f.kind] ?? 0) + 1; }
  console.log('  discipline', JSON.stringify(kinds));
  for (const f of res.instrumentDiscipline.slice(0, 4)) console.log('   ', f.kind, f.line, f.text.slice(0, 120));
  for (const f of res.findings) console.log('  finding', f.kind, f.line, f.text.slice(0, 100));
  for (const d of res.startDeltas) console.log('  startDelta', JSON.stringify(d));
  for (const a of res.attribution) { const b = Object.entries(a.buckets).filter(([, v]) => Math.abs(v) > 0.5).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '); console.log('  attr leg', a.legIndex, b); }
}
