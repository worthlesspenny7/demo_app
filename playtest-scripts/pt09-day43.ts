/** PT-09: day seed 43: first timing checkpoint 118 s after the end of the transit (needs >= 120 s). */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { instructionS } from '../src/core/course.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
const sc = generateStage(43, PROFILES.fullStage); const g = buildGhost(sc); const end = sc.book.find(i => i.n === 10)!; const s0 = instructionS(sc.course, end);
const cp = sc.checkpoints.filter(c => c.kind === 'timing').find(c => c.s > s0)!;
console.log('line 10:', end.text.slice(0, 60), 'speed', end.speed, 'transit', JSON.stringify(end.transit), 'asp', sc.asp);
for (const i of sc.book.filter(b => b.n >= 10 && b.n <= 16)) { const s = instructionS(sc.course, i); console.log(` line ${i.n} s+${(s - s0).toFixed(0)} ft t+${(ghostTimeAt(g, s) - ghostTimeAt(g, s0)).toFixed(1)} s speed ${i.speed} pause ${i.pause ?? ''} ${i.section ?? ''}`); }
console.log(`cp ${cp.id} at s+${(cp.s - s0).toFixed(0)} ft = ${(ghostTimeAt(g, cp.s) - ghostTimeAt(g, s0)).toFixed(1)} s after the transit end row; validator's own bound: ${(end.speed ?? 0) * 1.4667 * 120 | 0} ft`);
