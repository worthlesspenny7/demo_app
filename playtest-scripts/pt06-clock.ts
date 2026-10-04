/** PT-06 area 5: clock minuteAmbiguous edges; hands leak. */
import { RallyClock, Stopwatch } from '../src/core/stopwatch.js';
const log = console.log;
const c = new RallyClock(5, 0);
const base = 3600 * 9 + 600;
log('slop 5:', [0, 4.9, 4.99999, 5, 5.00001, 54.99999, 55, 55.00001, 55.1, 59.9, 60].map(s => `${s}:${c.minuteAmbiguous(base + s) ? 'AMB' : 'ok'}`).join(' '));
for (const slop of [0, 1, 30, 60]) { const cc = new RallyClock(slop, 0); const amb = Array.from({ length: 600 }, (_, i) => cc.minuteAmbiguous(base + i * 0.1)).filter(Boolean).length / 600 * 100; log(`slop ${slop}: ambiguous ${amb.toFixed(1)}% of a minute`); }
// does hourAngle leak the exact time?
const h = c.hands(base + 58.3); const secs = (h.hourAngle / 30) * 3600; log('hourAngle', h.hourAngle, '-> seconds past 12:00', secs.toFixed(1), 'true', ((base + 58.3) % 43200).toFixed(1), 'minute field', h.minute, 'amb', h.minuteAmbiguous);
// stopwatch: split hold auto release edge, lap/recall, reset
const w = new Stopwatch('digital', 60, 5); w.start(0); w.lap(10);
log('frozen at 14.99/15/15.0000001', w.isFrozen(14.99), w.isFrozen(15), w.isFrozen(15.0000001), 'reading@12', w.reading(12), 'reading@16', w.reading(16));
// recall after auto release steps into lap recall and pins the display
w.recall(16); log('recall after auto-release: recalled', w.recalled, 'reading@20', w.reading(20), '(live elapsed would be 20)');
// lap table across reset
const w2 = new Stopwatch('digital', 60, 0); w2.start(0); w2.lap(5); w2.lap(12); w2.stop(15); w2.reset(15); w2.start(20); w2.lap(23); w2.lap(31); log('lapTable after reset', JSON.stringify(w2.lapTable()));
// stop/start continues; lap table interval
const w3 = new Stopwatch('digital', 60, 0); w3.start(0); w3.lap(5); w3.stop(6); w3.start(100); w3.lap(104); log('stop/start gap', JSON.stringify(w3.lapTable()));
// lap on a stopped, never-started watch
const w4 = new Stopwatch('digital', 60, 0); w4.lap(10); log('lap on a never-started watch stores', JSON.stringify(w4.laps));
