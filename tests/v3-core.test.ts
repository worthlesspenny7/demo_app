import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { DEFAULT_RULES, DRIVER_EXPERT, DRIVER_PERFECT, aidsForRung, nodeById, FORD_1939, PACKARD_1936, type Scenario, type RulesConfig } from '../src/core/course.js';
import { Simulator, validateAction, ACTION_LIST, ENGINE_VERSION, type Action } from '../src/core/sim.js';
import { RallyClock } from '../src/core/stopwatch.js';
import { accelLoss, stopLoss, buildPerfTable, CHART_SPEEDS } from '../src/core/perf-table.js';
import { makeUpPlan, makeUpTotal, scheduleCorrection, scheduleCorrectionMinutes } from '../src/core/ledger.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { Session } from '../src/agent/protocol.js';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { departuresOf } from '../src/core/drills/departures.js';
import { d16Plan } from '../src/core/drills/d16.js';
import { parseChartRuns, parseChartNotes, chartPairs, driverOf } from '../src/core/drills/d06.js';
import { gradeCheckpointNotes, gradeChartLossNotes, chartLossFor, parseCpNotes, lossNumbers, lineSpeeds } from '../src/core/drills/preread.js';
import { lostProcedure, parseLostNote } from '../src/core/drills/lost.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { hms, formatClock } from '../src/core/units.js';
import { stepUntil, startLikeOracle } from './helpers.js';
import { runOracle } from './drill-helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const flat = (extra: Partial<ConstructorParameters<typeof ScenarioBuilder>[0]> = {}) => new ScenarioBuilder({ startTime: T0, driver: quiet, ...extra });
/** Step to a given time of day (no actions). */
function stepTo(sim: Simulator, tod: number): void { while (sim.tod < tod - 1e-9 && sim.phase !== 'finished') sim.step(0.1); }
const msgs = (sim: Simulator): string[] => sim.driverMsgs.map(m => m.text);

describe('V3 engine version', () => {
  it('INST-001 ENGINE_VERSION is 3.0.0 and the V3 actions are in the action list and validated', () => {
    expect(ENGINE_VERSION).toBe('3.0.0');
    for (const t of ['pullUp', 'call.warn', 'call.identify', 'count', 'clock.read', 'ledger.set', 'ta.request']) expect(ACTION_LIST).toContain(t);
    expect(validateAction({ type: 'call.identify', text: 'bridge' })).toBeNull(); expect(validateAction({ type: 'call.identify' })).not.toBeNull();
    expect(validateAction({ type: 'count', n: 9 })).toBeNull(); expect(validateAction({ type: 'count', n: 1.5 })).not.toBeNull();
    expect(validateAction({ type: 'call.warn' })).toBeNull(); expect(validateAction({ type: 'call.warn', seconds: 0 })).not.toBeNull();
    expect(validateAction({ type: 'clock.read', source: 'stopwatch' })).toBeNull(); expect(validateAction({ type: 'clock.read', source: 'wall' })).not.toBeNull();
    expect(validateAction({ type: 'ledger.set', entries: [{ seconds: 4, source: 'stop' }] })).toBeNull(); expect(validateAction({ type: 'ledger.set', entries: [{ seconds: 4 }] })).not.toBeNull();
    expect(validateAction({ type: 'pullUp' })).toBeNull();
  });
});

