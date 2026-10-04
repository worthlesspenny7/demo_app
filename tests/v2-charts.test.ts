import { describe, it, expect } from 'vitest';
import { buildPerfTable, stopLoss, accelLoss, turnLoss, dwellFor, apexSpeed, CHART_SPEEDS, matrixAt } from '../src/core/perf-table.js';
import { FORD_1939, PACKARD_1936, KNOWN_CARS, DRIVER_PERFECT } from '../src/core/course.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { calibrationFactor, adjustFactor, clicksPerSecondPerHour, timewiseAdjustment } from '../src/core/calibration.js';
import { hms } from '../src/core/units.js';

// the handbook tables, transcribed independently of src/core/course.ts (docs/research/08-rookie-handbook-body.md section 3)
const HB_ACCEL = { speeds: [0, 15, 20, 25, 30, 35, 40, 45, 50], rows: [
  [null, 1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4], [1, null, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4], [1.2, 0.2, null, 0.5, 1.6, 2.3, 3.2, 4.3, 5.3], [1.3, 0.3, 0.1, null, 1.1, 1.8, 2.7, 3.8, 4.6],
  [1.9, 0.9, 0.7, 0.6, null, 0.7, 1.6, 2.7, 3.5], [2, 1, 0.8, 0.7, 0.1, null, 0.9, 2, 2.8], [2.4, 1.4, 1.2, 1.1, 0.5, 0.4, null, 1.1, 1.9], [2.8, 1.8, 1.6, 1.5, 0.9, 0.8, 0.4, null, 0.8], [3.3, 2.3, 2.1, 2, 1.4, 1.3, 0.9, 0.5, null]] };
const HB_STOPGO = [[13, 12.7, 12.2, 11.1, 10.4, 9.5, 8.4, 7.6], [12.8, 12.5, 12, 10.9, 10.2, 9.3, 8.2, 7.4], [12.7, 12.4, 11.9, 10.8, 10.1, 9.2, 8.1, 7.3], [12.1, 11.8, 11.3, 10.2, 9.5, 8.6, 7.5, 6.7],
  [12, 11.7, 11.2, 10.1, 9.4, 8.5, 7.4, 6.6], [11.6, 11.3, 10.8, 9.7, 9, 8.1, 7, 6.2], [11.2, 10.9, 10.4, 9.3, 8.6, 7.7, 6.6, 5.8], [10.7, 10.4, 9.9, 8.8, 8.1, 7.2, 6.1, 5.3]];
const HB_TURNS = [[0, 0.3, 0.8, 1.9, 2.6, 3.5, 4.6, 5.4], [0.2, 0.5, 1, 2.1, 2.8, 3.7, 4.8, 5.6], [0.3, 0.6, 1.1, 2.2, 2.9, 3.8, 4.9, 5.7], [0.9, 1.2, 1.7, 2.8, 3.5, 4.4, 5.5, 6.3],
  [1, 1.3, 1.8, 2.9, 3.6, 4.5, 5.6, 6.4], [1.4, 1.7, 2.2, 3.3, 4, 4.9, 6, 6.8], [1.8, 2.1, 2.6, 3.7, 4.4, 5.3, 6.4, 7.2], [2.3, 2.6, 3.1, 4.2, 4.9, 5.8, 6.9, 7.7]];
const SP = [15, 20, 25, 30, 35, 40, 45, 50];

