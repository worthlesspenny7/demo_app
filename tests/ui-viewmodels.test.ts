import { describe, it, expect } from 'vitest';
import { stopwatchViewModel } from '../src/ui/viewmodels/stopwatch.js';
import { clockViewModel } from '../src/ui/viewmodels/clock.js';
import { speedoViewModel } from '../src/ui/viewmodels/speedo.js';
import { cameoSvg, pickRouteExit } from '../src/ui/viewmodels/cameo.js';
import { bookRows, columnC } from '../src/ui/viewmodels/book.js';
import { debriefViewModel, BUCKETS, workedTimed, workedCruise, ledgerAccuracy, biasNoise, cpCards, aidsRung } from '../src/ui/viewmodels/debrief.js';
import { replay, counterfactuals, stopsFromEvents } from '../src/ui/viewmodels/counterfactual.js';
import { effectiveScale, simAdvance, nextScale } from '../src/ui/viewmodels/timescale.js';
import { KeyMapper, KEY_HELP } from '../src/ui/viewmodels/keys.js';
import { audioCues } from '../src/ui/viewmodels/audio.js';
import { createAnnotations } from '../src/ui/viewmodels/annotations.js';
import { cockpitLayout, MIN_STOPWATCH_DIAL } from '../src/ui/viewmodels/layout.js';
import { dwellFor, accelLoss } from '../src/core/perf-table.js';
import { LEGAL_AIDS, TRAINING_AIDS, aidsForRung } from '../src/core/course.js';
import type { Observation } from '../src/core/sim.js';
import { createProgressStore, type StorageLike } from '../src/ui/viewmodels/progress.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { DRIVER_EXPERT } from '../src/core/course.js';
import type { Instruction, Scenario } from '../src/core/course.js';
import { runToEnd, startAtOfficialTime, stepUntil } from './helpers.js';
import '../src/core/drills/index.js';
import { drillById, allDrills } from '../src/core/drills/registry.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { instrumentPolicy, paceAidText, stopCardFor, cardDwell, focusLine, perfCardFor, waitMore, restartLabel } from '../src/ui/viewmodels/cockpitinfo.js';
import { nextDrill, startPathState, CURRICULUM } from '../src/ui/viewmodels/curriculum.js';
import { snapshotRun, restoreSim, saveStored, loadStored, LIVE_KEY } from '../src/ui/viewmodels/resume.js';
import { recordCampaignStage, loadCampaign, campaignSummary } from '../src/ui/viewmodels/campaign.js';
import { drillHint } from '../src/ui/viewmodels/hints.js';
import { trapCards, mathCards } from '../src/ui/screens/quiz.js';
import { headlineTip } from '../src/core/drills/rubrics.js';
import { workedStops, workedTurns, workedRestarts, rankTips } from '../src/ui/viewmodels/debrief.js';
import { stopLoss } from '../src/core/perf-table.js';

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
    expect(rows.map(r => r.colC)).toEqual(['CDT 8:00:00 / 35 MPH', '0 MPH / 0m15s', '30 MPH / 0m36s / 40 MPH', '0 MPH / 0m15s / 35 MPH', '']);   // GRIID-002 stacked lines, never "P15" or "30 for 0:36 then 40"
    expect(rows.map(r => r.state)).toEqual(['past', 'prev', 'current', 'next', 'next']);
    expect(rows[4]!.b).toEqual(['finish']);
    expect(rows[3]!.colD).toBe('Left at STOP. Pause 15. Speed 35 Comes quick');
  });
  it('UI-005 clamps out-of-range current lines and tolerates empty books', () => {
    expect(bookRows(book, 99).filter(r => r.isCurrent).map(r => r.n)).toEqual([5]);
    expect(bookRows(book, -3).filter(r => r.isCurrent).map(r => r.n)).toEqual([1]);
    expect(bookRows(book, Number.NaN).filter(r => r.isCurrent).length).toBe(1);
    expect(bookRows(undefined, 1)).toEqual([]);
    expect(columnC({ pause: 20, timed: { holdSpeed: 25, seconds: 90, thenSpeed: 45 } })).toBe('0 MPH / 0m20s / 25 MPH / 1m30s / 45 MPH');
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
    expect(k.keydown({ key: 'r' })).toEqual({ type: 'watch.recall' });            // WATCH-008: R recalls (never resets)
    expect(k.keydown({ key: 'm' })).toEqual({ type: 'watch.mode' });
    expect(k.keydown({ key: 'k' })).toEqual({ type: 'clock.read' });
    expect(k.keydown({ key: 'c' })).toEqual({ type: 'charts' });
    expect(k.keydown({ key: 'R', shiftKey: true })).toEqual({ type: 'watch.reset', force: true });   // only Shift+R resets from the keyboard, and it forces
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
      stops: deltas.map((d, i) => ({ legIndex: 1, nodeId: `n${i}`, line: i, vIn: 35, vOut: 35, entrySpeed: 35, exitSpeed: 35, pause: 15, carLoss: 7.5, cardLoss: 7.5, idealDwell: 7.5, correctDwell: 7.5, yourDwell: 7.5 + d, trafficWait: 0, goAt: null, net: d, delta: d, waitTod: 0, releaseTod: null, text: '', formulaText: '' })),
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
    // N1: the verdict judges THIS run. One row (n < 2) has no verdict even with ten late runs behind it; the history is context only
    const hist = { stop: [2, 2.5, 1.8, 2.2, 2.1, 1.9, 2.3, 2.0, 2.4, 2.2] };
    const withHist = biasNoise(mk([0.2]), hist);
    expect(withHist.rows.find(r => r.type === 'stop')!.verdict).toBe('none');
    expect(withHist.rows.find(r => r.type === 'stop')!.histN).toBe(11);
    expect(withHist.tip).toBeNull();
    // this run's two rows decide: scattered this run stays noise even over a late history; a steady +1.1 s, SD 0.1 is bias
    expect(biasNoise(mk([-3, 3]), hist).rows.find(r => r.type === 'stop')!.verdict).toBe('noise');
    const steady = biasNoise(mk([1.0, 1.1, 1.2, 1.1, 1.0, 1.2]), null).rows.find(r => r.type === 'stop')!;
    expect(steady.verdict).toBe('bias'); expect(Math.abs(steady.mean!)).toBeGreaterThan(steady.sd!);
    // the printed rule |mean| > sd always agrees with the verdict shown
    for (const d of [[0.6, -0.2, 0.4], [4, -4, 4.4], [1, 1], [0.1, -0.1]]) { const r = biasNoise(mk(d), null).rows.find(x => x.type === 'stop')!; if (r.verdict !== 'none') expect(r.verdict).toBe(Math.abs(r.mean!) > r.sd! ? 'bias' : 'noise'); }
    // nothing to say when both the mean and the SD are negligible, or with 0 or 1 maneuvers
    expect(biasNoise(mk([0.1, -0.1, 0.2]), null).rows.find(r => r.type === 'stop')!.verdict).toBe('none');
    expect(biasNoise(mk([]), null).tip).toBeNull();
    // the debrief carries exactly one tip
    const sc = stopLeg();
    const vm = debriefViewModel(runWithDwell(sc, 15).result(), sc);
    expect(typeof vm.tip).toBe('string');
    expect(vm.tip.split(/(?<=\.)\s+(?=[A-Z])/).length).toBeLessThanOrEqual(2);
    expect(vm.bias.rows.length).toBe(6);
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


// ---------------------------------------------------------------------------------------------------------------------
// UI fix sprint: one stop loss everywhere, stop card, restart holds, tip ranking, legal mode, resume, campaign, quizzes
// ---------------------------------------------------------------------------------------------------------------------
function oracleRun(id: string, seed: number, tier: number) {
  const d = drillById(id)!; const sc = d.scenario(seed, tier);
  const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
  return { d, sc, sim, r };
}

describe('UI-014 one turn-capped stop loss for the book strip, the perf card and the Debrief (PT-03 W1)', () => {
  it('UI-014 card dwell == Debrief ideal dwell for every pause line of D03 seeds 1-10, including turning stops', () => {
    let turning = 0, checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { sc, r } = oracleRun('D03', seed, 0);
      const vm = debriefViewModel(r, sc);
      for (const st of vm.stops) {
        if (st.line === null || !st.pause) continue;
        const card = stopCardFor(sc, st.line)!;
        expect(card.loss).toBeCloseTo(st.carLoss!, 6);
        expect(card.dwell).toBeCloseTo(st.idealDwell!, 6);
        expect(cardDwell(sc, st.line)).toBeCloseTo(st.idealDwell!, 6);
        if (sc.book[st.line - 1]!.turn && sc.book[st.line - 1]!.turn !== 'S') { turning++; expect(card.cap).toBe(sc.car.turnSpeedMph.turn); }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20); expect(turning).toBeGreaterThan(5);
  });
  it('UI-014 the turn cap lowers the dwell: a 90-degree turning stop loses more than the straight stop at the same speeds', () => {
    const { sc } = oracleRun('D03', 1, 0);
    const line = sc.book.find(i => i.pause && i.turn === 'L')!;
    expect(stopCardFor(sc, line.n)!.loss).toBeGreaterThan(0);
    // model-driven cars (the Ford): the turn zone cap lengthens the re-acceleration (table-driven cars read their printed chart and need no cap)
    expect(stopLoss(40, 40, FORD_1939, FORD_1939.turnSpeedMph.turn)).toBeGreaterThan(stopLoss(40, 40, FORD_1939));
  });
  it('UI-015 the Debrief stop rows come from the engine attribution (line, pause, dwell) and agree with the event log', () => {
    const { sc, r } = oracleRun('D03', 2, 0);
    const att = r.attribution.flatMap(a => a.stops);
    const rows = workedStops(r.events, sc, r.attribution);
    expect(att.length).toBeGreaterThan(3);
    for (const a of att) { const row = rows.find(x => x.nodeId === a.nodeId)!; expect(row.line).toBe(a.line); expect(row.pause).toBe(a.pause); expect(row.yourDwell).toBeCloseTo(Math.round(a.goDwell * 10) / 10, 1); expect(row.trafficWait).toBeCloseTo(Math.round(a.trafficWait * 10) / 10, 1); }
  });
});

describe('UI-016 stopped line, line focus and the legal-mode policy', () => {
  it('UI-016 focusLine: the stopped line wins; at rung >= 1 the pointer is last executed + 1; at rung 0 it is the book pointer', () => {
    const o = (stopped: number | null, cur: number, le: number | null) => ({ stoppedAtLine: stopped, currentLine: cur, driver: { lastExecutedLine: le } });
    expect(focusLine(o(4, 1, 2), 3, 10)).toEqual({ line: 4, stopped: true });
    expect(focusLine(o(null, 1, 3), 1, 10)).toEqual({ line: 4, stopped: false });
    expect(focusLine(o(null, 2, 3), 0, 10)).toEqual({ line: 2, stopped: false });
    expect(focusLine(o(null, 1, 10), 2, 10)).toEqual({ line: 10, stopped: false });
  });
  it('UI-016 a real STOP exposes stoppedAtLine and the card for that line with a wait-more countdown', () => {
    const { sc } = oracleRun('D03', 1, 0);
    const sim = new Simulator(sc); startAtOfficialTime(sim);
    stepUntil(sim, () => sim.observe({ peek: true }).stoppedAtLine !== null, 900);
    const o = sim.observe({ peek: true });
    expect(o.stoppedAtLine).toBe(2);
    const card = perfCardFor(sc, 2, instrumentPolicy(sc.aids))!;
    expect(card.mode).toBe('answers'); expect(card.stop!.cap).toBe(sc.car.turnSpeedMph.turn);
    expect(waitMore(card.stop!, 3)).toBeCloseTo(card.stop!.dwell - 3, 6);
  });
  it('UI-017 legal mode: rung <= 1 hides digital readouts and the computed card; rung >= 2 keeps them; the card then has only own annotations', () => {
    expect(instrumentPolicy(aidsForRung(0))).toMatchObject({ digitalReadouts: false, computedCard: false });
    expect(instrumentPolicy(aidsForRung(1))).toMatchObject({ digitalReadouts: false, computedCard: false });
    expect(instrumentPolicy(aidsForRung(2))).toMatchObject({ digitalReadouts: true, computedCard: true });
    expect(instrumentPolicy(aidsForRung(3))).toMatchObject({ digitalReadouts: true, computedCard: true });
    const { sc } = oracleRun('D03', 1, 0);
    const legal = perfCardFor(sc, 2, instrumentPolicy(aidsForRung(0)))!;
    expect(legal.mode).toBe('own'); expect(legal.stop).toBeUndefined(); expect(legal.timed).toBeUndefined();
  });
  it('UI-017 restart lines print their out-time and are never a stop card', () => {
    const sc = drillById('D16')!.scenario(1, 0);
    const rl = sc.book.filter(i => restartLabel(i));
    expect(rl.length).toBeGreaterThan(0);
    expect(restartLabel(rl[0])).toMatch(/^RESTART at \d\d:\d\d:\d\d$/);
    const card = perfCardFor(sc, rl[0]!.n, instrumentPolicy(sc.aids))!;
    expect(card.restart).toBeTruthy(); expect(card.stop).toBeUndefined();
  });
});

describe('DEBRIEF-005 restart holds, tip ranking and turn callouts', () => {
  it('DEBRIEF-005 a lunch / restart hold is judged against the out-time, not billed as a stop dwell', () => {
    const { sc, r } = oracleRun('D16', 1, 0);
    const vm = debriefViewModel(r, sc);
    const restartNodes = new Set(sc.book.filter(i => restartLabel(i)).map(i => i.nodeId));
    expect(vm.restarts.length).toBeGreaterThan(0);
    for (const s of vm.stops) expect(restartNodes.has(s.nodeId ?? '')).toBe(false);
    expect(vm.restarts[0]!.text).toMatch(/out-time \d\d:\d\d:\d\d/);
    expect(Math.abs(vm.restarts[0]!.delta ?? 0)).toBeLessThan(20);
    expect(vm.bias.rows.find(x => x.type === 'restart')).toBeTruthy();
    expect(vm.tip).not.toMatch(/subtract \d{2,} more/);
    expect(workedRestarts(r.events, sc).length).toBe(vm.restarts.length);
  });
  it('DEBRIEF-005 the first tip is the engine headline (largest bucket); a perfect Timewise speedo never reads "low"', () => {
    for (const [id, seed, tier] of [['D03', 1, 0], ['D04', 1, 2], ['D11', 1, 1]] as const) {
      const d = drillById(id)!; const sc = d.scenario(seed, tier);
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { latency: 1.5 }));
      const vm = debriefViewModel(r, sc);
      expect(vm.tips[0]).toBe(headlineTip(r, sc)); expect(vm.tip).toBe(vm.tips[0]);
      expect(vm.tips.length).toBeLessThanOrEqual(2);
      if (sc.speedo.kind === 'timewise' && sc.speedo.gain === 1) expect(vm.tips.join(' ')).not.toMatch(/speedometer reads low/i);
    }
  });
  it('DEBRIEF-005 a turn tip never outranks a larger stops bucket; callouts made while stopped are not graded', () => {
    const { sc, r } = oracleRun('D03', 3, 0);
    const turns = workedTurns(r.events, sc);
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) { if (t.whileStopped) { expect(t.late).toBe(false); expect(t.lateBy).toBe(0); } }
    const vm = debriefViewModel(r, sc);
    for (const x of vm.bias.errors.turn) expect(x).toBeGreaterThanOrEqual(0);
    expect(vm.bias.errors.turn.length).toBe(turns.filter(t => !t.whileStopped && t.lateBy !== null).length);
    // synthetic: a big stops bucket suppresses a turn follow-up
    const fakeBias = { rows: [{ type: 'turn' as const, label: 't', n: 2, mean: 2, sd: 0, histN: 2, histMean: 2, histSd: 0, verdict: 'bias' as const, fix: 'TURN FIX' }], tip: 'TURN FIX', topType: 'turn' as const, errors: { stop: [], timed: [], landmark: [], turn: [2, 2], cruise: [], restart: [] } };
    const totals = { cruise: 0, stop: 41, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 3, start: 0, ta: 0 };
    const simBad = new Simulator(sc); const bad = runBot(simBad, new OracleBot(simBad, { ignoreLosses: true }));
    expect(headlineTip(bad, sc)).not.toMatch(/^Clean run/);
    expect(rankTips(bad, sc, true, 'x', fakeBias, totals)).not.toContain('TURN FIX');
    expect(rankTips(bad, sc, true, 'x', fakeBias, { ...totals, stop: 0, turn: 20 })).toContain('TURN FIX');
    expect(rankTips(r, sc, true, 'x', fakeBias, { ...totals, stop: 0, turn: 20 })).not.toContain('TURN FIX');   // a clean run gets no follow-up
  });
});