describe('INST-001 the analog dash clock\'s loose minute hand', () => {
  it('INST-001 rules.clockMinuteSlop defaults to 5 s; the minute hand is ambiguous within the slop either side of the minute change', () => {
    expect(DEFAULT_RULES.clockMinuteSlop).toBe(5);
    const c = new RallyClock(5);
    for (const sec of [0, 0.5, 4.9, 55.1, 57, 59.9]) expect(c.minuteAmbiguous(T0 + 60 * 7 + sec), `at :${sec}`).toBe(true);
    for (const sec of [5, 5.1, 30, 54.9, 55]) expect(c.minuteAmbiguous(T0 + 60 * 7 + sec), `at :${sec}`).toBe(false);
    expect(new RallyClock(0).minuteAmbiguous(T0 + 59.99)).toBe(false); expect(new RallyClock(8).minuteAmbiguous(T0 + 52.5)).toBe(true);
  });
  it('INST-001 the hands: second hand 6 degrees a second, hour hand 30 a hour, the minute hand moves a little with the seconds', () => {
    const c = new RallyClock(5, 0); const h = c.hands(hms(3, 20, 15));
    expect(h.secondAngle).toBeCloseTo(90, 6); expect(h.hourAngle).toBeCloseTo((3 + 20 / 60 + 15 / 3600) * 30, 2); expect(h.minuteAngle).toBeCloseTo(6 * (20 + 15 / 60), 2);
    expect([h.hour, h.minute, h.second]).toEqual([3, 20, 15]); expect(h.minuteAmbiguous).toBe(false);
    const loose = new RallyClock(5, 3).hands(hms(3, 20, 15)); expect(loose.minuteAngle).toBeCloseTo(6 * (20 + 18 / 60), 2);   // the loose hand sits 3 s ahead of its tick
  });
  it('INST-001 observe().clock carries the hand angles; at aids rung <= 1 the resolved minute is withheld while ambiguous, at rung >= 2 it is given', () => {
    for (const rung of [0, 1, 2, 3] as const) {
      const sc = flat({ aids: aidsForRung(rung), prereadSeconds: 600 }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
      const sim = new Simulator(sc);
      stepTo(sim, T0 - 120 + 30); const a = sim.observe({ peek: true }).clock;     // 7:58:30: the minute is plain
      expect(a.minuteAmbiguous).toBe(false); expect(a.minute).toBe(58); expect(a.hour).toBe(7); expect(a.second).toBe(30); expect(a.secondAngle).toBeCloseTo(180, 3);
      stepTo(sim, T0 - 2); const b = sim.observe({ peek: true }).clock;      // 7:59:58: within 5 s of the 8:00 tick
      expect(b.minuteAmbiguous).toBe(true); expect(b.minute, `rung ${rung}`).toBe(rung <= 1 ? null : 59);
      expect(b.minuteAngle).toBeGreaterThan(0); expect(b.secondAngle).toBeCloseTo(58 * 6, 3); expect(b.hourAngle).toBeGreaterThan(0);
    }
  });
  it('INST-001 the slop is a rule: rules.clockMinuteSlop widens the ambiguous window', () => {
    const sc = flat({ aids: aidsForRung(0), prereadSeconds: 600, rules: { clockMinuteSlop: 9 } }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); stepTo(sim, T0 - 8); const o = sim.observe({ peek: true }).clock; expect(o.minuteAmbiguous).toBe(true); expect(o.minute).toBeNull();
  });
});

describe('INST-002 the director\'s setup: time of day from the stopwatch TOD mode, seconds from the clock', () => {
  it('INST-002 a stopwatch TOD-mode read counts as a clock read (WATCH-009); a read of the chrono face does not', () => {
    const sc = flat({ prereadSeconds: 200, startTime: hms(8, 0, 0) }).start(30).advanceMiles(0.2).transit({ exact: true, seconds: 120 }).advanceMiles(0.2).endTransit({ speed: 30 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'clock.read', source: 'stopwatch' });
    expect(sim.instrumentLog.length).toBe(0); expect(msgs(sim).join(' ')).toMatch(/chrono mode/);   // reading the chrono face is no time-of-day read
    sim.act({ type: 'watch.mode', mode: 'tod' }); sim.act({ type: 'clock.read', source: 'stopwatch' });
    expect(sim.instrumentLog.some(e => e.kind === 'clock.read' && e.source === 'stopwatch' && e.mode === 'tod')).toBe(true);
    // the bot that takes the time of day from the TOD mode leaves no clock finding on a restart / OUT
    const d16 = drillById('D16')!.scenario(1, 1); const sim16 = new Simulator(d16); const r = runBot(sim16, new OracleBot(sim16, { useWatch: true }));
    expect(r.actions.some(a => a.action.type === 'watch.mode' && a.action.mode === 'tod')).toBe(true); expect(r.actions.some(a => a.action.type === 'clock.read' && a.action.source === 'stopwatch')).toBe(true);
    expect(r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'))).toEqual([]);
  });
  it('INST-002 the OracleBot uses the stopwatch TOD mode: no plain clock.read of its own on a digital watch, and it goes back to chrono when no time of day is near', () => {
    const sc = drillById('D16')!.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
    expect(r.actions.filter(a => a.action.type === 'clock.read').every(a => (a.action as { source?: string }).source === 'stopwatch')).toBe(true);
    expect(r.actions.some(a => a.action.type === 'watch.mode' && a.action.mode === 'chrono')).toBe(true);
    expect(r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'))).toEqual([]);
  });
  it('INST-002 D16 at rung <= 1 seeds the one-minute trap: the exact-transit OUT falls on a minute change where the minute hand is ambiguous; at rung 2 it does not', () => {
    for (const seed of [1, 2, 3, 4]) {
      const bronze = drillById('D16')!.scenario(seed, 0); expect((bronze.tags ?? []).some(t => t.startsWith('trap:oneMinute'))).toBe(false);
      for (const tier of [1, 2]) {
        const sc = drillById('D16')!.scenario(seed, tier); expect(sc.aids.rung).toBeLessThanOrEqual(1); expect((sc.tags ?? []).filter(t => t.startsWith('trap:oneMinute')).length).toBe(2);
        const p = d16Plan(seed, true); expect(p.inEst).toBe(p.start + 120); expect((p.outEst % 60 + 60) % 60).toBe(0);
        const out = sc.book.find(i => i.transit?.end && i.transit.exact)!; const node = nodeById(sc.course, out.nodeId);
        // the OUT (IN + 20m00s) lands within the slop of a minute change: at the moment to leave, the minute hand cannot be read
        const sim0 = new Simulator(sc); runOracle(sc, { useWatch: true }, { sim: sim0 }); const go = sim0.transitOutFor(out)!;
        expect(new RallyClock(5).minuteAmbiguous(go), `seed ${seed} tier ${tier}: OUT ${formatClock(go)}`).toBe(true);
        const probe = new Simulator(sc); stepTo(probe, go); const o = probe.observe({ peek: true }).clock; expect(o.minuteAmbiguous).toBe(true); expect(o.minute).toBeNull(); void node;
      }
    }
  });
  it('INST-002 leaving a restart on the wrong minute is the debrief finding oneMinuteMistake, named separately from a late launch; the oracle leaves none', () => {
    for (const tier of [0, 1, 2]) {
      const d = drillById('D16')!; const sc = d.scenario(2, tier);
      const sim = new Simulator(sc); const naive = runBot(sim, new OracleBot(sim, { useWatch: true, wrongMinute: true }));
      const f = naive.findings.filter(x => x.kind === 'oneMinuteMistake'); expect(f.length, `tier ${tier}`).toBe(1); expect(Math.abs(f[0]!.seconds!)).toBeGreaterThan(50); expect(Math.abs(f[0]!.seconds!)).toBeLessThan(70);
      expect(f[0]!.text).toMatch(/minute was misread/); expect(f[0]!.text).toMatch(/TOD mode/); expect(naive.findings.some(x => x.kind === 'lateLaunch')).toBe(false);
      expect(d.rubric(naive, sc).feedback.join(' ')).toMatch(/minute was misread/);
      const ok = runOracle(sc, { useWatch: true }).r; expect(ok.findings.filter(x => x.kind === 'oneMinuteMistake')).toEqual([]);
    }
  });
});

describe('START-001 the start / restart procedure', () => {
  it('START-001 assigned starting position n leaves at base + n minutes (position 1 = base + 1); asp 0 keeps the base for drills that set no ASP', () => {
    const base = hms(8, 55, 0);
    for (const [asp, off] of [[0, 0], [1, 60], [7, 420], [120, 7200]] as const) {
      const sc = new ScenarioBuilder({ startTime: base, asp, driver: quiet }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
      expect(sc.startTime).toBe(base + off); expect(sc.baseStartTime).toBe(base); expect(sc.book[0]!.restartTime).toBe(base + off); expect(new Simulator(sc).launchInfo()!.ownTime).toBe(base + off);
    }
    const rs = new ScenarioBuilder({ startTime: base, asp: 3, driver: quiet }).start(35).advanceMiles(1).restart(40, base + 600).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    expect(rs.book[1]!.restartTime).toBe(base + 600 + 180);
  });
  it('START-001 launchTime = own time - the standing-start net loss (chart (a) 0 -> v); observe().launch carries it from the preread on', () => {
    for (const [car, v] of [[FORD_1939, 35], [FORD_1939, 50], [PACKARD_1936, 40]] as const) {
      const sc = flat({ car, asp: 2, prereadSeconds: 300 }).start(v).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc);
      const l = sim.observe({ peek: true }).launch!; expect(l.kind).toBe('start'); expect(l.line).toBe(1); expect(l.speed).toBe(v); expect(l.ownTime).toBe(T0 + 120);
      expect(l.netLoss).toBeCloseTo(Math.round(accelLoss(v, car) * 10) / 10, 6); expect(l.netLoss).toBeGreaterThan(1.5); expect(l.launchTime).toBeCloseTo(l.ownTime - l.netLoss, 6);
      expect(l.secondsToLaunch).toBeCloseTo(l.launchTime - sim.tod, 6);
    }
    expect(accelLoss(40, PACKARD_1936)).toBe(4.5);   // chart (a) 0 > 40
    // a driver in the middle of the course is not at a start: nothing to launch
    const sc = flat().start(35).advanceMiles(2).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc); startLikeOracle(sim); sim.step(30); expect(sim.observe({ peek: true }).launch).toBeNull();
  });
  it('START-001 startDeltas: every start and restart against its launch time: the oracle is on it, leaving at your own time is a lateLaunch by the net loss', () => {
    const d = drillById('D16')!; const sc = d.scenario(1, 0);
    const good = runOracle(sc).r; expect(good.startDeltas.map(x => x.kind)).toEqual(['start', 'restart']);
    for (const x of good.startDeltas) { expect(Math.abs(x.delta!), x.kind).toBeLessThan(0.3); expect(x.netLoss).toBeGreaterThan(1.5); expect(x.launchTime).toBeCloseTo(x.ownTime - x.netLoss, 6); expect(x.actual).toBeCloseTo(x.launchTime + x.delta!, 5); }
    expect(good.findings.filter(f => f.kind === 'lateLaunch' || f.kind === 'earlyLaunch')).toEqual([]);
    const sim = new Simulator(sc); const rookie = runBot(sim, new OracleBot(sim, { useWatch: true, ignoreLosses: true }));   // leaves at its own time, no lead
    const late = rookie.startDeltas.filter(x => x.delta! > 3); expect(late.length).toBeGreaterThanOrEqual(1); expect(rookie.findings.filter(f => f.kind === 'lateLaunch').length).toBeGreaterThanOrEqual(1);
    expect(late[0]!.delta).toBeCloseTo(late[0]!.netLoss, 0);
    expect(d.rubric(rookie, sc).stars).toBeLessThanOrEqual(2); expect(d.rubric(rookie, sc).feedback.join(' ')).toMatch(/launch/);
    expect(d.rubric(good, sc).stars).toBe(3); expect(d.rubric(good, sc).feedback.join(' ')).toMatch(/Start \(line 1\): your time/);
    // a start that never happens has no actual
    const never = new Simulator(sc).result(); expect(never.startDeltas[0]!.actual).toBeNull();
  });
  it('START-001 nobody releases you: other cars are queued at the sign, and pullUp is refused while the car one minute ahead is still at the sign', () => {
    const sc = flat({ asp: 5, prereadSeconds: 400, seed: 7 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const q0 = sim.observe({ peek: true }).startQueue!;
    expect(q0.cars.some(c => c.relative === 'ahead')).toBe(true); expect(q0.cars.some(c => c.relative === 'behind')).toBe(true);
    expect(q0.cars.filter(c => c.relative === 'ahead').every(c => c.position < 5)).toBe(true); expect(q0.cars.filter(c => c.relative === 'behind').every(c => c.position > 5)).toBe(true);
    expect(q0.carAheadAtSign).toBe(true); expect(q0.carAheadLeavesTod!).toBeGreaterThan(sim.tod);
    sim.act({ type: 'pullUp' }); expect(msgs(sim).join(' ')).toMatch(/car ahead is still at the sign/); expect(sim.events.some(e => e.type === 'pullUp.refused')).toBe(true);
    expect(sim.observe({ peek: true }).startQueue!.pulledUp).toBe(false);
    stepTo(sim, q0.carAheadLeavesTod! + 0.2); expect(sim.observe({ peek: true }).startQueue!.carAheadAtSign).toBe(false);
    sim.act({ type: 'pullUp' }); expect(sim.events.some(e => e.type === 'pullUp')).toBe(true); expect(sim.observe({ peek: true }).startQueue!.pulledUp).toBe(true);
    startLikeOracle(sim); const r = sim.result(); expect(r.startDeltas[0]!.pulledUp).toBe(true); expect(r.startDeltas[0]!.refusedPullUps).toBe(1);
    // the queue is seeded: the same scenario gives the same queue, another seed another one
    const again = new Simulator(sc).observe({ peek: true }).startQueue!; expect(JSON.stringify(again)).toBe(JSON.stringify(q0));
    const other = new Simulator(flat({ asp: 5, prereadSeconds: 400, seed: 8 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build()).observe({ peek: true }).startQueue!;
    expect(JSON.stringify(other.cars.map(c => c.leavesTod - T0))).not.toBe(JSON.stringify(q0.cars.map(c => c.leavesTod - T0)));
    // no car ahead (position 0): nothing to wait for
    const first = new Simulator(flat({ asp: 0, prereadSeconds: 100 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build()); first.act({ type: 'pullUp' });
    expect(first.events.some(e => e.type === 'pullUp')).toBe(true);
  });
  it('START-001 the driver expects "about 30 seconds": he asks for it before the launch time, and call.warn answers; the oracle gives it at every start and restart', () => {
    const sc = flat({ prereadSeconds: 200 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc); const l = sim.observe({ peek: true }).launch!;
    stepTo(sim, l.launchTime - 50); expect(msgs(sim).join(' ')).not.toMatch(/30 seconds/);
    stepTo(sim, l.launchTime - 44); expect(msgs(sim).filter(t => /about 30 seconds/i.test(t)).length).toBe(1);
    stepTo(sim, l.launchTime - 30); sim.act({ type: 'call.warn', seconds: 30 }); expect(msgs(sim).join(' ')).toMatch(/About 30 seconds, got it/); expect(sim.observe({ peek: true }).launch!.warned).toBe(true);
    expect(sim.events.find(e => e.type === 'call.warn')!.detail!.toLaunch).toBeCloseTo(30, 0);
    const sim2 = new Simulator(sc); stepTo(sim2, l.launchTime - 10); sim2.act({ type: 'call.warn' }); sim2.act({ type: 'start' });
    expect(msgs(sim2).filter(t => /about 30 seconds/i.test(t) && !/got it/i.test(t)).length).toBe(1);   // asked once, before the warning came
    const r = runOracle(drillById('D16')!.scenario(3, 0)).r; expect(r.startDeltas.every(x => x.warned && x.pulledUp)).toBe(true);
    // at a restart too
    const rs = drillById('D16')!.scenario(3, 0); const sim3 = new Simulator(rs); runBot(sim3, new OracleBot(sim3, { useWatch: true }));
    expect(sim3.driverMsgs.filter(m => /about 30 seconds, got it/i.test(m.text)).length).toBe(2);
  });
});

describe('START-002 pace cars one minute ahead and behind', () => {
  const road = (rung: 0 | 1 | 2 | 3, seed = 3, asp = 4) => new ScenarioBuilder({ startTime: T0, asp, seed, driver: quiet, aids: aidsForRung(rung), prereadSeconds: 60 }).start(35).advanceMiles(9).checkpoint().advanceFt(300).finish().build();
  /** Drive at the assigned speed and sample what the navigator sees every 5 s. */
  function sample(sc: Scenario, seconds = 600): { aheadSeen: number; behindSeen: number; n: number; sim: Simulator; first: ReturnType<Simulator['observe']> | null } {
    const sim = new Simulator(sc); startLikeOracle(sim); let aheadSeen = 0, behindSeen = 0, n = 0; let first: ReturnType<Simulator['observe']> | null = null;
    sim.step(60);
    for (let t = 0; t < seconds; t += 5) { sim.step(5); const o = sim.observe({ peek: true }); n++; if (o.ahead.some(f => f.kind === 'car')) { aheadSeen++; first = first ?? o; } if (o.paceCars.behind) behindSeen++; }
    return { aheadSeen, behindSeen, n, sim, first };
  }
  it('START-002 at rung >= 1 the car one minute ahead is in observe().ahead (kind car) and the one behind in observe().paceCars, each with its own seeded error; with no ASP there are no pace cars', () => {
    const { aheadSeen, behindSeen, n, first } = sample(road(1));
    expect(aheadSeen / n).toBeGreaterThan(0.85); expect(behindSeen / n).toBeGreaterThan(0.85);
    const f = first!.ahead.find(x => x.kind === 'car')!; expect(f.label).toMatch(/one minute ahead/); expect(f.paceCar!.offsetSeconds).toBe(-60); expect(f.approxDistanceFt).toBeGreaterThan(1500); expect(f.approxDistanceFt).toBeLessThan(5300);
    const pc = first!.paceCars; expect(pc.ahead!.offsetSeconds).toBe(-60); expect(pc.ahead!.position).toBe(3); expect(pc.behind!.offsetSeconds).toBe(60); expect(pc.behind!.position).toBe(5);
    expect(Math.abs(pc.ahead!.errorSeconds)).toBeLessThan(7); expect(Math.abs(pc.behind!.errorSeconds)).toBeLessThan(7);
    const errs = [3, 4, 5, 6].map(seed => { const s = new Simulator(road(1, seed)); startLikeOracle(s); s.step(120); return s.observe({ peek: true }).paceCars.ahead!.errorSeconds; });
    expect(new Set(errs).size).toBeGreaterThan(2);   // seeded: each scenario's car ahead has its own error
    const none = sample(road(3, 3, 0)); expect(none.aheadSeen).toBe(0); expect(none.behindSeen).toBe(0);
  });
  it('START-002 at rung 0 the pace cars are only occasionally in sight', () => {
    const { aheadSeen, n } = sample(road(0)); expect(aheadSeen).toBeGreaterThan(0); expect(aheadSeen / n).toBeLessThan(0.55); expect(sample(road(1)).aheadSeen / n).toBeGreaterThan(0.85);
  });
  it('START-002 gainingOnCarAhead is the live early/late cue in legal mode: true while the navigator runs well over the assigned speed, false while he holds it', () => {
    const sc = road(0, 3, 4); const sim = new Simulator(sc); startLikeOracle(sim); sim.step(90);
    let hold = 0, holdTrue = 0; for (let t = 0; t < 240; t += 2) { sim.step(2); const o = sim.observe({ peek: true }); if (o.ahead.some(f => f.kind === 'car')) { hold++; if (o.cues.gainingOnCarAhead) holdTrue++; } }
    expect(holdTrue).toBeLessThanOrEqual(Math.ceil(hold * 0.1));
    const sim2 = new Simulator(road(1, 3, 4)); startLikeOracle(sim2); sim2.step(60); sim2.act({ type: 'call.speed', mph: 42 });   // 20 % over
    let over = 0, overTrue = 0; for (let t = 0; t < 120; t += 2) { sim2.step(2); const o = sim2.observe({ peek: true }); if (t >= 20 && o.ahead.some(f => f.kind === 'car')) { over++; if (o.cues.gainingOnCarAhead) overTrue++; if (o.cues.gainingOnCarAhead) expect(o.ahead.find(f => f.kind === 'car')!.paceCar!.gaining).toBe(true); } }
    expect(over).toBeGreaterThan(10); expect(overTrue / over).toBeGreaterThan(0.8);
  });
});

/** One timed leg with a train at 0.5 mi, its checkpoint 1.0 mi later, then End timed portion, the TA point and a transit to the finish (as in v2-ta). */
function trainStage(trainSeconds = 140, rules: Partial<RulesConfig> = {}) {
  const b = flat({ rules }).start(35).advanceMiles(0.5);
  b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { speed: 35 });
  b.hazard({ kind: 'train', startTod: T0 + 30, durationSeconds: trainSeconds });
  b.advanceMiles(1.0).checkpoint().advanceFt(500);
  b.endTimedPortion({ endOfStage: true, transit: { exact: true, seconds: 1800 } }).advanceMiles(8).observationFinish();
  return b.build();
}
function silentBot(sim: Simulator): OracleBot { const bot = new OracleBot(sim, { noRecovery: true }); (bot as unknown as { declareTA: () => void }).declareTA = () => {}; return bot; }
function toWindow(sim: Simulator, bot: OracleBot): void { while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); } }
/** A leg with one hazard zone 0.5 mi in, a checkpoint 1.5 mi later, End timed portion + the TA point. */
function zoneStage(h: Parameters<ScenarioBuilder['hazard']>[0]) {
  const b = flat().start(35).advanceMiles(0.5); b.hazard(h); b.advanceMiles(1.5).checkpoint().advanceFt(500);
  b.endTimedPortion({ endOfStage: true, transit: { exact: false, seconds: 600, miles: 2 } }).advanceMiles(2).observationFinish(); return b.build();
}

describe('TAF-001 the 2026 TA web form and the classic paper mode', () => {
  it('TAF-001 ta.request carries car number, 4-digit password, phone, stage, cause and witnesses; they are recorded and the missing ones listed; a bad password is rejected', () => {
    const full = { type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 2, toLine: 2, carNumber: 12, password: '0427', phone: '555-0142', stage: 3, cause: 'train', witnesses: { ahead: 11, behind: 13 } } as const;
    expect(validateAction(full)).toBeNull(); expect(validateAction({ ...full, password: '04x7' })).toMatch(/4 digits/); expect(validateAction({ ...full, password: '123' })).not.toBeNull();
    expect(validateAction({ ...full, witnesses: 5 })).not.toBeNull(); expect(validateAction({ ...full, phone: 5 })).not.toBeNull(); expect(validateAction({ ...full, stage: {} })).not.toBeNull();
    const sc = trainStage(); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim); toWindow(sim, bot);
    sim.act({ ...full, seconds: 60 }); const a = sim.taRequests[0]!;
    expect(a.status).toBe('filed'); expect(a).toMatchObject({ carNumber: 12, password: '0427', phone: '555-0142', stage: 3, cause: 'train', witnesses: { ahead: 11, behind: 13 }, missingFields: [] });
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 60, fromLine: 2, toLine: 2, carNumber: 12, cause: 'train' }); const b = sim.taRequests[1]!;
    expect(b.status).toBe('filed'); expect(b.missingFields).toEqual(['password', 'phone', 'stage']);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 60, fromLine: 2, toLine: 2 }); expect(sim.taRequests[2]!.missingFields).toEqual(['carNumber', 'password', 'phone', 'stage', 'cause']);
    expect(sim.observe({ peek: true }).ta.mode).toBe('web'); expect(sim.observe({ peek: true }).ta.requests[0]!.carNumber).toBe(12);
  });
  it('TAF-001 the leg is checkpoints passed + 1, exposed as sim.legNumberFor(tod)', () => {
    const sc = flat().start(35).advanceMiles(1).checkpoint().advanceMiles(1).checkpoint().advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); expect(sim.legNumberFor(sim.tod)).toBe(1); expect(sim.legNumberFor()).toBe(1);
    stepUntil(sim, () => sim.records.filter(r => r.kind === 'timing').length === 2); const t1 = sim.records[0]!.rawTod!, t2 = sim.records[1]!.rawTod!;
    expect(sim.legNumberFor(t1 - 1)).toBe(1); expect(sim.legNumberFor(t1 + 1)).toBe(2); expect(sim.legNumberFor(t2 - 0.5)).toBe(2); expect(sim.legNumberFor(t2 + 0.5)).toBe(3); expect(sim.legNumberFor()).toBe(3);
    expect(sim.legNumberFor(T0 - 1000)).toBe(1);
  });
  it('TAF-001 classic paper mode (rules.taMode "paper"): a sheet is filed at a red checkpoint stop, no window and no printed TA point; the web form refuses without a TA point', () => {
    const paper = trainStage(140, { taMode: 'paper' }); const web = trainStage(140);
    const sim = new Simulator(paper); const bot = silentBot(sim); startLikeOracle(sim);
    while (sim.phase !== 'finished' && sim.legIndex < 2) { bot.onTick(); sim.step(0.1); }   // past the checkpoint, nowhere near a red checkpoint
    expect(sim.observe({ peek: true }).ta).toMatchObject({ mode: 'paper', windowOpen: false, atRedCheckpoint: false, eligibleLegs: [] });
    sim.act({ type: 'ta.request', legIndex: 1, seconds: 60, fromLine: 2, toLine: 2 }); expect(sim.taRequests[0]!.status).toBe('refused'); expect(sim.taRequests[0]!.reason).toMatch(/red \(observation\) checkpoint/);
    // the whole run: at the finish (an observation checkpoint) the oracle hands in the sheet
    const sim2 = new Simulator(paper); const r = runBot(sim2, new OracleBot(sim2));
    expect(r.ta.requests.length).toBe(1); const q = r.ta.requests[0]!; expect(q.status).toBe('filed'); expect(q.adjusted % 10).toBe(0); expect(q.adjusted).toBeGreaterThan(40); expect(q).toMatchObject({ cause: 'train', password: '1939', missingFields: [] });
    expect(r.score.legs[0]!.taCredit).toBe(q.adjusted > 0 ? r.score.legs[0]!.taCredit : 0); expect(r.score.legs[0]!.taCredit).toBeGreaterThan(40);
    expect(sim2.observe({ peek: true }).ta).toMatchObject({ mode: 'paper', windowOpen: true, atRedCheckpoint: true, eligibleLegs: [1] });
    // the web mode never needs the red checkpoint and a book with no TA point refuses
    const sim3 = new Simulator(flat().start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build()); sim3.act({ type: 'ta.request', legIndex: 1, seconds: 30, fromLine: 1, toLine: 1 }); expect(sim3.taRequests[0]!.reason).toMatch(/TA point/);
    expect(DEFAULT_RULES.taMode).toBe('web'); void web;
  });
});

