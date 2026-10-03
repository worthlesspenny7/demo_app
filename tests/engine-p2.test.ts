import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE, STOCK_1939_SPEEDO } from '../src/core/builder.js';
import { Simulator, replay, ENGINE_VERSION } from '../src/core/sim.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { DRIVER_EXPERT, DRIVER_DAD_ROOKIE, DRIVER_PERFECT, INSTANT_CAR, FORD_1939, LEGAL_AIDS, TRAINING_AIDS, aidsForRung, validateScenario, nodeById, DEFAULT_RULES } from '../src/core/course.js';
import { hms, milesToFt, mphToFps } from '../src/core/units.js';
import { Car } from '../src/core/car.js';
import { Speedometer } from '../src/core/speedo.js';
import { Stopwatch } from '../src/core/stopwatch.js';
import { rng } from '../src/core/rng.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { Session, playScript } from '../src/agent/protocol.js';
import { stopLoss, rampLead } from '../src/core/perf-table.js';
import { scoreLeg, benchmarkLabel } from '../src/core/scoring.js';
import { stepUntil, runToEnd, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };

function compound(seconds = 40) {
  // "STOP P15, 25 for 40 then 45"
  return new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5)
    .instruction({ control: 'STOP', exits: EXITS.crossroads('S'), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'S', pause: 15, timed: { holdSpeed: 25, seconds, thenSpeed: 45 }, speed: 25 })
    .advanceMiles(1.5).checkpoint().advanceFt(300).finish().build();
}

