/** Probe: can the D14 deck produce duplicate option texts (kind 0: loss == pause - loss)? */
import { stopLoss } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';
const speeds = [25, 30, 35, 40, 45, 50];
for (const p of [15, 20, 30]) for (const v of speeds) for (const w of speeds) {
  const loss = Math.round(stopLoss(v, w, FORD_1939) * 10) / 10; const d = Math.max(0, Math.round((p - loss) * 10) / 10);
  const opts = [`${d.toFixed(1)} s`, `${p} s`, `${(p + loss).toFixed(1)} s`, `${loss.toFixed(1)} s`];
  if (new Set(opts).size < 4) console.log(`DUPLICATE options: P${p} ${v}->${w} loss ${loss}:`, opts);
}
for (const v of speeds) { const spm = 3600 / v; const o = [`${spm.toFixed(1)} s`, `${(3600 / (v + 5)).toFixed(1)} s`, `${(spm * 1.1).toFixed(1)} s`, `${(v * 1.5).toFixed(1)} s`]; if (new Set(o).size < 4) console.log('DUP spm', v, o); }
for (const v of speeds) for (let late = 3; late <= 12; late++) { const f = v / 5 + 1; const t = Math.round(late * f); const o = [`${t} s`, `${Math.round(late * (v / 10 + 1))} s`, `${late * 5} s`, `${Math.round(late * f * 1.5)} s`]; if (new Set(o).size < 4) console.log('DUP recovery', v, late, o); }
console.log('math-dupes probe done');