describe('UI-018 progress per tier, honest persistence flag, resume and campaign', () => {
  const mem = (): StorageLike & { map: Map<string, string> } => { const map = new Map<string, string>(); return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } }; };
  it('UI-018 stars are stored per tier (Bronze/Silver/Gold), the best across tiers still drives unlocks, runs keep raw seconds', () => {
    const st = createProgressStore(mem());
    st.recordRun('D03', { stars: 2, aces: 1, score: 3, tier: 0, raw: 12, unit: 'raw' });
    st.recordRun('D03', { stars: 3, aces: 0, score: 1, tier: 2, raw: 5, unit: 'raw' });
    st.recordRun('D03', { stars: 1, aces: 0, score: 4, tier: 0, raw: 20, unit: 'raw' });
    const p = st.get('D03')!;
    expect(p.tierStars).toEqual([2, 0, 3]); expect(p.stars).toBe(3); expect(p.bestRaw).toBe(5);
    expect(st.recentRuns(3).map(r => r.raw)).toEqual([12, 5, 20]);
  });
  it('UI-018 C2: a working store reports persistent before anything was written; a throwing store reports false', () => {
    expect(createProgressStore(mem()).persistent).toBe(true);
    const bad: StorageLike = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(createProgressStore(bad).persistent).toBe(false);
  });
  it('UI-018 a live run saved as {actions, tick} restores to the identical simulator state (replay)', () => {
    const d = drillById('D03')!; const sc = d.scenario(1, 0);
    const sim = new Simulator(sc, { watch: 'analog' });
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' }); sim.act({ type: 'watch.toggle' });
    for (let i = 0; i < 300; i++) { sim.step(0.1); if (i === 50) sim.act({ type: 'call.speed', mph: 36 }); if (i === 120) sim.act({ type: 'line.set', n: 3 }); }
    const snap = snapshotRun(sim, { kind: 'drill', drillId: 'D03', tier: 0, seed: 1 }, { driverSkill: 'scenario', watch: 'analog', annotations: null, scaleMax: 1 });
    const store = mem(); expect(saveStored(LIVE_KEY, snap, store)).toBe(true);
    const back = loadStored(LIVE_KEY, store)!;
    const re = restoreSim(sc, back);
    expect(re.tick).toBe(sim.tick);
    const a = sim.observe({ peek: true }), b = re.observe({ peek: true });
    expect(b.tod).toBe(a.tod); expect(b.currentLine).toBe(a.currentLine); expect(b.stopwatch.reading).toBe(a.stopwatch.reading); expect(b.speedo.reading).toBe(a.speedo.reading); expect(b.driver.targetIndicated).toBe(a.driver.targetIndicated);
    // and both continue identically
    sim.step(30); re.step(30);
    expect(re.observe({ peek: true }).tod).toBe(sim.observe({ peek: true }).tod); expect(re.car.s).toBe(sim.car.s);
    expect(() => restoreSim(sc, { ...back, engineVersion: '0.0.1' })).toThrow();
  });
  it('UI-020 D13 campaign: nine stages, best score per stage kept, cumulative total, per tier', () => {
    const store = mem();
    recordCampaignStage({ stage: 1, tier: 0, raw: 60, score: 50.7, aces: 1 }, store, 1);
    recordCampaignStage({ stage: 1, tier: 0, raw: 90, score: 76.1, aces: 0 }, store, 2);   // worse replay: ignored
    recordCampaignStage({ stage: 2, tier: 0, raw: 40, score: 33.8, aces: 2 }, store, 3);
    recordCampaignStage({ stage: 1, tier: 1, raw: 10, score: 8.5, aces: 0 }, store, 4);
    recordCampaignStage({ stage: 12, tier: 0, raw: 1, score: 1, aces: 0 }, store, 5);        // out of range
    const s0 = campaignSummary(loadCampaign(store), 0);
    expect(s0.rows.length).toBe(9); expect(s0.played).toBe(2); expect(s0.total).toBeCloseTo(84.5, 5); expect(s0.rows[0]!.score).toBeCloseTo(50.7, 5); expect(s0.rows[1]!.cumulative).toBeCloseTo(84.5, 5); expect(s0.complete).toBe(false);
    expect(campaignSummary(loadCampaign(store), 1).played).toBe(1);
    expect(drillById('D13')!.scenario(3, 0).id).not.toBe(drillById('D13')!.scenario(4, 0).id);
  });
});