describe('performance charts (HB p.7-9, Appendix B)', () => {
  it('CHART-001 buildPerfTable gives the three handbook charts, IN rows x OUT columns, tenths of a second, with the old accessors kept', () => {
    const t = buildPerfTable(FORD_1939);
    expect(t.accel.speeds).toEqual([0, ...CHART_SPEEDS]); expect(t.stopGo.speeds).toEqual(CHART_SPEEDS); expect(t.turns.speeds).toEqual(CHART_SPEEDS); expect(CHART_SPEEDS).toEqual([10, 12, 15, 20, 25, 30, 35, 40, 45, 48, 50, 55]); expect(t.speeds).toEqual(CHART_SPEEDS); expect(t.extrapolated).toEqual([]); // SPEED-001
    for (const m of [t.accel, t.stopGo, t.turns]) for (const r of m.speeds) for (const c of m.speeds) { const v = m.rows[r]![c]!; expect(Number.isFinite(v)).toBe(true); expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-9); }
    expect(t.accel.rows[0]![40]!).toBeCloseTo(accelLoss(40, FORD_1939), 1); expect(t.accel.rows[35]![0]!).toBeGreaterThan(0); expect(t.accel.rows[40]![40]).toBe(0);
    expect(t.accel.rows[30]![50]!).toBeGreaterThan(t.accel.rows[30]![40]!); // accelerating further loses more
    // (b) 35 in / 35 out is within 1 s of the stopLoss-based dwell
    expect(Math.abs(t.stopGo.rows[35]![35]! - dwellFor(15, 35, 35, FORD_1939))).toBeLessThan(1);
    expect(Math.abs(t.stopGo.rows[35]![35]! - (15 - t.accel.rows[35]![0]! - t.accel.rows[0]![35]!))).toBeLessThan(0.11);
    // (c) turns for the Ford's 12 mph apex: the same model the driver uses
    expect(Math.abs(t.turns.rows[35]![35]! - turnLoss(90, 35, 35, FORD_1939))).toBeLessThan(0.06);
    expect(apexSpeed(90, FORD_1939)).toBe(12); expect(apexSpeed(90, PACKARD_1936)).toBe(15);
    // the older records are derived accessors
    expect(t.stop['35>35']).toBeCloseTo(stopLoss(35, 35, FORD_1939), 1); expect(t.turn['90:35>35']).toBeCloseTo(turnLoss(90, 35, 35, FORD_1939), 1); expect(t.lead['30>40']).toBeGreaterThan(0);
    expect(buildPerfTable(FORD_1939)).toBe(t); // cached per car
    // the Packard example at 30 in / 40 out prints 8.6
    expect(buildPerfTable(PACKARD_1936).stopGo.rows[30]![40]).toBe(8.6);
  });

  it('CHART-002 PACKARD_1936 reproduces the handbook tables exactly (table-driven) and is selectable like FORD_1939', () => {
    const t = buildPerfTable(PACKARD_1936); expect(KNOWN_CARS.PACKARD_1936).toBe(PACKARD_1936); expect(KNOWN_CARS.FORD_1939).toBe(FORD_1939); expect(PACKARD_1936.year).toBe(1936);
    HB_ACCEL.speeds.forEach((r, i) => HB_ACCEL.speeds.forEach((c, j) => { const want = HB_ACCEL.rows[i]![j]; expect(t.accel.rows[r]![c], `accel ${r}->${c}`).toBe(want === null ? 0 : want); }));
    SP.forEach((r, i) => SP.forEach((c, j) => { expect(t.stopGo.rows[r]![c], `stop&go ${r}/${c}`).toBe(HB_STOPGO[i]![j]); expect(t.turns.rows[r]![c], `turn ${r}/${c}`).toBe(HB_TURNS[i]![j]); }));
    expect(t.accel.rows[0]![40]).toBe(4.5); expect(t.stopGo.rows[30]![40]).toBe(8.6); expect(t.turns.rows[40]![35]).toBe(4);
    // the handbook's own arithmetic holds in the tables: pause = 15 - brake(IN) - accel(OUT); turn = IN->15 + 15->OUT
    for (const r of SP) for (const c of SP) { expect(Math.abs(t.stopGo.rows[r]![c]! - (15 - t.accel.rows[r]![0]! - t.accel.rows[0]![c]!))).toBeLessThan(0.151); expect(Math.abs(t.turns.rows[r]![c]! - (t.accel.rows[r]![15]! + t.accel.rows[15]![c]!))).toBeLessThan(0.151); }
    // the engine's losses for a table-driven car come from its tables
    expect(accelLoss(40, PACKARD_1936)).toBe(4.5); expect(stopLoss(30, 40, PACKARD_1936)).toBeCloseTo(15 - 8.6, 9); expect(turnLoss(90, 40, 35, PACKARD_1936)).toBe(4); expect(dwellFor(15, 30, 40, PACKARD_1936)).toBeCloseTo(8.6, 9);
    expect(matrixAt(t.stopGo, 32.5, 40)).toBeCloseTo((8.6 + 8.5) / 2, 9); // bilinear between printed speeds
    expect(buildPerfTable(PACKARD_1936).stopGo.speeds).toEqual([...SP, 55]); expect(buildPerfTable(PACKARD_1936).extrapolated).toEqual([55]); // the handbook prints 15..50; SPEED-001 extends it to 55 and flags it
  });

  const measure = (vin: number, vout: number) => {
    const sc = new ScenarioBuilder({ startTime: hms(8, 0, 0), car: PACKARD_1936, driver: DRIVER_PERFECT }).start(vin).advanceMiles(1.0).instruction({ exits: EXITS.crossroads('R'), sightDistance: 700 }, { turn: 'R', speed: vout }).advanceMiles(1.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); sim.act({ type: 'start' }); const ns = sc.course.nodes.find(n => n.kind === 'intersection')!.s; let called = false, spd = false; let apex = Infinity;
    while (sim.phase !== 'finished' && sim.car.s < ns + 3000) {
      if (!called && sim.car.s >= ns - 650) { sim.act({ type: 'call.turn', dir: 'R' }); called = true; }
      if (!spd && sim.car.s >= ns - 30) { sim.act({ type: 'call.speed', mph: vout }); spd = true; }
      sim.step(0.1); if (sim.car.s > ns - 5 && sim.car.s < ns + 5) apex = Math.min(apex, sim.car.mph());
    }
    return { turn: sim.result().attribution[0]!.buckets.turn, apex };
  };
  it('CHART-003 turn execution follows the chart: slow to the car\'s apex speed, turn, accelerate; the turn bucket equals the Packard chart within 0.5 s for 30/35/40 in x 25..45 out', () => {
    const chart = buildPerfTable(PACKARD_1936).turns;
    for (const vin of [30, 35, 40]) for (const vout of [25, 30, 35, 40, 45]) {
      const m = measure(vin, vout); expect(Math.abs(m.turn - chart.rows[vin]![vout]!), `${vin}->${vout}: bucket ${m.turn.toFixed(2)} vs chart ${chart.rows[vin]![vout]}`).toBeLessThanOrEqual(0.5);
      expect(m.apex).toBeLessThan(15.9); expect(m.apex).toBeGreaterThan(12);
    }
    // the Ford preset slows to its 12 mph apex
    const f = new ScenarioBuilder({ startTime: hms(8, 0, 0), driver: DRIVER_PERFECT }).start(35).advanceMiles(0.8).instruction({ exits: EXITS.crossroads('R'), sightDistance: 700 }, { turn: 'R', speed: 35 }).advanceMiles(1).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(f); sim.act({ type: 'start' }); const ns = f.course.nodes.find(n => n.kind === 'intersection')!.s; sim.act({ type: 'call.turn', dir: 'R' }); while (sim.car.s < ns + 1) sim.step(0.1);
    expect(sim.car.mph()).toBeLessThanOrEqual(12.6);
    // the turn card of the engine: loss for the pair, plus the 10 % rule to recover it (HB p.10)
    const loss = turnLoss(90, 40, 35, PACKARD_1936); expect(loss * 10).toBeCloseTo(40, 6); // 4.0 s lost: 10 % faster for 40 s
  });

  it('CHART-005 new factor = old factor x correct / actual; the Timewise worked example 28m43.2s vs 28m47.3s: 4.1 s late = 8.2 s/h = 10 clicks, 4315 -> 4305', () => {
    const correct = 28 * 60 + 43.2, actual = 28 * 60 + 47.3;
    const k = calibrationFactor([{ perfect: correct, actual }]); // CAL-001's k = sum(P)/sum(A)
    expect(k).toBeCloseTo(correct / actual, 12); expect(4315 * k).toBeCloseTo(4304.76, 1); expect(Math.round(4315 * k)).toBe(4305); expect(adjustFactor(4315, correct, actual)).toBeCloseTo(4315 * k, 9);
    expect(clicksPerSecondPerHour(4315)).toBe(1.2);
    const adj = timewiseAdjustment(4315, correct, actual);
    expect(adj.errorSeconds).toBeCloseTo(4.1, 6); expect(adj.secondsPerHour).toBeCloseTo(8.2, 6); expect(adj.clicks).toBe(10); expect(adj.direction).toBe('reduce'); expect(adj.newFactor).toBe(4305); expect(Math.round(adj.exactFactor)).toBe(4305);
    // fast (early) arrival increases the factor: the printed "actual / correct" formula is the erratum
    const fast = timewiseAdjustment(4315, correct, correct - 4.1); expect(fast.direction).toBe('increase'); expect(fast.newFactor).toBe(4325); expect(adjustFactor(4315, correct, correct - 4.1)).toBeGreaterThan(4315);
    // the CAL-001 example is the same rule
    expect(calibrationFactor([{ perfect: 100, actual: 103 }, { perfect: 100, actual: 103 }, { perfect: 100, actual: 103 }])).toBeCloseTo(100 / 103, 9);
  });
});
