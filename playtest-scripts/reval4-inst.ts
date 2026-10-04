/** V4 realism: loose minute hand, stopwatch TOD mode, clock reads, WATCH-009 findings. */
import { Simulator } from '../src/core/sim.js';
import { simpleStart, aidsRung } from './pt06-common.js';
for (const rung of [0, 1, 3]) {
  const sc = simpleStart(0, rung, 3, 600);
  const sim = new Simulator(sc, { watch: 'digital' });
  const rows: string[] = [];
  // step through a minute change in the preread: sample every second from -8 to +8 s around a minute boundary
  const t0 = sim.tod; const nextMin = Math.ceil((t0 + 20) / 60) * 60;
  while (sim.tod < nextMin - 8.05) sim.step(0.1);
  while (sim.tod <= nextMin + 8.05) {
    const c = sim.observe().clock;
    rows.push(`${(sim.tod - nextMin).toFixed(0)}:${c.minute === null ? 'amb' : c.minute}/${c.minuteAngle.toFixed(1)}`);
    for (let i = 0; i < 20; i++) sim.step(0.1);
  }
  console.log(`rung ${rung} clockMinuteSlop ${sc.rules.clockMinuteSlop}:`, rows.join(' '));
}
// stopwatch TOD mode
const sc = simpleStart(0, 1, 3, 600); const sim = new Simulator(sc, { watch: 'digital' });
for (let i = 0; i < 50; i++) sim.step(0.1);
const before = sim.observe().stopwatch;
sim.act({ type: 'watch.mode', mode: 'tod' } as any);
const o = sim.observe();
console.log('watch kind', before.kind, 'mode after', o.stopwatch.mode, 'reading', o.stopwatch.reading, 'tod', o.tod.toFixed(1));
console.log('clock.read from stopwatch', JSON.stringify(sim.act({ type: 'clock.read', source: 'stopwatch' } as any)));
console.log('digital seconds shown to .01:', JSON.stringify((o.stopwatch as any).display ?? null));
console.log('bezel clock options:', JSON.stringify((sim as any).sc.rules));