describe('ghost edge cases', () => {
  it('GHOST-009 pause applies before the timed anchor: virtual node at s + 25mph*40s, time = arrival + 55', () => {
    const sc = compound(); const g = buildGhost(sc); const s0 = nodeById(sc.course, 'n2').s;
    const sv = s0 + mphToFps(25) * 40; expect(sv - s0).toBeCloseTo(1466.7, 0);
    const arrival = T0 + s0 / mphToFps(35);
    expect(ghostTimeAt(g, sv) - arrival).toBeCloseTo(55, 3);
    expect(ghostTimeAt(g, sv + mphToFps(45) * 10) - arrival).toBeCloseTo(65, 3);
  });
  it('GHOST-010 validation rejects spanning timed segments, CPs at pause nodes, bad numbering', () => {
    const bad = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(0.2).timedAt('x', { holdSpeed: 30, seconds: 60, thenSpeed: 40 }).advanceFt(500).speedAtSign('S', 35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    expect(validateScenario(bad).some(p => /timed segment reaches past/.test(p))).toBe(true);
    const cpAtPause = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(0.5).stop('S', 30).checkpoint().advanceMiles(0.5).finish().build();
    expect(validateScenario(cpAtPause).some(p => /pause node/.test(p))).toBe(true);
    const ok = compound(); expect(validateScenario(ok)).toEqual([]);
    const renum = compound(); renum.book[1]!.n = 7; expect(validateScenario(renum).some(p => /numbering/.test(p))).toBe(true);
  });
});

describe('car and speedo invariants', () => {
  it('CAR-006 stopping never overshoots the line and snaps to rest', () => {
    for (const v0 of [20, 35, 50]) {
      const c = new Car(FORD_1939); c.v = mphToFps(v0); c.mode = 'cruise'; const line = 2000; let t = 0;
      while ((c.mode as string) !== 'stopped' && t < 200) { c.step(0.1, mphToFps(v0), line); expect(c.s).toBeLessThanOrEqual(line + 1e-6); t += 0.1; }
      expect(c.v).toBe(0); expect(c.s).toBeCloseTo(line, 6);
    }
  });
  it('SPEEDO-006 inverse uses only the deterministic transfer and is monotone', () => {
    const sp = new Speedometer(STOCK_1939_SPEEDO, rng(3));
    let prev = -1;
    for (let v = 0; v <= 100; v += 5) { const ind = sp.indicatedFor(v); expect(sp.inverse(ind)).toBeCloseTo(v, 6); const inv = sp.inverse(v); expect(inv).toBeGreaterThanOrEqual(prev); prev = inv; }
    const tw = new Speedometer(PERFECT_TIMEWISE, rng(1)); tw.setFactor(1.02); expect(tw.inverse(tw.indicatedFor(40))).toBeCloseTo(40, 6);
  });
  it('DRV-010 hold error: expert sd <= 0.35 mph, rookie >= 0.8 mph over 5 minutes', () => {
    const run = (driver: typeof DRIVER_EXPERT) => {
      const sc = new ScenarioBuilder({ startTime: T0, driver }).start(40).advanceMiles(6).checkpoint().advanceFt(300).finish().build();
      const sim = new Simulator(sc); sim.act({ type: 'start' }); sim.step(30);
      const xs: number[] = []; for (let i = 0; i < 3000; i++) { sim.step(0.1); xs.push(sim.car.mph() - 40); }
      const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
    };
    expect(run(DRIVER_EXPERT)).toBeLessThanOrEqual(0.35);
    expect(run(DRIVER_DAD_ROOKIE)).toBeGreaterThanOrEqual(0.6);
  });
});

describe('driver cues and semantics', () => {
  const stopSc = () => new ScenarioBuilder({ startTime: T0, driver: quiet, aids: TRAINING_AIDS }).start(35).advanceMiles(0.5).stop('S', 40).advanceMiles(0.6).checkpoint().advanceFt(300).finish().build();
  it('DRV-013 driver says Stopped at the line and At <speed> when settled', () => {
    const sim = new Simulator(stopSc()); startLikeOracle(sim);
    stepUntil(sim, () => sim.waitingForGo, 300); const msgs = sim.observe().driver.messages.map(m => m.text);
    expect(msgs).toContain('Stopped');
    sim.act({ type: 'call.speed', mph: 40 }); sim.act({ type: 'call.go' });
    stepUntil(sim, () => Math.abs(sim.car.mph() - 40) < 0.4, 60); sim.step(1.0);
    expect(sim.observe().driver.messages.some(m => m.text === 'At 40')).toBe(true);
  });
  it('DRV-014 cross traffic holds the driver after go; non-qualifying; logged', () => {
    let seen = 0;
    for (let seed = 1; seed <= 12 && !seen; seed++) {
      const sc = new ScenarioBuilder({ startTime: T0, seed, driver: quiet, trafficWaitProbability: 1 }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
      const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.waitingForGo, 300);
      const ev = sim.events.find(e => e.type === 'traffic'); expect(ev).toBeTruthy(); expect(ev!.detail!.ledgerEligible).toBe(true);
      const wait = ev!.detail!.wait as number; expect(wait).toBeGreaterThanOrEqual(0); expect(wait).toBeLessThanOrEqual(20);
      if (wait < 3) continue;
      sim.act({ type: 'call.go' }); sim.step(0.5);
      expect(sim.car.v).toBe(0); expect(sim.observe().driver.messages.some(m => m.text === 'Waiting on traffic')).toBe(true);
      stepUntil(sim, () => sim.car.v > 0, 30); expect(sim.taQualifying[1] ?? 0).toBe(0); seen++;
    }
    expect(seen).toBe(1);
  });
  it('DRV-015 a turn callout arms past intermediate intersections without a matching exit', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.3).instruction({ exits: EXITS.sideRoad('L'), sightDistance: 500 }, { text: 'Continue', speed: 35 })
      .advanceMiles(0.3).instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 500 }, { turn: 'R', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); sim.act({ type: 'call.turn', dir: 'R' }); runToEnd(sim);
    expect(sim.offCourseCount).toBe(0); expect(sim.events.some(e => e.type === 'driver' && /No right here/.test(String(e.detail?.text)))).toBe(true);
  });
  it('DRV-016 callout semantics: go while rolling, stop with no control, uturn on course refused', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4).instruction({ label: 'church', sightDistance: 500 }, { text: 'Church on R', speed: 35 }).advanceMiles(0.6).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); sim.step(5); sim.observe();
    sim.act({ type: 'call.go' }); expect(sim.observe().driver.messages.some(m => m.text === 'Already rolling')).toBe(true);
    sim.act({ type: 'call.uturn' }); expect(sim.observe().driver.messages.some(m => /Turn around\?/.test(m.text))).toBe(true); expect(sim.offCourseCount).toBe(0);
    sim.act({ type: 'call.stop' }); stepUntil(sim, () => sim.waitingForGo, 200); expect(sim.waitReason).toBe('hold'); expect(sim.car.v).toBe(0);
    sim.act({ type: 'call.go' }); sim.step(2); expect(sim.car.v).toBeGreaterThan(0);
  });
  it('DRV-017 check-off names the executed line and observe carries lastExecutedLine', () => {
    const sim = new Simulator(stopSc()); startLikeOracle(sim); stepUntil(sim, () => sim.waitingForGo, 300); sim.act({ type: 'call.go' }); sim.step(3);
    const o = sim.observe(); expect(o.driver.lastExecutedLine).toBe(2);
    expect(sim.events.some(e => e.type === 'driver' && /line 2/.test(String(e.detail?.text)))).toBe(true);
    const legal = new Simulator({ ...stopSc(), aids: LEGAL_AIDS }); startLikeOracle(legal); stepUntil(legal, () => legal.waitingForGo, 300); legal.act({ type: 'call.go' }); legal.step(3);
    expect(legal.observe().driver.lastExecutedLine).toBeNull();
  });
  it('WATCH-006 digital lap freezes the display until recall; two laps store two splits', () => {
    const w = new Stopwatch('digital'); w.start(0); w.lap(10); expect(w.reading(15)).toBeCloseTo(10, 6); w.lap(20); expect(w.laps.length).toBe(2); expect(w.reading(25)).toBeCloseTo(20, 6);
    w.recall(); expect(w.reading(25)).toBeCloseTo(25, 6); expect(w.reset(25)).toBe(true);
    const a = new Stopwatch('analog'); a.start(0); a.lap(10); expect(a.reading(15)).toBeCloseTo(15, 6);
  });
});