describe('TAF-002 TA arithmetic: measured = stopped + chart loss; make up the odd seconds', () => {
  it('TAF-002 taAdvice: stoppedSeconds (wheels-stop to go) + chartLoss (stop and go for the speeds) = measured; makeUpToRound is the odd seconds; claim the multiple of 10 ("delayed 3:47, made up 7, claim 3:40")', () => {
    for (const d of [100, 117, 140]) {
      const sim = new Simulator(trainStage(d)); const bot = silentBot(sim); startLikeOracle(sim); toWindow(sim, bot); const a = sim.taAdvice(1);
      expect(a.stoppedSeconds).toBeGreaterThan(d - 45); expect(a.stoppedSeconds).toBeLessThan(d); expect(a.chartLoss).toBeCloseTo(Math.round(stopLoss(35, 35, sim.sc.car) * 10) / 10, 0); expect(a.chartLoss).toBeGreaterThan(5);
      expect(a.measured).toBeCloseTo(a.stoppedSeconds + a.chartLoss + a.otherDelay, 1); expect(a.otherDelay).toBeLessThan(1); expect(a.measured).toBeCloseTo(a.measuredDelay, 1);
      expect(a.makeUpToRound).toBe(Math.round(a.measured) % 10); expect(a.claim % 10).toBe(0); expect(a.claim + a.makeUpToRound).toBe(Math.round(a.measured)); expect(a.cause).toBe('train');
      expect(a.suggested % 10).toBe(0); expect(a.suggested).toBeLessThanOrEqual(a.claim);
    }
    // the worked example: 3:47 measured = 227 s -> make up 7, claim 220 (3:40)
    const w = new Simulator(trainStage()); const adv = w.taAdvice(1); expect(adv).toMatchObject({ stoppedSeconds: 0, chartLoss: 0, measured: 0, makeUpToRound: 0, claim: 0, cause: null });
    const m = 227; expect(m % 10).toBe(7); expect(Math.floor(m / 10) * 10).toBe(220);
  });
  it('TAF-002 a request for the claim is within the committee\'s credit (the chart loss is part of the delay now), and it is a multiple of 10', () => {
    const sim = new Simulator(trainStage(125)); const bot = silentBot(sim); startLikeOracle(sim); toWindow(sim, bot); const a = sim.taAdvice(1);
    sim.act({ type: 'ta.request', legIndex: 1, seconds: a.suggested, fromLine: a.fromLine!, toLine: a.toLine!, note: `Delayed ${Math.round(a.measured)} s, made up ${a.makeUpToRound} s` });
    while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); }
    const l = sim.result().score.legs[0]!; expect(l.taCredit).toBe(a.suggested); expect(l.taOverDeclared).toBe(false);
  });
  it('TAF-002 tractor, combine and construction zones are qualifying slow delays (the plain slow vehicle is not), each with its cause', () => {
    for (const kind of ['tractor', 'combine', 'construction'] as const) {
      const sc = zoneStage({ kind, speedMph: 15, lengthFt: 1800 }); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim); toWindow(sim, bot);
      expect(sim.taQualifying[1]!, kind).toBeGreaterThan(38); const a = sim.taAdvice(1); expect(a.cause).toBe(kind); expect(a.measured).toBeGreaterThan(38); expect(a.otherDelay).toBeGreaterThan(38); expect(a.stoppedSeconds).toBe(0);
      expect(sim.observe({ peek: true }).ahead.length).toBeGreaterThanOrEqual(0);
    }
    const slow = new Simulator(zoneStage({ kind: 'slow', speedMph: 15, lengthFt: 1800, passWindowAfterFt: 900 })); const b2 = silentBot(slow); startLikeOracle(slow); toWindow(slow, b2); expect(slow.taQualifying[1] ?? 0).toBe(0);
    // the zone is visible on the road with its name
    const sc = zoneStage({ kind: 'combine', speedMph: 15, lengthFt: 1800 }); const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.observe({ peek: true }).ahead.some(f => f.kind === 'combine'), 300);
    expect(sim.observe({ peek: true }).ahead.find(f => f.kind === 'combine')!.label).toMatch(/Combine ahead/);
  });
  it('TAF-002 a school bus is a blocking delay: the car waits behind it while it is stopped, and the stop is stopped time + the chart loss (qualifying)', () => {
    const sc = zoneStage({ kind: 'schoolBus', s: 0.6 * 5280, startTod: T0 + 40, durationSeconds: 70 }); const sim = new Simulator(sc); const bot = silentBot(sim); startLikeOracle(sim);
    let sawBus = false, minV = 99; while (sim.phase !== 'finished' && !sim.taState().windowOpen) { bot.onTick(); sim.step(0.1); if (sim.observe({ peek: true }).ahead.some(f => f.kind === 'schoolBus')) sawBus = true; if (sim.car.s > 0.6 * 5280 - 100 && sim.car.s < 0.6 * 5280) minV = Math.min(minV, sim.car.mph()); }
    expect(sawBus).toBe(true); expect(minV).toBe(0); expect(msgs(sim).join(' ')).toMatch(/School bus stopped/); expect(msgs(sim).join(' ')).toMatch(/bus is moving/);
    const a = sim.taAdvice(1); expect(a.cause).toBe('schoolBus'); expect(a.stoppedSeconds).toBeGreaterThan(20); expect(a.stoppedSeconds).toBeLessThan(75); expect(a.chartLoss).toBeGreaterThan(5);
    expect(a.measured).toBeCloseTo(a.stoppedSeconds + a.chartLoss, 1); expect(sim.taQualifying[1]!).toBeCloseTo(a.measured, 1);
    // a car that arrives after the bus has gone is not held
    const late = new Simulator(zoneStage({ kind: 'schoolBus', s: 0.6 * 5280, startTod: T0 - 100, durationSeconds: 60 })); const b2 = silentBot(late); startLikeOracle(late); toWindow(late, b2); expect(late.taQualifying[1] ?? 0).toBe(0);
  });
  it('TAF-002 the generator can place the named causes (profile.delayCauses) and the oracle still finishes a day and files the cause', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) { const sc = generateStage(seed, { ...PROFILES.fullStage, delayCauses: true, trafficWaitProbability: 0 }); for (const h of sc.hazards) if (['tractor', 'combine', 'construction', 'schoolBus'].includes(h.kind)) kinds.add(h.kind); }
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    for (let seed = 1; seed <= 10; seed++) {
      const sc = generateStage(seed, { ...PROFILES.fullStage, delayCauses: true, trafficWaitProbability: 0 }); if (!sc.hazards.some(h => ['tractor', 'combine', 'construction', 'schoolBus'].includes(h.kind))) continue;
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true })); expect(sim.phase).toBe('finished'); expect(r.offCourseCount).toBe(0);
      expect(r.ta.requests.every(q => q.status === 'filed' && q.adjusted % 10 === 0 && q.cause !== undefined)).toBe(true); break;
    }
  });
});

