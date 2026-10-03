/** V2 revalidation: compare buildPerfTable(PACKARD_1936 / FORD_1939) with the handbook tables (08-rookie-handbook-body.md section 3). */
import { FORD_1939, PACKARD_1936 } from '../src/core/course.js';
import { buildPerfTable } from '../src/core/perf-table.js';
const HB_A: Record<number, Record<number, number>> = {
 0:{15:1,20:1.3,25:1.8,30:2.9,35:3.6,40:4.5,45:5.6,50:6.4},
 15:{0:1,20:0.3,25:0.8,30:1.9,35:2.6,40:3.5,45:4.6,50:5.4},
 20:{0:1.2,15:0.2,25:0.5,30:1.6,35:2.3,40:3.2,45:4.3,50:5.3},
 25:{0:1.3,15:0.3,20:0.1,30:1.1,35:1.8,40:2.7,45:3.8,50:4.6},
 30:{0:1.9,15:0.9,20:0.7,25:0.6,35:0.7,40:1.6,45:2.7,50:3.5},
 35:{0:2,15:1,20:0.8,25:0.7,30:0.1,40:0.9,45:2,50:2.8},
 40:{0:2.4,15:1.4,20:1.2,25:1.1,30:0.5,35:0.4,45:1.1,50:1.9},
 45:{0:2.8,15:1.8,20:1.6,25:1.5,30:0.9,35:0.8,40:0.4,50:0.8},
 50:{0:3.3,15:2.3,20:2.1,25:2,30:1.4,35:1.3,40:0.9,45:0.5}};
const OUT=[15,20,25,30,35,40,45,50];
const HB_B: number[][] = [[13,12.7,12.2,11.1,10.4,9.5,8.4,7.6],[12.8,12.5,12,10.9,10.2,9.3,8.2,7.4],[12.7,12.4,11.9,10.8,10.1,9.2,8.1,7.3],[12.1,11.8,11.3,10.2,9.5,8.6,7.5,6.7],[12,11.7,11.2,10.1,9.4,8.5,7.4,6.6],[11.6,11.3,10.8,9.7,9,8.1,7,6.2],[11.2,10.9,10.4,9.3,8.6,7.7,6.6,5.8],[10.7,10.4,9.9,8.8,8.1,7.2,6.1,5.3]];
const HB_C: number[][] = [[0,0.3,0.8,1.9,2.6,3.5,4.6,5.4],[0.2,0.5,1,2.1,2.8,3.7,4.8,5.6],[0.3,0.6,1.1,2.2,2.9,3.8,4.9,5.7],[0.9,1.2,1.7,2.8,3.5,4.4,5.5,6.3],[1,1.3,1.8,2.9,3.6,4.5,5.6,6.4],[1.4,1.7,2.2,3.3,4,4.9,6,6.8],[1.8,2.1,2.6,3.7,4.4,5.3,6.4,7.2],[2.3,2.6,3.1,4.2,4.9,5.8,6.9,7.7]];
const IN=[15,20,25,30,35,40,45,50];
const t = buildPerfTable(PACKARD_1936);
let bad: string[] = []; let n = 0;
for (const r of Object.keys(HB_A).map(Number)) for (const c of Object.keys(HB_A[r]!).map(Number)) { n++; const v = t.accel.rows[r]?.[c]; if (v !== HB_A[r]![c]) bad.push(`A ${r}>${c} engine ${v} hb ${HB_A[r]![c]}`); }
IN.forEach((r,i)=>OUT.forEach((c,j)=>{ n++; const v=t.stopGo.rows[r]?.[c]; if (v!==HB_B[i]![j]) bad.push(`B ${r}>${c} engine ${v} hb ${HB_B[i]![j]}`); n++; const w=t.turns.rows[r]?.[c]; if (w!==HB_C[i]![j]) bad.push(`C ${r}>${c} engine ${w} hb ${HB_C[i]![j]}`); }));
console.log(`PACKARD cells compared ${n}, mismatches ${bad.length}`); console.log(bad.slice(0,20).join('\n'));
console.log('Packard speeds accel', t.accel.speeds.join(','), 'stopGo', t.stopGo.speeds.join(','), 'turns', t.turns.speeds.join(','));
console.log('Packard 55 row/col sample: accel 0>55', t.accel.rows[0]?.[55], 'stopGo 30>55', t.stopGo.rows[30]?.[55], 'turns 55>30', t.turns.rows[55]?.[30]);
// Ford: self-consistency
const f = buildPerfTable(FORD_1939);
let incons: string[] = []; let m = 0;
for (const r of f.stopGo.speeds) for (const c of f.stopGo.speeds) { m++; const exp = Math.max(0, Math.round((15 - f.accel.rows[r]![0]! - f.accel.rows[0]![c]!) * 10) / 10); if (Math.abs(f.stopGo.rows[r]![c]! - exp) > 0.051) incons.push(`${r}>${c} stopGo ${f.stopGo.rows[r]![c]} vs 15-${f.accel.rows[r]![0]}-${f.accel.rows[0]![c]} = ${exp}`); }
console.log(`FORD stopGo cells ${m}, inconsistent ${incons.length}`, incons.slice(0,6).join(' | '));
const fmt = (M: any) => M.speeds.map((c: number)=>String(c).padStart(5)).join('') + '\n' + M.speeds.map((r:number)=> String(r).padStart(3)+ M.speeds.map((c:number)=>String(M.rows[r]?.[c] ?? '').padStart(5)).join('')).join('\n');
console.log('FORD accel (rows in, cols out; 0 included)\n' + fmt(f.accel));
console.log('FORD stopGo\n' + fmt(f.stopGo));
console.log('FORD turns\n' + fmt(f.turns));
console.log('Ford 0>40', f.accel.rows[0]![40], 'Ford 40>0', f.accel.rows[40]![0], 'Ford 30>40 stop&go', f.stopGo.rows[30]![40], 'Ford 40>35 turn', f.turns.rows[40]![35]);
// monotonic sanity checks for Ford vs Packard
let nonmono: string[] = [];
for (const r of f.accel.speeds) { let prev=-1; for (const c of f.accel.speeds) { if (c<=r) continue; const v=f.accel.rows[r]![c]!; if (v < prev-0.05) nonmono.push(`accel row ${r} dec at ${c}`); prev=v; } }
console.log('Ford accel monotone-in-OUT violations', nonmono.length, nonmono.slice(0,5).join('; '));
