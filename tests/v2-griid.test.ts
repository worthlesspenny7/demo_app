import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS, describeInstruction, type NodeSpec } from '../src/core/builder.js';
import { DRIVER_EXPERT, TRAINING_AIDS, aidsForRung, instructionS, validateScenario, nodeById, type Instruction } from '../src/core/course.js';
import { columnCLines, columnBSymbols, columnCIcons, transitMiles, odometerBox, columnD, formatInterval, formatClockFace } from '../src/core/griid.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { hms, mphToFps } from '../src/core/units.js';
import { stepUntil, startLikeOracle } from './helpers.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const ins = (o: Partial<Instruction>): Instruction => ({ n: 1, nodeId: 'n1', text: '', ...o });

describe('GRIID format (REG VII.B.3, VII.F; HB Appendix D/E)', () => {
  it('GRIID-001 every book row has a number, Column A cameo data (node, exits, sign, control), Column B symbols, Column C stacked lines and a Column D sentence; the instruction lives in Column D', () => {
    const sc = generateStage(2, PROFILES.fullStage!);
    sc.book.forEach((row, i) => {
      expect(row.n).toBe(i + 1);
      const node = nodeById(sc.course, row.nodeId); expect(node).toBeDefined(); // Column A: dot, arrow, roads, sign text, landmark, control all live on the node
      expect(Array.isArray(columnBSymbols(row))).toBe(true); expect(Array.isArray(columnCLines(row, sc.timeZone))).toBe(true);
      expect(row.text.length, `row ${row.n}`).toBeGreaterThan(5); expect(columnD(row, 'example')).toContain(row.text);
    });
    expect(sc.book.some(r => columnCLines(r).length > 0)).toBe(true);
    // Column A carries no written instruction: the cameo node has no text field of its own
    expect(Object.keys(nodeById(sc.course, sc.book[3]!.nodeId))).not.toContain('text');
  });

  it('GRIID-002 Column C lines: speeds, pauses, timed and delayed changes, restart clock faces, transits, calibration boxes', () => {
    expect(columnCLines(ins({ speed: 40 }))).toEqual(['40 MPH']);
    expect(columnCLines(ins({ pause: 15, speed: 45 }))).toEqual(['0 MPH', '0m15s', '45 MPH']);
    expect(columnCLines(ins({ timed: { holdSpeed: 30, seconds: 36, thenSpeed: 45 } }))).toEqual(['30 MPH', '0m36s', '45 MPH']);
    expect(columnCLines(ins({ timed: { holdSpeed: 30, seconds: 72, thenSpeed: 40, delayed: true } }))).toEqual(['1m12s', '40 MPH']);
    expect(columnCLines(ins({ pause: 15, timed: { holdSpeed: 25, seconds: 40, thenSpeed: 45 } }))).toEqual(['0 MPH', '0m15s', '25 MPH', '0m40s', '45 MPH']);
    expect(columnCLines(ins({ section: 'restart', restartTime: hms(8, 55, 0), speed: 30 }), 'CDT')).toEqual(['CDT 8:55:00', '30 MPH']);
    expect(columnCLines(ins({ section: 'restart', restartTime: hms(15, 5, 0) + 17 * 60, baseTime: hms(14, 55, 0), speed: 30 }), 'EDT')).toEqual(['EDT 2:55:00', '30 MPH']); // the printed base, not base + ASP
    expect(columnCLines(ins({ transit: { exact: true, seconds: 1200, miles: 12 } }))).toEqual(['20m00s']);
    expect(columnCLines(ins({ transit: { exact: false, seconds: 30 } }))).toEqual(['(0m30s)']);
    expect(columnCLines(ins({ transit: { exact: false, seconds: 3 * 3600 + 25 * 60 } }))).toEqual(['(3h25m00s)']);
    expect(columnCLines(ins({ section: 'start', restartTime: hms(8, 0, 0), transit: { exact: true, seconds: 1200 } }))).toEqual(['CDT 8:00:00', '20m00s']);
    expect(columnCLines(ins({ section: 'calibration', perfectInterval: 332, perfectCumulative: 441.3 }))).toEqual(['5m32.0s', '7m21.3s']);
    expect(columnCLines(ins({ section: 'calibration', calibrationStart: true, speed: 50, transit: { exact: true, seconds: 1560 }, perfectInterval: 0, perfectCumulative: 0 }))).toEqual(['26m00s', '50 MPH', '* 0m00.0s']);
    expect(columnCLines(ins({ section: 'calibration', perfectInterval: 555.8, perfectCumulative: 1517.8, transit: { exact: true, seconds: 540 } }))).toEqual(['9m15.8s', '25m17.8s', '9m00s']);
    expect(columnCLines(ins({ promotedStop: { kind: 'meal', leaveBeforeEndSeconds: 2700 } }))).toEqual(['(45m00s)']);
    expect(columnCLines(ins({}))).toEqual([]); expect(columnCLines(null)).toEqual([]);
    expect(formatInterval(36)).toBe('0m36s'); expect(formatInterval(5 * 60 + 32, true)).toBe('5m32.0s'); expect(formatInterval(3 * 3600 + 15 * 60)).toBe('3h15m00s'); expect(formatClockFace(hms(14, 55, 0))).toBe('2:55:00'); expect(formatClockFace(hms(12, 0, 0))).toBe('12:00:00');
    // the old forms are gone
    for (const r of generateStage(1, PROFILES.fullStage!).book) for (const l of columnCLines(r)) expect(l).not.toMatch(/^P\d|for \d+:\d\d then/);
  });
  it('GRIID-002 the time-zone label of the scenario prints on every clock face', () => {
    const sc = new ScenarioBuilder({ startTime: T0, timeZone: 'EDT', driver: quiet }).start(35).advanceMiles(1).restart(30, hms(9, 30, 0)).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    expect(sc.timeZone).toBe('EDT'); expect(columnCLines(sc.book[0], sc.timeZone)).toEqual(['EDT 8:00:00', '35 MPH']); expect(columnCLines(sc.book[1], sc.timeZone)[0]).toBe('EDT 9:30:00');
    expect(new ScenarioBuilder().start(30).build().timeZone).toBe('CDT');
  });

  it('GRIID-003 Column B symbols: tire warm-up, calibration, transit begin/end with the 4-digit odometer box, free zone, end timed, pit, meal, refuel, rest, TA point, finish', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(undefined); b.warmup({ seconds: 1200 }); b.advanceMiles(8);
    b.calibrationRun({ miles: 21, points: 4, thenTransit: { exact: false, seconds: 540 } }); b.advanceMiles(4.5).restart(30, hms(8, 55, 0));
    b.freeZone(); b.advanceMiles(1).endFreeZone(); b.advanceMiles(3).checkpoint().advanceMiles(1);
    b.endTimedPortion({ transit: { exact: false, seconds: 12300, miles: 75 } }); b.advanceMiles(5); b.promotedStop('refuel', 11400); b.advanceMiles(5).promotedStop('pit', 7800); b.advanceMiles(5).promotedStop('meal', 2700); b.advanceMiles(5).promotedStop('rest', 180);
    b.advanceMiles(5).restart(30, hms(14, 55, 0)).advanceMiles(6).checkpoint(); b.endTimedPortion({ endOfStage: true, transit: { exact: true, seconds: 1800, miles: 20 } }).advanceMiles(20).observationFinish();
    const sc = b.build(); const syms = (n: number) => columnBSymbols(sc.book[n - 1]);
    expect(syms(1)).toEqual(['warmup', 'transit-begin']); expect(odometerBox(sc.book[0])).toBe('0080'); expect(transitMiles(sc.book[0])).toBe(8);
    const cal = sc.book.find(i => i.calibrationStart)!; expect(columnBSymbols(cal)).toEqual(['calibration', 'transit-begin']); expect(odometerBox(cal)).toBe('0210');
    const calEnd = sc.book.filter(i => i.section === 'calibration').pop()!; expect(columnBSymbols(calEnd)).toEqual(['transit-begin']); expect(odometerBox(calEnd)).toBe('0045');
    expect(columnBSymbols(sc.book.find(i => i.section === 'restart')!)).toEqual(['transit-end']);
    expect(columnBSymbols(sc.book.find(i => i.freeZone === 'begin'))).toEqual(['freezone-begin']); expect(columnBSymbols(sc.book.find(i => i.freeZone === 'end'))).toEqual(['freezone-end']);
    const et = sc.book.filter(i => i.endTimed); expect(columnBSymbols(et[0])).toEqual(['transit-begin']); expect(columnCIcons(et[0])).toEqual(['end-timed']);   // the crossed-out watch is a Column C pictogram (HB p.27, Example #17)
     expect(odometerBox(et[0])).toBe('0750'); expect(odometerBox(et[1])).toBe('0200');
    expect(columnBSymbols(sc.book.find(i => i.taPoint))).toEqual(['ta']);
    expect(['refuel', 'pit', 'meal', 'rest'].map(k => columnBSymbols(sc.book.find(i => i.promotedStop?.kind === k)))).toEqual([['refuel'], ['pit'], ['meal'], ['rest']]);
    expect(columnBSymbols(sc.book[sc.book.length - 1])).toEqual(['finish']); expect(odometerBox(sc.book.find(i => i.section === 'restart'))).toBeNull();
  });

  const sentence = (spec: Parameters<typeof describeInstruction>[0], node: NodeSpec, ctx = {}): string => describeInstruction(spec, node, ctx);
  it('GRIID-004 Column D wording follows the Example Rally', () => {
    const light: NodeSpec = { control: 'SIGNAL', exits: EXITS.crossroads('R').map(e => e.isRoute ? { ...e, name: 'Buchanan Blvd' } : e) };
    expect(sentence({ turn: 'R' }, light)).toBe('Turn right onto Buchanan Blvd at a crossroad at a Traffic Light.');
    expect(sentence({}, { sign: { text: 'Leaving Chattanooga City Limit', shape: 'rect', side: 'R' } })).toBe("Pass a sign on your right reading in whole or in part 'Leaving Chattanooga City Limit'.");
    const stopS: NodeSpec = { control: 'STOP', sign: { text: 'STOP', shape: 'octagon', side: 'R' }, exits: EXITS.crossroads('S').map(e => e.isRoute ? { ...e, name: 'Roosevelt Rd' } : e) };
    expect(sentence({ turn: 'S' }, stopS)).toBe('Go straight to cross Roosevelt Rd at a crossroad at a Stop Sign.');
    expect(sentence({ turn: 'BR' }, { exits: EXITS.wye('BR').map(e => e.isRoute ? { ...e, name: 'Interstate 75 North' } : e), label: 'Y' })).toBe('Bear right onto Interstate 75 North.');
    expect(sentence({ speed: 40 }, { sign: { text: 'SPEED LIMIT 40', shape: 'rect', side: 'R' } }, { prevSpeed: 30 })).toBe("Pass a sign on your right reading in whole or in part 'SPEED LIMIT 40'. Change average speed to 40 miles per hour at the referenced sign.");
    expect(sentence({}, { control: 'RR', label: 'RR crossing' }, { prevSpeed: 45 })).toBe('Grade level Railroad Crossing. Continue previous average speed (in this case 45 miles per hour) since no speed is given.');
    expect(sentence({ pause: 15, speed: 45 }, { control: 'BLINKER', exits: EXITS.crossroads('S').map(e => e.isRoute ? { ...e, name: 'Sherman St' } : e) })).toBe('Cross Sherman St at a Blinker. Pause 15 seconds, then change average speed to 45 miles per hour.');
    expect(sentence({ speed: 45 }, { exits: EXITS.crossroads('S') }, { prevSpeed: 30 })).toBe('Change average speed to 45 miles per hour at the apex of the intersection (since there is no referenced sign).');
    expect(sentence({ transit: { exact: true, seconds: 1200, miles: 12 } }, { label: 'Begin transit' })).toBe('Begin Transit of approximately 12 miles; take exactly 20 minutes to complete the Transit.');
    expect(sentence({ transit: { exact: true, seconds: 1200, end: true }, speed: 25 }, { sign: { text: 'END', shape: 'rect', side: 'R' } }, { transitBeginN: 31 })).toBe('End Transit at the referenced sign. Leave this point 20 minutes after instruction #31. Begin average speed of 25 miles per hour.');
    expect(sentence({ section: 'restart', restartTime: hms(8, 55, 0), speed: 30 }, { label: 'Restart' })).toBe('Time-of-day restart. Leave this point at 8:55:00 plus your assigned start position in minutes. Begin average speed of 30 miles per hour.');
    expect(sentence({ endTimed: true }, { label: 'x' })).toMatch(/^End timed portion\./);
    expect(sentence({ section: 'finish' }, { kind: 'finish' })).toBe('Finish Line. End Stage. Stop at Observation Checkpoint.');
    expect(sentence({ taPoint: { windowSeconds: 900, endOfStage: true } }, {})).toMatch(/^Within 15m00s,.*scorecard/);
    expect(sentence({ promotedStop: { kind: 'meal', leaveBeforeEndSeconds: 2700 } }, {})).toMatch(/leave here 45 minutes prior to your end-of-transit time/);
    // notes ride along in Column D
    const sc = new ScenarioBuilder({ startTime: T0, aids: TRAINING_AIDS }).start(35).advanceMiles(0.5).stop('R', 35, { hint: 'Comes quick' }).build();
    expect(sc.book[1]!.remark).toBe('Comes quick'); expect(sc.book[1]!.hint).toBe('Comes quick'); expect(columnD(sc.book[1], 'example')).toMatch(/Comes quick$/);
  });
  it('GRIID-005 lettered and omitted rows keep the numbering checks intact and execution follows the printed order', () => {
    const b = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.4);
    b.instruction({ sign: { text: 'A', shape: 'rect', side: 'R' } }, { speed: 30, printed: '2a' }).advanceMiles(0.2);
    b.instruction({ sign: { text: 'B', shape: 'rect', side: 'R' } }, { speed: 30, printed: '2b' }).advanceMiles(0.2);
    b.instruction({ sign: { text: 'C', shape: 'rect', side: 'R' } }, { omitted: true, printed: '3' }).advanceMiles(0.6).checkpoint().advanceFt(300).finish();
    const sc = b.build();
    expect(validateScenario(sc)).toEqual([]); expect(sc.book.map(i => i.n)).toEqual([1, 2, 3, 4, 5]); expect(sc.book.map(i => i.printed ?? '')).toEqual(['', '2a', '2b', '3', '']);
    const omitted = sc.book[3]!; expect(omitted.omitted).toBe(true); expect(omitted.speed).toBeUndefined(); expect(omitted.turn).toBeUndefined();
    const sim = new Simulator(sc); startLikeOracle(sim); stepUntil(sim, () => sim.phase === 'finished', 600); expect(sim.result().instructionsExecuted).toBe(5); expect(sim.offCourseCount).toBe(0); // the omitted row is passed in order and does nothing
  });

  it('GRIID-006 an instruction is complete when its last speed change has been made, or when the landmark has been passed if it has none: the check-off fires then, not at the node', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: TRAINING_AIDS }).start(30).advanceMiles(0.5)
      .instruction({ label: 'church', sightDistance: 500 }, { text: 'Church on R' }).advanceMiles(0.4)
      .instruction({ sign: { text: 'SPEED LIMIT 45', shape: 'rect', side: 'R' }, sightDistance: 500 }, { speed: 45 }).advanceMiles(0.8)
      .instruction({ label: 'bridge', sightDistance: 500 }, { timed: { holdSpeed: 45, seconds: 20, thenSpeed: 35 } }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); startLikeOracle(sim);
    const said = (n: number) => sim.events.find(e => e.type === 'driver' && new RegExp(`line ${n}\\b`).test(String(e.detail?.text)));
    const nodeAt = (n: number) => nodeById(sc.course, sc.book[n - 1]!.nodeId).s;
    stepUntil(sim, () => sim.car.s >= nodeAt(2) + 5); expect(said(2)).toBeDefined(); // no speed change: complete at the landmark
    stepUntil(sim, () => sim.car.s >= nodeAt(3) + 5); sim.act({ type: 'call.speed', mph: 45 }); expect(said(3)).toBeUndefined(); // the ramp to 45 is not finished yet
    stepUntil(sim, () => said(3) !== undefined, 60); expect(Math.abs(sim.car.mph() - 45)).toBeLessThan(0.7); expect(sim.car.s).toBeGreaterThan(nodeAt(3) + 5);
    stepUntil(sim, () => sim.car.s >= nodeAt(4) + 5); expect(said(4)).toBeUndefined(); // a timed line is complete only after the then-speed change
    sim.act({ type: 'call.speed', mph: 35 }); stepUntil(sim, () => said(4) !== undefined, 120); expect(sim.tod - (sim.events.find(e => e.type === 'passed' && /bridge/.test(String(e.detail?.what)))?.tod ?? 0)).toBeGreaterThan(18);
  });

  it('GRIID-007 a speed change takes effect at a sign when the front tires reach it, at the referenced control line of an intersection, otherwise at the centre / apex; rules.turnSpeedDatum is gone', () => {
    const mk = (node: NodeSpec) => { const b = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1); b.instruction(node, { speed: 60 }); return b.advanceMiles(1).checkpoint().build(); };
    const sign = mk({ sign: { text: 'S', shape: 'rect', side: 'R' } }), apex = mk({ exits: EXITS.crossroads('S'), sightDistance: 500 }), controlled = mk({ control: 'STOP', exits: EXITS.crossroads('S'), stopLineOffset: 60, sign: { text: 'STOP', shape: 'octagon', side: 'R' } });
    const s0 = (sc: typeof sign) => instructionS(sc.course, sc.book[1]!);
    expect(s0(sign)).toBe(5280); expect(s0(apex)).toBe(5280); expect(s0(controlled)).toBe(5280 - 60);
    // the ghost changes speed exactly there: 1 mi at 30 then 1 mi at 60 = 120 + 60 s from the change point
    const t = (sc: typeof sign) => ghostTimeAt(buildGhost(sc), sc.course.lengthFt) - T0;
    expect(t(sign)).toBeCloseTo(180, 6); expect(t(apex)).toBeCloseTo(180, 6); expect(t(controlled)).toBeCloseTo(180 - 60 * (1 / mphToFps(30) - 1 / mphToFps(60)), 6); // 60 ft earlier at the faster speed
    expect('turnSpeedDatum' in (sign.rules as object)).toBe(false);
    // a timed change anchors at the same position: the virtual node lies s_anchor + v x T beyond the control line
    const b = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1);
    b.instruction({ control: 'STOP', exits: EXITS.crossroads('S'), stopLineOffset: 60, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { pause: 15, timed: { holdSpeed: 25, seconds: 40, thenSpeed: 45 } });
    const sc = b.advanceMiles(2).checkpoint().build(); const g = buildGhost(sc);
    expect(ghostTimeAt(g, 5280 - 60 + mphToFps(25) * 40) - T0).toBeCloseTo((5280 - 60) / mphToFps(30) + 15 + 40, 6);
  });
  it('GRIID-008 a timed change measures its interval from the speed change in the same Column C; a delayed change measures it from the line\'s own execution point', () => {
    const b = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1);
    b.timedAt('bridge', { holdSpeed: 30, seconds: 36, thenSpeed: 45 }); b.advanceMiles(2);
    b.timedAt('barn', { holdSpeed: 45, seconds: 72, thenSpeed: 40 }, { delayed: true }); b.advanceMiles(2).checkpoint();
    const sc = b.build(); const g = buildGhost(sc);
    const a1 = nodeById(sc.course, sc.book[1]!.nodeId).s;
    expect(sc.book[1]!.speed).toBe(30); expect(columnCLines(sc.book[1])).toEqual(['30 MPH', '0m36s', '45 MPH']);
    expect(ghostTimeAt(g, a1 + mphToFps(30) * 36) - ghostTimeAt(g, a1)).toBeCloseTo(36, 6);
    const a2 = nodeById(sc.course, sc.book[2]!.nodeId).s;
    expect(sc.book[2]!.speed).toBeUndefined(); expect(sc.book[2]!.timed!.delayed).toBe(true); expect(columnCLines(sc.book[2])).toEqual(['1m12s', '40 MPH']);
    expect(ghostTimeAt(g, a2 + mphToFps(45) * 72) - ghostTimeAt(g, a2)).toBeCloseTo(72, 6); // 72 s at the speed already in force, counted from this row
    expect(ghostTimeAt(g, a2 + mphToFps(45) * 72 + mphToFps(40) * 10) - ghostTimeAt(g, a2 + mphToFps(45) * 72)).toBeCloseTo(10, 6);
  });

  it('GRIID-009 book verbosity: example style prints the sentence in Column D, race style only the remarks; rung >= 2 and the training aids default to example, rung <= 1 to race', () => {
    const mk = (rung: 0 | 1 | 2 | 3, style?: 'example' | 'race') => new ScenarioBuilder({ startTime: T0, aids: aidsForRung(rung), bookStyle: style }).start(35).advanceMiles(0.5).stop('R', 35, { hint: 'Look sharp' }).advanceMiles(0.2).stop('S', 40).build();
    expect(mk(3).bookStyle).toBe('example'); expect(mk(2).bookStyle).toBe('example'); expect(mk(1).bookStyle).toBe('race'); expect(mk(0).bookStyle).toBe('race'); expect(mk(0, 'example').bookStyle).toBe('example');
    const sc = mk(2); expect(columnD(sc.book[1], sc.bookStyle)).toMatch(/Turn right.*Stop Sign\. Pause 15 seconds.* Look sharp$/);
    const race = mk(0); expect(columnD(race.book[1], race.bookStyle)).toBe('Look sharp'); expect(columnD(race.book[2], race.bookStyle)).toBe(''); expect(race.book[1]!.text).toMatch(/Turn right/); // the sentence still exists for the logic, the book just does not print it
    expect(generateStage(1, { ...PROFILES.fullStage!, bookStyle: 'race' }).bookStyle).toBe('race');
  });
});

