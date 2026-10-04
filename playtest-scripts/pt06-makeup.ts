/** PT-06 area 4: make-up ledger, drops, timedIntervalDisturbed edges. */
import { ScenarioBuilder, Simulator, DRIVER_EXPERT, hms, log, adv, until } from './pt06-common.js';
import { PERFECT_TIMEWISE } from '../src/core/builder.js';
function sc(opts: { holdSpeed?: number; secs?: number; then?: number } = {}) {
  const T0 = hms(8, 0, 0); const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0, skill: 'perfect' } as never, speedo: PERFECT_TIMEWISE, prereadSeconds: 20 }).start(35).advanceMiles(0.5);
  b.timedAt('bridge', { holdSpeed: opts.holdSpeed ?? 35, seconds: opts.secs ?? 90, thenSpeed: opts.then ?? 45 });
  b.advanceMiles(2.5).checkpoint().advanceFt(400).finish(); return b.build();
}
function play(label: string, script: (sim: Simulator, atTimed: () => boolean) => void, s = sc()) {
  const sim = new Simulator(s); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); const timedLine = s.book.find(i => i.timed)!;
  const crossed = () => sim.events.some(e => e.type === 'node' && false) || sim.car.s > 0.5 * 5280 + 1;
  until(sim, () => sim.car.s > 0.5 * 5280 + 2, 400);
  script(sim, crossed);
  const r = sim.result(); log(`${label}: makeUp.begin ${sim.events.filter(e => e.type === 'makeUp.begin').length} end ${sim.events.filter(e => e.type === 'makeUp.end').length} dropped ${sim.makeUpDrops} findings ${r.findings.map(f => f.kind).join(',') || '-'}`);
  void timedLine;
}
play('exact assigned 35', (sim) => { adv(sim, 40); });
play('36 (2.9 %) 40 s', (sim) => { sim.act({ type: 'call.speed', mph: 36 }); adv(sim, 40); });
play('37.5 (7.1 %) 40 s', (sim) => { sim.act({ type: 'call.speed', mph: 37.5 }); adv(sim, 40); });
play('38 (8.6 %, +3) 40 s', (sim) => { sim.act({ type: 'call.speed', mph: 38 }); adv(sim, 40); });
play('37.8 (exactly 8 %, +2.8 mph) 40 s', (sim) => { sim.act({ type: 'call.speed', mph: 37.8 }); adv(sim, 40); });
play('38 for ~2.5 s only after the 4 s grace', (sim) => { adv(sim, 8); sim.act({ type: 'call.speed', mph: 38 }); adv(sim, 2.6); sim.act({ type: 'call.speed', mph: 35 }); adv(sim, 40); });
play('38 for 2 s, 35, 38 for 2 s (cumulative 4 s)', (sim) => { adv(sim, 8); sim.act({ type: 'call.speed', mph: 38 }); adv(sim, 2.0); sim.act({ type: 'call.speed', mph: 35 }); adv(sim, 10); sim.act({ type: 'call.speed', mph: 38 }); adv(sim, 2.5); sim.act({ type: 'call.speed', mph: 35 }); adv(sim, 20); });
play('make-up started before the timed line at the same assigned speed', (sim) => { adv(sim, 0); }, sc());
// make-up started BEFORE the timed line (assigned 35 before and as the hold): called 39 on the approach
{ const s = sc(); const sim = new Simulator(s); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); until(sim, () => sim.car.s > 0.5 * 5280 - 600, 400); sim.act({ type: 'call.speed', mph: 39 }); until(sim, () => sim.car.s > 0.5 * 5280 + 400, 400); adv(sim, 30);
  log('make-up called 600 ft before a timed line whose hold equals the assigned speed: begin', sim.events.filter(e => e.type === 'makeUp.begin').length, 'dropped', sim.makeUpDrops, 'timedIntervalDisturbed', sim.result().findings.filter(f => f.kind === 'timedIntervalDisturbed').length, 'target now', sim.targetIndicated); }
// make-up through a speed-change sign: assigned 35 -> 45 at a sign; navigator at 39 (+11 %); sign must drop the extra
{ const T0 = hms(8, 0, 0); const b = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, speedo: PERFECT_TIMEWISE, prereadSeconds: 20 }).start(35).advanceMiles(1);
  b.speedAtSign('SPEED LIMIT 45', 45); b.advanceMiles(1).speedAtSign('SPEED LIMIT 30', 30); b.advanceMiles(1).checkpoint().advanceFt(400).finish(); const s = b.build();
  const sim = new Simulator(s); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); until(sim, () => sim.car.s > 2000, 400); sim.act({ type: 'call.speed', mph: 39 });
  until(sim, () => sim.car.s > 5280 + 400, 400); log('after the 45 sign: target', sim.targetIndicated, 'makeUp', JSON.stringify(sim.makeUp), 'drops', sim.makeUpDrops);
  sim.act({ type: 'call.speed', mph: 50 }); until(sim, () => sim.car.s > 2 * 5280 + 400, 400); log('after the 30 sign (called 50 = 11 % over 45): target', sim.targetIndicated, 'drops', sim.makeUpDrops, 'makeUp', JSON.stringify(sim.makeUp)); }
