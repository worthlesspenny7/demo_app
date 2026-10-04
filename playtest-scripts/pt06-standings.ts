/** PT-06 area 6: compareStandings uses !== on float totals (sums of 0.01-rounded stage scores): a true tie is broken by float noise instead of REG V.C.2.f(2) (older Scoring Year first). */
import { rankStandings } from '../src/core/scoring.js';
const a = { name: 'older-1920', total: 0.1 + 0.2, scoringYear: 1920 }, b = { name: 'younger-1930', total: 0.3, scoringYear: 1930 };
console.log('expected order: older-1920 first (equal totals); actual:', rankStandings([b, a]).map(s => s.name).join(', '));
const stage = [10.1, 20.2, 30.3].reduce((x, y) => x + y, 0), other = 60.6;
console.log('sum of stage scores 10.10 + 20.20 + 30.30 =', stage, 'vs', other, stage === other ? 'equal' : 'NOT equal (float)');