describe('MAKEUP-001 the make-up ledger', () => {
  it('MAKEUP-001 makeUpPlan(seconds, assigned): +10 % for 10 x the seconds (6 s a minute), +20 % for 5 x (12 s a minute)', () => {
    expect(makeUpPlan(4, 35)).toEqual({ plus10: { mph: 38.5, seconds: 40 }, plus20: { mph: 42, seconds: 20 } });
    expect(makeUpPlan(7, 40)).toEqual({ plus10: { mph: 44, seconds: 70 }, plus20: { mph: 48, seconds: 35 } });
    expect(makeUpPlan(0, 30).plus10.seconds).toBe(0); expect(makeUpPlan(-3, 30).plus20.seconds).toBe(0);
    for (const [s, v] of [[4, 35], [9, 45], [12, 20]] as const) { const p = makeUpPlan(s, v); expect(p.plus10.seconds * 6 / 60).toBeCloseTo(s * 10 * 0.1, 6); expect(p.plus20.seconds * 12 / 60).toBeCloseTo(s, 6); }
  });
  it('MAKEUP-001 ledger.set keeps a running make-up total of entries {seconds, source}; the believed lateness defaults to that total', () => {
    expect(makeUpTotal([{ seconds: 4, source: 'stop' }, { seconds: 2.5, source: 'turn' }, { seconds: -1, source: 'early' }])).toBe(5.5);
    const sim = new Simulator(flat().start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build()); startLikeOracle(sim); sim.step(20);
    sim.act({ type: 'ledger.set', seconds: 7, entries: [{ seconds: 4, source: 'stop' }, { seconds: 3, source: 'turn' }] });
    let o = sim.observe({ peek: true }); expect(o.makeUpTotal).toBe(7); expect(o.ledger).toBe(7); expect(o.ledgerEntries).toEqual([{ seconds: 4, source: 'stop' }, { seconds: 3, source: 'turn' }]);
    sim.act({ type: 'ledger.set', entries: [{ seconds: 4, source: 'stop' }, { seconds: 3, source: 'turn' }, { seconds: 2, source: 'train' }] }); o = sim.observe({ peek: true });
    expect(o.makeUpTotal).toBe(9); expect(o.ledger).toBe(9); expect(sim.result().ledgerLog.map(l => l.makeUpTotal)).toEqual([7, 9]);
    sim.act({ type: 'ledger.set', seconds: 3 }); expect(sim.observe({ peek: true }).makeUpTotal).toBe(9);   // a plain ledger.set leaves the entries alone
    expect(sim.observe({ peek: true }).ledger).toBe(3);
  });
  /** 35 mph, a speed change to 45 at a sign 1.0 mi in, then a checkpoint. */
  const changeSc = () => flat().start(35).advanceMiles(1.0).speedAtSign('SPEED LIMIT 45', 45).advanceMiles(1.0).checkpoint().advanceFt(300).finish().build();
  it('MAKEUP-001 the simulator drops the "+%" at the speed-change sign (the make-up is 10 % over the speed it was begun on) and the oracle re-applies it on the new speed', () => {
    const sim = new Simulator(changeSc()); startLikeOracle(sim); sim.step(30); sim.act({ type: 'call.speed', mph: 38.5 });
    expect(sim.makeUp).not.toBeNull(); expect(sim.makeUp!.assigned).toBe(35); expect(sim.makeUp!.pct).toBeCloseTo(10, 1);
    stepUntil(sim, () => sim.makeUpDrops > 0, 120);
    expect(sim.makeUpDrops).toBe(1); expect(sim.targetIndicated).toBe(45); expect(sim.makeUp).toBeNull(); expect(msgs(sim).join(' ')).toMatch(/Assigned speed is 45 now: dropping the extra/); expect(sim.events.some(e => e.type === 'makeUp.dropped')).toBe(true);
    // a navigator who already called the new speed (or never made up) has nothing dropped
    const a = new Simulator(changeSc()); startLikeOracle(a); a.step(30); a.act({ type: 'call.speed', mph: 38.5 }); stepUntil(a, () => a.car.s > 4500); a.act({ type: 'call.speed', mph: 45 }); stepUntil(a, () => a.car.s > 5600);
    expect(a.makeUpDrops).toBe(0); expect(a.makeUp).toBeNull();
    const b = new Simulator(changeSc()); startLikeOracle(b); b.step(30); b.act({ type: 'call.speed', mph: 36 }); expect(b.makeUp).toBeNull();   // +3 % is no make-up
    // the lead call of the coming speed (45 before the sign) is not a make-up of 29 %
    const c = new Simulator(changeSc()); startLikeOracle(c); stepUntil(c, () => c.car.s > 4600); c.act({ type: 'call.speed', mph: 45 }); expect(c.makeUp).toBeNull();
    // the oracle that was dropped starts over: its recovery state is cleared and it re-applies on the new assigned speed
    const sim2 = new Simulator(changeSc()); const bot = new OracleBot(sim2, { useWatch: true }); startLikeOracle(sim2); sim2.step(30); sim2.act({ type: 'call.speed', mph: 38.5 });
    (bot as unknown as { recovering: number | null }).recovering = 38.5;
    stepUntil(sim2, () => sim2.makeUpDrops > 0, 120); bot.onTick(); expect((bot as unknown as { recovering: number | null }).recovering).toBeNull();
  });
  it('MAKEUP-001 shortening a stop recovers time: a go call 5 s early at a 20 s pause leaves the car 5 s earlier at the checkpoint', () => {
    const sc = flat().start(35).advanceMiles(0.6).stop('S', 35, { pause: 20 }).advanceMiles(1.0).checkpoint().advanceFt(300).finish().build();
    const run = (shorten: number): number => {
      const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.waitingForGo, 600); const dwell = Math.max(0, 20 - stopLoss(35, 35, sc.car));
      sim.step(dwell - shorten); sim.act({ type: 'call.go' }); stepUntil(sim, () => sim.phase === 'finished', 1200); return sim.result().score.legs[0]!.rawError!;
    };
    const base = run(0), early = run(5); expect(early - base).toBeLessThanOrEqual(-4); expect(early - base).toBeGreaterThanOrEqual(-6); expect(Math.abs(base)).toBeLessThanOrEqual(2);
  });
  it('MAKEUP-001 making up inside a stopwatch-timed interval is the debrief finding timedIntervalDisturbed (never when the speed is held)', () => {
    const sc = flat().start(30).advanceMiles(0.3).timedAt('bridge', { holdSpeed: 30, seconds: 60, thenSpeed: 40 }).advanceMiles(1.0).speedAtSign('SPEED LIMIT 40', 40).advanceMiles(0.8).checkpoint().advanceFt(300).finish().build();
    const run = (call: number | null): Simulator => {
      const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.events.some(e => e.type === 'passed' && e.detail?.what === 'bridge'), 600);
      sim.step(5); if (call !== null) sim.act({ type: 'call.speed', mph: call }); sim.step(40); return sim;
    };
    const bad = run(34); expect(bad.makeUp).not.toBeNull(); const f = bad.result().findings.filter(x => x.kind === 'timedIntervalDisturbed'); expect(f.length).toBe(1); expect(f[0]!.line).toBe(2); expect(f[0]!.text).toMatch(/Never make up time inside a timed interval/);
    expect(run(null).result().findings.filter(x => x.kind === 'timedIntervalDisturbed')).toEqual([]);
    expect(run(31).result().findings.filter(x => x.kind === 'timedIntervalDisturbed')).toEqual([]);   // a 3 % wander is noise, not a make-up
    // the oracle never disturbs a timed interval
    const sim = new Simulator(sc); expect(runBot(sim, new OracleBot(sim, { useWatch: true })).findings.filter(x => x.kind === 'timedIntervalDisturbed')).toEqual([]);
  });
});