describe('book text of generated rows', () => {
  it('GRIID-004 generated stages print GRIID sentences, never the old "Pause 15" / "Speed 35" forms', () => {
    for (const row of generateStage(3, PROFILES.fullStage!).book) { expect(row.text).not.toMatch(/\bSpeed \d\d\b|^Pause \d+\.|mph for/); }
  });
});

describe('V2 fix sprint: transit exactness, Column C icons, guide rows and speeds not shown', () => {
  it('STAGE-009 only "take exactly" makes a transit exact: a plain interval (calibration run, tire warm-up, transit to the finish) prints without parentheses but is not exact, an advisory one prints in parentheses, and the Column D sentence follows the flag', () => {
    expect(columnCLines(ins({ transit: { exact: false, plain: true, seconds: 1560, miles: 21 } }))).toEqual(['26m00s']);      // HB #5 / #34: plain, not exact
    expect(columnCLines(ins({ transit: { exact: false, seconds: 540, miles: 4.5 } }))).toEqual(['(9m00s)']);               // advisory
    expect(columnCLines(ins({ transit: { exact: true, seconds: 1200, miles: 12 } }))).toEqual(['20m00s']);                 // "take exactly 20 minutes" (HB #30)
    const sentence = (t: Instruction['transit']) => describeInstruction({ transit: t }, { label: 'Begin transit', sightDistance: 400 });
    expect(sentence({ exact: false, plain: true, seconds: 1800, miles: 20 })).toMatch(/take approximately 30 minutes/); expect(sentence({ exact: true, seconds: 1200, miles: 12 })).toMatch(/take exactly 20 minutes/);
    for (const seed of [1, 2, 3, 4]) {
      const sc = generateStage(seed);
      expect(sc.book.filter(i => i.transit && !i.transit.end && i.transit.exact === true), `seed ${seed}`).toEqual([]);   // no generated line says "take exactly": calibration, warm-up, finish transit are plain
      const cal = sc.book.find(i => i.calibrationStart)!; expect(cal.transit).toMatchObject({ exact: false, plain: true }); expect(columnCLines(cal)[0]).toMatch(/^\d+m\d\ds$/);
      expect(columnCLines(sc.book[0]!)[columnCLines(sc.book[0]!).length - 1]).toBe('20m00s'); expect(sc.book[0]!.transit!.exact).toBe(false);
      const fin = sc.book.filter(i => i.endTimed).pop()!; expect(fin.transit).toMatchObject({ exact: false, plain: true });
    }
    const d = new ScenarioBuilder({ startTime: T0, driver: quiet }).start(35).advanceMiles(0.5).transit({ exact: true, seconds: 600, miles: 1.4 }).advanceMiles(1.4).endTransit({ speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    expect(d.book.find(i => i.transit && !i.transit.end)!.transit!.exact).toBe(true);
  });

  it('GRIID-010 the restart watch face and the crossed-out watch of End timed portion are Column C pictograms, not Column B symbols (HB p.27, Example #17)', () => {
    const sc = generateStage(1);
    const restart = sc.book.find(i => i.section === 'restart')!; const et = sc.book.find(i => i.endTimed)!;
    expect(columnCIcons(restart)).toEqual(['restart']); expect(columnCIcons(et)).toEqual(['end-timed']); expect(columnCIcons(sc.book.find(i => i.taPoint))).toEqual([]);
    expect(columnBSymbols(et)).not.toContain('end-timed' as never); expect(columnBSymbols(restart)).toEqual(['transit-end']);
    for (const i of sc.book) { expect(columnBSymbols(i) as string[]).not.toContain('end-timed'); expect(columnBSymbols(i) as string[]).not.toContain('restart'); }
    expect(columnCLines(restart, sc.timeZone)).toEqual([expect.stringMatching(/^CDT \d+:\d\d:\d\d$/), expect.stringMatching(/^\d+ MPH$/)]);   // the time of day and the speed stay as the lines under the watch
  });

  it('GRIID-011 the row before the end of an advisory transit prints "(0m30s)": the time left to the end of the transit, from the transit\'s own pace', () => {
    expect(columnCLines(ins({ transitGuide: 30 }))).toEqual(['(0m30s)']); expect(columnCLines(ins({ transitGuide: 30, speed: 35 }))).toEqual(['(0m30s)', '35 MPH']);
    for (const seed of [1, 2, 3, 4, 5]) {
      const sc = generateStage(seed);
      const guided = sc.book.filter(i => i.transitGuide !== undefined); expect(guided.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      for (const g of guided) {
        const idx = sc.book.indexOf(g); const begin = [...sc.book.slice(0, idx)].reverse().find(i => i.transit && !i.transit.end)!;
        const endIdx = sc.book.findIndex((x, k) => k > idx && (x.transit?.end || x.restartTime !== undefined && x.section === 'restart' || x.section === 'finish'));
        const end = sc.book[endIdx]!; expect(begin.transit!.exact).toBe(false);
        const dist = instructionS(sc.course, end) - instructionS(sc.course, g); const total = instructionS(sc.course, end) - instructionS(sc.course, begin);
        expect(Math.abs(g.transitGuide! - begin.transit!.seconds * dist / total), `seed ${seed} line ${g.n}`).toBeLessThanOrEqual(3);   // rounded to 5 s
        expect(g.transitGuide! % 5).toBe(0); expect(columnCLines(g)).toContain(`(${formatInterval(g.transitGuide!)})`);
        expect(g.transitGuide!).toBeLessThan(begin.transit!.seconds); expect(g.restartTime).toBeUndefined();
      }
      const lastOfOpening = sc.book.find(i => i.section === 'restart')!; expect(sc.book[lastOfOpening.n - 2]!.transitGuide).toBeGreaterThan(0);   // the transit into the first restart
    }
  });

  it('GRIID-012 about one row in ten prints no speed where the speed is unchanged, as real sheets do (Trophy Run #40, #53, #57, #73, #74); layout, timing and the ghost are identical', () => {
    let omitted = 0, total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const a = generateStage(seed); const b = generateStage(seed, { ...PROFILES.fullStage!, omitUnchangedSpeedProbability: 0 });
      expect(a.book.length).toBe(b.book.length); expect(a.course.lengthFt).toBe(b.course.lengthFt);
      const ga = buildGhost(a), gb = buildGhost(b); expect(ga.legs.map(l => l.perfectDuration)).toEqual(gb.legs.map(l => l.perfectDuration)); expect(ga.endTod).toBe(gb.endTod);
      let cur: number | undefined;
      a.book.forEach((x, i) => {
        const y = b.book[i]!; total++;
        if (x.speed === undefined && y.speed !== undefined) { omitted++; expect(y.speed, `seed ${seed} line ${x.n}`).toBe(cur); expect(y.timed).toBeUndefined(); expect(columnCLines(x).some(l => /MPH$/.test(l) && !/^0 MPH$/.test(l))).toBe(false); }
        else expect(x.speed).toBe(y.speed);
        if (y.timed) cur = y.timed.thenSpeed; else if (y.speed !== undefined) cur = y.speed;
      });
    }
    expect(omitted / total).toBeGreaterThan(0.05); expect(omitted / total).toBeLessThan(0.11);
    const none = generateStage(2, { ...PROFILES.fullStage!, omitUnchangedSpeedProbability: 0 }); expect(none.book.filter(i => i.speed === undefined && i.section === undefined).length).toBeLessThan(generateStage(2).book.filter(i => i.speed === undefined && i.section === undefined).length);
  });
});
