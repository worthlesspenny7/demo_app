import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { DRIVER_EXPERT, DRIVER_DAD_ROOKIE, FORD_1939, type Scenario } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
import { stopLoss } from '../src/core/perf-table.js';
import { OracleBot, RandomBot, makeBot, runBot } from '../src/agent/bots.js';
import { rng } from '../src/core/rng.js';

const T0 = hms(8, 0, 0);

/** A varied leg: 2 stops, a landmark speed change, a timed segment, a turn at a T, one CP. */
function variedLeg(seed: number, driver = DRIVER_EXPERT, speedo = PERFECT_TIMEWISE): Scenario {
  const r = rng(seed);
  const b = new ScenarioBuilder({ startTime: T0, seed, driver, speedo });
  b.start(r.pick([30, 35, 40]));
  b.advanceMiles(0.4 + r.next()).stop(r.pick(['L', 'R', 'S']), r.pick([30, 35, 40]));
  b.advanceMiles(0.3 + r.next()).speedAtSign('SPEED LIMIT 45', 45);
  b.advanceMiles(0.3 + r.next()).timedAt('bridge', { holdSpeed: 30, seconds: 20 + r.int(0, 40), thenSpeed: 40 });
  b.advanceMiles(0.5 + r.next()).instruction({ exits: EXITS.tee('L'), sightDistance: 600 }, { turn: 'L', speed: 35 });
  b.advanceMiles(0.4 + r.next()).stop('R', 40);
  b.advanceMiles(0.3 + r.next()).checkpoint();
  b.advanceFt(400).finish();
  return b.build();
}
function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; }

describe('bots and validation targets', () => {
  it('BOT-001 oracle with expert driver scores <= 3 s per checkpoint (median over 10 seeds)', () => {
    const pens: number[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new Simulator(variedLeg(seed));
      const r = runBot(sim, new OracleBot(sim));
      expect(r.score.legs.length).toBe(1);
      expect(r.offCourseCount).toBe(0);
      pens.push(r.score.legs[0]!.penalty);
    }
    expect(median(pens)).toBeLessThanOrEqual(3);
  });
  it('BOT-002 rookie bot (ignores losses) is >= 5 s worse per stop than oracle', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const o = runBot(new Simulator(sc), makeBot('oracle', new Simulator(sc)) && new OracleBot(new Simulator(sc)));
    const simO = new Simulator(sc); const ro = runBot(simO, new OracleBot(simO));
    const simR = new Simulator(sc); const rr = runBot(simR, new OracleBot(simR, { ignoreLosses: true }));
    void o;
    expect(rr.score.legs[0]!.error! - ro.score.legs[0]!.error!).toBeGreaterThanOrEqual(2 * 5);
  });
  it('BOT-003 noPause bot is early by about pause - stopLoss (4..10 s) on a single-stop leg', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { forgetPauses: true }));
    const expected = -(15 - stopLoss(35, 35, FORD_1939));
    expect(r.score.legs[0]!.error!).toBeLessThanOrEqual(-4); expect(r.score.legs[0]!.error!).toBeGreaterThanOrEqual(-10);
    expect(Math.abs(r.score.legs[0]!.error! - expected)).toBeLessThanOrEqual(2);
  });
  it('BOT-004 random bot never crashes the simulator (20 seeds)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = new Simulator(variedLeg(seed, DRIVER_DAD_ROOKIE));
      const r = runBot(sim, new RandomBot(sim, seed), 1800);
      expect(r.score.raw).toBeGreaterThanOrEqual(0);
    }
  });
  it('VAL-001 a 1% high speedometer uncorrected costs 8-10 s over a 15-minute leg', () => {
    // 15 min at 40 mph = 10 miles. Speedo reads 1% high -> car runs 1% slow -> ~9 s late.
    const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, speedo: { ...PERFECT_TIMEWISE, gain: 1.01 } }).start(40).advanceMiles(10).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { noRecovery: true }));
    expect(r.score.legs[0]!.error!).toBeGreaterThanOrEqual(8); expect(r.score.legs[0]!.error!).toBeLessThanOrEqual(10);
    const a = r.attribution[0]!;
    expect(a.buckets.cruise).toBeGreaterThan(7); expect(a.meanSpeedRatio).toBeLessThan(0.995);
  });
  it('VAL-002 a wrong turn costs at the next CP only; the following leg is clean', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, excursionFt: 1500 }).start(35).advanceMiles(0.5)
      .instruction({ exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', speed: 35 })
      .advanceMiles(0.7).checkpoint().advanceMiles(0.8).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const bot = new OracleBot(sim);
    // sabotage: call a right turn at the crossroads, then u-turn 20 s later
    let turned = false, uturned = false;
    while (sim.phase !== 'finished') {
      bot.onTick();
      if (!turned && sim.phase === 'running' && sim.car.s > 2300) { sim.act({ type: 'call.turn', dir: 'R' }); turned = true; }
      if (sim.offCourseCount > 0 && !uturned && sim.observe().driver.state === 'offcourse' && sim.tod > (sim.events.find(e => e.type === 'offCourse')?.tod ?? 0) + 20) { sim.act({ type: 'call.uturn' }); uturned = true; }
      sim.step(0.1);
    }
    const r = sim.result();
    expect(r.score.legs[0]!.error!).toBeGreaterThan(50);
    expect(Math.abs(r.score.legs[1]!.error!)).toBeLessThanOrEqual(3);
    expect(r.attribution[0]!.buckets.offCourse).toBeGreaterThan(40);
  });
});

