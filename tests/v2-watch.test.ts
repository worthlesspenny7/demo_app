import { describe, it, expect } from 'vitest';
import { Stopwatch, DEFAULT_WATCH } from '../src/core/stopwatch.js';
import { ScenarioBuilder } from '../src/core/builder.js';
import { DEFAULT_RULES, DRIVER_EXPERT } from '../src/core/course.js';
import { Simulator, validateAction } from '../src/core/sim.js';
import { hms } from '../src/core/units.js';
import { stepUntil, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };

describe('digital stopwatch (WATCH-008)', () => {
  it('WATCH-008 chrono and tod modes: tod mode reads the rally clock, chrono keeps running underneath; digital is the engine default', () => {
    expect(DEFAULT_WATCH).toBe('digital'); expect(new Simulator(new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).checkpoint().build()).watch.kind).toBe('digital');
    const w = new Stopwatch('digital'); w.start(100); expect(w.mode).toBe('chrono');
    w.toggleMode(); expect(w.mode).toBe('tod'); expect(w.reading(T0 + 12.34)).toBeCloseTo(T0 + 12.34, 6);
    w.toggleMode(); expect(w.reading(103.456)).toBeCloseTo(3.46, 6);
    const a = new Stopwatch('analog'); a.setMode('tod'); expect(a.mode).toBe('chrono'); // the analog watch has no TOD mode
  });
  it('WATCH-008 laps store the split and expose interval + cumulative pairs; the split freezes and auto-releases after rules.splitHoldSeconds (0 = until recall)', () => {
    expect(DEFAULT_RULES.splitHoldSeconds).toBe(5);
    const w = new Stopwatch('digital', 60, 5); w.start(0); w.lap(109.3); w.lap(441.3);
    expect(w.lapTable()).toEqual([{ interval: 109.3, cumulative: 109.3 }, { interval: 332, cumulative: 441.3 }].map(r => ({ interval: expect.closeTo(r.interval, 6), cumulative: r.cumulative })));
    expect(w.reading(442)).toBeCloseTo(441.3, 6); expect(w.isFrozen(442)).toBe(true); expect(w.reading(446.2)).toBeCloseTo(441.3, 6);
    expect(w.isFrozen(446.4)).toBe(false); expect(w.reading(446.4)).toBeCloseTo(446.4, 6);
    const hold = new Stopwatch('digital', 60, 0); hold.start(0); hold.lap(10); expect(hold.reading(500)).toBeCloseTo(10, 6); hold.recall(500); expect(hold.reading(501)).toBeCloseTo(501, 6);
  });
  it('WATCH-008 recall cycles back through the last 10 laps and returns to live; reset only while stopped unless forced', () => {
    const w = new Stopwatch('digital', 60, 5); w.start(0);
    for (let i = 1; i <= 12; i++) w.lap(i * 10);
    w.recall(200); // the freeze has long expired: recall now steps through the laps
    expect(w.reading(200)).toBeCloseTo(120, 6); w.recall(200); expect(w.reading(200)).toBeCloseTo(110, 6);
    for (let i = 0; i < 8; i++) w.recall(200); expect(w.reading(200)).toBeCloseTo(30, 6); // 10th lap back
    w.recall(200); expect(w.recalled).toBeNull(); expect(w.reading(200)).toBeCloseTo(200, 6);
    expect(w.reset(200)).toBe(false); expect(w.running).toBe(true); expect(w.reset(200, true)).toBe(true); expect(w.laps).toEqual([]);
    w.start(300); w.stop(310); expect(w.reset(311)).toBe(true);
  });
  it('WATCH-008 the simulator exposes mode, lap table and freeze, and the actions watch.mode / watch.reset {force} work', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, rules: { splitHoldSeconds: 3 } }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'watch.start' }); sim.step(10); sim.act({ type: 'watch.lap' }); sim.step(2);
    let o = sim.observe().stopwatch; expect(o.frozen).toBe(true); expect(o.lapTable).toHaveLength(1); expect(o.lapTable![0]!.cumulative).toBeCloseTo(10, 1);
    sim.step(2); expect(sim.observe().stopwatch.frozen).toBe(false);
    sim.act({ type: 'watch.mode' }); expect(sim.observe().stopwatch.mode).toBe('tod'); sim.act({ type: 'watch.mode', mode: 'chrono' }); expect(sim.observe().stopwatch.mode).toBe('chrono');
    sim.act({ type: 'watch.reset' }); expect(sim.watch.running).toBe(true); expect(sim.observe().driver.messages.some(m => /stop it before resetting/.test(m.text))).toBe(true);
    sim.act({ type: 'watch.reset', force: true }); expect(sim.watch.running).toBe(false); expect(validateAction({ type: 'watch.mode', mode: 'x' })).not.toBeNull();
  });
});

