/** PT-09: chart (b) printed cell vs the physical stop & go loss the simulator charges (Ford), per pair. */
import { FORD_1939, PACKARD_1936 } from '../src/core/course.js';
import { buildPerfTable, matrixAt, stopLoss, accelLoss } from '../src/core/perf-table.js';
for (const car of [FORD_1939]) {
  const p = buildPerfTable(car); let worst = 0, sum = 0, n = 0;
  const rows: string[] = [];
  for (const a of [20, 25, 30, 35, 40, 45, 50, 55]) { const cells: string[] = []; for (const b of [20, 25, 30, 35, 40, 45, 50, 55]) { const chart = matrixAt(p.stopGo, a, b); const phys = 15 - stopLoss(a, b, car); const d = chart - phys; worst = Math.max(worst, Math.abs(d)); sum += d; n++; cells.push(d.toFixed(1).padStart(5)); } rows.push(`${String(a).padStart(3)}: ${cells.join(' ')}`); }
  console.log(car.name, 'chart(b) minus (15 - physical stopLoss), rows IN 20..55, cols OUT 20..55'); console.log(rows.join('\n')); console.log('worst', worst.toFixed(2), 'mean', (sum / n).toFixed(2));
  console.log('accelLoss(40)', accelLoss(40, car).toFixed(2), 'accel[0][40]', matrixAt(p.accel, 0, 40), 'decel 40>0', matrixAt(p.accel, 40, 0));
}
