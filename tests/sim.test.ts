import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { DRIVER_EXPERT, type Scenario } from '../src/core/course.js';
import { hms, milesToFt, mphToFps } from '../src/core/units.js';
import { stopLoss } from '../src/core/perf-table.js';
import { stepUntil, runToEnd, nodeS, startAtOfficialTime, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };

function straightMile(): Scenario {
  return new ScenarioBuilder({ startTime: T0, driver: quiet }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
}

describe('simulator basics', () => {
  it('SIM-006 preread phase then start; early departure keeps the official anchor', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 60 }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc);
    expect(sim.observe().phase).toBe('preread');
    expect(sim.observe().secondsToStart).toBeCloseTo(60, 6);
    sim.step(30); // 30 s early
    sim.act({ type: 'start' });
    expect(sim.phase).toBe('running');
    runToEnd(sim);
    const r = sim.result();
    // left 30 s early at 30 mph on a 1-mile leg -> about 30 s early plus the acceleration loss (~5 s)
    expect(r.score.legs[0]!.error!).toBeLessThan(-20);
    expect(r.score.legs[0]!.error!).toBeGreaterThan(-32);
  });
  it('SIM-003 checkpoint recorded to the nearest second and leg index increments', () => {
    const sim = new Simulator(straightMile());
    startAtOfficialTime(sim);
    stepUntil(sim, () => sim.records.length > 0);
    expect(sim.records[0]!.actualTod).toBe(Math.floor(sim.records[0]!.rawTod! + 0.5));
    expect(sim.observe().legIndex).toBe(2);
  });
  it('SIM-001 observation hides positions and rounds distances to 50 ft', () => {
    const sim = new Simulator(straightMile());
    startAtOfficialTime(sim);
    stepUntil(sim, () => sim.observe().ahead.length > 0, 600);
    const o = sim.observe();
    const json = JSON.stringify(o);
    expect(json).not.toMatch(/"s":/);
    for (const f of o.ahead) expect(f.approxDistanceFt % 50).toBe(0);
  });
  it('SIM-002 a node is visible exactly from sightDistance and disappears after passing', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(30).advanceMiles(1).speedAtSign('SPEED LIMIT 40', 40).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    const s = nodeS(sc, 'n2');
    stepUntil(sim, () => sim.car.s >= s - 500 - 1);
    expect(sim.observe().ahead.some(f => f.nodeId === 'n2')).toBe(false);
    stepUntil(sim, () => sim.car.s >= s - 500 + 1);
    expect(sim.observe().ahead.some(f => f.nodeId === 'n2')).toBe(true);
    stepUntil(sim, () => sim.car.s > s + 1);
    expect(sim.observe().ahead.some(f => f.nodeId === 'n2')).toBe(false);
  });
  it('SIM-016 intersections expose exits; sign text only within half the sight distance', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(30).advanceMiles(1).stop('R', 35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    const s = nodeS(sc, 'n2');
    stepUntil(sim, () => sim.car.s >= s - 650);
    let f = sim.observe().ahead.find(x => x.nodeId === 'n2')!;
    expect(f.exits!.length).toBe(3); expect(f.sign!.text).toBeUndefined(); expect(f.control).toBe('STOP');
    stepUntil(sim, () => sim.car.s >= s - 300);
    f = sim.observe().ahead.find(x => x.nodeId === 'n2')!;
    expect(f.sign!.text).toBe('STOP');
  });
  it('SIM-010/SIM-011 line.set and note are navigator-only state', () => {
    const sim = new Simulator(straightMile());
    sim.act({ type: 'line.set', n: 2 }); sim.act({ type: 'note', text: 'dwell 8.5' });
    const o = sim.observe(); expect(o.currentLine).toBe(2); expect(o.notes).toEqual(['dwell 8.5']);
    expect(sim.car.s).toBe(0);
  });
  it('SIM-012 speedo factor only for Timewise', () => {
    const sim = new Simulator(straightMile());
    sim.act({ type: 'speedo.setFactor', k: 1.01 });
    expect(sim.speedo.userFactor).toBe(1.01);
  });
  it('SIM-013 cheat card maps assigned to indicated when useCard', () => {
    const sim = new Simulator(straightMile(), { useCard: true });
    sim.act({ type: 'card.set', card: { '35': 36 } });
    sim.act({ type: 'call.speed', mph: 35 });
    expect(sim.targetIndicated).toBe(36);
  });
  it('SIM-007 determinism: same scenario and script give identical results', () => {
    const run = () => { const sim = new Simulator(straightMile()); startAtOfficialTime(sim); runToEnd(sim); return JSON.stringify(sim.result()); };
    expect(run()).toBe(run());
  });
  it('SIM-015/SIM-017 event log and counters', () => {
    const sim = new Simulator(straightMile()); startAtOfficialTime(sim); runToEnd(sim);
    const types = new Set(sim.events.map(e => e.type));
    expect(types.has('depart')).toBe(true); expect(types.has('checkpoint')).toBe(true); expect(types.has('node')).toBe(true);
    const r = sim.result(); expect(r.drivingSeconds).toBeGreaterThan(100); expect(r.instructionsExecuted).toBeGreaterThanOrEqual(1);
  });
});

