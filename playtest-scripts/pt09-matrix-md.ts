/** PT-09: render the matrix JSON lines as a markdown table. Usage: npx tsx playtest-scripts/pt09-matrix-md.ts files... > table.md */
import { readFileSync } from 'node:fs';
interface Row { drill: string; tier: number; seed: number; bot: string; stars?: number; raw?: number; oc?: number; dnf?: boolean }
const rows: Row[] = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Row));
const BOTS = ['oracle', 'skill', 'rookie', 'noPause', 'goCount', 'wrongMinute', 'noClockReads', 'noCalibration'];
const med = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]!; };
console.log('| Drill | Tier | ' + BOTS.join(' | ') + ' |'); console.log('|---|---|' + BOTS.map(() => '---').join('|') + '|');
for (const d of [...new Set(rows.map(r => r.drill))].sort()) for (const t of [0, 1, 2]) {
  const cells = BOTS.map(b => { const rb = rows.filter(r => r.drill === d && r.tier === t && r.bot === b && r.stars !== undefined).sort((x, y) => x.seed - y.seed); if (!rb.length) return '-'; return `${rb.map(r => r.stars).join('')} (${med(rb.map(r => r.raw ?? 0))}s${rb.some(r => r.dnf) ? ', DNF' + rb.filter(r => r.dnf).length : ''})`; });
  console.log(`| ${d} | ${['B', 'S', 'G'][t]} | ${cells.join(' | ')} |`);
}