describe('PROTO-001 the callout protocol in the driver model', () => {
  it('PROTO-001 ICE: call.identify is answered "I see it too", and the driver says "mark" at the sign that was identified (and only then)', () => {
    const sc = flat().start(35).advanceMiles(0.5).speedAtSign('SPEED LIMIT 35', 35).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); sim.step(20); sim.act({ type: 'call.identify', text: 'speed limit sign on the right' });
    expect(msgs(sim).filter(t => t === 'I see it too').length).toBe(1); expect(sim.driverMsgs.find(m => m.text === 'I see it too')!.kind).toBe('readback');
    expect(msgs(sim)).not.toContain('Mark'); stepUntil(sim, () => sim.events.some(e => e.type === 'passed' && String(e.detail?.what).includes('SPEED LIMIT')), 300);
    expect(msgs(sim).filter(t => t === 'Mark').length).toBe(1); expect(sim.events.find(e => e.type === 'mark')!.detail!.identified).toBe('speed limit sign on the right');
    const quietSim = new Simulator(sc); startLikeOracle(quietSim); quietSim.step(20); stepUntil(quietSim, () => quietSim.events.some(e => e.type === 'passed' && String(e.detail?.what).includes('SPEED LIMIT')), 300);
    expect(msgs(quietSim)).not.toContain('Mark'); expect(validateAction({ type: 'call.identify', text: 'x'.repeat(201) })).not.toBeNull();
  });
  it('PROTO-001 the driver reads back "holding 35" unprompted every 2-4 minutes while rolling', () => {
    const sc = flat().start(35).advanceMiles(13).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc); startLikeOracle(sim);
    while (sim.phase !== 'finished' && sim.tod < T0 + 1500) sim.step(1);
    const hs = sim.driverMsgs.filter(m => m.text === 'Holding 35'); expect(hs.length).toBeGreaterThanOrEqual(3); expect(hs.every(m => m.kind === 'readback')).toBe(true);
    const gaps = hs.slice(1).map((m, i) => m.tod - hs[i]!.tod); for (const g of gaps) { expect(g).toBeGreaterThanOrEqual(119.5); expect(g).toBeLessThanOrEqual(240.5); }
    expect(hs[0]!.tod - sim.events.find(e => e.type === 'depart')!.tod).toBeGreaterThanOrEqual(119.5);
    // none while stopped: a long wait at a stop adds no read-back
    expect(sim.sc.hazards.length).toBe(0);
  });
  it('PROTO-001 stop count support: act count is echoed; when the driver has not gone ("waiting on traffic") he says "keep counting" and the count continues past zero', () => {
    let proven = false;
    for (let seed = 1; seed <= 12 && !proven; seed++) {
      const sc = flat({ seed, trafficWaitProbability: 1 }).start(35).advanceMiles(0.5).stop('S', 35, { pause: 15 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
      const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.waitingForGo, 300);
      for (const n of [9, 8, 7]) sim.act({ type: 'count', n }); expect(msgs(sim).slice(-3)).toEqual(['9', '8', '7']); expect(msgs(sim)).not.toContain('Keep counting');
      sim.act({ type: 'call.go' }); if (!msgs(sim).includes('Waiting on traffic')) continue;
      proven = true; expect(msgs(sim)).toContain('Keep counting'); const before = msgs(sim).filter(t => t === 'Keep counting').length;
      sim.act({ type: 'count', n: 0 }); expect(msgs(sim).slice(-2)).toEqual(['0', 'Keep counting']); sim.act({ type: 'count', n: 1 }); expect(msgs(sim).at(-1)).toBe('1'); sim.act({ type: 'count', n: 2 }); expect(msgs(sim).at(-1)).toBe('2');
      expect(msgs(sim).filter(t => t === 'Keep counting').length).toBe(before + 1); expect(sim.events.filter(e => e.type === 'count').map(e => e.detail!.n)).toEqual([9, 8, 7, 0, 1, 2]);
      stepUntil(sim, () => !sim.waitingForGo, 60); expect(msgs(sim).join(' ')).toMatch(/Clear, going/);
      sim.act({ type: 'count', n: 3 }); expect(msgs(sim).at(-1)).toBe('3'); expect(msgs(sim).filter(t => t === 'Keep counting').length).toBe(before + 1);   // he has gone: no more "keep counting"
    }
    expect(proven).toBe(true);
  });
  it('PROTO-001 at aids rung >= 2 a prompt event nextCall names the expected next navigator call, once per line, before the line; rung < 2 has none', () => {
    const mk = (rung: 0 | 1 | 2 | 3) => new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(rung) }).start(35).advanceMiles(0.8).instruction({ exits: EXITS.tee('L'), sightDistance: 600, label: 'T' }, { turn: 'L', speed: 35 })
      .advanceMiles(0.8).speedAtSign('SPEED LIMIT 45', 45).advanceMiles(0.8).stop('S', 45, { pause: 15 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    for (const rung of [2, 3] as const) {
      const sim = new Simulator(mk(rung)); const bot = new OracleBot(sim); let seen: string | null = null;
      while (sim.phase !== 'finished') { bot.onTick(); sim.step(0.1); const n = sim.observe({ peek: true }).nextCall; if (n && n.line === 2 && !seen) seen = `${n.call}|${n.text}|${Math.round(sim.car.s)}`; }
      const ev = sim.events.filter(e => e.type === 'nextCall'); expect(ev.map(e => e.detail!.call)).toEqual(['call.turn L', 'call.speed 45', 'call.go', 'call.stop']);
      expect(new Set(ev.map(e => e.detail!.line)).size).toBe(ev.length); expect(seen!).toMatch(/^call\.turn L\|Next: call the left at line 2\|\d+$/);
      for (const e of ev) { const ins = sim.sc.book.find(i => i.n === e.detail!.line)!; const dist = nodeById(sim.sc.course, ins.nodeId).s - e.s; expect(dist).toBeGreaterThan(0); expect(dist).toBeLessThanOrEqual(705); }
    }
    for (const rung of [0, 1] as const) { const sim = new Simulator(mk(rung)); startLikeOracle(sim); stepUntil(sim, () => sim.car.s > 4000, 300); expect(sim.events.some(e => e.type === 'nextCall')).toBe(false); expect(sim.observe({ peek: true }).nextCall).toBeNull(); }
  });
});