describe('UI-019 first-run clarity and the curriculum order', () => {
  it('UI-019 Start here: lesson 1 first, then D01, D03; the current step is the first one not done', () => {
    const none = startPathState({}, () => false);
    expect(none[0]!.step.id).toBe('ghost-car'); expect(none[0]!.current).toBe(true); expect(none.filter(x => x.current).length).toBe(1);
    const some = startPathState({ D01: 1 }, id => id === 'ghost-car');
    expect(some.find(x => x.current)!.step.id).toBe('D03');
    expect(startPathState({}, () => true).some(x => x.current)).toBe(true);   // drills still pending
  });
  it('UI-019 next drill follows the curriculum, D18 gets a Next (D11) and a locked next drill reports its lock', () => {
    const ds = allDrills();
    expect(CURRICULUM.indexOf('D18')).toBeLessThan(CURRICULUM.indexOf('D11'));
    const n = nextDrill('D18', ds, {})!;
    expect(n.drill.id).toBe('D11'); expect(n.locked).toBe(true); expect(n.needs).toMatch(/D18/);
    expect(nextDrill('D18', ds, { D18: 1, D07: 2 })!.locked).toBe(false);
    expect(nextDrill('D11', ds, {})!.drill.id).toBe('D12');
  });
  it('UI-019 D01 gets its own objective keys and pre-read; other drills get the generic three', () => {
    expect(drillHint('D01').preread).toMatch(/front bumper/); expect(drillHint('D01').keys.map(k => k[0])).toEqual(['D', 'Space', 'L']);
    expect(drillHint('D99').preread).toBeNull(); expect(drillHint('D03').keys.length).toBe(3);
  });
});

describe('UI-021 quizzes: distinct cards, distinct options, no printed answers', () => {
  it('UI-021 D09: 20 distinct cards drawn from the 24-card trap library, four distinct options, the answer is in the options and not in the prompt', () => {
    for (const seed of [1, 7, 42, 311, 999]) {
      const cards = trapCards(seed);
      expect(cards.length).toBe(20); expect(new Set(cards.map(c => c.prompt)).size).toBe(20);
      for (const c of cards) { expect(c.options.length).toBe(4); expect(new Set(c.options).size).toBe(4); expect(c.answer).toBeGreaterThanOrEqual(0); expect(c.prompt).not.toContain(c.options[c.answer]!); }
    }
  });
  it('UI-021 D14 (PT-03 W2): no duplicate options for 300 seeds; the recovery card uses the stopwatch form t = E v / 5', () => {
    for (let seed = 1; seed <= 300; seed++) for (const c of mathCards(seed)) { expect(new Set(c.options).size).toBe(c.options.length); expect(c.options.length).toBe(4); }
    const c = mathCards(5).find(x => x.prompt.includes('hold +5 mph'))!;
    expect(c.tip).toContain('E x v / d');
  });
});

import { formatElapsed } from '../src/core/units.js';
import { Stopwatch, RallyClock } from '../src/core/stopwatch.js';
import { fmtMMSS } from '../src/ui/viewmodels/book.js';
import { unlockStars, unlockBest, startPathFromProgress } from '../src/ui/viewmodels/curriculum.js';
import { scenarioMinutes, drillMinutes, formatMinutes } from '../src/ui/viewmodels/estimate.js';
import { gateFor } from '../src/ui/viewmodels/campaign-gate.js';
import { finishPrompt, turnLossBlock } from '../src/ui/viewmodels/cockpitinfo.js';
import { scaleHintText } from '../src/ui/viewmodels/hints.js';
import { sameDrillSource } from '../src/ui/viewmodels/resume.js';
import { isUnlocked } from '../src/core/drills/index.js';