describe('attribution', () => {
  it('ATTR-001 buckets sum to the leg error within 1.5 s', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const sim = new Simulator(variedLeg(seed)); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: seed % 2 === 0 }));
      const a = r.attribution[0]!; const sum = Object.values(a.buckets).reduce((x, y) => x + y, 0);
      expect(Math.abs(sum - r.score.legs[0]!.error!)).toBeLessThanOrEqual(1.5);
    }
  });
  it('ATTR-002 ignoring stop loss on one Pause 15 lands 5-12 s in the stop bucket', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 } }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
    const a = r.attribution[0]!;
    expect(a.buckets.stop).toBeGreaterThanOrEqual(5); expect(a.buckets.stop).toBeLessThanOrEqual(12);
    expect(Math.abs(a.buckets.cruise)).toBeLessThan(1.5);
  });
  it('ATTR-003 1% speedo error shows up as cruise', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: { ...DRIVER_EXPERT, inconsistency: 0 }, speedo: { ...PERFECT_TIMEWISE, gain: 1.01 } }).start(40).advanceMiles(10).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { noRecovery: true }));
    expect(r.attribution[0]!.buckets.cruise).toBeGreaterThanOrEqual(7.5); expect(r.attribution[0]!.buckets.cruise).toBeLessThanOrEqual(10.5);
  });
  it('ATTR-004 excursion time lands in offCourse', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, excursionFt: 1000 }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', speed: 35 }).advanceMiles(0.7).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const bot = new OracleBot(sim);
    let turned = false, ut = false;
    while (sim.phase !== 'finished') { bot.onTick(); if (!turned && sim.phase === 'running' && sim.car.s > 2300) { sim.act({ type: 'call.turn', dir: 'R' }); turned = true; } if (sim.offCourseCount && !ut && sim.observe().driver.state === 'offcourse' && (sim as unknown as { off: { branchDist: number } }).off?.branchDist > 500) { sim.act({ type: 'call.uturn' }); ut = true; } sim.step(0.1); }
    const r = sim.result(); const a = r.attribution[0]!;
    expect(a.buckets.offCourse).toBeGreaterThan(30);
    expect(a.buckets.offCourse / r.score.legs[0]!.error!).toBeGreaterThan(0.8);
  });
});