describe('SPEED-001 speeds 10-55 in charts and the generator', () => {
  it('SPEED-001 buildPerfTable covers 10..55 mph for a model car; the Packard keeps its printed 15-50 exactly and has 55 extrapolated and flagged', () => {
    expect(CHART_SPEEDS).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const f = buildPerfTable(FORD_1939); expect(f.speeds).toEqual(CHART_SPEEDS); expect(f.extrapolated).toEqual([]);
    for (const m of [f.accel, f.stopGo, f.turns]) for (const r of m.speeds) for (const c of m.speeds) { expect(Number.isFinite(m.rows[r]![c]!)).toBe(true); expect(m.rows[r]![c]!).toBeGreaterThanOrEqual(0); }
    expect(f.accel.rows[0]![10]!).toBeGreaterThan(0); expect(f.accel.rows[0]![10]!).toBeLessThan(f.accel.rows[0]![55]!); expect(f.stopGo.rows[10]![10]!).toBeGreaterThan(f.stopGo.rows[55]![55]!);
    const p = buildPerfTable(PACKARD_1936); expect(p.speeds).toEqual([15, 20, 25, 30, 35, 40, 45, 50, 55]); expect(p.extrapolated).toEqual([55]); expect(PACKARD_1936.extrapolated).toEqual([55]);
    expect(p.stopGo.rows[30]![40]).toBe(8.6); expect(p.accel.rows[0]![40]).toBe(4.5); expect(p.turns.rows[40]![35]).toBe(4); expect(p.accel.rows[0]![50]).toBe(6.4); expect(p.stopGo.rows[50]![50]).toBe(5.3);
    // 55 follows the trend of the printed 45 -> 50 (linear), one decimal: 0 > 55 = 6.4 + (6.4 - 5.6) = 7.2
    expect(p.accel.rows[0]![55]).toBe(7.2); expect(p.accel.rows[55]![55]).toBe(0); expect(p.stopGo.rows[50]![55]!).toBeLessThan(p.stopGo.rows[50]![50]!); expect(p.stopGo.rows[55]![30]!).toBeLessThan(p.stopGo.rows[50]![30]!);
    for (const r of p.stopGo.speeds) for (const c of p.stopGo.speeds) expect(Math.abs(p.stopGo.rows[r]![c]! * 10 - Math.round(p.stopGo.rows[r]![c]! * 10))).toBeLessThan(1e-9);
  });
  it('SPEED-001 the generator uses 48 as an assigned speed on some days and 55 in the calibration run on some days (both only sometimes); 15-55 otherwise', () => {
    let n48 = 0, n55cal = 0, n50cal = 0; const all = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const sc = generateStage(seed, PROFILES.fullStage);
      for (const i of sc.book) for (const v of [i.speed, i.timed?.holdSpeed, i.timed?.thenSpeed]) if (v !== undefined) { all.add(v); if (v === 48) n48++; }
      const t = sc.tags!.find(x => x.startsWith('calibration:speed:'))!; if (t.endsWith(':55')) n55cal++; else { expect(t.endsWith(':50')).toBe(true); n50cal++; }
      const cal = sc.book.find(i => i.calibrationStart)!; expect(cal.speed).toBe(Number(t.split(':')[2]));
    }
    expect(n48).toBeGreaterThan(0); expect(n55cal).toBeGreaterThan(0); expect(n50cal).toBeGreaterThan(0); expect(all.has(55)).toBe(true); expect([...all].every(v => v === 48 || v % 5 === 0)).toBe(true);
    const share48 = n48 / [...Array(12).keys()].reduce((a, k) => a + generateStage(k + 1, PROFILES.fullStage).book.length, 0); expect(share48).toBeLessThan(0.08);   // sometimes, not often
  });
  it('SPEED-001 the oracle drives a 48 and a 55 calibration day: k is measured at the calibration speed and holds the day', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sc = generateStage(seed, { ...PROFILES.fullStage, trafficWaitProbability: 0 }); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true }));
      expect(sim.phase).toBe('finished'); expect(r.offCourseCount).toBe(0); expect(r.score.raw).toBeLessThan(60);
    }
  });
});

describe('CAL-006 calibration run: no live early/late feedback; the schedule correction', () => {
  it('CAL-006 scheduleCorrection(errorSeconds, runSeconds) = "1 s per N min" from the measured calibration error', () => {
    expect(scheduleCorrection(5.6, 28 * 60)).toBe('1 s per 5 min'); expect(scheduleCorrection(-5.6, 28 * 60)).toBe('1 s per 5 min'); expect(scheduleCorrection(14, 28 * 60)).toBe('1 s per 2 min');
    expect(scheduleCorrection(0, 28 * 60)).toBe('no correction'); expect(scheduleCorrection(3, 0)).toBe('no correction'); expect(scheduleCorrection(100, 600)).toBe('1 s per 1 min');
    expect(scheduleCorrectionMinutes(2, 3000)).toBe(25); expect(scheduleCorrectionMinutes(4.1, 28 * 60 + 47.3)).toBe(7); expect(scheduleCorrectionMinutes(0, 100)).toBeNull();
  });
  it('CAL-006 inside the calibration run the pace bar, countdown, cumulative times and the pace-car cue are suppressed at every rung; outside it the rung\'s aids are back', () => {
    for (const rung of [3, 2] as const) {
      const sc = generateStage(1, { ...PROFILES.fullStage, aids: aidsForRung(rung), asp: 6, trafficWaitProbability: 0 });
      const cal = sc.book.filter(i => i.section === 'calibration'); const lo = nodeById(sc.course, cal.find(i => i.calibrationStart)!.nodeId).s, hi = nodeById(sc.course, cal[cal.length - 1]!.nodeId).s;
      const sim = new Simulator(sc); const bot = new OracleBot(sim, { useWatch: true }); let inside = 0, outsideTimed = 0, carSeen = 0, last = -9;
      while (sim.phase !== 'finished' && sim.legIndex < 2) {
        bot.onTick(); sim.step(0.1);
        if (sim.phase !== 'running' || sim.tod - last < 3) continue; last = sim.tod; const o = sim.observe({ peek: true }); const s = sim.car.s;
        if (s >= lo && s <= hi) { inside++; expect(o.aids.earlyLate, `rung ${rung} s ${s}`).toBeUndefined(); expect(o.aids.countdown ?? null).toBeNull(); expect(o.aids.cumulativePerfectAtNextLine).toBeUndefined(); expect(o.cues.gainingOnCarAhead).toBe(false); expect(o.ahead.some(f => f.kind === 'car')).toBe(false); }
        else if (s > hi + 3000 && sim.legIndex === 1) { outsideTimed++; expect(typeof o.aids.earlyLate).toBe('number'); if (o.ahead.some(f => f.kind === 'car')) carSeen++; }
      }
      expect(inside).toBeGreaterThan(30); expect(outsideTimed).toBeGreaterThan(5); expect(carSeen).toBeGreaterThan(0);
    }
    for (const rung of [0, 1] as const) { const sc = generateStage(1, { ...PROFILES.fullStage, aids: aidsForRung(rung) }); const sim = new Simulator(sc); const bot = new OracleBot(sim, { useWatch: true }); let n = 0; while (sim.phase !== 'finished' && n++ < 30000) { bot.onTick(); sim.step(0.1); if (n % 50 === 0) expect(sim.observe({ peek: true }).aids.earlyLate).toBeUndefined(); } }
  });
});