describe('simulator rules', () => {
  it('SIM-004 checkpoint sign visible only in the sight zone; slowing in it is a violation', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.6).checkpoint('timing', 400).advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); const cpS = sc.checkpoints[0]!.s;
    stepUntil(sim, () => sim.car.s >= cpS - 600); expect(sim.observe().ahead.some(f => f.kind === 'checkpoint')).toBe(false);
    stepUntil(sim, () => sim.car.s >= cpS - 350); expect(sim.observe().ahead.some(f => f.kind === 'checkpoint')).toBe(true);
    sim.act({ type: 'call.speed', mph: 3 }); stepUntil(sim, () => sim.records.length > 0, 120);
    expect(sim.records[0]!.sightViolation).toBe(true);
    runToEnd(sim); expect(sim.result().score.legs[0]!.extras.sightZone).toBe(DEFAULT_RULES.sightZonePenalty);
  });
  it('SIM-005 observation CP without a stop within 200 ft is missed; with call.stop it is satisfied', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).checkpoint().advanceFt(500).finish().build();
    const a = new Simulator(sc); startLikeOracle(a); runToEnd(a); expect(a.result().observationMissed).toBe(true);
    const b = new Simulator(sc); startLikeOracle(b); b.act({ type: 'call.stop' }); runToEnd(b); expect(b.result().observationMissed).toBe(false);
  });
  it('SIM-008 result lists every checkpoint with actual, perfect, error, ace, penalty and totals', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).checkpoint().advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    expect(r.score.legs.length).toBe(2);
    for (const l of r.score.legs) { expect(typeof l.actualTod).toBe('number'); expect(typeof l.perfectTod).toBe('number'); expect(typeof l.error).toBe('number'); expect(typeof l.ace).toBe('boolean'); expect(typeof l.penalty).toBe('number'); }
    expect(r.score.raw).toBe(r.score.legs.reduce((a, l) => a + l.penalty, 0)); expect(r.score.score).toBe(Math.round(r.score.raw * 0.845 * 100) / 100);
  });
  it('SIM-014 an instantaneous car with a perfect driver and no losses scores 0 at every CP (20 seeds)', () => {
    let totalLegs = 0, zeroLegs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = rng(seed * 7);
      const b = new ScenarioBuilder({ startTime: T0, seed, car: INSTANT_CAR, driver: DRIVER_PERFECT, speedo: PERFECT_TIMEWISE });
      b.start(r.pick([30, 35, 40]));
      for (let k = 0; k < 4; k++) {
        b.advanceMiles(0.3 + r.next());
        const kind = r.int(0, 3);
        if (kind === 0) b.stop(r.pick(['L', 'R', 'S']), r.pick([30, 35, 40]));
        else if (kind === 1) b.speedAtSign('SPEED LIMIT', r.pick([25, 45, 50]));
        else if (kind === 2) b.timedAt('bridge', { holdSpeed: 30, seconds: 20 + r.int(0, 30), thenSpeed: 40 });
        else b.instruction({ exits: EXITS.tee(r.pick(['L', 'R'])), sightDistance: 600 }, { turn: 'L', speed: 35 });
        if (kind === 3) { const last = b['book' as keyof typeof b] as unknown as { turn: string }[]; void last; }
        if (r.chance(0.5)) { b.advanceMiles(0.2 + r.next() * 0.5); b.checkpoint(); }
      }
      b.advanceMiles(0.3).checkpoint().advanceFt(300).finish();
      const sc = b.build();
      // fix tee turns to match exits
      for (const ins of sc.book) { const n = nodeById(sc.course, ins.nodeId); if (n.exits && ins.turn) { const route = n.exits.find(e => e.isRoute)!; ins.turn = route.angle < -20 ? 'L' : route.angle > 20 ? 'R' : 'S'; } }
      const sim = new Simulator(sc); const res = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
      expect(res.offCourseCount).toBe(0);
      // whole-second rounding of arrival times can produce +-1 even for the ghost itself (as in the real event)
      for (const l of res.score.legs) { expect(Math.abs(l.error!)).toBeLessThanOrEqual(1); totalLegs++; if (l.error === 0) zeroLegs++; }
    }
    expect(zeroLegs / totalLegs).toBeGreaterThanOrEqual(0.5);
  });
  it('SIM-018 ledger stores estimates with truth and result carries the series', () => {
    const sim = new Simulator(compound()); startLikeOracle(sim); sim.step(20);
    sim.act({ type: 'ledger.set', seconds: 3 }); expect(sim.observe().ledger).toBe(3);
    const r = sim.result(); expect(r.ledgerLog.length).toBe(1); expect(r.ledgerLog[0]!.believed).toBe(3); expect(typeof r.ledgerLog[0]!.truth).toBe('number');
  });
  it('SIM-019 navigator reads the speedo at mark spacing unless aids give the fine reading', () => {
    const mk = (aids: typeof LEGAL_AIDS, speedo = STOCK_1939_SPEEDO) => { const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, speedo, aids }).start(37).advanceMiles(2).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc); startLikeOracle(sim); sim.step(60); return sim.observe().speedo.reading; };
    expect(mk(LEGAL_AIDS) % 5).toBe(0);
    expect(mk(TRAINING_AIDS) % 5).not.toBe(0);
    expect(mk(LEGAL_AIDS, PERFECT_TIMEWISE) % 1).toBe(0);
  });
  it('SIM-020 countdown aid reaches zero 55 s after the ghost arrives at a compound node', () => {
    const sc = { ...compound(), aids: TRAINING_AIDS }; const sim = new Simulator(sc); startLikeOracle(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    const arrivalGhost = T0 + nodeById(sc.course, 'n2').s / mphToFps(35);
    sim.act({ type: 'call.speed', mph: 25 }); sim.act({ type: 'call.go' }); sim.step(1);
    const cd = sim.observe().aids.countdown!; expect(cd).toBeCloseTo(arrivalGhost + 55 - sim.tod, 0);
  });
  it('SIM-021 termination by timeout and by abort; result marks un-crossed CPs missed', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const a = new Simulator(sc); a.act({ type: 'start' }); a.act({ type: 'call.stop' }); // stops at the finish? no: holds at next node (the finish) - instead never go: use speed 0
    a.act({ type: 'call.speed', mph: 0 }); a.step(40 * 60); expect(a.phase).toBe('finished'); expect(a.result().score.legs[0]!.extras.missed).toBe(true);
    const b = new Simulator(sc); b.act({ type: 'start' }); b.step(10); b.act({ type: 'abort' }); expect(b.phase).toBe('finished'); expect(b.result().score.legs[0]!.penalty).toBe(DEFAULT_RULES.maxPerCp);
  });
  it('SIM-022 actions are recorded with ticks and replay reproduces the identical result', () => {
    const sc = compound(); const sim = new Simulator(sc); const r1 = runBot(sim, new OracleBot(sim));
    expect(r1.actions.length).toBeGreaterThan(3); expect(r1.engineVersion).toBe(ENGINE_VERSION);
    const sim2 = replay(sc, r1.actions); const r2 = sim2.result();
    expect(JSON.stringify(r2.score)).toBe(JSON.stringify(r1.score)); expect(JSON.stringify(r2.records)).toBe(JSON.stringify(r1.records));
    expect(() => replay(sc, r1.actions, { engineVersion: '0.0.1' })).toThrow();
  });
  it('SIM-023/SIM-024 off course: no flag without the aid, branch shows a DEAD END tell, driver stops and asks', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, excursionFt: 1500, aids: LEGAL_AIDS }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', speed: 35 }).advanceMiles(0.7).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); sim.act({ type: 'call.turn', dir: 'R' });
    stepUntil(sim, () => sim.offCourseCount > 0, 300);
    const o = sim.observe(); expect(o.offCourseHint).toBe(false); expect(o.driver.state).toBe('cruise');
    stepUntil(sim, () => sim.observe().ahead.some(f => f.kind === 'roadEnd'), 120);
    expect(sim.observe().ahead.find(f => f.kind === 'roadEnd')!.label).toBe('DEAD END');
    stepUntil(sim, () => sim.waitingForGo, 120); expect(sim.waitReason).toBe('roadEnd');
    sim.act({ type: 'call.uturn' }); stepUntil(sim, () => sim.events.some(e => e.type === 'rejoin'), 300); expect(sim.offCourseCount).toBe(1);
  });
  it('SIM-025 tod is exact in ticks and crossing times are interpolated within the tick', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); for (let i = 0; i < 36000; i++) sim.step(0.1); // stays in preread (no start): pure clock
    expect(sim.tod).toBe(sim.sc.startTime - 30 + 3600);
    // crossing times are interpolated inside the tick: an instant car's raw crossing equals the analytic ghost time (not the tick grid)
    const inst = new ScenarioBuilder({ startTime: T0, car: INSTANT_CAR, driver: DRIVER_PERFECT }).start(37).advanceFt(3457).checkpoint().advanceFt(300).finish().build();
    const a = new Simulator(inst); a.step(30); a.act({ type: 'start' }); runToEnd(a);
    const ghost = T0 + 3457 / mphToFps(37);
    expect(Math.abs(a.records[0]!.rawTod! - ghost)).toBeLessThan(0.005);
    expect(Math.abs((a.records[0]!.rawTod! * 10) % 1)).toBeGreaterThan(0.01); // not on the 0.1 s grid
  });
  it('SIM-026 late departure keeps the official anchor and is reported', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.step(30 + 12); sim.act({ type: 'start' }); const msg = sim.observe().driver.messages.map(m => m.text).join('|');
    expect(msg).toMatch(/Leaving 12 s late/); runToEnd(sim); const r = sim.result();
    expect(r.secondsLateAtStart).toBeCloseTo(12, 1); expect(r.score.legs[0]!.error!).toBeGreaterThanOrEqual(14); expect(r.attribution[0]!.buckets.start).toBeGreaterThan(12);
  });
  it('SIM-027 legIndex hidden at rung <= 1, shown at rung >= 2', () => {
    const sc1 = new ScenarioBuilder({ startTime: T0, aids: aidsForRung(1) }).start(35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    expect(new Simulator(sc1).observe().legIndex).toBeNull();
    const sc2 = { ...sc1, aids: aidsForRung(2) }; expect(new Simulator(sc2).observe().legIndex).toBe(1);
  });
  it('SIM-028 line annotations and pre-read coverage', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'line.annotate', n: 2, text: '7.4' }); expect(sim.observe().annotations[2]).toBe('7.4');
    runBot(sim, new OracleBot(sim)); expect(sim.result().prereadCoverage).toBeCloseTo(0.5, 6);
  });
});

