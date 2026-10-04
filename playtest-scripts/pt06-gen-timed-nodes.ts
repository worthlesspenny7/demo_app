/** PT-06 area 7: no timed segment may reach past ANY node that stops or turns the car (not only the next printed line with speed/pause/turn/timed); also hazards (signals, trains, slow zones) inside the interval. */
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { instructionS } from '../src/core/course.js';
const bad: string[] = []; let timedN = 0;
for (let seed = 1; seed <= 50; seed++) {
  const sc = generateStage(seed, PROFILES.fullStage);
  sc.book.forEach((ins, i) => {
    if (!ins.timed) return; timedN++;
    const s0 = instructionS(sc.course, ins); const reach = s0 + ins.timed.holdSpeed * 1.4666667 * ins.timed.seconds;
    for (const n of sc.course.nodes) if (n.s > s0 + 5 && n.s <= reach + 1) {
      const nin = sc.book.find(b => b.nodeId === n.id);
      if (n.control === 'STOP' || n.control === 'SIGNAL' || n.control === 'RR' || n.control === 'YIELD' || n.control === 'BLINKER') bad.push(`seed ${seed} timed line ${ins.n} (${ins.timed.holdSpeed} mph x ${ins.timed.seconds} s): control ${n.control} node ${n.id} inside the interval (line ${nin?.n ?? 'unprinted'})`);
      else if (n.kind === 'intersection' && (n.exits ?? []).some(e => e.isRoute && Math.abs(e.angle) >= 20)) bad.push(`seed ${seed} timed line ${ins.n}: turn node ${n.id} inside the interval (line ${nin?.n ?? 'unprinted'})`);
    }
    for (const h of sc.hazards) { const hs = (h as any).s as number; const len = (h as any).lengthFt ?? 0; if (hs !== undefined && hs + len > s0 && hs <= reach) bad.push(`seed ${seed} timed line ${ins.n}: hazard ${h.kind} at ${Math.round(hs - s0)} ft inside the interval`); }
  });
}
console.log('timed segments', timedN, 'problems', bad.length); console.log(bad.slice(0, 20).join('\n'));