describe('LOST-001 the lost doctrine in D10', () => {
  it('LOST-001 parseLostNote reads "lost 94", "lost 1:34" and "doubled 1:34.5"', () => {
    expect(parseLostNote('lost 94')).toBe(94); expect(parseLostNote('Lost: 1:34')).toBe(94); expect(parseLostNote('doubled 1:34.5')).toBe(94.5); expect(parseLostNote('nothing here')).toBeNull(); expect(parseLostNote('lost')).toBeNull();
  });
  /** A wrong turn at the first crossroads, a turn-around 12 s later, back at the junction. `watch`: start the stopwatch at the turn-around; `note`: write the doubled time (+ error). */
  function lostRun(o: { watch: boolean; noteError: number | null }) {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, excursionFt: 1500, seed: 4 }).start(35).advanceMiles(0.8).instruction({ exits: EXITS.crossroads('R'), sightDistance: 700 }, { turn: 'R', speed: 35 }).advanceMiles(1.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim); const node = sc.course.nodes.find(n => n.kind === 'intersection')!;
    stepUntil(sim, () => sim.car.s > node.s - 500, 300); sim.act({ type: 'call.turn', dir: 'L' });   // the wrong way
    stepUntil(sim, () => sim.events.some(e => e.type === 'offCourse'), 120); sim.step(12); sim.act({ type: 'call.uturn' }); if (o.watch) sim.act({ type: 'watch.start' });
    stepUntil(sim, () => sim.events.some(e => e.type === 'rejoin'), 300);
    const t0 = sim.events.find(e => e.type === 'call.uturn')!.tod, t1 = sim.events.find(e => e.type === 'rejoin')!.tod;
    if (o.noteError !== null) sim.act({ type: 'note', text: `lost ${Math.round(2 * (t1 - t0) + o.noteError)}` });
    sim.act({ type: 'call.turn', dir: 'R' }); stepUntil(sim, () => sim.phase === 'finished', 1200);
    return { sc, r: sim.result(), doubled: 2 * (t1 - t0) };
  }
  it('LOST-001 on a wrong turn the rubric scores the doctrine: the stopwatch started at the turn-around and the doubled time within 2 s (2 stars for one excursion, else 1)', () => {
    const d10 = drillById('D10')!; const good = lostRun({ watch: true, noteError: 0 });
    expect(good.r.offCourseCount).toBe(1); const lp = lostProcedure(good.r); expect(lp.length).toBe(1); expect(lp[0]!.watchStarted).toBe(true); expect(lp[0]!.ok).toBe(true); expect(lp[0]!.doubled).toBeCloseTo(good.doubled, 6); expect(lp[0]!.doubled).toBeGreaterThan(30);
    const rb = d10.rubric(good.r, good.sc); expect(rb.stars).toBe(2); expect(rb.feedback.join(' ')).toMatch(/Lost \(LOST-001\)/); expect(rb.feedback.join(' ')).toMatch(/rejoin 30 s behind a car you know is on course/); expect(rb.headline).toMatch(/doubled within 2 s/);
    expect(lostRun({ watch: true, noteError: 1.4 }).r.offCourseCount).toBe(1);
    expect(d10.rubric(lostRun({ watch: true, noteError: 1.4 }).r, good.sc).stars).toBe(2);   // within 2 s
    const off = lostRun({ watch: true, noteError: 6 }); expect(d10.rubric(off.r, off.sc).stars).toBe(1); expect(d10.rubric(off.r, off.sc).feedback.join(' ')).toMatch(/more than 2 s off/);
    const nowatch = lostRun({ watch: false, noteError: 0 }); expect(lostProcedure(nowatch.r)[0]!.watchStarted).toBe(false); expect(d10.rubric(nowatch.r, nowatch.sc).stars).toBe(1); expect(d10.rubric(nowatch.r, nowatch.sc).feedback.join(' ')).toMatch(/Start the stopwatch at the turn-around/);
    const nonote = lostRun({ watch: true, noteError: null }); expect(d10.rubric(nonote.r, nonote.sc).stars).toBe(1); expect(d10.rubric(nonote.r, nonote.sc).feedback.join(' ')).toMatch(/no lost time/);
    // on course all the way: the doctrine is not asked for
    const sim = new Simulator(d10.scenario(1, 0)); const clean = runBot(sim, new OracleBot(sim)); expect(clean.offCourseCount).toBe(0); expect(lostProcedure(clean)).toEqual([]); expect(d10.rubric(clean, sim.sc).stars).toBe(3);
    expect(d10.objective).toMatch(/lost doctrine/);
  });
});