describe('instrument discipline (WATCH-009)', () => {
  // lines: 1 start, 2 begin exact transit, 3 end transit (OUT), 4 STOP + pause, 5 timed segment
  const stage = () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).transit({ exact: true, seconds: 300, miles: 0.9 }).advanceMiles(0.9);
    b.endTransit({ speed: 35 }).advanceMiles(0.4).stop('S', 35).advanceMiles(0.5).timedAt('bridge', { holdSpeed: 30, seconds: 20, thenSpeed: 35 }).advanceMiles(1.5).checkpoint().advanceFt(300).finish();
    return b.build();
  };
  const atLine = (sim: Simulator, n: number) => stepUntil(sim, () => sim.waitingForGo && sim.observe({ peek: true }).stoppedAtLine === n, 3000);
  const goAtOut = (sim: Simulator, clock: 'none' | 'read' | 'tod') => {
    if (clock === 'tod') sim.act({ type: 'watch.mode', mode: 'tod' });
    atLine(sim, 3); const node = sim.sc.course.nodes.find(n => n.id === sim.sc.book[2]!.nodeId)!; const go = sim.holdGoTod(node)!;
    stepUntil(sim, () => sim.tod >= go, 3000); if (clock === 'read') sim.act({ type: 'clock.read' }); sim.act({ type: 'call.go' });
  };
  it('WATCH-009 an exact-transit OUT time taken with the stopwatch in chrono and no clock read is flagged; reading the clock or TOD mode clears it', () => {
    const find = (clock: 'none' | 'read' | 'tod') => { const sim = new Simulator(stage()); startLikeOracle(sim); goAtOut(sim, clock); sim.step(1); return sim.result().instrumentDiscipline.filter(f => f.kind === 'clockForTimeOfDay' && f.line === 3); };
    expect(find('none')).toHaveLength(1); expect(find('none')[0]!.text).toMatch(/OUT time|clock/);
    expect(find('read')).toHaveLength(0); expect(find('tod')).toHaveLength(0);
    const sim = new Simulator(stage()); startLikeOracle(sim); sim.act({ type: 'watch.mode', mode: 'tod' }); expect(sim.instrumentLog.some(e => e.kind === 'watch.mode' && e.mode === 'tod')).toBe(true);
    sim.act({ type: 'clock.read' }); expect(sim.instrumentLog.some(e => e.kind === 'clock.read')).toBe(true);
    const peek = new Simulator(stage()); peek.observe({ peek: true }); expect(peek.instrumentLog).toHaveLength(0); peek.observe({ peek: true, clock: true }); expect(peek.instrumentLog).toHaveLength(1);
  });
  it('WATCH-009 a pause or timed segment with no stopwatch start/lap within 2 s of its anchor is flagged; a lap at the anchor clears it', () => {
    const sc = stage();
    const play = (useWatch: boolean) => {
      const sim = new Simulator(sc); startLikeOracle(sim); goAtOut(sim, 'read');
      atLine(sim, 4); if (useWatch) sim.act({ type: 'watch.lap' }); sim.step(8); sim.act({ type: 'call.go' });
      const bridge = sc.course.nodes.find(n => n.id === sc.book[4]!.nodeId)!;
      stepUntil(sim, () => sim.car.s >= bridge.s - 6, 3000); if (useWatch) sim.act({ type: 'watch.lap' }); sim.step(5);
      return sim.result().instrumentDiscipline.map(f => `${f.kind}:${f.line}`);
    };
    const bad = play(false); expect(bad).toContain('clockForInterval:4'); expect(bad).toContain('clockForInterval:5');
    const good = play(true); expect(good).not.toContain('clockForInterval:4'); expect(good).not.toContain('clockForInterval:5');
  });
  it('WATCH-009 a calibration point crossed without a lap is flagged; a lap clears it; a lap with the split still frozen is flagged', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(50).calibrationRun({ miles: 3, points: 3, speed: 50 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const pts = sc.book.filter(i => i.section === 'calibration' && !i.calibrationStart);
    const play = (lap: boolean) => {
      const sim = new Simulator(sc); startLikeOracle(sim); sim.act({ type: 'watch.start' });
      for (const c of pts) { const s = sc.course.nodes.find(n => n.id === c.nodeId)!.s; stepUntil(sim, () => sim.car.s >= s - 30, 2000); if (lap) sim.act({ type: 'watch.lap' }); stepUntil(sim, () => sim.car.s >= s + 30, 200); sim.step(6); }
      return sim.result().instrumentDiscipline;
    };
    expect(play(false).filter(f => f.kind === 'calibrationWithoutLap')).toHaveLength(pts.length);
    const ok = play(true); expect(ok.filter(f => f.kind === 'calibrationWithoutLap')).toEqual([]); expect(ok.filter(f => f.kind === 'lapWhileFrozen')).toEqual([]);
    const sim = new Simulator(sc); startLikeOracle(sim); sim.act({ type: 'watch.start' }); sim.step(5); sim.act({ type: 'watch.lap' }); sim.step(1); sim.act({ type: 'watch.lap' });
    expect(sim.result().instrumentDiscipline.some(f => f.kind === 'lapWhileFrozen')).toBe(true);
  });
});
