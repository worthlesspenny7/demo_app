/** V4 realism: structure of generated day stages (seeds 1-8). */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { bookLayout } from '../src/ui/viewmodels/book.js';
import { columnCLines } from '../src/core/griid.js';
const seeds = [1,2,3,4,5,6,7,8];
const agg: Record<string, number> = {};
const hist: Record<number, number> = {};
let rowsTot = 0, speedOmitted = 0, speedRows = 0, stops = 0, stopsPause = 0, sig = 0, sigPause = 0, blink = 0, blinkPause = 0, rr = 0, rrPause = 0, pauseNon15 = 0, timedRows = 0;
const pausesVals: Record<number, number> = {};
for (const seed of seeds) {
  const sc = generateStage(seed, PROFILES.fullStage);
  const lay = bookLayout(sc as any);
  const rowsPerPage = lay.starts.map((s, i) => (lay.starts[i + 1] ?? sc.book.length) - s);
  const cps = sc.checkpoints; const tcp = cps.filter(c => c.kind === 'timing').length, ocp = cps.filter(c => c.kind === 'observation').length;
  const book = sc.book; const nodeById = new Map(sc.course.nodes.map(n => [n.id, n]));
  const cal = book.filter(b => b.section === 'calibration');
  const calBoxes = cal.filter(b => !b.calibrationStart && b.perfectInterval !== undefined).length;
  const calStart = book.find(b => b.calibrationStart);
  const calSpeed = calStart?.speed;
  // first timed instruction index vs first timing cp
  const firstRestart = book.findIndex(b => b.restartTime !== undefined);
  const speeds = book.map(b => b.speed).filter((x): x is number => typeof x === 'number');
  for (const b of book) {
    rowsTot++;
    const nd = nodeById.get(b.nodeId);
    if (typeof b.speed === 'number') { speedRows++; hist[b.speed] = (hist[b.speed] ?? 0) + 1; }
    if (b.timed) timedRows++;
    const ctl = nd?.control;
    if (ctl === 'STOP') { stops++; if (b.pause) { stopsPause++; pausesVals[b.pause] = (pausesVals[b.pause] ?? 0) + 1; if (b.pause !== 15) pauseNon15++; } }
    if (ctl === 'SIGNAL') { sig++; if (b.pause) sigPause++; }
    if (ctl === 'BLINKER') { blink++; if (b.pause) blinkPause++; }
    if (ctl === 'RR' || nd?.label?.includes('RR')) { rr++; if (b.pause) rrPause++; }
  }
  const lenMi = sc.course.lengthFt / 5280;
  console.log(JSON.stringify({ seed, name: sc.name, rows: book.length, pages: lay.pages, perPageMin: Math.min(...rowsPerPage), perPageMax: Math.max(...rowsPerPage), miles: +lenMi.toFixed(1), asp: sc.asp, base: sc.baseStartTime, start: sc.startTime, startMinusBase: (sc.startTime - (sc.baseStartTime ?? 0)) / 60, tcp, ocp, calBoxes, calSpeed, calMiles: calStart && (calStart as any).transit?.miles, firstRestart, style: sc.bookStyle, sections: [...new Set(book.map(b => b.section).filter(Boolean))].join(',') }));
  // CP order: positions relative to book rows
  const cpDesc = cps.map(c => ({ kind: c.kind, mi: +(c.s/5280).toFixed(1) }));
  console.log('  cps', JSON.stringify(cpDesc));
  const ta = book.filter(b => b.taPoint).map(b => b.n); const fz = book.filter(b => b.freeZone).map(b => b.freeZone + b.n); const tr = book.filter(b => b.transit).map(b => `${b.n}${b.transit!.end ? 'e' : (b.transit!.exact ? 'X' : 't')}:${Math.round(b.transit!.seconds/60)}m`);
  console.log('  ta', ta.join(','), 'fz', fz.join(','), 'transits', tr.join(' '), 'info', book.filter(b => b.infoBox !== undefined).map(b => b.n).join(','), 'promoted', book.filter(b => b.promotedStop).map(b => b.n + b.promotedStop!.kind).join(','));
}
console.log('speeds hist', JSON.stringify(hist));
console.log({ rowsTot, speedRows, stops, stopsPause, sig, sigPause, blink, blinkPause, rr, rrPause, pauseNon15, timedRows, pausesVals });
