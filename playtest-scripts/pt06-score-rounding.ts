/** PT-06 area 6: stage score = raw x age factor rounded to the nearest 0.01 s (REG V.C.2.e): float error rounds exact .xx5 halves DOWN for the 1939 factor. */
import { scoreStage, scoreLeg } from '../src/core/scoring.js';
import { DEFAULT_RULES } from '../src/core/course.js';
import type { Leg } from '../src/core/ghost.js';
const leg = { index: 1, cpId: 'cp1', perfectTod: 0, perfectDuration: 600, cumulativePerfect: 600 } as unknown as Leg;
const rows: string[] = []; let bad = 0;
for (const raw of [5, 23, 41, 47, 7, 9]) {
  const l = scoreLeg({ leg, record: { cpId: 'cp1', kind: 'timing', actualTod: 1000 + 600 + raw, rawTod: 1000 + 600 + raw, sightViolation: false }, anchorActual: 1000, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
  const s = scoreStage([l], 1939, DEFAULT_RULES, { observationMissed: false }).score; const exact = Math.floor((raw * 845 + 5) / 10) / 100; if (s !== exact) bad++;
  rows.push(`raw ${raw} x 0.845 = ${raw * 0.845} -> score ${s} (round-half-up to 0.01 = ${exact})`);
}
console.log(rows.join('\n')); console.log('mismatches', bad);