describe('DEBRIEF-008 this-run verdicts and traffic holds', () => {
  it('DEBRIEF-008 a steady +1.1 s (SD 0.1) over 6 stops is bias, the printed rule agrees, rows with n < 2 have no verdict or advice', () => {
    const mk = (deltas: number[]) => ({
      stops: deltas.map((d, i) => ({ legIndex: 1, nodeId: `n${i}`, line: i, vIn: 35, vOut: 35, entrySpeed: 35, exitSpeed: 35, pause: 15, carLoss: 7.5, cardLoss: 7.5, idealDwell: 7.5, correctDwell: 7.5, yourDwell: 7.5 + d, trafficWait: 0, goAt: null, net: d, delta: d, waitTod: 0, releaseTod: null, text: '', formulaText: '' })),
      timed: [], landmarks: [], turns: [], cruise: [],
    });
    const b = biasNoise(mk([1.0, 1.1, 1.2, 1.1, 1.0, 1.2]), { stop: [3, -3, 3, -3] });   // a scattered history must not change this run's verdict
    const stop = b.rows.find(r => r.type === 'stop')!;
    expect(stop.verdict).toBe('bias'); expect(b.tip).toMatch(/late/);
    for (const r of b.rows.filter(x => x.n < 2)) { expect(r.verdict).toBe('none'); expect(r.fix).toBe(''); }
    const one = biasNoise(mk([4]), null); expect(one.rows.find(r => r.type === 'stop')!.verdict).toBe('none'); expect(one.tip).toBeNull();
  });
  it('DEBRIEF-008 stop rows carry goDwell as the navigator dwell and trafficWait as a ledger note (traffic forced on every seed)', () => {
    const quietDriver = { ...DRIVER_EXPERT, inconsistency: 0 };
    let seen = 0;
    for (let seed = 1; seed <= 8 && !seen; seed++) {
      const sc: Scenario = new ScenarioBuilder({ startTime: 8 * 3600, seed, driver: quietDriver, trafficWaitProbability: 1 }).start(35).advanceMiles(0.5).stop('S', 35, { pause: 15 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
      const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' });
      for (let i = 0; i < 6000 && sim.phase !== 'finished'; i++) { sim.step(0.5); if (sim.waitingForGo) { sim.step(8); sim.act({ type: 'call.go' }); sim.step(30); } }
      const r = sim.result(); const att = r.attribution.flatMap(a => a.stops);
      const rows = workedStops(r.events, sc, r.attribution);
      expect(rows.length).toBe(att.length);
      rows.forEach((row, i) => { expect(row.yourDwell).toBeCloseTo(Math.round(att[i]!.goDwell * 10) / 10, 1); expect(row.trafficWait).toBeCloseTo(Math.round(att[i]!.trafficWait * 10) / 10, 1); });
      const held = rows.find(x => x.trafficWait > 0.5);
      if (held) { seen++; expect(held.text).toMatch(/Traffic held the car/); expect(held.formulaText).toMatch(/traffic held the car/); expect(held.yourDwell).toBeLessThan(att[0]!.dwell); }
    }
    expect(seen).toBe(1);
  });
});

describe('UI-021 formatters and the bezel index', () => {
  it('UI-021 119.97 s prints 2:00.0 and 0:59.96 prints 1:00.0; fmtMMSS rounds before splitting', () => {
    expect(formatElapsed(119.97)).toBe('2:00.0'); expect(formatElapsed(59.96)).toBe('1:00.0'); expect(formatElapsed(119.97, 0)).toBe('2:00');
    expect(formatElapsed(65.04, 2)).toBe('1:05.04'); expect(formatElapsed(-0.04)).toBe('0:00.0'); expect(formatElapsed(-5.5)).toBe('-0:05.5');
    expect(fmtMMSS(119.6)).toBe('2:00'); expect(fmtMMSS(59.5)).toBe('1:00'); expect(fmtMMSS(61)).toBe('1:01');
  });
  it('UI-021 bezelRemaining is 0.0 at the index (float noise must not wrap to the dial length)', () => {
    const w = new Stopwatch('analog'); w.start(0); w.bezel = 20.200000000000003;
    expect(w.bezelRemaining(20.2)).toBe(0); expect(w.bezelRemaining(20.0)).toBeCloseTo(0.2, 6);
    const c = new RallyClock(); c.setBezel(20); expect(c.bezelRemaining(28800 + 20 + 1e-9)).toBe(0); expect(c.bezelRemaining(28800 + 20)).toBe(0);
    expect(clockViewModel(28800 + 20 + 1e-9, 20).bezelRemaining).toBe(0); expect(clockViewModel(28800 + 19.8, 20).bezelRemaining).toBeCloseTo(0.2, 3);
    const vm = stopwatchViewModel(20.2, 'analog', { dialSeconds: 60, bezel: 20.200000000000003 }); expect(vm.bezelRemaining).toBe(0);
  });
});

describe('DRILL-004 unlocks count Silver or Gold stars only', () => {
  it('DRILL-004 Bronze stars never unlock; Silver or Gold do; single-tier decks count their only tier; legacy progress falls back to best stars', () => {
    const ds = allDrills(); const d03 = ds.find(d => d.id === 'D03')!; const d09 = ds.find(d => d.id === 'D09')!;
    expect(unlockStars(d03, { stars: 3, tierStars: [3, 0, 0] })).toBe(0);
    expect(unlockStars(d03, { stars: 3, tierStars: [3, 2, 0] })).toBe(2);
    expect(unlockStars(d03, { stars: 3, tierStars: [1, 0, 3] })).toBe(3);
    expect(unlockStars(d09, { stars: 2, tierStars: [2, 0, 0] })).toBe(2);
    expect(unlockStars(d03, { stars: 2 })).toBe(2);
    const bronze = Object.fromEntries(['D03', 'D04', 'D05', 'D08', 'D10'].map(id => [id, { stars: 3, tierStars: [3, 0, 0] }]));
    expect(isUnlocked(drillById('D18')!, unlockBest(ds, { drills: bronze }))).toBe(false);
    const silver = Object.fromEntries(['D03', 'D04', 'D05', 'D08', 'D10'].map(id => [id, { stars: 2, tierStars: [0, 2, 0] }]));
    expect(isUnlocked(drillById('D18')!, unlockBest(ds, { drills: silver }))).toBe(true);
  });
});

describe('UI-028 Start-here path and pace aid polish', () => {
  it('UI-028 Start-here marks a drill step done only on a Silver or Gold star (same rule as unlockStars); lessons use lessonDone', () => {
    const ds = allDrills();
    const bronze = { drills: { D01: { stars: 3, tierStars: [3, 0, 0] } } };
    const afterBronze = startPathFromProgress(ds, bronze, id => id === 'ghost-car');
    expect(afterBronze.find(x => x.step.id === 'D01')!.done).toBe(false);
    expect(afterBronze.find(x => x.current)!.step.id).toBe('D01');
    const silver = { drills: { D01: { stars: 2, tierStars: [0, 2, 0] }, D03: { stars: 3, tierStars: [0, 0, 3] } } };
    const afterSilver = startPathFromProgress(ds, silver, id => id === 'ghost-car');
    expect(afterSilver.find(x => x.step.id === 'D01')!.done).toBe(true);
    expect(afterSilver.find(x => x.step.id === 'D03')!.done).toBe(true);
    expect(afterSilver.find(x => x.current)!.step.id).toBe('D04');
    expect(afterSilver.find(x => x.step.id === 'ghost-car')!.done).toBe(true);
  });
  it('UI-028 pace aid shows no number while the car waits at a restart line (hold), the signed number otherwise', () => {
    expect(paceAidText(-227.8, 'hold')).toBe('holding for restart');
    expect(paceAidText(-227.8, 'stop')).toBe('-227.8 s');
    expect(paceAidText(3.25, null)).toBe('+3.3 s');
    expect(paceAidText(0, undefined)).toBe('0.0 s');
  });
});

describe('UI-024 card minutes come from the 1x ghost time', () => {
  it('UI-024 D07 reads about 45 min, not 12; a quiz keeps its own figure; formatting handles hours', () => {
    const d07 = drillById('D07')!;
    expect(drillMinutes(d07)).toBeGreaterThan(40); expect(drillMinutes(d07)).toBeLessThan(55);
    expect(drillMinutes(drillById('D09')!)).toBe(drillById('D09')!.minutes);
    expect(scenarioMinutes(drillById('D01')!.scenario(1, 0))).toBeGreaterThanOrEqual(4);
    expect(formatMinutes(9)).toBe('~9 min'); expect(formatMinutes(60)).toBe('~1 h'); expect(formatMinutes(293)).toBe('~4 h 53 min');
  });
});

describe('UI-025 campaign gate', () => {
  it('UI-025 D13 is locked until D12 has a Silver/Gold star; the note names what is needed', () => {
    const d13 = drillById('D13')!;
    const locked = gateFor(d13, {}); expect(locked.open).toBe(false); expect(locked.note).toMatch(/D12/);
    expect(gateFor(d13, { D12: 1 }).open).toBe(true);
    expect(gateFor(undefined, {}).open).toBe(false);
  });
});

describe('UI-022 saved run on the pre-read and UI-023 scale hints', () => {
  it('UI-022 a saved run counts as "the same drill" for any tier and seed, never for another drill', () => {
    expect(sameDrillSource({ kind: 'drill', drillId: 'D03', tier: 0, seed: 1 }, { kind: 'drill', drillId: 'D03', tier: 2, seed: 9 })).toBe(true);
    expect(sameDrillSource({ kind: 'drill', drillId: 'D03', tier: 0, seed: 1 }, { kind: 'drill', drillId: 'D04', tier: 0, seed: 1 })).toBe(false);
    expect(sameDrillSource({ kind: 'builtin', name: 'varied', seed: 1 }, { kind: 'builtin', name: 'varied', seed: 4 })).toBe(true);
    expect(sameDrillSource({ kind: 'builtin', name: 'varied', seed: 1 }, { kind: 'drill', drillId: 'D03', tier: 0, seed: 1 })).toBe(false);
  });
  it('UI-023 the hint bar names the real scale keys; the keys exist and a locked drill says so', () => {
    expect(scaleHintText(false)).toMatch(/>.*faster/); expect(scaleHintText(false)).toMatch(/<.*slower/); expect(scaleHintText(true)).toMatch(/locked at 1x/);
    const k = new KeyMapper(); expect(k.keydown({ key: '>' })).toEqual({ type: 'scale', delta: 1 }); expect(k.keydown({ key: '<' })).toEqual({ type: 'scale', delta: -1 });
  });
});

describe('UI-026 S at the finish and the turn-loss block', () => {
  it('UI-026 the finish prompt appears when the finish or observation checkpoint is in sight and disappears after S', () => {
    const sc = drillById('D03')!.scenario(1, 0);
    const ahead = [{ kind: 'finish', approxDistanceFt: 300 }, { kind: 'checkpoint', approxDistanceFt: 150, label: 'OBSERVATION CHECKPOINT' }];
    const needs = { ...sc, checkpoints: [...sc.checkpoints, { ...sc.checkpoints[0]!, kind: 'observation' as const }] };
    expect(finishPrompt(ahead, needs, false)).toMatch(/S: stop/);
    expect(finishPrompt(ahead, needs, true)).toBeNull();
    expect(finishPrompt([{ kind: 'intersection', approxDistanceFt: 200 }], needs, false)).toBeNull();
    expect(finishPrompt(ahead, { book: [], checkpoints: [] }, false)).toBeNull();
  });
  it('UI-026 the perf card of a turning line carries 90 and 45 degree turn-loss rows from the performance table', () => {
    const sc = drillById('D11')!.scenario(1, 0);
    const line = sc.book.findIndex(i => i.turn === 'L' || i.turn === 'R') + 1;
    expect(line).toBeGreaterThan(0);
    const card = perfCardFor(sc, line, instrumentPolicy(aidsForRung(3)))!;
    expect(card.turnLoss).toBeDefined();
    const t = card.turnLoss!; expect(t.rows.map(r => r.angle)).toEqual([90, 45]); expect(t.rows[0]!.losses.length).toBe(t.speeds.length);
    expect(t.rows[0]!.losses[2]!).toBeGreaterThan(t.rows[1]!.losses[2]!);   // a 90 costs more than a 45
    expect(t.here?.angle).toBe(90); expect(t.here!.loss).toBeGreaterThan(0);
    expect(turnLossBlock(sc, 1).here).toBeNull();
  });
});

// ---------- teaching content: LESSON-001..005, CHART-004/005 wording, UI-033 ----------
import { LESSONS, lessonText, type Lesson } from '../content/lessons.js';
import { PACKARD_CHARTS, PACKARD_LABEL, AGE_FACTOR_ROWS, PENALTY_ROWS, TA_PATTERN, COLUMN_C_ROWS, SPEED_CHANGE_ROWS, packardValue, ageFactorFor } from '../content/reference-data.js';
import { STOPWATCH_NOTE, CLOCK_NOTE } from '../src/ui/screens/settings.js';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/ui/state.js';
import { vi } from 'vitest';

const lesson = (id: string): Lesson => { const l = LESSONS.find(x => x.id === id); if (!l) throw new Error(`no lesson ${id}`); return l; };
const hasAll = (text: string, phrases: string[]): void => { for (const p of phrases) expect(text, `missing phrase: ${p}`).toContain(p); };
const checkOk = (l: Lesson): void => { expect(l.check.question.length).toBeGreaterThan(10); expect(l.check.options.length).toBeGreaterThanOrEqual(3); expect(l.check.answer).toBeGreaterThanOrEqual(0); expect(l.check.answer).toBeLessThan(l.check.options.length); expect(l.check.explain.length).toBeGreaterThan(10); };

describe('LESSON-001 The Four S\'s', () => {
  it('LESSON-001 exists with the four S\'s in the handbook\'s order and priorities, cites HB p.13-14 and has a check question', () => {
    const l = lesson('four-s'); const t = lessonText(l);
    expect(l.title).toBe("The Four S's"); checkOk(l);
    hasAll(t, ['HB p.13-14', 'Safety first', 'Start on time', 'Stay on course', 'Stay on time', "concentrate on the first 3 S's", 'WWV', 'automatically on time the instant you reach a checkpoint']);
    expect(t.indexOf('Safety first')).toBeLessThan(t.indexOf('Start on time')); expect(t.indexOf('Start on time')).toBeLessThan(t.indexOf('Stay on course')); expect(t.indexOf('Stay on course')).toBeLessThan(t.indexOf('Stay on time'));
    expect(l.source).toMatch(/08-rookie-handbook-body/); expect(l.source).toMatch(/V\.H/);
  });
  it('LESSON-001 gives the TA rules in plain words with the farm-tractor example and the real penalties', () => {
    const t = lessonText(lesson('four-s'));
    hasAll(t, ['What qualifies', 'What never does', 'multiples of 10 s', 'within 15 minutes', 'TA point', 'could have made up', TA_PATTERN, 'Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.']);
    hasAll(t, ['1 s per second', '2 min late, 5 min early', 'Missed timing checkpoint', '3 min', 'More than 30 min', 'Failure to stop at a STOP sign', 'DNF']);
    const l = lesson('four-s'); expect(l.check.options[l.check.answer]).toContain('0m20s');
  });
  it('LESSON-001 every lesson keeps a source citing the research files and has one check question', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
    for (const l of LESSONS) { expect(l.source.length, l.id).toBeGreaterThan(10); expect(l.source, l.id).toMatch(/docs\/research|DESIGN/); checkOk(l); }
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length);
    expect(LESSONS[0]!.id).toBe('ghost-car');   // the start-here path still begins with the ghost car
  });
});

describe('LESSON-002 Team protocol', () => {
  it('LESSON-002 teaches the call pattern ending in GO, the read-back rule and the sign glossary', () => {
    const l = lesson('protocol'); const t = lessonText(l);
    expect(l.title).toBe('Team protocol'); checkOk(l);
    hasAll(t, ['Next: STOP sign, crossroad, turn right, 35 after.', 'Stopped', '3, 2, 1, GO', 'always ends a countdown with the word GO', 'HB Appendix B']);
    hasAll(t, ['crossroad', 'T', 'sideroad', 'Y', 'soft right curve', 'soft offset right curve', 'blinker', 'yield', 'comes quick']);
    hasAll(t, ['repeats back every turn and every speed', 'timed section', 'cross off each instruction', 'names the next sign before looking down', 'never pull up to a restart point before your minute', 'make up a loss as soon as it is safe', 'team errors only', 'the driver watches the road']);
    const glossary = l.body.find((b): b is Extract<typeof b, { table: unknown }> => typeof b !== 'string' && 'table' in b)!;
    expect(glossary.table.rows.map(r => r[0])).toEqual(expect.arrayContaining(['crossroad', 'T', 'sideroad', 'Y', 'soft right curve', 'soft offset right curve', 'blinker', 'yield', 'comes quick']));
  });
  it('LESSON-002 carries a printable card for the driver of exactly eight lines', () => {
    const card = lesson('protocol').body.find((b): b is Extract<typeof b, { card: unknown }> => typeof b !== 'string' && 'card' in b)!;
    expect(card.card.title).toMatch(/Card for the driver/); expect(card.card.lines).toHaveLength(8);
    expect(card.card.lines.join(' ')).toMatch(/GO/); expect(card.card.lines.join(' ')).toMatch(/Stopped/);
  });
});

