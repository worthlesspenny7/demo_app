/** V2 revalidation: exact-transit OUT early/late probe; >30 min late = missed (180); sight-zone; STOP skip refusal. */
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot } from '../src/agent/bots.js';
import { registerAll } from './v2-reg.js';
import { drillById } from '../src/core/drills/registry.js';
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import { accelLoss } from '../src/core/perf-table.js';
import { departuresOf } from '../src/core/drills/departures.js';
import { formatClock } from '../src/core/units.js';
await registerAll();
console.log('== exact-transit OUT probe (D16 seed 2): shift the oracle go by -60 / 0 / +45 s');
for (const off of [-60, 0, 45]) {
  const sc = drillById('D16')!.scenario(2, 0); const sim = new Simulator(sc, { watch: 'digital' }); const bot = makeBot('oracle', sim, 2)!;
  const orig = sim.holdGoTod.bind(sim);
  (sim as any).holdGoTod = (node: any) => { const g = orig(node); const ins = sc.book.find(i => i.nodeId === node.id); return g !== null && ins?.transit?.end && ins.transit.exact ? g + off : g; };
  const r = runBot(sim, bot);
  const deps = departuresOf(r, sc);
  console.log(`off ${off}: legs ${r.score.legs.map(l => `${l.error}(pen ${l.penalty})`).join(', ')} | dep errs ${deps.map(d => d.kind + ':' + d.err.toFixed(0)).join(',')} | raw ${r.score.raw}`);
}
console.log('== >30 min late = missed (180): STOP at 2 mi, hold the car 35 min');
{
  const T0 = 8 * 3600;
  const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(2).stop('S', 30, { pause: 0, noPause: true }).advanceMiles(2).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
  const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' });
  let t = 0; let went = false;
  while (sim.phase !== 'finished' && t < 40000) {
    if (sim.waitingForGo && !went && sim.tod - (sim.waitStartTod ?? 0) > 35 * 60) { went = true; sim.act({ type: 'call.go' }); }
    sim.step(0.1); t += 0.1; }
  const r = sim.result();
  console.log('legs', r.score.legs.map(x => `err ${x.error} raw ${x.rawError} pen ${x.penalty} missed ${x.extras.missed}`).join(' | '), 'raw', r.score.raw, 'dnf', r.score.dnf, r.score.dnfReason ?? '');
}
console.log('== Never-reached final CP (abort the run) -> result');
{
  const T0 = 8 * 3600;
  const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(1).checkpoint().advanceMiles(1).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
  const sim = new Simulator(sc); sim.tod = sc.startTime - accelLoss(30, sc.car); sim.act({ type: 'start' });
  let t = 0; while (sim.car.s < 6000 && t < 4000) { sim.step(0.1); t += 0.1; }
  const r = sim.result(); console.log('mid-run result phase', sim.phase, 'legs', r.score.legs.map(x => `err ${x.error} pen ${x.penalty} missed ${x.extras.missed}`).join(' | '), 'raw', r.score.raw, 'dnf', r.score.dnf, r.score.dnfReason ?? '');
}
console.log('== STOP sign skip refusal');
{
  const T0 = 8 * 3600;
  const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE }).start(30).advanceMiles(0.5).stop('S', 30, { noPause: true }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
  const sim = new Simulator(sc); sim.tod = sc.startTime - 5; sim.act({ type: 'start' });
  let t = 0; while (!sim.waitingForGo && t < 600) { sim.step(0.1); t += 0.1; }
  console.log('waiting', sim.waitingForGo, 'reason', sim.waitReason);
  const evs0 = sim.observe().driver.messages.map(m => m.text);
  console.log('driver msgs', evs0.join(' | '));
  for (const a of [{ type: 'call.go' }] as any[]) { sim.act(a); }
  console.log('after call.go (immediate, no pause): waitingForGo', sim.waitingForGo);
}
