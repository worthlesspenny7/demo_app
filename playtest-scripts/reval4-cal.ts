import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { instructionS } from '../src/core/course.js';
import { mphToFps } from '../src/core/units.js';
import { columnCLines, formatInterval } from '../src/core/griid.js';
let maxErr = 0;
for (let seed = 1; seed <= 8; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  const cal = sc.book.filter(i => i.section === 'calibration'); const st = cal.find(i => i.calibrationStart)!; const v = st.speed!;
  let prev = instructionS(sc.course, st), cum = 0; const rows: string[] = [];
  for (const i of cal) { if (i.calibrationStart) continue; const s = instructionS(sc.course, i); const iv = (s - prev) / mphToFps(v); cum += iv; prev = s;
    maxErr = Math.max(maxErr, Math.abs(iv - (i.perfectInterval ?? NaN)), Math.abs(cum - (i.perfectCumulative ?? NaN))); rows.push(`${i.perfectInterval?.toFixed(1)}/${i.perfectCumulative?.toFixed(1)}`); }
  const last = cal[cal.length - 1]!; const tr = sc.book.find(b => b.transit?.end && sc.book.indexOf(b) > sc.book.indexOf(last));
  console.log(`seed ${seed} @${v} mph official ${columnCLines(st).join(' / ')} boxes ${rows.join(' ')} lastRowC [${columnCLines(last).join(' / ')}] ${(st as any).transit ? 'start transit ' + JSON.stringify((st as any).transit) : ''}`);
}
console.log('max err', maxErr.toFixed(3));
