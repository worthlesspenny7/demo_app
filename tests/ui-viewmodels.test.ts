import { describe, it, expect } from 'vitest';
import { stopwatchViewModel } from '../src/ui/viewmodels/stopwatch.js';
import { clockViewModel } from '../src/ui/viewmodels/clock.js';
import { speedoViewModel } from '../src/ui/viewmodels/speedo.js';
import { cameoSvg, pickRouteExit } from '../src/ui/viewmodels/cameo.js';
import { bookRows, columnC } from '../src/ui/viewmodels/book.js';
import { debriefViewModel, BUCKETS } from '../src/ui/viewmodels/debrief.js';
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
