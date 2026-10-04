import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { columnCLines } from '../src/core/griid.js';
let n = 0, delayed = 0, chain = 0, restartTimed = 0, rows = 0, stopTimed = 0; const secs: number[] = [];
for (let seed = 1; seed <= 12; seed++) { const sc = generateStage(seed, PROFILES.fullStage); for (const b of sc.book) { rows++; if (b.timed) { n++; secs.push(b.timed.seconds); if (b.timed.delayed) delayed++; if (b.restartTime !== undefined) restartTimed++; if (b.pause) stopTimed++; if (columnCLines(b).filter(l => /^\d+ MPH$/.test(l)).length > 3) chain++; } } }
console.log({ rows, timed: n, pct: (100 * n / rows).toFixed(1), delayed, chain, restartTimed, stopTimed, minSec: Math.min(...secs), maxSec: Math.max(...secs) });
