/** PT-09: aggregate the matrix JSON lines into per-drill tables and flags. Usage: npx tsx playtest-scripts/pt09-matrix-report.ts file1.jsonl file2.jsonl ... */
import { readFileSync } from 'node:fs';
interface Row { drill: string; tier: number; seed: number; bot: string; stars?: number; score?: number; raw?: number; oc?: number; dnf?: boolean; findings?: string[]; disc?: string[]; tip?: string; err?: string }
const rows: Row[] = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Row));
const drills = [...new Set(rows.map(r => r.drill))].sort(); const BOTS = ['oracle', 'skill', 'rookie', 'noPause', 'goCount', 'wrongMinute', 'noClockReads', 'noCalibration'];
const NAIVE = ['rookie', 'noPause', 'goCount', 'wrongMinute', 'noClockReads', 'noCalibration'];
const med = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1]! : NaN; };
const flags: string[] = []; const errs = rows.filter(r => r.err);
console.log(`rows ${rows.length}, errors ${errs.length}`); for (const e of errs.slice(0, 10)) console.log('ERR', e.drill, e.tier, e.seed, e.bot, e.err);
const T = ['B', 'S', 'G'];
const best: Record<string, Record<string, number>> = {};   // drill -> bot -> best Silver star (for gates)
for (const d of drills) {
  console.log(`\n### ${d}   (stars by seed 1-10 | median raw s | off-course | DNF)`);
  for (const t of [0, 1, 2]) {
    const rt = rows.filter(r => r.drill === d && r.tier === t); if (!rt.length) continue;
    for (const b of BOTS) {
      const rb = rt.filter(r => r.bot === b && r.stars !== undefined).sort((x, y) => x.seed - y.seed); if (!rb.length) continue;
      const stars = rb.map(r => r.stars).join(''); const raw = med(rb.map(r => r.raw ?? NaN)); const oc = rb.reduce((a, r) => a + (r.oc ?? 0), 0); const dnf = rb.filter(r => r.dnf).length;
      const mx = Math.max(...rb.map(r => r.stars!)); const mn = Math.min(...rb.map(r => r.stars!));
      console.log(`${T[t]} ${b.padEnd(13)} ${stars.padEnd(10)} raw ${String(raw).padStart(4)}  oc ${oc} dnf ${dnf}`);
      if (NAIVE.includes(b)) { const n3 = rb.filter(r => r.stars === 3).length; if (n3 > 0) flags.push(`NAIVE-3: ${d} ${T[t]} ${b}: ${n3}/${rb.length} seeds reach 3 stars (${stars})`); }
      if (t === 1) { (best[d] ??= {})[b] = mx; }
      if (b === 'oracle' && t === 0 && mn < 3) flags.push(`ORACLE<3 at Bronze: ${d} ${b}: ${stars} (seeds with <3: ${rb.filter(r => r.stars! < 3).map(r => `${r.seed}:${r.stars}/${r.raw}s${r.oc ? '/oc' + r.oc : ''}`).join(' ')})`);
      if (b === 'skill' && t === 0 && mn < 3) flags.push(`SKILL<3 at Bronze: ${d} ${b}: ${stars}`);
    }
  }
}
console.log('\n### Flags'); console.log(flags.join('\n'));
// gates at Silver for a naive team: stars needed
const GATES: [string, number, string][] = [['D03', 2, 'D18'], ['D04', 2, 'D18'], ['D05', 2, 'D18'], ['D08', 2, 'D18'], ['D10', 2, 'D18'], ['D16', 1, 'D18'], ['D18', 1, 'D11'], ['D07', 2, 'D11'], ['D11', 1, 'D12'], ['D15', 1, 'D12'], ['D16', 2, 'D12'], ['D12', 1, 'D13'], ['D06', 1, 'Gold D03/D04/D05']];
console.log('\n### Gates a naive team passes at Silver (best of 10 seeds / per-seed count)');
for (const [dr, need, opens] of GATES) {
  for (const b of NAIVE) { const rb = rows.filter(r => r.drill === dr && r.tier === 1 && r.bot === b && r.stars !== undefined); if (!rb.length) continue; const pass = rb.filter(r => r.stars! >= need).length; if (pass) console.log(`${dr} >= ${need} (opens ${opens}): ${b} passes in ${pass}/${rb.length} seeds (${rb.sort((x, y) => x.seed - y.seed).map(r => r.stars).join('')})`); }
}