describe('driver behaviour', () => {
  function stopScenario(dir: 'L' | 'R' | 'S' = 'S', exits = EXITS.crossroads(dir)): Scenario {
    return new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop(dir, 35, { exits }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
  }
  it('DRV-001 target speed converges to speedo inverse', () => {
    const sim = new Simulator(straightMile()); startAtOfficialTime(sim);
    sim.act({ type: 'call.speed', mph: 40 });
    stepUntil(sim, () => sim.car.s > 2000);
    expect(Math.abs(sim.car.mph() - sim.speedo.inverse(40))).toBeLessThan(0.3);
  });
  it('DRV-002 stops at STOP without a callout and waits for go', () => {
    const sc = stopScenario(); const sim = new Simulator(sc); startAtOfficialTime(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    expect(sim.waitReason).toBe('stop'); expect(sim.car.v).toBe(0);
    expect(Math.abs(sim.car.s - nodeS(sc, 'n2'))).toBeLessThan(2);
    const sAtStop = sim.car.s; sim.step(10); expect(sim.car.s).toBe(sAtStop);
    sim.act({ type: 'call.go' }); sim.step(2); expect(sim.car.v).toBeGreaterThan(0);
  });
  it('DRV-003 patience: asks at 25 s and leaves at 50 s', () => {
    const sim = new Simulator(stopScenario()); startAtOfficialTime(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    sim.observe();
    sim.step(26); expect(sim.observe().driver.messages.some(m => m.text === 'Going?')).toBe(true);
    sim.step(26); expect(sim.car.v).toBeGreaterThan(0);
    expect(sim.events.some(e => e.type === 'release' && e.detail?.reason === 'patience')).toBe(true);
  });
  it('DRV-004 at a T without a callout the driver stops and asks', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.tee('L'), sightDistance: 600 }, { turn: 'L', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    expect(sim.waitReason).toBe('ask');
    expect(sim.observe().driver.messages.some(m => m.text === 'Left or right?')).toBe(true);
    sim.act({ type: 'call.turn', dir: 'L' }); sim.step(3); expect(sim.car.v).toBeGreaterThan(0);
    runToEnd(sim); expect(sim.offCourseCount).toBe(0);
  });
  it('DRV-005 side road with no callout: straight on', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.sideRoad('R'), sightDistance: 600 }, { text: 'Continue', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); runToEnd(sim);
    expect(sim.offCourseCount).toBe(0); expect(sim.result().score.legs[0]!.penalty).toBeLessThan(3);
  });
  it('DRV-006 wrong turn goes off course; uturn returns after 2x distance + 20 s', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, excursionFt: 2640 }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.crossroads('S'), sightDistance: 600 }, { turn: 'S', speed: 35 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    sim.act({ type: 'call.turn', dir: 'R' });
    stepUntil(sim, () => sim.offCourseCount > 0, 300);
    const tOff = sim.tod; expect(sim.observe().driver.state).toBe('offcourse');
    sim.step(30); sim.act({ type: 'call.uturn' });
    stepUntil(sim, () => sim.offCourseCount > 0 && sim.observe().driver.state === 'cruise', 600);
    expect(sim.events.some(e => e.type === 'rejoin')).toBe(true);
    expect(sim.tod - tOff).toBeGreaterThan(60);
    runToEnd(sim); expect(sim.result().score.legs[0]!.error!).toBeGreaterThan(60);
  });
  it('DRV-007 turn callouts map to angle bands; unmatched asks', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.wye('BR'), sightDistance: 600 }, { turn: 'BR', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    sim.act({ type: 'call.turn', dir: 'BR' }); runToEnd(sim); expect(sim.offCourseCount).toBe(0);
    const sim2 = new Simulator(sc); startAtOfficialTime(sim2);
    sim2.act({ type: 'call.turn', dir: 'BL' }); runToEnd(sim2); expect(sim2.offCourseCount).toBe(1);
  });
  it('DRV-008 callouts are read back', () => {
    const sim = new Simulator(straightMile()); startAtOfficialTime(sim); sim.observe();
    sim.act({ type: 'call.speed', mph: 40 }); sim.act({ type: 'call.turn', dir: 'L' });
    const msgs = sim.observe().driver.messages.filter(m => m.kind === 'readback');
    expect(msgs.length).toBe(2);
  });
  it('DRV-009 red signal: driver waits, delay logged as qualifying', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5);
    b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 });
    b.hazard({ kind: 'signal', redSeconds: 40, greenSeconds: 50, offset: T0 + 51.4 - 20 }); // red when we arrive (~51 s)
    const sc = b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    expect(sim.waitReason).toBe('signal');
    expect(sim.taQualifying[1]!).toBeGreaterThan(5);
    stepUntil(sim, () => !sim.waitingForGo, 120); expect(sim.car.v).toBeGreaterThanOrEqual(0);
    runToEnd(sim);
    expect(sim.result().score.legs[0]!.error!).toBeGreaterThan(10);
  });
  it('DRV-011 turn caps speed then re-accelerates', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 600 }, { turn: 'R', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim); sim.act({ type: 'call.turn', dir: 'R' });
    const s = nodeS(sc, 'n2');
    stepUntil(sim, () => sim.car.s >= s + 1);
    expect(sim.car.mph()).toBeLessThanOrEqual(12.5);
    stepUntil(sim, () => sim.car.s >= s + 1500);
    expect(sim.car.mph()).toBeGreaterThan(33);
  });
  it('DRV-012 slow vehicle limits speed until pass', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(40).advanceMiles(0.3);
    b.hazard({ kind: 'slow', speedMph: 25, lengthFt: 4000, passWindowAfterFt: 1500 });
    const sc = b.advanceMiles(1.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    const hs = sc.hazards[0]!.s;
    stepUntil(sim, () => sim.car.s >= hs + 800);
    expect(sim.car.mph()).toBeLessThan(27);
    sim.act({ type: 'call.pass' });
    stepUntil(sim, () => sim.car.s >= hs + 2500);
    expect(sim.car.mph()).toBeGreaterThan(35);
    expect(sim.taQualifying[1] ?? 0).toBe(0);
  });
});

describe('stops and pauses end to end', () => {
  it('pause handled with correct dwell gives a near-zero leg', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    const dwell = 15 - stopLoss(35, 35, sc.car);
    sim.step(dwell); sim.act({ type: 'call.go' });
    runToEnd(sim);
    const leg = sim.result().score.legs[0]!;
    expect(Math.abs(leg.error!)).toBeLessThanOrEqual(1);
  });
  it('forgetting the dwell arithmetic (full 15 s) makes you late by the stop loss', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).stop('S', 35).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim);
    stepUntil(sim, () => sim.waitingForGo, 300);
    sim.step(15); sim.act({ type: 'call.go' });
    runToEnd(sim);
    const leg = sim.result().score.legs[0]!;
    const loss = stopLoss(35, 35, sc.car);
    expect(leg.error!).toBeGreaterThanOrEqual(Math.floor(loss) - 1); expect(leg.error!).toBeLessThanOrEqual(Math.ceil(loss) + 1);
  });
});