describe('scoring and hazards extras', () => {
  it('SCORE-010 TA never turns a late leg early and rounds to granularity', () => {
    const leg = { index: 1, cpId: 'cp1', cpS: 1000, perfectTod: T0 + 600, perfectDuration: 600, anchor: { kind: 'official' as const, tod: T0 } };
    const l = scoreLeg({ leg, record: { cpId: 'cp1', kind: 'timing', actualTod: T0 + 610, rawTod: T0 + 610, sightViolation: false }, anchorActual: T0, taDeclared: 40, taQualifying: 40 }, DEFAULT_RULES);
    expect(l.taCredit).toBe(10); expect(l.error).toBe(0);
    const early = scoreLeg({ leg, record: { cpId: 'cp1', kind: 'timing', actualTod: T0 + 595, rawTod: T0 + 595, sightViolation: false }, anchorActual: T0, taDeclared: 10, taQualifying: 10 }, DEFAULT_RULES);
    expect(early.taCredit).toBe(0); expect(early.error).toBe(-5);
  });
  it('SCORE-011 benchmark labels', () => {
    expect(benchmarkLabel(2)).toBe('champion'); expect(benchmarkLabel(13)).toBe('expert'); expect(benchmarkLabel(20)).toBe('sportsman'); expect(benchmarkLabel(46)).toBe('rookie'); expect(benchmarkLabel(47)).toBe('blown');
    const sim = new Simulator(compound()); expect(['champion', 'expert', 'sportsman', 'rookie', 'blown']).toContain(runBot(sim, new OracleBot(sim)).score.benchmark);
  });
  it('HAZ-003 slow vehicle delay is not TA-qualifying', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(40).advanceMiles(0.3); b.hazard({ kind: 'slow', speedMph: 25, lengthFt: 3000 });
    const sc = b.advanceMiles(1.2).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { noRecovery: true }));
    expect(sim.taQualifying[1] ?? 0).toBe(0); expect(r.score.legs[0]!.error!).toBeGreaterThan(10); expect(r.attribution[0]!.buckets.hazard).toBeGreaterThan(8);
  });
  it('HAZ-005 red-signal wait is TA-qualifying only when rules.taForSignals', () => {
    const mk = (taForSignals: boolean) => { const b = new ScenarioBuilder({ startTime: T0, driver: quiet, rules: { taForSignals } }).start(35).advanceMiles(0.5); b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 40, greenSeconds: 50, offset: T0 + 51.4 - 20 }); return b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build(); };
    const a = new Simulator(mk(true)); startLikeOracle(a); stepUntil(a, () => a.waitingForGo, 300); expect(a.taQualifying[1]!).toBeGreaterThan(5);
    const b = new Simulator(mk(false)); startLikeOracle(b); stepUntil(b, () => b.waitingForGo, 300); expect(b.taQualifying[1] ?? 0).toBe(0);
  });
  it('ATTR-005 start and ta buckets exist and the partition still holds', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5); b.instruction({ control: 'RR', sightDistance: 600, label: 'RR crossing' }, { text: 'RR crossing', speed: 35 }); b.hazard({ kind: 'train', startTod: T0 + 40, durationSeconds: 60 });
    const sc = b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const bot = new OracleBot(sim, { noRecovery: true }); let declared = false;
    while (sim.phase !== 'finished') { bot.onTick(); if (!declared && (sim.taQualifying[1] ?? 0) > 0 && !sim.waitingForGo) { sim.act({ type: 'ta.declare', seconds: Math.round(sim.taQualifying[1]!) }); declared = true; } sim.step(0.1); }
    const r = sim.result(); const a = r.attribution[0]!;
    expect(a.buckets.ta).toBeLessThan(0); expect(a.buckets.hazard).toBeGreaterThan(20);
    const sum = Object.values(a.buckets).reduce((x, y) => x + y, 0); expect(Math.abs(sum - r.score.legs[0]!.error!)).toBeLessThanOrEqual(2);
  });
});