describe('LESSON-003 Marking up the instructions', () => {
  it('LESSON-003 lists the six notations with a page-break example and the restart and transit arithmetic', () => {
    const l = lesson('markup'); const t = lessonText(l); checkOk(l);
    expect(l.title).toBe('Marking up the instructions');
    const list = l.body.find((b): b is Extract<typeof b, { list: string[] }> => typeof b !== 'string' && 'list' in b)!;
    expect(list.list).toHaveLength(6); expect(list.ordered).toBe(true);
    hasAll(t, ['HB p.15', 'Carry the speed from the bottom of each page to the top of the next', 'Write every speed not shown', 'Highlight every "comes quick"', 'note it at the bottom of the previous page', 'chart pause time beside every printed pause', 'restart time', 'OUT time', '8:55:00 + 12 min = 9:07:00', 'PAGE 2 of 6', 'PAGE 3 of 6', '8.6']);
    expect(l.check.options[l.check.answer]).toBe('40 MPH');
  });
});

describe('LESSON-004 Transits and restarts', () => {
  it('LESSON-004 covers advisory vs exact transits, IN + interval = OUT, lunch inside the transit, base + ASP, the free zone and the wrong-minute warning', () => {
    const l = lesson('transits'); const t = lessonText(l); checkOk(l);
    expect(l.title).toBe('Transits and restarts');
    hasAll(t, ['Advisory transit', 'Exact transit', 'IN + interval = OUT', 'leave here 45 minutes prior to your end-of-transit time', 'assigned start position', 'ASP', '2-minute free zone', 'wrong minute', 'a lot of make up']);
    expect(l.check.options[l.check.answer]).toBe('2:22:00');   // 2:55:00 + 12 min - 45 min
  });
});

describe('LESSON-005 Reference pages', () => {
  it('LESSON-005 the penalty table carries the 1 s, 120 / 300 / 180 s numbers with rule numbers', () => {
    const by = (rule: string) => PENALTY_ROWS.find(r => r.rule === rule)!;
    expect(by('V.E.1.a').seconds).toBe(1); expect(by('V.E.1.b').seconds).toBe(120); expect(by('V.E.1.c').seconds).toBe(300); expect(by('V.E.2.a, V.C.2.b').seconds).toBe(180); expect(by('V.E.3.a').seconds).toBe(30);
    expect(by('V.E.3.e').penalty).toBe('DNF');
    for (const r of PENALTY_ROWS) expect(r.rule).toMatch(/^V\.E\.\d/);
  });
  it('LESSON-005 the age factor table is the printed V.D table: 0.845 for 1939, 0.915 for 1953, 1.000 from 1954, 0.800 for 1930, 0.500 for 1900', () => {
    const f = (y: string) => AGE_FACTOR_ROWS.find(r => r.year === y)!.factor;
    expect(f('1939')).toBe(0.845); expect(f('1953')).toBe(0.915); expect(f('1954+')).toBe(1); expect(f('1930')).toBe(0.8); expect(f('1929')).toBe(0.79); expect(f('1936')).toBe(0.83); expect(f('1926')).toBe(0.76); expect(f('1912')).toBe(0.62); expect(f('1900')).toBe(0.5);
    expect(AGE_FACTOR_ROWS).toHaveLength(55); expect(ageFactorFor(1939)).toBe(0.845); expect(ageFactorFor(1965)).toBe(1);
  });
  it('LESSON-005 the three Packard charts are static tables labelled "1936 Packard example, HB p.7-9" with 8.6 for 30->40 stop & go and 4.0 for 40->35 turn', () => {
    expect(PACKARD_LABEL).toBe('1936 Packard example, HB p.7-9'); expect(PACKARD_CHARTS.map(c => c.id)).toEqual(['accel', 'stopgo', 'turn']);
    expect(packardValue('stopgo', 30, 40)).toBe(8.6); expect(packardValue('turn', 40, 35)).toBe(4); expect(packardValue('accel', 0, 40)).toBe(4.5);
    expect(packardValue('stopgo', 15, 15)).toBe(13); expect(packardValue('turn', 50, 50)).toBe(7.7); expect(packardValue('accel', 50, 0)).toBe(3.3);
    for (const c of PACKARD_CHARTS) for (const r of c.rows) expect(r.values).toHaveLength(c.cols.length);
  });
  it('LESSON-005 Column C syntax and speed-change position tables carry rule numbers', () => {
    expect(COLUMN_C_ROWS.map(r => r.shows)).toEqual(expect.arrayContaining(['7:30:00', '3h15m00s', '0m45s', '(35m00s)', '45 MPH']));
    expect(SPEED_CHANGE_ROWS.map(r => r.rule)).toEqual(expect.arrayContaining(['VII.E.2.b', 'VII.E.2.c', 'VII.E.2.d']));
    expect(TA_PATTERN).toBe('Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.');
  });
});

describe('CHART-004 and CHART-005 lesson wording', () => {
  it('CHART-004 pause-arithmetic, timed-leads and recovery use the handbook rules', () => {
    hasAll(lessonText(lesson('pause-arithmetic')), ['Stop & Go chart', 'sometimes the instructed pause time may be different than 15 seconds', '13.6 s']);
    hasAll(lessonText(lesson('timed-leads')), ['split the speed change at the sign', 'midpoint speed', '32.5', 'Half a ramp early is the same thing']);
    const rec = lessonText(lesson('recovery'));
    hasAll(rec, ['drive 10 % above the instructed speed for 10 x the seconds lost', '38.5 mph for 40 s makes up 4 s at 35', '44 mph for 44 s makes up 4.4 s at 40', '(Assigned - Actual) / Assigned x seconds at the reduced speed = seconds lost', '40 assigned, 30 actual, 20 s']);
    expect(lesson('recovery').check.options[lesson('recovery').check.answer]).toBe('44 mph for 44 s');
  });
  it('CHART-005 calibration shows the Timewise worked example: 4.1 s late = 8.2 s/h = 10 clicks, 4315 -> 4305', () => {
    const t = lessonText(lesson('calibration'));
    hasAll(t, ['new factor = old factor x correct time / actual time', '28m43.2s', '28m47.3s', '4.1 s', '8.2 s per hour', '10 clicks', '4315 - 10 = 4305', '4305']);
    expect(Math.round(4315 * (28 * 60 + 43.2) / (28 * 60 + 47.3))).toBe(4305);
  });
  it('CHART-004 the GRIID lesson names five columns, the Column B symbols, Column C syntax and Column D remarks versus example sentences', () => {
    const t = lessonText(lesson('griid-cameo'));
    hasAll(t, ['five columns', 'B = section symbols', 'hourglass', '7:30:00', '3h15m00s', '0m45s', 'advisory', 'Comes quick', 'Look sharp', 'full sentence', 'VII.B.3.c']);
  });
});