describe('PREREAD-001 checkpoint times and chart losses written in Column D', () => {
  it('PREREAD-001 parseCpNotes reads "CP3 09:14:22"; lossNumbers reads "loss 10.2" and signed "-2.3"', () => {
    expect(parseCpNotes(['CP3 09:14:22', 'cp 4 9:20:01 am', 'nothing', 'CP#5 21:03:09'])).toEqual([{ cp: 3, tod: 9 * 3600 + 14 * 60 + 22 }, { cp: 4, tod: 9 * 3600 + 20 * 60 + 1 }, { cp: 5, tod: 9 * 3600 + 3 * 60 + 9 }]);
    expect(lossNumbers('loss 10.2')).toEqual([10.2]); expect(lossNumbers('-2.3')).toEqual([2.3]); expect(lossNumbers('pause 4.8 s; -2.3 chart')).toEqual([2.3]); expect(lossNumbers('9:41:00 restart')).toEqual([]); expect(lossNumbers('35 mph')).toEqual([]);
  });
  it('PREREAD-001 D16 grades "CP1 hh:mm:ss" notes within 2 s of the crossing, only when the player wrote them', () => {
    const d = drillById('D16')!; const sc = d.scenario(2, 0);
    const run = (delta: number | null) => {
      const seen = new Set<string>();
      return runOracle(sc, { useWatch: true }, { hook: s => { if (delta === null) return; for (const [i, rec] of s.records.entries()) if (rec.kind === 'timing' && rec.actualTod !== null && !seen.has(rec.cpId)) { seen.add(rec.cpId); s.act({ type: 'line.annotate', n: Math.max(1, s.currentLine), text: `CP${i + 1} ${formatClock(rec.actualTod + delta)}` }); } } }).r;
    };
    const good = run(0); const g = gradeCheckpointNotes(good); expect(g.attempted).toBe(true); expect(g.total).toBe(3); expect(g.good).toBe(3); expect(d.rubric(good, sc).feedback.join(' ')).toMatch(/Checkpoint times \(PREREAD-001\): 3\/3 within 2 s/);
    const near = gradeCheckpointNotes(run(2)); expect(near.good).toBe(3); const off = gradeCheckpointNotes(run(3)); expect(off.good).toBe(0); expect(off.lines.join(' ')).toMatch(/within 2 s needed/);
    expect(d.rubric(run(3), sc).feedback.join(' ')).toMatch(/Checkpoint times \(PREREAD-001\): 0\/3/);
    const none = run(null); expect(gradeCheckpointNotes(none).attempted).toBe(false); expect(d.rubric(none, sc).feedback.join(' ')).not.toMatch(/Checkpoint times/);
    expect(d.rubric(good, sc).stars).toBe(3);
  });
  it('PREREAD-001 D15 grades checkpoint times (within 2 s) and chart losses pre-written beside stops and turns (within 1 s); optional, and counted when attempted', () => {
    const d = drillById('D15')!; const sc = d.scenario(1, 0); const sp = lineSpeeds(sc);
    const losses = sc.book.map(i => ({ n: i.n, loss: chartLossFor(sc, i, sp.get(i.n)!) })).filter(x => x.loss !== null) as { n: number; loss: number }[];
    expect(losses.length).toBeGreaterThan(15); expect(sc.book.filter(i => i.pause).every(i => losses.some(l => l.n === i.n))).toBe(true); expect(sc.book.filter(i => i.turn && i.turn !== 'S' && !i.pause && i.section !== 'start').every(i => losses.some(l => l.n === i.n))).toBe(true);
    const stop = sc.book.find(i => i.pause)!; const stopLossV = chartLossFor(sc, stop, sp.get(stop.n)!)!; expect(stopLossV).toBeGreaterThan(5); expect(stopLossV).toBeLessThan(15);
    const run = (offset: number | null, cpDelta: number | null) => {
      let done = false; const seen = new Set<string>();
      return runOracle(sc, { useWatch: true }, { hook: s => {
        if (!done && offset !== null) { done = true; for (const l of losses) s.act({ type: 'line.annotate', n: l.n, text: `loss ${(l.loss + offset).toFixed(1)}` }); } else done = true;
        if (cpDelta !== null) for (const [i, rec] of s.records.entries()) if (rec.kind === 'timing' && rec.actualTod !== null && !seen.has(rec.cpId)) { seen.add(rec.cpId); s.act({ type: 'line.annotate', n: Math.max(1, s.currentLine), text: `CP${i + 1} ${formatClock(rec.actualTod + cpDelta)}` }); }
      } }).r;
    };
    const exact = run(0, 0); const cl = gradeChartLossNotes(exact, sc); expect(cl.attempted).toBe(true); expect(cl.total).toBe(losses.length); expect(cl.good).toBe(cl.total);
    const fb = d.rubric(exact, sc).feedback.join(' '); expect(fb).toMatch(new RegExp(`Chart losses beside stops and turns \\(PREREAD-001\\): ${cl.total}/${cl.total} within 1 s`)); expect(fb).toMatch(/Checkpoint times \(PREREAD-001\): \d+\/\d+ within 2 s/);
    const within = run(0.9, null); expect(gradeChartLossNotes(within, sc).good).toBe(cl.total); const off = run(1.5, null); expect(gradeChartLossNotes(off, sc).good).toBe(0);
    expect(d.rubric(off, sc).stars).toBe(0); expect(d.rubric(off, sc).feedback.join(' ')).toMatch(/Chart losses beside stops and turns \(PREREAD-001\): 0\//);   // attempted and wrong: it counts against the marks
    const none = run(null, null); expect(gradeChartLossNotes(none, sc).attempted).toBe(false); expect(d.rubric(none, sc).feedback.join(' ')).toMatch(/Optional \(PREREAD-001\)/);
  });
});

describe('CHART-006 the D06 chart tool: runs, outliers, per-driver charts, stop in the middle, speeds to 55', () => {
  it('CHART-006 "stopgo 30>40 runs 8.4 8.6 8.5 8.5" is the average of four runs; a negative net loss is an outlier, flagged and left out', () => {
    const m = parseChartRuns(['stopgo 30>40 runs 8.4 8.6 8.5 8.5', 'turn 40>35 runs 4.1 -0.3 4.0', 'accel 0>40 = 4.5', 'stopmid 35>35 runs 10.0, 10.4; 10.2']);
    expect(m.get('stopGo:30>40')).toMatchObject({ runs: [8.4, 8.6, 8.5, 8.5], outliers: [], value: 8.5 }); expect(m.get('turn:40>35')).toMatchObject({ runs: [4.1, -0.3, 4], outliers: [-0.3], value: 4.05 });
    expect(m.get('accel:0>40')!.value).toBe(4.5); expect(m.get('stopMid:35>35')!.value).toBe(10.2);
    expect(parseChartNotes(['stopgo 30>40 runs 8.4 8.6 8.5 8.5']).get('stopGo:30>40')).toBe(8.5); expect(parseChartNotes(['turn 40>35 runs -1 -2']).has('turn:40>35')).toBe(false);
    // the old single-number forms still parse
    expect(parseChartNotes(['stop & go 25 -> 35 = 10.1', 'decel 40>30: 1.2']).get('stopGo:25>35')).toBe(10.1);
  });
  it('CHART-006 charts are per driver: a note tagged "A:" / "B:" / "driver B" counts only for that driver; untagged notes count for both', () => {
    const notes = ['A: stopgo 30>40 = 8.4', 'B: stopgo 30>40 = 9.4', 'driver B accel 0>40 = 5.1', 'turn 40>35 = 4.0'];
    expect(parseChartNotes(notes, 'A').get('stopGo:30>40')).toBe(8.4); expect(parseChartNotes(notes, 'B').get('stopGo:30>40')).toBe(9.4); expect(parseChartNotes(notes, 'A').has('accel:0>40')).toBe(false);
    expect(parseChartNotes(notes, 'B').get('accel:0>40')).toBe(5.1); expect(parseChartNotes(notes, 'A').get('turn:40>35')).toBe(4); expect(parseChartNotes(notes, 'B').get('turn:40>35')).toBe(4);
    const d = drillById('D06')!; const drivers = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) { for (const t of [1, 2]) { const sc = d.scenario(seed, t); drivers.add(driverOf(sc.tags)); expect(sc.tags).toContain(`driver:${driverOf(sc.tags)}`); if (driverOf(sc.tags) === 'B') expect(sc.car.name).toMatch(/driver B/); } expect(driverOf(d.scenario(seed, 0).tags)).toBe('A'); }
    expect(drivers).toEqual(new Set(['A', 'B']));
    const seedB = Array.from({ length: 12 }, (_, i) => i + 1).find(sd => driverOf(d.scenario(sd, 1).tags) === 'B')!; const sc = d.scenario(seedB, 1); const perf = buildPerfTable(sc.car);
    expect(sc.car.a0).toBeLessThan(FORD_1939.a0 * 1.2); const pairs = chartPairs(sc.tags); expect(pairs.length).toBe(10);
    const truth = (p: ReturnType<typeof chartPairs>[number]): number => p.kind === 'stopMid' ? Math.round(stopLoss(p.vIn, p.vOut, sc.car) * 10) / 10 : Math.round((p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns).rows[p.vIn]![p.vOut]! * 10) / 10;
    const run = (prefix: string, extra: string[] = []) => { const sim = new Simulator(sc); for (const p of pairs) sim.act({ type: 'note', text: `${prefix}${p.kind === 'stopGo' ? 'stopgo' : p.kind} ${p.vIn}>${p.vOut} runs ${truth(p).toFixed(1)} ${(truth(p) + 0.2).toFixed(1)} ${(truth(p) - 0.2).toFixed(1)} ${truth(p).toFixed(1)}` }); for (const e of extra) sim.act({ type: 'note', text: e }); return d.rubric(runBot(sim, null), sc); };
    expect(run('B: ').stars).toBe(3); expect(run('').stars).toBe(3); const wrong = run('A: '); expect(wrong.stars).toBe(0); expect(wrong.feedback.join(' ')).toMatch(/tagged for the other driver were ignored/); expect(wrong.feedback.join(' ')).toMatch(/driver B/);
    const out = run('', [`stopgo ${pairs.find(p => p.kind === 'stopGo')!.vIn}>${pairs.find(p => p.kind === 'stopGo')!.vOut} runs ${truth(pairs.find(p => p.kind === 'stopGo')!)} -0.4`]); expect(out.feedback.join(' ')).toMatch(/negative net loss, an outlier: delete it or re-run/);
  });
  it('CHART-006 the stop-in-the-middle run is the tenth pair (a stop with no pause printed; the net loss is 15 s minus chart (b)); speeds run to 55; a "simple chart is enough"', () => {
    const d = drillById('D06')!; const speeds = new Set<number>(); let mid = 0;
    for (let seed = 1; seed <= 10; seed++) for (const t of [0, 1, 2]) {
      const sc = d.scenario(seed, t); const pairs = chartPairs(sc.tags); expect(pairs.length).toBe(10); for (const p of pairs) { speeds.add(p.vIn); speeds.add(p.vOut); } mid += pairs.filter(p => p.kind === 'stopMid').length;
      const sm = pairs.find(p => p.kind === 'stopMid')!; const stopIns = sc.book.filter(i => i.turn === 'S' && i.pause === undefined && i.speed === sm.vOut); expect(stopIns.length).toBeGreaterThanOrEqual(1);
    }
    expect(mid).toBe(30); expect(speeds.has(55)).toBe(true); expect(speeds.has(50)).toBe(true); expect([...speeds].every(v => v === 0 || (v >= 20 && v <= 55))).toBe(true);
    // Bronze copies the printed Packard: a pair at 55 is flagged as extrapolated in the answer lines
    const bronze = Array.from({ length: 30 }, (_, i) => i + 1).map(sd => d.scenario(sd, 0)).find(sc => chartPairs(sc.tags).some(p => p.vIn === 55 || p.vOut === 55))!;
    const rb = d.rubric(runBot(new Simulator(bronze), null), bronze); expect(rb.feedback.join(' ')).toMatch(/extrapolated: the handbook prints 15-50/); expect(rb.feedback.join(' ')).toMatch(/simple chart is enough/i); expect(rb.headline).toMatch(/stop in the middle 0\/1/);
    // the stop-in-the-middle truth is the zero-dwell stop loss
    const f = FORD_1939; expect(stopLoss(35, 35, f)).toBeCloseTo(15 - buildPerfTable(f).stopGo.rows[35]![35]!, 0);
  });
});

describe('CPX-001 generated days place 4-6 timing checkpoints, one in the morning and a late surprise', () => {
  it('CPX-001 4-6 timing checkpoints a day, at least one in the morning portion (before the lunch restart)', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
      const sc = generateStage(seed, PROFILES.fullStage); const cps = sc.checkpoints.filter(c => c.kind === 'timing'); counts.add(cps.length);
      expect(cps.length, `seed ${seed}`).toBeGreaterThanOrEqual(4); expect(cps.length, `seed ${seed}`).toBeLessThanOrEqual(6);
      const restarts = sc.book.filter(i => i.section === 'restart'); const lunchS = nodeById(sc.course, restarts[restarts.length - 1]!.nodeId).s;
      expect(cps.filter(c => c.s < lunchS).length, `seed ${seed}`).toBeGreaterThanOrEqual(1); expect(cps.filter(c => c.s > lunchS).length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
    }
    expect(counts.size).toBeGreaterThanOrEqual(2);   // the number varies with the seed
    expect(generateStage(1, { ...PROFILES.fullStage, cpCount: 12 }).checkpoints.filter(c => c.kind === 'timing').length).toBe(12);   // an explicit count is honoured
  });
  it('CPX-001 a late surprise: the last timing checkpoint of the final timed portion is within the last 10 minutes before "End timed portion"', () => {
    for (let seed = 1; seed <= 16; seed++) {
      const sc = generateStage(seed, PROFILES.fullStage); const g = buildGhost(sc); const ends = sc.book.filter(i => i.endTimed); expect(ends.length).toBe(2);
      const finalEnd = ghostTimeAt(g, nodeById(sc.course, ends[1]!.nodeId).s); const lastLeg = g.legs[g.legs.length - 1]!;
      expect(finalEnd - lastLeg.perfectTod, `seed ${seed}`).toBeLessThanOrEqual(600); expect(finalEnd - lastLeg.perfectTod).toBeGreaterThan(0);
    }
  });
});
