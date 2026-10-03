import { describe, it, expect } from 'vitest';
import { stopwatchViewModel } from '../src/ui/viewmodels/stopwatch.js';
import { clockViewModel } from '../src/ui/viewmodels/clock.js';
import { speedoViewModel } from '../src/ui/viewmodels/speedo.js';
import { cameoSvg, pickRouteExit } from '../src/ui/viewmodels/cameo.js';
import { bookRows, columnC } from '../src/ui/viewmodels/book.js';
import { debriefViewModel, BUCKETS, workedTimed, workedCruise, ledgerAccuracy, biasNoise, cpCards, aidsRung } from '../src/ui/viewmodels/debrief.js';
import { replay, counterfactuals, stopsFromEvents } from '../src/ui/viewmodels/counterfactual.js';
import { effectiveScale, simAdvance, nextScale } from '../src/ui/viewmodels/timescale.js';
import { KeyMapper } from '../src/ui/viewmodels/keys.js';
import { audioCues } from '../src/ui/viewmodels/audio.js';
import { createAnnotations } from '../src/ui/viewmodels/annotations.js';
import { cockpitLayout, MIN_STOPWATCH_DIAL } from '../src/ui/viewmodels/layout.js';
import { dwellFor, accelLoss } from '../src/core/perf-table.js';
import { LEGAL_AIDS, TRAINING_AIDS, aidsForRung } from '../src/core/course.js';
import type { Observation } from '../src/core/sim.js';
import { createProgressStore, type StorageLike } from '../src/ui/viewmodels/progress.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import type { Instruction } from '../src/core/course.js';
import { runToEnd, startAtOfficialTime, stepUntil } from './helpers.js';

describe('UI-001 stopwatchViewModel', () => {
  it('UI-001 maps 0.2 s to 2.4 degrees on the 30 s dial and 60 s to one register minute', () => {
    const vm = stopwatchViewModel(0.2, 'analog');
    expect(vm.dialSeconds).toBe(30);
    expect(vm.sweepDeg).toBeCloseTo(2.4, 6);
    expect(stopwatchViewModel(15, 'analog').sweepDeg).toBeCloseTo(180, 6);
    expect(stopwatchViewModel(30, 'analog').sweepDeg).toBeCloseTo(0, 6);   // one full revolution
    const m = stopwatchViewModel(60, 'analog');
    expect(m.registerMinutes).toBe(30);
    expect(m.registerDeg).toBeCloseTo(12, 6);                              // 1 of 30 minutes
    expect(m.minutes).toBe(1);
    expect(stopwatchViewModel(0.2, 'analog', { dialSeconds: 60 }).sweepDeg).toBeCloseTo(1.2, 6);
  });
  it('UI-001 quantizes analog to 1/5 s, digital to 1/100 s, and maps the countdown bezel', () => {
    expect(stopwatchViewModel(7.33, 'analog').reading).toBeCloseTo(7.4, 6);
    expect(stopwatchViewModel(7.333, 'digital').reading).toBeCloseTo(7.33, 6);
    expect(stopwatchViewModel(7.333, 'digital').digital).toBe('0:07.33');
    const b = stopwatchViewModel(10, 'analog', { bezel: 25 });
    expect(b.bezelDeg).toBeCloseTo(300, 6);
    expect(b.bezelRemaining).toBeCloseTo(15, 6);
    expect(stopwatchViewModel(NaN as unknown as number, 'analog').sweepDeg).toBe(0);
    expect(stopwatchViewModel(100, 'analog', { laps: [10, 25.4, 40] }).lapRows.map(r => r.n)).toEqual([3, 2, 1]);
  });
});

describe('UI-002 clockViewModel', () => {
  it('UI-002 maps TOD to hour, minute and second hand angles plus bezel rotation', () => {
    const vm = clockViewModel(3 * 3600 + 30 * 60 + 15, 45);
    expect(vm.hourDeg).toBeCloseTo(105, 6);        // 3:30 -> 3.5/12 of a turn
    expect(vm.minuteDeg).toBeCloseTo(181.5, 6);     // 30 min 15 s
    expect(vm.secondDeg).toBeCloseTo(90, 6);
    expect(vm.bezelDeg).toBeCloseTo(270, 6);
    expect(vm.bezelRemaining).toBeCloseTo(30, 6);
    expect(vm.digital).toBe('03:30:15');
    expect(clockViewModel(13 * 3600).hourDeg).toBeCloseTo(30, 6);
    expect(clockViewModel(Number.NaN).digital).toBe('00:00:00');
  });
});