describe('UI-033 Settings: handbook defaults (digital stopwatch, analog clock), analog stopwatch selectable', () => {
  it('UI-033 the defaults are a digital stopwatch and an analog clock, and the notes say the analog stopwatch is not the handbook\'s recommendation', () => {
    expect(DEFAULT_SETTINGS.watch).toBe('digital'); expect(DEFAULT_SETTINGS.clock).toBe('analog');
    hasAll(STOPWATCH_NOTE, ['digital stopwatch', 'lap/split', 'time-of-day', 'HB p.5', 'analog stopwatch', 'not the handbook\'s recommendation', 'selectable']);
    hasAll(CLOCK_NOTE, ['analog by default', 'digital readout', 'optional', 'WWV']);
  });
  it('UI-033 the clock setting persists through save and load and a missing field falls back to analog', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
    try {
      saveSettings({ ...DEFAULT_SETTINGS, clock: 'digital', watch: 'analog' });
      expect(loadSettings().clock).toBe('digital'); expect(loadSettings().watch).toBe('analog');   // analog stays selectable
      const [key] = [...store.keys()]; const old = JSON.parse(store.get(key!)!) as Record<string, unknown>; delete old['clock']; store.set(key!, JSON.stringify(old));
      expect(loadSettings().clock).toBe('analog');
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('LESSON-006 Which timer, when', () => {
  it('LESSON-006 sits right after the Four S\'s and states the clock / stopwatch split with the two never-do rules', () => {
    const i = LESSONS.findIndex(l => l.id === 'which-timer'); expect(i).toBeGreaterThan(0); expect(LESSONS[i - 1]!.id).toBe('four-s');
    const l = lesson('which-timer'); const t = lessonText(l); checkOk(l); expect(l.title).toBe('Which timer, when');
    hasAll(t, ['HB p.5', 'WWV', 'base time plus your assigned start position', 'IN and OUT times of an exact transit', '15-minute Time Allowance window', 'lap at every calibration point', 'asterisk', 'wheels stop', '10 % make-up count', 'backup', 'never read time of day off a running chrono', 'never time an interval off the clock']);
    expect(l.check.options[l.check.answer]).toMatch(/stopwatch at the sign/);
  });
  it('LESSON-006 has a situation / device / what-you-write-down table and a worked calibration-lap example against the box', () => {
    const l = lesson('which-timer');
    const tab = l.body.find((b): b is Extract<typeof b, { table: { head: string[] } }> => typeof b !== 'string' && 'table' in b)!;
    expect(tab.table.head).toEqual(['Situation', 'Device', 'What you write down']);
    for (const r of tab.table.rows) expect(r).toHaveLength(3);
    expect(tab.table.rows.map(r => r[0])).toEqual(expect.arrayContaining(['Start or restart', 'Exact transit', 'TA window (15 min)', 'Calibration run', 'Timed speed change', 'Pause', '10 % make-up count']));
    const t = lessonText(l);
    hasAll(t, ['1m49.3s', '7m21.3s', '16m02.0s', '25m17.8s', 'box cumulative', 'your lap', 'Late 4.3 s']);
  });
});

// ---------- UI V2: GRIID book, charts, TA point, restart cards, scorecard, digital watch ----------
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { columnCLines, columnBSymbols, columnD, odometerBox, type ColumnBSymbol } from '../src/core/griid.js';
import { bookPages, griidRow, calibrationBoxRange, pageOfLine, signBox, ROWS_PER_PAGE } from '../src/ui/viewmodels/book.js';
import { griidIcon, odometerHtml, SYMBOL_LABEL } from '../src/ui/render/griid-icons.js';
import { columnAHtml, columnBHtml, columnCHtml, griidRowHtml } from '../src/ui/render/griid.js';
import { bookSheetsHtml } from '../src/ui/screens/book.js';
import { chartGrids, stopChartReading, chartStopLoss, tenPercentRule } from '../src/ui/viewmodels/charts.js';
import { holdCardFor } from '../src/ui/viewmodels/cockpitinfo.js';
import { taFormVm, taRounding, taNoteText, windowClock } from '../src/ui/viewmodels/ta.js';
import { scorecardViewModel, taRequestRows } from '../src/ui/viewmodels/scorecard.js';
import { digitalWatchViewModel, SplitTracker, chronoText, todText } from '../src/ui/viewmodels/digitalwatch.js';
import { PACKARD_1936, FORD_1939 } from '../src/core/course.js';
import { buildPerfTable } from '../src/core/perf-table.js';
import { builtinScenario } from '../src/agent/scenarios.js';
import { hms, formatClock } from '../src/core/units.js';

const ALL_SYMBOLS: ColumnBSymbol[] = ['warmup', 'calibration', 'transit-begin', 'transit-end', 'freezone-begin', 'freezone-end', 'end-timed', 'pit', 'meal', 'refuel', 'rest', 'ta', 'finish'];

/** The oracle drives a generated stage to the first open TA window (seed 6 has a qualifying delay on leg 3). */
function stageAtTaWindow(seed: number): Simulator {
  const sim = new Simulator(generateStage(seed), { watch: 'digital' }); const bot = new OracleBot(sim);
  for (let n = 0; n < 2_000_000 && sim.phase !== 'finished' && !sim.taState().windowOpen; n++) { bot.onTick(); sim.step(0.1); }
  return sim;
}

describe('UI-029 the book as the five-column GRIID row', () => {
  const stage = generateStage(1);
  it('UI-029 every row carries number, Column B ids with the odometer box, stacked Column C lines and Column D, straight from the core GRIID helpers', () => {
    const rows = bookRows(stage.book, 12, { timeZone: stage.timeZone, style: stage.bookStyle });
    expect(rows.length).toBe(stage.book.length);
    for (const r of rows) {
      const ins = stage.book[r.n - 1]!;
      expect(r.b).toEqual(columnBSymbols(ins)); expect(r.c).toEqual(columnCLines(ins, stage.timeZone)); expect(r.odometer).toBe(odometerBox(ins)); expect(r.d).toBe(columnD(ins, stage.bookStyle));
      expect(r.colC).toBe(r.c.join(' / '));
      for (const l of r.c) expect(l).not.toMatch(/^P\d|for \d+:\d\d then/);   // the old "P15" / "30 for 0:36 then 40" notation is gone
    }
    expect(rows.filter(r => r.isCurrent).map(r => r.n)).toEqual([12]);
    expect(rows[10]!.state).toBe('prev'); expect(rows[12]!.state).toBe('next'); expect(rows[20]!.state).toBe('far');   // UI-009 emphasis kept
    const pause = rows.find(r => r.pause)!; expect(pause.c.slice(0, 3)).toEqual(['0 MPH', '0m15s', expect.stringMatching(/^\d+ MPH$/)]);
    const hourglass = rows.find(r => r.b.includes('transit-begin') && r.odometer)!; expect(hourglass.odometer).toMatch(/^\d{4}$/);
    const asterisk = rows.find(r => r.asterisk)!; expect(asterisk.c).toContain('* 0m00.0s');
  });
  it('UI-029 the calibration box is the interval over the cumulative time; a 5m32.0s / 7m21.3s pair is boxed', () => {
    const cal = stage.book.find(i => i.section === 'calibration' && !i.calibrationStart)!;
    const r = griidRow(cal); expect(r.cBox).not.toBeNull();
    expect(r.c.slice(r.cBox![0], r.cBox![1] + 1)).toEqual([expect.stringMatching(/^\d+m\d\d\.\ds$/), expect.stringMatching(/^\d+m\d\d\.\ds$/)]);
    const ins: Instruction = { n: 7, nodeId: 'x', text: 'cal', section: 'calibration', perfectInterval: 332, perfectCumulative: 441.3 };
    expect(calibrationBoxRange(ins, columnCLines(ins))).toEqual([0, 1]);
    const html = columnCHtml(griidRow(ins)); expect(html).toContain('class="cbox"'); expect(html).toContain('5m32.0s'); expect(html).toContain('7m21.3s');
    expect(columnCHtml(griidRow(stage.book.find(i => i.calibrationStart)!))).toContain('class="asterisk"');
  });
  it('UI-029 every Column B symbol id has a small inline SVG icon with its label, and the odometer box has four digit boxes with a black tenths box', () => {
    for (const sym of ALL_SYMBOLS) { const svg = griidIcon(sym); expect(svg).toContain(`data-sym="${sym}"`); expect(svg.startsWith('<svg')).toBe(true); expect(svg).toContain(SYMBOL_LABEL[sym]); expect(svg.length).toBeGreaterThan(150); }
    expect(new Set(ALL_SYMBOLS.map(s => griidIcon(s))).size).toBe(ALL_SYMBOLS.length);                       // all distinct
    expect(griidIcon('transit-begin')).not.toBe(griidIcon('transit-end'));                                   // full vs empty hourglass
    expect(griidIcon('freezone-begin')).toContain('#d6453d'); expect(griidIcon('freezone-end')).not.toContain('#d6453d');   // crossed camera vs camera
    expect(griidIcon('ta')).toContain('#f5d90a');                                                             // yellow box
    const odo = odometerHtml('0045'); expect(odo).toContain('data-odo="0045"'); expect((odo.match(/<i/g) ?? []).length).toBe(4); expect(odo).toContain('class="tenths">5');
    const b = columnBHtml({ b: ['warmup', 'transit-begin'], odometer: '0080' }); expect(b).toContain('data-sym="warmup"'); expect(b).toContain('data-odo="0080"'); expect((b.match(/data-odo/g) ?? []).length).toBe(1);
  });
  it('UI-029 Column D is the sentence in the example style and the remark alone in the race style (GRIID-009)', () => {
    const ins: Instruction = { n: 3, nodeId: 'n', text: 'Turn right at a crossroad at a Traffic Light.', remark: 'Comes quick' };
    expect(griidRow(ins, { style: 'example' }).d).toBe('Turn right at a crossroad at a Traffic Light. Comes quick');
    expect(griidRow(ins, { style: 'race' }).d).toBe('Comes quick');
    expect(griidRow({ ...ins, remark: undefined }, { style: 'race' }).d).toBe('');
    expect(columnAHtml({ svg: '<svg/>', sign: signBox({ id: 'n', s: 0, kind: 'sign', control: 'none', sightDistance: 300, sign: { text: 'LEAVING ELDORA CITY LIMIT', shape: 'rect', side: 'R' } }), landmark: 'bridge' })).toMatch(/sign-box side-R[^>]*>LEAVING ELDORA CITY LIMIT.*landmark">bridge/);
  });
  it('UI-029 page breaks every 6 rows with "Page n of m" and the stage title; the printable view prints the same pages', () => {
    const pages = bookPages(stage.book, 'D18 Full day', { timeZone: stage.timeZone, style: stage.bookStyle });
    expect(ROWS_PER_PAGE).toBe(6); expect(pages.length).toBe(Math.ceil(stage.book.length / 6));
    expect(pages[0]!.footer).toBe(`Page 1 of ${pages.length}`); expect(pages[1]!.footer).toBe(`Page 2 of ${pages.length}`); expect(pages[0]!.title).toBe('D18 Full day');
    expect(pages.slice(0, -1).every(p => p.rows.length === 6)).toBe(true); expect(pages.flatMap(p => p.rows).map(r => r.n)).toEqual(stage.book.map(i => i.n));
    expect(pageOfLine(1)).toBe(1); expect(pageOfLine(6)).toBe(1); expect(pageOfLine(7)).toBe(2);
    const html = bookSheetsHtml(stage, 'D18 Full day'); expect((html.match(/class="book-sheet"/g) ?? []).length).toBe(pages.length);
    expect(html).toContain(`Page 1 of ${pages.length}`); expect(html).toContain('D18 Full day'); expect(html).toContain('data-sym="transit-begin"'); expect(html).toContain('class="cbox"');
    expect(griidRowHtml(pages[0]!.rows[0]!, { svg: '' })).toMatch(/class="gn">1<.*class="gb".*class="gc".*class="gd"/);
  });
  it('UI-029 lettered lines print their letter and omitted lines are marked (GRIID-005)', () => {
    const r = griidRow({ n: 4, nodeId: 'n', text: 'x', printed: '3a', omitted: true });
    expect(r.printed).toBe('3a'); expect(r.omitted).toBe(true); expect(griidRowHtml({ ...r, isCurrent: false, state: 'far', offset: 3 }, { svg: '' })).toContain('(omitted)');
  });
});

describe('UI-030 the three handbook charts as IN x OUT grids with the current pair highlighted', () => {
  it('UI-030 chartGrids returns accel (including 0), stop & go and turns, IN rows x OUT columns, and the pair is highlighted in each (CHART-001)', () => {
    const g = chartGrids(FORD_1939, { vIn: 35, vOut: 40 });
    expect(g.map(x => x.id)).toEqual(['accel', 'stopGo', 'turns']); expect(g.map(x => x.letter)).toEqual(['a', 'b', 'c']);
    expect(g[0]!.speeds[0]).toBe(0); expect(g[0]!.rows[0]!.in).toBe(0); expect(g[0]!.rows.every(r => r.cells.length === g[0]!.speeds.length)).toBe(true);
    expect(g[1]!.speeds[0]).toBe(15); expect(g[2]!.speeds).toContain(55);
    for (const x of g) { expect(x.highlight).toEqual({ in: 35, out: 40 }); expect(x.rows.flatMap(r => r.cells).filter(c => c.hi).length).toBe(1); }
    const t = buildPerfTable(FORD_1939); const cell = g[1]!.rows.find(r => r.in === 35)!.cells.find(c => c.out === 40)!; expect(cell.value).toBe(t.stopGo.rows[35]![40]); expect(cell.text).toBe(cell.value.toFixed(1));
    expect(chartGrids(FORD_1939, { vIn: null, vOut: 35 })[0]!.highlight).toEqual({ in: 0, out: 35 });          // a start from rest highlights the 0 row of chart (a)
    expect(chartGrids(FORD_1939, null).every(x => x.highlight === null)).toBe(true);
  });
  it('UI-030 the Packard example in chart (b) at 30 in / 40 out prints 8.6, and the stop card reads that pause time directly', () => {
    const g = chartGrids(PACKARD_1936, { vIn: 30, vOut: 40 })[1]!; expect(g.rows.find(r => r.in === 30)!.cells.find(c => c.out === 40)!.text).toBe('8.6');
    const rd = stopChartReading(PACKARD_1936, 30, 40, 15); expect(rd.chart).toBe(8.6); expect(rd.sit).toBe(8.6);
    expect(stopChartReading(PACKARD_1936, 30, 40, 20).sit).toBeCloseTo(13.6, 6);                                  // a longer printed pause adds the extra seconds
    expect(chartStopLoss(PACKARD_1936, 30, 40)).toBeCloseTo(15 - 8.6, 6);
  });
  it('UI-030 StopCard.chart carries the chart (b) reading for a straight stop, none for a stop at a turn; dwell = pause - loss from the same chart', () => {
    const sc = generateStage(1); const straight = sc.book.find(i => i.pause && (!i.turn || i.turn === 'S'))!; const turning = sc.book.find(i => i.pause && i.turn && i.turn !== 'S')!;
    const a = stopCardFor(sc, straight.n)!; expect(a.chart).not.toBeNull(); expect(a.chart!.sit).toBeCloseTo(a.dwell, 1); expect(a.cap).toBeUndefined();
    const b = stopCardFor(sc, turning.n)!; expect(b.chart).toBeNull(); expect(b.cap).toBe(sc.car.turnSpeedMph.turn);
  });
  it('UI-030 the 10 % rule line: drive 10 % over for ten times the seconds lost (CHART-003: "this turn: N s")', () => {
    expect(tenPercentRule(35, 4).text).toBe('10 % rule: 38.5 mph for 40 s makes up 4.0 s'); expect(tenPercentRule(40, 4.4).mph).toBe(44); expect(tenPercentRule(40, 4.4).seconds).toBe(44);
    const sc = generateStage(1); const turn = sc.book.find(i => (i.turn === 'R' || i.turn === 'L') && i.speed !== undefined)!;
    const here = turnLossBlock(sc, turn.n).here; expect(here).not.toBeNull(); expect(here!.rule.seconds).toBe(Math.round(here!.loss * 10)); expect(here!.rule.text).toContain('10 % rule');
  });
});

describe('UI-031 TA point screen', () => {
  it('UI-031 at an open TA window the form lists the eligible legs with measured delay, recoverable and suggested from sim.taAdvice, and the window counts down from 15 minutes', () => {
    const sim = stageAtTaWindow(6); const ta = sim.observe({ peek: true }).ta;
    expect(ta.windowOpen).toBe(true);
    const vm = taFormVm(ta, l => sim.taAdvice(l));
    expect(vm.visible).toBe(true); expect(vm.endOfStage).toBe(false); expect(vm.countdown).toBe('15:00'); expect(vm.legs.map(l => l.legIndex)).toEqual(ta.eligibleLegs);
    const leg3 = vm.legs.find(l => l.legIndex === 3)!; const adv = sim.taAdvice(3);
    expect(leg3.measured).toBe(adv.measuredDelay); expect(leg3.recoverable).toBe(adv.recoverable); expect(leg3.suggested).toBe(adv.suggested); expect(leg3.suggested).toBe(50); expect([leg3.fromLine, leg3.toLine]).toEqual([80, 80]);
    expect(leg3.text).toMatch(/Leg 3: delay 1m29s, could be made up 0m29s, suggested request 0m50s \(lines 80-80\)/);
    expect(vm.ackAvailable).toBe(false); expect(vm.example).toBe('Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.');
    sim.step(125); const later = taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)); expect(later.countdown).toBe('12:55');
    sim.step(900); expect(taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)).visible).toBe(false);
    expect(taFormVm(null, () => adv).visible).toBe(false);
  });
  it('UI-031 the request rounds live to 10 s against the team with the adjustment text, the same as the engine, and the note follows the handbook example (TA-005)', () => {
    expect(taRounding(47, 89).text).toBe('0m47s adjusted to 0m50s'); expect(taRounding(47, 89).adjusted).toBe(50);       // measured is above the midpoint: up
    expect(taRounding(43, 20)).toMatchObject({ adjusted: 40, changed: true }); expect(taRounding(50, 89)).toMatchObject({ adjusted: 50, changed: false });
    expect(taRounding(0, 5).adjusted).toBe(0);
    const sim = stageAtTaWindow(6); sim.act({ type: 'ta.request', legIndex: 3, seconds: 47, fromLine: 80, toLine: 80 });
    expect(sim.taRequests[0]!.adjusted).toBe(taRounding(47, sim.taAdvice(3).measuredDelay).adjusted); expect(sim.taRequests[0]!.adjustment).toBe(taRounding(47, sim.taAdvice(3).measuredDelay).text);
    expect(taNoteText({ delay: 45, madeUp: 25, request: 20, cause: 'a farm tractor' })).toBe('Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.');
    expect(taNoteText({ delay: 45, madeUp: 25, request: 20, witness: 'car 12' })).toBe('Delayed 0m45s. Made up 0m25s. Request 0m20s. Witness: car 12.');
    expect(windowClock(900)).toBe('15:00'); expect(windowClock(59.2)).toBe('1:00'); expect(windowClock(null)).toBe('--:--');
  });
  it('UI-031 the end-of-stage TA point offers the scorecard acknowledgement and the debrief shows each request with status, adjusted amount and reason', () => {
    const sim = new Simulator(generateStage(6), { watch: 'digital' }); const bot = new OracleBot(sim);
    let filed = false;
    for (let n = 0; n < 3_000_000 && sim.phase !== 'finished'; n++) {
      bot.onTick(); sim.step(0.1);
      const ta = sim.taState();
      if (ta.windowOpen && !ta.endOfStage && !filed && ta.eligibleLegs.includes(3)) { filed = true; sim.act({ type: 'ta.request', legIndex: 3, seconds: 47, fromLine: 80, toLine: 80, note: 'Delayed by a train.' }); sim.act({ type: 'ta.request', legIndex: 2, seconds: 30, fromLine: 40, toLine: 41 }); }
      if (ta.windowOpen && ta.endOfStage && !ta.scorecardAcked) { expect(taFormVm(ta, l => sim.taAdvice(l)).ackAvailable).toBe(true); sim.act({ type: 'scorecard.ack' }); expect(taFormVm(sim.taState(), l => sim.taAdvice(l)).ackAvailable).toBe(false); expect(taFormVm(sim.taState(), l => sim.taAdvice(l)).acked).toBe(true); }
    }
    const result = sim.result(); const rows = taRequestRows(result);
    expect(rows.length).toBeGreaterThanOrEqual(2); expect(rows.length).toBe(result.ta.requests.length); expect(result.ta.scorecardAcked).toBe(true);   // the oracle may file its own at the end-of-stage point
    const r3 = rows.find(r => r.legIndex === 3)!; expect(r3.status).toBe('filed'); expect(r3.adjusted).toBe(50); expect(r3.adjustment).toBe('0m47s adjusted to 0m50s'); expect(r3.reason).toBe(result.score.legs[2]!.taReason); expect(r3.text).toContain('requested 0m47s'); expect(r3.text).toContain('credit');
    const r2 = rows.find(r => r.legIndex === 2)!; expect(r2.reason).toMatch(/Allowed|measured|never/);
    const sc = scorecardViewModel(result, sim.sc); expect(sc.taRequests.length).toBe(rows.length); expect(sc.scorecardAcked).toBe(true); expect(sc.taCreditTotal).toBe(rows.reduce((a, r) => a + r.credit, 0));
  });
});

describe('UI-032 restart, exact-transit and promoted-stop cards', () => {
  const sc = generateStage(1, { ...PROFILES.fullStage!, asp: 17 });
  it('UI-032 restart card: base + ASP = your time, leave at that second, do not pull up before your minute', () => {
    const rs = sc.book.find(i => i.section === 'restart')!;
    const card = holdCardFor(sc, null, rs.n, sc.asp)!;
    expect(card.kind).toBe('restart'); expect(card.goTod).toBe(rs.restartTime);
    expect(card.text).toBe(`base ${formatClock(rs.baseTime!)} + ASP 17 min = your time ${formatClock(rs.baseTime! + 17 * 60)}, leave at that second, do not pull up before your minute`);
    expect(sc.asp).toBe(17); expect(rs.restartTime).toBe(rs.baseTime! + 17 * 60);
  });
  it('UI-032 exact-transit card: IN + 20m00s = OUT, from sim.transitIn / transitOutFor; before the sign it says to read the clock', () => {
    const ex = new ScenarioBuilder({ startTime: hms(8, 0, 0) }).start(30).advanceMiles(0.5).transit({ exact: true, seconds: 1200, miles: 12 }).advanceMiles(0.5).endTransit({ speed: 30 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const begin = ex.book.find(i => i.transit?.exact && !i.transit.end)!; const end = ex.book.find(i => i.transit?.end)!;
    const src = { transitIn: { [begin.n]: hms(9, 14, 7) }, transitOutFor: () => hms(9, 14, 7) + 1200, holdGoTod: () => null };
    const a = holdCardFor(ex, src, begin.n)!; expect(a.kind).toBe('transit'); expect(a.text).toBe('IN 09:14:07 + 20m00s = OUT 09:34:07'); expect(a.goTod).toBe(hms(9, 34, 7));
    const b = holdCardFor(ex, src, end.n)!; expect(b.text).toBe('IN 09:14:07 + 20m00s = OUT 09:34:07'); expect(b.title).toMatch(/End of exact transit/);
    expect(holdCardFor(ex, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => null }, begin.n)!.text).toBe('IN (read the clock at the sign) + 20m00s = OUT');
  });
  it('UI-032 promoted-stop card: leave by HH:MM:SS (45m00s prior to end of transit); the live sim supplies the time through holdGoTod', () => {
    const meal = sc.book.find(i => i.promotedStop?.kind === 'meal')!;
    const src = { transitIn: {}, transitOutFor: () => null, holdGoTod: () => hms(11, 6, 40) };
    expect(holdCardFor(sc, src, meal.n)!.text).toBe('leave by 11:06:40 (45m00s prior to end of transit)');
    expect(holdCardFor(sc, null, meal.n)!.text).toBe('leave 45m00s prior to end of transit');
    expect(holdCardFor(sc, null, 2)).toBeNull();
    const sim = new Simulator(sc); expect(typeof sim.holdGoTod).toBe('function'); expect(holdCardFor(sc, sim, meal.n)!.kind).toBe('promoted');
  });
});

describe('UI-034 debrief scorecard mirroring the official one', () => {
  function straightRun(lateSeconds: number, stop = false) {
    const sc = builtinScenario('straight', 1); const sim = new Simulator(sc, { watch: 'digital' });
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.step(3 + lateSeconds); sim.act({ type: 'start' }); sim.act({ type: 'call.speed', mph: 30 });
    for (let i = 0; i < 4000 && sim.phase !== 'finished'; i++) { if (sim.waitingForGo) sim.act({ type: 'call.go' }); if (stop && sim.car.s > 5400 && i % 1 === 0) sim.act({ type: 'call.stop' }); sim.step(0.5); }
    return { sc, result: sim.result() };
  }
  it('UI-034 a 3-minute-late leg is flagged "capped at 2m00s (late)" with its penalty 120, plus the observation penalty, raw, age factor and stage score to 0.01 s', () => {
    const { sc, result } = straightRun(183);
    const vm = scorecardViewModel(result, sc);
    expect(vm.legs.length).toBe(1); const l = vm.legs[0]!;
    expect(l.flag).toBe('late-cap'); expect(l.flagText).toBe('capped at 2m00s (late)'); expect(l.penalty).toBe(120); expect(l.errorText).toBe(`+${l.error}`); expect(l.perfect).toBe('08:02:00');
    expect(vm.caps).toEqual({ late: 120, early: 300, missed: 180 }); expect(vm.capsText).toBe('Late legs are capped at 2m00s, early legs at 5m00s; a missed checkpoint scores 3m00s.');
    expect(vm.items).toEqual([{ kind: 'observation', label: 'Observation Checkpoint crossed without the stop', seconds: 180 }]);
    expect(vm.raw).toBe(300); expect(vm.ageFactor).toBe(0.845); expect(vm.ageText).toBe('0.845 (1939)'); expect(vm.score).toBe(253.5); expect(vm.scoreText).toBe('253.50'); expect(vm.dnf).toBe(false); expect(vm.banner).toBe('');
  });
  it('UI-034 an early leg beyond 5 minutes is capped at 5m00s (early); a missed final checkpoint shows "missed checkpoint: 3m00s" and the DNF / FNS banner', () => {
    const sc = builtinScenario('straight', 1); const sim = new Simulator(sc, { watch: 'digital' });
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' }); sim.act({ type: 'call.speed', mph: 30 }); sim.step(20); sim.act({ type: 'abort' });
    const vm = scorecardViewModel(sim.result(), sc);
    expect(vm.legs[0]!.flag).toBe('missed'); expect(vm.legs[0]!.flagText).toContain('missed checkpoint: 3m00s'); expect(vm.legs[0]!.actual).toBe('missed'); expect(vm.legs[0]!.penalty).toBe(180);
    expect(vm.dnf).toBe(true); expect(vm.banner).toMatch(/^DNF \/ FNS: The final Timing Checkpoint was missed/); expect(vm.banner).toContain('excluded from championship awards');
  });
  it('UI-034 shows sight-zone, early-departure and observation items, TA credits per leg, and an ace marker', () => {
    const base = straightRun(0, true).result; const leg = base.score.legs[0]!;
    const fake = { ...base, score: { ...base.score, legs: [{ ...leg, extras: { ...leg.extras, sightZone: 30 }, taCredit: 50, taReason: 'Allowed 0m50s of 0m50s requested', ace: false, capped: false }], earlyDepartures: [{ minutesEarly: 6.5, penalty: 60, referral: false }, { minutesEarly: 7, penalty: 300, referral: false }, { minutesEarly: 8, penalty: 120, referral: true }], observationPenalty: 180 } } as typeof base;
    const vm = scorecardViewModel(fake, builtinScenario('straight', 1));
    expect(vm.items.map(i => i.kind)).toEqual(['sightZone', 'earlyDeparture', 'earlyDeparture', 'earlyDeparture', 'observation']);
    expect(vm.items[0]!.seconds).toBe(30); expect(vm.items[3]!.label).toContain('referred'); expect(vm.legs[0]!.taCredit).toBe(50);
  });
  it('UI-034 and WATCH-009 the instrument-discipline block lists result().instrumentDiscipline findings, or says it is clean', () => {
    const { sc, result } = straightRun(0, true);
    const clean = scorecardViewModel({ ...result, instrumentDiscipline: [] }, sc).discipline; expect(clean.clean).toBe(true); expect(clean.summary).toMatch(/^Clean/);
    const findings = [{ kind: 'clockForTimeOfDay' as const, line: 12, text: 'Restart time (line 12) was taken with the stopwatch in chrono mode and no clock read in the last minute' }, { kind: 'calibrationWithoutLap' as const, line: 7, text: 'Calibration point at line 7 was passed without a lap on the stopwatch' }];
    const d = scorecardViewModel({ ...result, instrumentDiscipline: findings }, sc).discipline; expect(d.clean).toBe(false); expect(d.findings).toEqual(findings); expect(d.summary).toContain('2 instrument findings');
  });
});

describe('WATCH-008 digital stopwatch view-model and UI-033 instrument keys', () => {
  it('WATCH-008 the display is 1/100 s in chrono and the rally time of day in TOD; the mode chip follows the engine mode', () => {
    expect(chronoText(441.3)).toBe('7:21.30'); expect(chronoText(0.005)).toBe('0:00.01'); expect(chronoText(59.999)).toBe('1:00.00'); expect(todText(hms(10, 14, 7.35))).toBe('10:14:07.35'); expect(todText(hms(10, 14, 7.999))).toBe('10:14:08.00');
    const sc = new ScenarioBuilder({ startTime: hms(8, 0, 0) }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc, { watch: 'digital' });
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' }); sim.act({ type: 'watch.start' }); sim.step(12.3);
    const a = digitalWatchViewModel(sim.observe({ peek: true }).stopwatch); expect(a.mode).toBe('chrono'); expect(a.modeLabel).toBe('CHRONO'); expect(a.display).toBe('0:12.30'); expect(a.running).toBe(true); expect(a.canReset).toBe(false);
    sim.act({ type: 'watch.mode' }); const b = digitalWatchViewModel(sim.observe({ peek: true }).stopwatch); expect(b.modeLabel).toBe('TOD'); expect(b.display).toMatch(/^08:00:\d\d\.\d\d$/);
  });
  it('WATCH-008 a lap freezes the split (indicator and countdown to the auto-release), the lap table shows interval over cumulative, recall cycles, reset only when stopped', () => {
    const sc = new ScenarioBuilder({ startTime: hms(8, 0, 0) }).start(30).advanceMiles(6).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc, { watch: 'digital' }); const tr = new SplitTracker();
    const vmOf = () => { const o = sim.observe({ peek: true }); tr.update(!!o.stopwatch.frozen, o.stopwatch.laps.length, o.tod); return digitalWatchViewModel(o.stopwatch, { holdSeconds: o.rules.splitHoldSeconds, tod: o.tod, tracker: tr }); };
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' }); sim.act({ type: 'watch.start' }); sim.step(332); sim.act({ type: 'watch.lap' }); sim.step(109.3); sim.act({ type: 'watch.lap' });
    let v = vmOf(); expect(v.frozen).toBe(true); expect(v.display).toBe('7:21.30'); expect(v.holdLeft).toBeCloseTo(5, 0); expect(v.indicator).toMatch(/^SPLIT frozen, releases in [45]\.\d s$/);
    expect(v.laps.map(l => [l.n, l.interval, l.cumulative])).toEqual([[2, '1m49.3s', '7m21.3s'], [1, '5m32.0s', '5m32.0s']]);   // newest first, the shape of the book's calibration box
    sim.step(2); v = vmOf(); expect(v.holdLeft).toBeCloseTo(3, 0); sim.step(4); v = vmOf(); expect(v.frozen).toBe(false); expect(v.indicator).toBe(''); expect(v.display).toBe(chronoText(sim.observe({ peek: true }).stopwatch.reading));
    sim.act({ type: 'watch.lap' }); sim.act({ type: 'watch.recall' }); v = vmOf(); expect(v.frozen).toBe(false);   // the first R releases the freeze
    sim.act({ type: 'watch.recall' }); v = vmOf(); expect(v.indicator).toBe('RECALL L3'); sim.act({ type: 'watch.recall' }); v = vmOf(); expect(v.indicator).toBe('RECALL L2'); expect(v.laps.find(l => l.recalled)!.n).toBe(2);   // then R cycles back through the laps
    expect(v.canReset).toBe(false); sim.act({ type: 'watch.reset' }); expect(sim.observe({ peek: true }).stopwatch.laps.length).toBe(3);   // refused while running
    sim.act({ type: 'watch.reset', force: true }); expect(vmOf().laps).toEqual([]);
    sim.act({ type: 'watch.stop' }); expect(vmOf().canReset).toBe(true);
  });
  it('WATCH-008 with the hold set to 0 the split stays frozen until recall (no countdown)', () => {
    const sc = new ScenarioBuilder({ startTime: hms(8, 0, 0), rules: { splitHoldSeconds: 0 } }).start(30).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); const sim = new Simulator(sc, { watch: 'digital' }); const tr = new SplitTracker();
    sim.act({ type: 'skipPreread', secondsBefore: 3 }); sim.act({ type: 'start' }); sim.act({ type: 'watch.start' }); sim.step(30); sim.act({ type: 'watch.lap' }); sim.step(60);
    const o = sim.observe({ peek: true }); tr.update(!!o.stopwatch.frozen, o.stopwatch.laps.length, o.tod); const v = digitalWatchViewModel(o.stopwatch, { holdSeconds: 0, tod: o.tod, tracker: tr });
    expect(v.frozen).toBe(true); expect(v.holdLeft).toBeNull(); expect(v.indicator).toBe('SPLIT frozen (R to release)');
  });
  it('UI-033 the key help lists Space / L / R / M, the reset rules and the clock-read key', () => {
    const t = KEY_HELP.map(k => `${k.keys}: ${k.does}`).join('\n');
    for (const s of ['Space', 'L or Enter', 'R: recall', 'M: digital watch mode', 'Reset button', 'Shift+R: force the reset even while running', 'C: the three performance charts', 'K or click the clock', 'T: Time Allowance form']) expect(t).toContain(s);
  });
});
