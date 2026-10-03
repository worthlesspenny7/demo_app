import { PACKARD_CHARTS, AGE_FACTOR_ROWS, ageFactorFor } from '../content/reference-data.js';
import { LESSONS } from '../content/lessons.js';
const A: Record<number, (number|null)[]> = {0:[null,1,1.3,1.8,2.9,3.6,4.5,5.6,6.4],15:[1,null,0.3,0.8,1.9,2.6,3.5,4.6,5.4],20:[1.2,0.2,null,0.5,1.6,2.3,3.2,4.3,5.3],25:[1.3,0.3,0.1,null,1.1,1.8,2.7,3.8,4.6],30:[1.9,0.9,0.7,0.6,null,0.7,1.6,2.7,3.5],35:[2,1,0.8,0.7,0.1,null,0.9,2,2.8],40:[2.4,1.4,1.2,1.1,0.5,0.4,null,1.1,1.9],45:[2.8,1.8,1.6,1.5,0.9,0.8,0.4,null,0.8],50:[3.3,2.3,2.1,2,1.4,1.3,0.9,0.5,null]};
let bad = 0; for (const r of PACKARD_CHARTS[0]!.rows) r.values.forEach((v, i) => { if (v !== A[r.label]![i]) { bad++; console.log('accel mismatch', r.label, i); } });
console.log('reference accel mismatches', bad);
// age table from regs
const REG: Record<number, number> = {}; const cols = [[1953,0.915,1952,0.910,1951,0.905,1950,0.900,1949,0.895,1948,0.890,1947,0.885,1946,0.880,1945,0.875,1944,0.870,1943,0.865,1942,0.860,1941,0.855]];
for (let y = 1953; y >= 1941; y--) REG[y] = Math.round((0.915 - (1953 - y) * 0.005) * 1000) / 1000;
for (let y = 1940; y >= 1930; y--) REG[y] = Math.round((0.85 - (1940 - y) * 0.005) * 1000) / 1000;
for (let y = 1929; y >= 1900; y--) REG[y] = Math.round((0.79 - (1929 - y) * 0.01) * 1000) / 1000;
let ab = 0; for (const [y, f] of Object.entries(REG)) if (ageFactorFor(+y) !== f) { ab++; console.log('age mismatch', y, ageFactorFor(+y), f); }
console.log('age rows', AGE_FACTOR_ROWS.length, 'mismatches', ab, '1939', ageFactorFor(1939), '1912', ageFactorFor(1912), '1926', ageFactorFor(1926));
console.log('lessons', LESSONS.map(l => `${l.id}(${l.minutes}m)`).join(', '));