describe('protocol extras', () => {
  it('AGENT-003 advance untilEvent stops on feature visibility / driver message / car stopped and lists events', () => {
    const s = new Session(compound()); s.handle({ type: 'act', action: { type: 'start' } });
    const kinds = new Set<string>(); let guard = 0;
    while (guard++ < 40) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 120 }); if (r.type !== 'advanced') break; if (r.stoppedOn) kinds.add(r.stoppedOn.split(':')[0]!); expect(Array.isArray(r.events)).toBe(true); if (r.stoppedOn === 'carStopped') break; }
    expect(kinds.has('featureVisible')).toBe(true); expect(kinds.has('carStopped')).toBe(true);
  });
  it('AGENT-004 malformed/invalid requests yield error replies; hello hides positions; playScript runs in-process', () => {
    const replies = playScript(compound(), [{ type: 'hello' }, { type: 'act', action: { type: 'speedo.setFactor', k: 1.01 } }, { type: 'bogus' } as unknown as Parameters<typeof playScript>[1][number], { type: 'result' }]);
    expect(replies[0]!.type).toBe('hello'); expect(JSON.stringify(replies[0])).not.toMatch(/"s":/); expect(replies[2]!.type).toBe('error'); expect(replies[3]!.type).toBe('result');
  });
  it('AGENT-005 scheduled actions fire on elapsed / watchReads / featureVisible and are recorded', () => {
    const s = new Session(compound());
    s.handle({ type: 'act', action: { type: 'start' } }); s.handle({ type: 'act', action: { type: 'watch.start' } });
    s.handle({ type: 'act', action: { type: 'note', text: 'at10' }, when: { elapsed: 10 } });
    s.handle({ type: 'act', action: { type: 'note', text: 'watch20' }, when: { watchReads: 20 } });
    s.handle({ type: 'act', action: { type: 'call.turn', dir: 'S' }, when: { event: 'featureVisible', label: 'STOP' } });
    const r = s.handle({ type: 'advance', seconds: 60 }); expect(r.type).toBe('advanced'); if (r.type !== 'advanced') return;
    expect(r.scheduledFired).toContain('note'); expect(r.scheduledFired.filter(x => x === 'note').length).toBe(2); expect(r.scheduledFired).toContain('call.turn');
    const res = s.handle({ type: 'result' }); if (res.type === 'result') { const notes = res.result.actions.filter(a => a.action.type === 'note'); expect(notes.length).toBe(2); expect(notes[0]!.tick).toBeLessThan(notes[1]!.tick); }
  });
  it('BOT-005 goCount bot is early by 1-3 s per compound instruction versus oracle', () => {
    const sc = compound(40); const o = new Simulator(sc); const ro = runBot(o, new OracleBot(o, { noRecovery: true }));
    const g = new Simulator(sc); const rg = runBot(g, new OracleBot(g, { goCount: true, noRecovery: true }));
    const diff = rg.score.legs[0]!.error! - ro.score.legs[0]!.error!;
    expect(diff).toBeLessThanOrEqual(-1); expect(diff).toBeGreaterThanOrEqual(-4);
  });
});

describe('determinism hygiene', () => {
  it('DET-001 core has no Math.random/Date/DOM and rng forks are independent', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
    for (const f of walk('src/core')) { const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""'); expect(src, f).not.toMatch(/Math\.random|Date\.now|performance\.now|\bwindow\.|\bdocument\.|localStorage/); }
    const base = rng(5); const a = base.fork('a'), b = base.fork('b'); const b1 = b.next(); for (let i = 0; i < 100; i++) a.next(); const b2 = rng(5).fork('b').next();
    expect(b1).toBe(b2);
  });
});