describe('UI-003 speedoViewModel', () => {
  it('UI-003 maps indicated mph to a needle angle within the 0-100 dial and clamps', () => {
    expect(speedoViewModel(0).needleDeg).toBeCloseTo(-120, 6);
    expect(speedoViewModel(50).needleDeg).toBeCloseTo(0, 6);
    expect(speedoViewModel(100).needleDeg).toBeCloseTo(120, 6);
    const over = speedoViewModel(130);
    expect(over.needleDeg).toBeCloseTo(120, 6);
    expect(over.clamped).toBe(true);
    const neg = speedoViewModel(-5);
    expect(neg.needleDeg).toBeCloseTo(-120, 6);
    expect(neg.clamped).toBe(true);
    expect(speedoViewModel(60, 120).needleDeg).toBeCloseTo(0, 6);
    expect(speedoViewModel(35).ticks.filter(t => t.major).map(t => t.mph)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
});

describe('UI-004 cameoSvg', () => {
  it('UI-004 draws a dot, an arrow, one bold route path, thin non-route paths and dashed driveways', () => {
    const exits = [...EXITS.crossroads('R'), { angle: -45, surface: 'gravel' as const, kind: 'driveway' as const, isRoute: false }];
    const svg = cameoSvg(exits, 'STOP', 'R');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('class="cameo-dot"');
    expect(svg).toContain('marker-end="url(#cameo-arrow)"');
    expect((svg.match(/cameo-exit/g) ?? []).length).toBe(1);             // exactly one bold exit
    expect((svg.match(/cameo-thin/g) ?? []).length).toBe(3);             // left, straight, driveway
    expect((svg.match(/stroke-dasharray/g) ?? []).length).toBe(1);        // only the driveway is dashed
    expect(svg).toContain('cameo-stop');                                 // octagon glyph
    expect(cameoSvg(EXITS.tee('L'), 'YIELD', 'L')).toContain('cameo-yield');
    expect(cameoSvg(EXITS.crossroads('S'), 'SIGNAL')).toContain('cameo-signal');
  });
  it('UI-004 picks the route from routeDir when exits carry no isRoute, and never throws on missing data', () => {
    const anon = [{ angle: -90 }, { angle: 0 }, { angle: 90 }];
    expect(pickRouteExit(anon, 'L')?.angle).toBe(-90);
    expect(pickRouteExit(anon, 'BR')?.angle).toBe(0);                     // no bear-right road: falls back to straight-most
    expect(pickRouteExit([{ angle: -90, kind: 'driveway' }, { angle: 90 }], null)?.angle).toBe(90);
    expect(cameoSvg(undefined)).toContain('cameo-exit');
    expect(cameoSvg([], 'none')).toContain('<svg');
    expect(cameoSvg(null, 'RR')).toContain('cameo-rr');
  });
});

describe('UI-005 bookRows', () => {
  const book: Instruction[] = [
    { n: 1, nodeId: 'n1', text: 'START. Speed 35', section: 'start', speed: 35, restartTime: 28800 },
    { n: 2, nodeId: 'n2', text: 'Right at STOP. Pause 15', turn: 'R', pause: 15 },
    { n: 3, nodeId: 'n3', text: 'At "Oak Rd". 30 for 0:36 then 40', timed: { holdSpeed: 30, seconds: 36, thenSpeed: 40 }, speed: 30 },
    { n: 4, nodeId: 'n4', text: 'Left at STOP. Pause 15. Speed 35', turn: 'L', pause: 15, speed: 35, hint: 'Comes quick' },
    { n: 5, nodeId: 'n5', text: 'FINISH', section: 'finish' },
  ];
  it('UI-005 marks exactly one current row and formats Column C', () => {
    const rows = bookRows(book, 3);
    expect(rows.filter(r => r.isCurrent).length).toBe(1);
    expect(rows[2]!.isCurrent).toBe(true);
    expect(rows.map(r => r.colC)).toEqual(['35', 'P15', '30 for 0:36 then 40', '35 P15', '']);
    expect(rows.map(r => r.state)).toEqual(['past', 'prev', 'current', 'next', 'next']);
    expect(rows[0]!.colB).toBe('START');
    expect(rows[3]!.colD).toBe('Comes quick');
  });
  it('UI-005 clamps out-of-range current lines and tolerates empty books', () => {
    expect(bookRows(book, 99).filter(r => r.isCurrent).map(r => r.n)).toEqual([5]);
    expect(bookRows(book, -3).filter(r => r.isCurrent).map(r => r.n)).toEqual([1]);
    expect(bookRows(book, Number.NaN).filter(r => r.isCurrent).length).toBe(1);
    expect(bookRows(undefined, 1)).toEqual([]);
    expect(columnC({ pause: 20, timed: { holdSpeed: 25, seconds: 90, thenSpeed: 45 } })).toBe('P20 25 for 1:30 then 45');
    expect(columnC(null)).toBe('');
  });
});

describe('UI-007 debriefViewModel', () => {
  function leg(stopPause = 0) {
    const b = new ScenarioBuilder({ id: 'vm-leg', seed: 7, prereadSeconds: 0 });
    b.start(35).advanceMiles(0.5);
    if (stopPause) b.stop('S', 35, { pause: stopPause });
    b.advanceMiles(0.5).checkpoint('timing').advanceMiles(0.3).finish();
    return b.build();
  }
  it('UI-007 lists per-CP rows and attribution buckets that sum to the leg error within 1.5 s', () => {
    const sc = leg();
    const sim = new Simulator(sc);
    startAtOfficialTime(sim);
    runToEnd(sim);
    const vm = debriefViewModel(sim.result(), sc);
    expect(vm.rows.length).toBe(1);
    expect(vm.rows[0]!.actual).toMatch(/^\d\d:\d\d:\d\d$/);
    expect(vm.rows[0]!.error).not.toBeNull();
    expect(vm.legs.length).toBe(1);
    const l = vm.legs[0]!;
    expect(Math.abs(l.sum - (l.error ?? 0))).toBeLessThanOrEqual(1.5);
    expect(Math.abs(l.residual)).toBeLessThanOrEqual(1.5);
    expect(vm.headline.length).toBeGreaterThan(0);
    expect(vm.tip.length).toBeGreaterThan(0);
    expect(vm.timeline.some(p => p.kind === 'checkpoint')).toBe(true);
    for (const b of BUCKETS) expect(Number.isFinite(vm.totals[b])).toBe(true);
  });
  it('UI-007 produces worked stop arithmetic (pause, car loss, ideal dwell, your dwell) with a STOP and go call', () => {
    const sc = leg(15);
    const sim = new Simulator(sc);
    startAtOfficialTime(sim);
    stepUntil(sim, () => sim.observe().driver.waitingForGo, 600);
    sim.step(8);
    sim.act({ type: 'call.go' });
    runToEnd(sim);
    const vm = debriefViewModel(sim.result(), sc);
    expect(vm.stops.length).toBe(1);
    const st = vm.stops[0]!;
    expect(st.pause).toBe(15);
    expect(st.vIn).toBe(35); expect(st.vOut).toBe(35);
    expect(st.carLoss).not.toBeNull();
    expect(st.idealDwell).toBeCloseTo(15 - (st.carLoss ?? 0), 1);
    expect(st.yourDwell).toBeGreaterThan(7);
    expect(st.text).toContain('ideal dwell');
    const l = vm.legs[0]!;
    expect(Math.abs(l.sum - (l.error ?? 0))).toBeLessThanOrEqual(1.5);
  });
  it('UI-007 never throws on missing data', () => {
    expect(debriefViewModel(null).rows).toEqual([]);
    expect(debriefViewModel(undefined).headline).toContain('No checkpoints');
    expect(debriefViewModel({} as never).legs).toEqual([]);
  });
});

describe('UI-008 progress store', () => {
  function fakeStorage(): StorageLike & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
  }
  it('UI-008 saving a drill result and reloading restores stars and aces', () => {
    const storage = fakeStorage();
    const a = createProgressStore(storage);
    a.recordRun('D03', { stars: 2, aces: 1, score: 12 });
    a.recordRun('D03', { stars: 1, aces: 2, score: 30 });
    a.markLesson('ghost-car');
    const b = createProgressStore(storage);
    const p = b.get('D03')!;
    expect(p.stars).toBe(2);            // keeps the best
    expect(p.aces).toBe(3);             // accumulates
    expect(p.bestScore).toBe(12);
    expect(p.runs).toBe(2);
    expect(b.lessonDone('ghost-car')).toBe(true);
    expect(b.persistent).toBe(true);
  });
  it('UI-008 falls back to memory when storage throws or is missing', () => {
    const broken: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    const s = createProgressStore(broken);
    s.recordRun('D01', { stars: 3, aces: 0, score: 0 });
    expect(s.get('D01')?.stars).toBe(3);
    expect(s.persistent).toBe(false);
    const none = createProgressStore(null);
    none.recordRun('D02', { stars: 1, aces: 0, score: 5 });
    expect(none.get('D02')?.stars).toBe(1);
    const corrupt = fakeStorage(); corrupt.setItem('rally-trainer.progress.v1', '{not json');
    expect(createProgressStore(corrupt).load().drills).toEqual({});
  });
});

// ---------- helpers for the debrief / counterfactual tests ----------
function stopLeg(seed = 7) {
  const b = new ScenarioBuilder({ id: 'cf-leg', seed, prereadSeconds: 0 });
  b.start(35).advanceMiles(0.5).stop('S', 35, { pause: 15 }).advanceMiles(0.5).checkpoint('timing').advanceMiles(0.3).finish();
  return b.build();
}
/** Run the stop leg with a given dwell at the STOP; returns the simulator (finished). */
function runWithDwell(sc: ReturnType<typeof stopLeg>, dwell: number) {
  const sim = new Simulator(sc);
  startAtOfficialTime(sim);
  stepUntil(sim, () => sim.observe().driver.waitingForGo, 600);
  sim.step(dwell);
  sim.act({ type: 'call.go' });
  runToEnd(sim);
  return sim;
}

describe('UI-009 cockpit layout', () => {
  it('UI-009 road view >= 45 % of the left pane, stopwatch the largest instrument with a >= 240 px dial, book column on the right', () => {
    for (const [w, h] of [[1280, 720], [1366, 768], [1600, 900], [1920, 1080]] as const) {
      const L = cockpitLayout(w, h);
      expect(L.roadFraction).toBeGreaterThanOrEqual(0.45);
      expect(L.stopwatch.dial).toBeGreaterThanOrEqual(MIN_STOPWATCH_DIAL);
      expect(L.stopwatch.dial).toBeGreaterThan(L.clock.dial);
      expect(L.clock.dial).toBeGreaterThan(L.speedo.dial);
      expect(L.book.x).toBe(L.leftPane.w);
      expect(L.book.x + L.book.w).toBe(w);
      expect(L.clock.rect.x).toBeLessThan(L.stopwatch.rect.x);
      expect(L.stopwatch.rect.x).toBeLessThan(L.speedo.rect.x);
      expect(L.drawer.y).toBe(L.leftPane.h);
    }
    expect(cockpitLayout(Number.NaN, Number.NaN).stopwatch.dial).toBeGreaterThanOrEqual(MIN_STOPWATCH_DIAL);
  });
});

describe('UI-010 adaptive time scale', () => {
  const base = { requested: 4, paused: false, phase: 'running', carStopped: false, waitingForGo: false, nearestFeatureFt: null, hazardActive: false, countdownSeconds: null, bezelRemaining: null } as const;
  it('UI-010 runs at the requested scale only in dead cruise, drops to 1x near features / stops / countdowns, 0 while paused, capped catch-up', () => {
    expect(effectiveScale({ ...base })).toBe(4);
    expect(effectiveScale({ ...base, requested: 8, maxScale: 4 })).toBe(4);
    expect(effectiveScale({ ...base, paused: true })).toBe(0);
    expect(effectiveScale({ ...base, nearestFeatureFt: 750 })).toBe(1);
    expect(effectiveScale({ ...base, nearestFeatureFt: 1200 })).toBe(4);
    expect(effectiveScale({ ...base, carStopped: true })).toBe(1);
    expect(effectiveScale({ ...base, waitingForGo: true })).toBe(1);
    expect(effectiveScale({ ...base, hazardActive: true })).toBe(1);
    expect(effectiveScale({ ...base, countdownSeconds: 12 })).toBe(1);
    expect(effectiveScale({ ...base, countdownSeconds: 40 })).toBe(4);
    expect(effectiveScale({ ...base, bezelRemaining: 9 })).toBe(1);
    expect(effectiveScale({ ...base, lockedTo1x: true })).toBe(1);
    expect(effectiveScale({ ...base, phase: 'finished' })).toBe(1);
    expect(simAdvance(0.016, 4)).toBeCloseTo(0.064, 6);
    expect(simAdvance(5, 8)).toBe(2);           // a stalled tab cannot fast-forward more than 2 s per frame
    expect(simAdvance(0.016, 0)).toBe(0);       // paused: nothing advances
    expect(nextScale(1, 1)).toBe(2); expect(nextScale(8, 1)).toBe(8); expect(nextScale(1, -1)).toBe(1);
  });
});

describe('UI-011 keyboard mapping', () => {
  it('UI-011 maps the cockpit keys: Space, L, Shift+R only, bezel brackets, arrows with B/A modifiers, G/S/U/P/T/N/D/E, digits+Enter, +/-', () => {
    const k = new KeyMapper();
    expect(k.keydown({ key: ' ' })).toEqual({ type: 'watch.toggle' });
    expect(k.keydown({ key: 'l' })).toEqual({ type: 'watch.lap' });
    expect(k.keydown({ key: 'Enter' })).toEqual({ type: 'watch.lap' });
    expect(k.keydown({ key: 'r' })).toBeNull();                                   // plain R is a landmine: ignored
    expect(k.keydown({ key: 'R', shiftKey: true })).toEqual({ type: 'watch.reset' });
    expect(k.keydown({ key: '[' })).toEqual({ type: 'bezel', delta: -1 });
    expect(k.keydown({ key: ']' })).toEqual({ type: 'bezel', delta: 1 });
    expect(k.keydown({ key: '}', shiftKey: true })).toEqual({ type: 'bezel', delta: 0.2 });
    expect(k.keydown({ key: 'ArrowLeft' })).toEqual({ type: 'call.turn', dir: 'L' });
    expect(k.keydown({ key: 'ArrowUp' })).toEqual({ type: 'call.turn', dir: 'S' });
    k.keydown({ key: 'b' }); expect(k.keydown({ key: 'ArrowRight' })).toEqual({ type: 'call.turn', dir: 'BR' }); k.keyup({ key: 'b' });
    k.keydown({ key: 'a' }); expect(k.keydown({ key: 'ArrowLeft' })).toEqual({ type: 'call.turn', dir: 'AL' }); k.keyup({ key: 'a' });
    k.keydown({ key: 'j' }); expect(k.keydown({ key: 'ArrowLeft' })).toEqual({ type: 'call.turn', dir: 'JL' }); k.keyup({ key: 'j' });
    expect(k.keydown({ key: 'ArrowRight' })).toEqual({ type: 'call.turn', dir: 'R' });
    expect(k.keydown({ key: 'g' })).toEqual({ type: 'call.go' });
    expect(k.keydown({ key: 's' })).toEqual({ type: 'call.stop' });
    expect(k.keydown({ key: 'u' })).toEqual({ type: 'call.uturn' });
    expect(k.keydown({ key: 'p' })).toEqual({ type: 'call.pass' });
    expect(k.keydown({ key: 't' })).toEqual({ type: 'ta' });
    expect(k.keydown({ key: 'n' })).toEqual({ type: 'line', delta: 1 });
    expect(k.keydown({ key: 'N', shiftKey: true })).toEqual({ type: 'line', delta: -1 });
    expect(k.keydown({ key: 'd' })).toEqual({ type: 'depart' });
    expect(k.keydown({ key: 'e' })).toEqual({ type: 'ledger' });
    expect(k.keydown({ key: '3' })).toEqual({ type: 'buffer', text: '3' });
    expect(k.keydown({ key: '6' })).toEqual({ type: 'buffer', text: '36' });
    expect(k.keydown({ key: '.' })).toEqual({ type: 'buffer', text: '36.' });
    expect(k.keydown({ key: '5' })).toEqual({ type: 'buffer', text: '36.5' });
    expect(k.keydown({ key: 'Enter' })).toEqual({ type: 'call.speed', mph: 36.5 });
    expect(k.buffer).toBe('');
    expect(k.keydown({ key: '+' })).toEqual({ type: 'nudge', delta: 1 });
    expect(k.keydown({ key: '-' })).toEqual({ type: 'nudge', delta: -1 });
    expect(k.keydown({ key: 'Escape' })).toEqual({ type: 'pause' });
    expect(k.keydown({ key: 'x', ctrlKey: true })).toBeNull();
    expect(k.keydown({ key: 'z' })).toBeNull();
    expect(k.keydown(null as unknown as { key: string })).toBeNull();
  });
});

describe('UI-012 audio cues', () => {
  function obs(p: Partial<Observation>): Observation {
    return { phase: 'running', tod: 0, secondsToStart: 0, stopwatch: { kind: 'analog', running: false, reading: 0, laps: [], bezel: 0, bezelRemaining: 0, dialSeconds: 60 }, ledger: null, bezel: 0, speedo: { reading: 0, kind: 'timewise' }, book: [], currentLine: 1, ahead: [], driver: { messages: [], state: 'cruise', targetIndicated: null, pendingTurn: null, waitingForGo: false, lastExecutedLine: null }, annotations: {}, carStopped: false, offCourseHint: false, aids: {}, notes: [], legIndex: 1, startTime: 0, rules: { maxPerCp: 300, sightZonePenalty: 30, observationMissPenalty: 60, earlyRestartPenalty: 60, earlyRestartMinutes: 5, missedCpLateMinutes: 30, trophyRunCounts: false, rookieDropWorstLeg: false, taOverDeclareTolerance: 5 }, ...p } as Observation;
  }
  it('UI-012 clicks on start/stop/lap, speaks driver lines, beeps 3-2-1 only with the aid, train and signal sounds, silent when muted', () => {
    const a = obs({});
    const b = obs({ stopwatch: { kind: 'analog', running: true, reading: 0, laps: [], bezel: 0, bezelRemaining: 0, dialSeconds: 60 }, driver: { messages: [{ id: 1, tod: 1, text: 'Holding 35', kind: 'readback' }], state: 'cruise', targetIndicated: 35, pendingTurn: null, waitingForGo: false, lastExecutedLine: null } });
    const cues = audioCues(a, b);
    expect(cues).toContainEqual({ kind: 'click' });
    expect(cues).toContainEqual({ kind: 'speech', text: 'Holding 35' });
    const c = obs({ stopwatch: { kind: 'analog', running: true, reading: 5, laps: [5], bezel: 0, bezelRemaining: 0, dialSeconds: 60 } });
    expect(audioCues(b, c).filter(x => x.kind === 'click').length).toBe(1);
    expect(audioCues(obs({ aids: { countdown: 3.4 } }), obs({ aids: { countdown: 2.9 } }), { countdownAid: true })).toEqual([{ kind: 'beep', n: 3 }]);
    expect(audioCues(obs({ aids: { countdown: 3.4 } }), obs({ aids: { countdown: 2.9 } }), { countdownAid: false })).toEqual([]);
    expect(audioCues(obs({}), obs({ ahead: [{ kind: 'intersection', approxDistanceFt: 400, gateDown: true }] }))).toEqual([{ kind: 'train' }]);
    expect(audioCues(obs({}), obs({ ahead: [{ kind: 'intersection', approxDistanceFt: 400, signalColor: 'red' }] }))).toEqual([{ kind: 'signal' }]);
    expect(audioCues(a, b, { muted: true })).toEqual([]);
    expect(audioCues(null, undefined)).toEqual([]);
  });
});

describe('UI-013 pre-read annotations', () => {
  const book: Instruction[] = [
    { n: 1, nodeId: 'n1', text: 'START. Speed 35', section: 'start', speed: 35, restartTime: 28800 },
    { n: 2, nodeId: 'n2', text: 'Right at STOP. Pause 15', turn: 'R', pause: 15 },
    { n: 3, nodeId: 'n3', text: 'At "Oak Rd". Speed 40', speed: 40 },
    { n: 4, nodeId: 'n4', text: 'Left at STOP. Pause 20. Speed 35', turn: 'L', pause: 20, speed: 35 },
  ];
  it('UI-013 highlight colours, GO-time column, cheat card and coverage persist through serialize/restore', () => {
    const a = createAnnotations();
    expect(a.toggleHighlight(2, 'pause')).toEqual(['pause']);
    expect(a.toggleHighlight(2, 'turn')).toEqual(['pause', 'turn']);
    expect(a.toggleHighlight(2, 'pause')).toEqual(['turn']);
    a.setGoTime(4, '12.5');
    a.setCard({ '35': 36, '40': 41.2 });
    expect(a.coverage(book)).toBeCloseTo(0.5, 6);         // line 4 has a GO time, line 2 lost its pause mark
    a.toggleHighlight(2, 'pause');
    expect(a.coverage(book)).toBe(1);
    const b = createAnnotations(a.serialize());
    expect(b.highlights(2)).toEqual(['turn', 'pause']);
    expect(b.goTime(4)).toBe('12.5');
    expect(b.card()).toEqual({ '35': 36, '40': 41.2 });
    expect(b.suggested(book)[3]).toEqual(['speed', 'sign']);
    expect(b.suggested(book)[4]).toEqual(['pause', 'speed', 'turn']);
    expect(createAnnotations('{broken').coverage([])).toBe(1);
    expect(createAnnotations(null).coverage(undefined)).toBe(1);
  });
});

describe('DEBRIEF-001 worked arithmetic', () => {
  it('DEBRIEF-001 stop rows carry entry/exit speed, card loss, correct dwell = pause - loss, your dwell, delta and the formula text', () => {
    const sc = stopLeg();
    const sim = runWithDwell(sc, 11.1);
    const vm = debriefViewModel(sim.result(), sc);
    expect(vm.stops.length).toBe(1);
    const st = vm.stops[0]!;
    expect(st.entrySpeed).toBe(35); expect(st.exitSpeed).toBe(35);
    expect(st.cardLoss).toBeCloseTo(7.6, 1);
    expect(st.correctDwell).toBeCloseTo(15 - st.cardLoss!, 1);
    expect(st.yourDwell).toBeCloseTo(11.1, 0);
    expect(st.delta).toBeCloseTo(st.yourDwell + st.cardLoss! - 15, 1);
    expect(st.formulaText).toMatch(/^dwell = 15 - 7\.\d = 7\.\d s; you called go at 11\.\d s; \+3\.\d s$/);
  });
  it('DEBRIEF-001 timed-change rows give T, ramp lead, correct call and your call; cruise rows give ratio and seconds over', () => {
    const b = new ScenarioBuilder({ id: 'timed', seed: 3, prereadSeconds: 0 });
    b.start(30).advanceMiles(0.4).timedAt('bridge', { holdSpeed: 30, seconds: 36, thenSpeed: 40 }).advanceMiles(1).checkpoint('timing').advanceFt(300).finish();
    const sc = b.build();
    const sim = new Simulator(sc);
    startAtOfficialTime(sim);
    stepUntil(sim, () => sim.result().events.some(e => e.type === 'node' && e.detail?.nodeId === 'n2'), 600);
    sim.step(36.4);
    sim.act({ type: 'call.speed', mph: 40 });
    runToEnd(sim);
    const r = sim.result();
    const rows = workedTimed(r.events, sc);
    expect(rows.length).toBe(1);
    const t = rows[0]!;
    expect(t.T).toBe(36);
    expect(t.rampLead).toBeGreaterThan(0.5);
    expect(t.correctCall).toBeCloseTo(36 - t.rampLead, 1);
    expect(t.yourCall).toBeCloseTo(36.4, 0);
    expect(t.delta).toBeCloseTo(t.yourCall! - t.correctCall, 1);
    const cr = workedCruise(r.attribution, sc);
    expect(cr.length).toBeGreaterThan(0);
    expect(cr[0]!.ratio).toBeGreaterThan(0.9);
    expect(cr[0]!.text).toContain('ratio');
    expect(workedTimed(undefined, null)).toEqual([]);
  });
  it('DEBRIEF-001 ledger accuracy grades believed vs truth', () => {
    const sc = stopLeg();
    const sim = new Simulator(sc);
    startAtOfficialTime(sim);
    sim.step(20);
    sim.act({ type: 'ledger.set', seconds: 4 });
    const truth = sim.pace();
    runToEnd(sim);
    const lv = ledgerAccuracy(sim.result().ledgerLog);
    expect(lv.count).toBe(1);
    expect(lv.rows[0]!.believed).toBe(4);
    expect(lv.rows[0]!.truth).toBeCloseTo(truth, 1);
    expect(lv.meanAbs).toBeCloseTo(Math.abs(4 - truth), 0);
    expect(ledgerAccuracy(undefined).count).toBe(0);
  });
});

describe('DEBRIEF-002 counterfactual replays', () => {
  it('DEBRIEF-002 replaying the player\'s own action log reproduces the checkpoint error within 1 s', () => {
    const sc = stopLeg();
    const sim = runWithDwell(sc, 8);
    const actual = sim.result();
    const again = replay(sc, actual.events)!;
    expect(again).not.toBeNull();
    expect(again.score.legs[0]!.error).toBeCloseTo(actual.score.legs[0]!.error!, 0);
    expect(stopsFromEvents(actual.events).length).toBe(1);
  });
  it('DEBRIEF-002 "go at the card dwell" removes the stop error, leaving only the standing-start loss; per-stop rows read "if you had called go at X"', () => {
    const sc = stopLeg();
    const sim = runWithDwell(sc, 15);           // full printed pause: ~7.5 s late at the stop
    const actual = sim.result();
    const was = actual.score.legs[0]!.error!;
    const cfs = counterfactuals(actual, sc);
    const card = cfs.find(c => c.id === 'cardDwell')!;
    expect(card.applicable).toBe(true);
    const e = card.rows[0]!.error!;
    expect(e).toBeLessThan(was);
    expect(Math.abs(e - accelLoss(35, sc.car))).toBeLessThanOrEqual(2);       // what remains is the start-line loss
    expect(card.rows[0]!.text).toMatch(/^cp1: [+-]?\d+ \(was \+\d+\)$/);
    const per = cfs.find(c => c.id === 'stop:0')!;
    expect(per.label).toMatch(/if you had called go at 7\.\d s instead of 15\.\d s, cp1 would have been/);
    // ATTR-001 holds for the replayed run too
    const vm = debriefViewModel(card.result, sc);
    expect(Math.abs(vm.legs[0]!.sum - (vm.legs[0]!.error ?? 0))).toBeLessThanOrEqual(1.5);
    // not applicable rows are reported, never thrown
    expect(cfs.find(c => c.id === 'fullTa')!.applicable).toBe(false);
    expect(cfs.find(c => c.id === 'exactCard')!.applicable).toBe(false);
    expect(counterfactuals(null, sc)).toEqual([]);
    expect(replay(sc, null)).toBeNull();
    expect(dwellFor(15, 35, 35, sc.car)).toBeCloseTo(7.4, 0);
  });
});

describe('DEBRIEF-003 bias vs noise', () => {
  it('DEBRIEF-003 labels a consistent late "go" as bias with one tip, scattered errors as noise, and merges the last-10-run history', () => {
    const mk = (deltas: number[]) => ({
      stops: deltas.map((d, i) => ({ legIndex: 1, nodeId: `n${i}`, line: i, vIn: 35, vOut: 35, entrySpeed: 35, exitSpeed: 35, pause: 15, carLoss: 7.5, cardLoss: 7.5, idealDwell: 7.5, correctDwell: 7.5, yourDwell: 7.5 + d, goAt: null, net: d, delta: d, waitTod: 0, releaseTod: null, text: '', formulaText: '' })),
      timed: [], landmarks: [], turns: [], cruise: [],
    });
    const bias = biasNoise(mk([2.0, 2.4, 1.8, 2.2]), null);
    const stop = bias.rows.find(r => r.type === 'stop')!;
    expect(stop.verdict).toBe('bias');
    expect(stop.mean).toBeCloseTo(2.1, 1);
    expect(bias.tip).toMatch(/late/);
    const noise = biasNoise(mk([-3, 3, -2.5, 2.5]), null);
    expect(noise.rows.find(r => r.type === 'stop')!.verdict).toBe('noise');
    expect(noise.tip).toMatch(/rhythm/);
    // history: this run alone looks like noise, but with ten late runs behind it the verdict is bias
    const withHist = biasNoise(mk([0.2]), { stop: [2, 2.5, 1.8, 2.2, 2.1, 1.9, 2.3, 2.0, 2.4, 2.2] });
    expect(withHist.rows.find(r => r.type === 'stop')!.verdict).toBe('bias');
    expect(withHist.rows.find(r => r.type === 'stop')!.histN).toBe(11);
    expect(biasNoise(mk([]), null).tip).toBeNull();
    // the debrief carries exactly one tip
    const sc = stopLeg();
    const vm = debriefViewModel(runWithDwell(sc, 15).result(), sc);
    expect(typeof vm.tip).toBe('string');
    expect(vm.tip.split(/(?<=\.)\s+(?=[A-Z])/).length).toBeLessThanOrEqual(2);
    expect(vm.bias.rows.length).toBe(5);
  });
});

describe('DEBRIEF-004 immediate CP card', () => {
  it('DEBRIEF-004 at aids rung >= 2 a timing CP crossing yields a 3-second card with error, largest bucket and event; at rung <= 1 nothing', () => {
    const sc = stopLeg();
    const r = runWithDwell(sc, 15).result();
    expect(aidsRung(TRAINING_AIDS)).toBe(3);
    expect(aidsRung(LEGAL_AIDS)).toBe(0);
    expect(aidsRung(aidsForRung(2))).toBe(2);
    expect(aidsRung(aidsForRung(1))).toBe(1);
    const cards = cpCards(r.events, r.attribution, TRAINING_AIDS, sc);
    expect(cards.length).toBe(1);
    const c = cards[0]!;
    expect(c.cpId).toBe('cp1');
    expect(c.showUntil - c.tod).toBeCloseTo(3, 6);
    expect(c.error).toBe(r.score.legs[0]!.error);
    expect(c.largestBucket).not.toBeNull();
    expect(c.largestEvent).toMatch(/stop at line 2/);
    expect(cpCards(r.events, r.attribution, LEGAL_AIDS, sc)).toEqual([]);
    expect(cpCards(r.events, r.attribution, aidsForRung(1), sc)).toEqual([]);
    expect(cpCards(undefined, undefined, TRAINING_AIDS)).toEqual([]);
  });
});
