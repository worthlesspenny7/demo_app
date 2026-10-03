import { Simulator } from '../src/core/sim.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { OracleBot } from '../src/agent/bots.js';
import { instructionS } from '../src/core/course.js';
import { formatInterval } from '../src/core/griid.js';
for (const mode of ['no-laps', 'laps', 'laps+clock', 'double-lap']) {
  const sc = generateStage(1, PROFILES.fullStage); const sim = new Simulator(sc, { watch: 'digital' }); const bot = new OracleBot(sim, { useWatch: false });
  const cal = sc.book.filter(i => i.section === 'calibration').map(i => ({ ins: i, s: instructionS(sc.course, i), done: false }));
  let t = 0; let lastClock = -99; const lapTimes: number[] = [];
  while (sim.phase !== 'finished' && t < 40000 && sim.car.s < cal[cal.length - 1]!.s + 3000) {
    if (mode !== 'no-laps') for (const c of cal) if (!c.done && sim.car.s >= c.s - 5) { c.done = true; if (c.ins.calibrationStart) { sim.act({ type: 'watch.reset' } as any); sim.act({ type: 'watch.start' } as any); } else { sim.act({ type: 'watch.lap' } as any); if (mode === 'double-lap') sim.act({ type: 'watch.lap' } as any); } }
    if (mode === 'laps+clock' && sim.tod - lastClock > 20) { lastClock = sim.tod; sim.act({ type: 'clock.read' }); }
    bot.onTick(sim); sim.step(0.1); t += 0.1; }
  const r = sim.result();
  const lt = (sim.observe().stopwatch as any).lapTable as { interval: number; cumulative: number }[];
  console.log(mode, 'findings:', r.instrumentDiscipline.filter(f => f.line <= 11).map(f => f.kind + '@' + f.line).join(',') || 'none', '| watch laps', lt.length, lt.slice(0, 3).map(x => formatInterval(x.interval, true) + '/' + formatInterval(x.cumulative, true)).join(' '), '| printed', sc.book.filter(i => i.section === 'calibration' && !i.calibrationStart).slice(0, 3).map(i => formatInterval(i.perfectInterval!, true) + '/' + formatInterval(i.perfectCumulative!, true)).join(' '));
}
