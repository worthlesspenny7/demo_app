import { describe, it, expect } from 'vitest';
import { Speedometer } from '../src/core/speedo.js';
import { rng } from '../src/core/rng.js';
import { PERFECT_TIMEWISE, STOCK_1939_SPEEDO } from '../src/core/builder.js';
import { Stopwatch, RallyClock } from '../src/core/stopwatch.js';
import { Car } from '../src/core/car.js';
import { FORD_1939 } from '../src/core/course.js';
import { mphToFps } from '../src/core/units.js';

describe('speedometer', () => {
  it('SPEEDO-001 perfect timewise reads true after settling', () => {
    const sp = new Speedometer(PERFECT_TIMEWISE, rng(1));
    for (let i = 0; i < 100; i++) sp.step(0.1, 35);
    expect(Math.abs(sp.reading(35) - 35)).toBeLessThanOrEqual(0.05);
  });
  it('SPEEDO-002 1% high factor reads 1% high and inverse() gives the true speed to hold', () => {
    const sp = new Speedometer(PERFECT_TIMEWISE, rng(1));
    sp.setFactor(1.01);
    expect(sp.indicatedFor(35)).toBeCloseTo(35.35, 6);
    expect(sp.inverse(35)).toBeCloseTo(35 / 1.01, 6);
  });
  it('SPEEDO-003 mechanical reads gain*v+offset+quad*v^2 and the stock preset reads high at 50', () => {
    const sp = new Speedometer(STOCK_1939_SPEEDO, rng(1));
    expect(sp.indicatedFor(50)).toBeCloseTo(1.03 * 50 + 1 + 0.0003 * 2500, 6);
    const over = sp.indicatedFor(50) - 50;
    expect(over).toBeGreaterThanOrEqual(1); expect(over).toBeLessThanOrEqual(5);
    expect(sp.inverse(sp.indicatedFor(42))).toBeCloseTo(42, 6);
  });
  it('SPEEDO-004 quantization: mechanical 1 mph, timewise 0.1 mph', () => {
    const m = new Speedometer({ ...STOCK_1939_SPEEDO, bounce: 0 }, rng(1));
    for (let i = 0; i < 200; i++) m.step(0.1, 33.3);
    expect(m.reading(33.3) % 1).toBeCloseTo(0, 9);
    const t = new Speedometer(PERFECT_TIMEWISE, rng(1));
    for (let i = 0; i < 100; i++) t.step(0.1, 33.37);
    expect(Math.round(t.reading(33.37) * 10) / 10).toBeCloseTo(t.reading(33.37), 9);
  });
  it('SPEEDO-005 daily drift bounded to 1% and timewise unaffected', () => {
    const m = new Speedometer(STOCK_1939_SPEEDO, rng(7));
    const g0 = m.spec.gain; m.newStage();
    expect(Math.abs(m.spec.gain / g0 - 1)).toBeLessThanOrEqual(0.0100001);
    const t = new Speedometer(PERFECT_TIMEWISE, rng(7));
    t.newStage(); expect(t.spec.gain).toBe(1);
    expect(() => m.setFactor(1.01)).toThrow();
  });
});

describe('stopwatch and clock', () => {
  it('WATCH-001 start/stop/resume accumulate', () => {
    const w = new Stopwatch('digital');
    w.start(100); expect(w.elapsed(110)).toBeCloseTo(10); w.stop(110); expect(w.elapsed(130)).toBeCloseTo(10);
    w.start(130); expect(w.elapsed(135)).toBeCloseTo(15);
  });
  it('WATCH-002 lap keeps running; analog resets only when stopped', () => {
    const w = new Stopwatch('analog'); w.start(0); expect(w.lap(12.3)).toBeCloseTo(12.3); expect(w.running).toBe(true);
    expect(w.reset(13)).toBe(false); w.stop(13); expect(w.reset(13)).toBe(true); expect(w.elapsed(20)).toBe(0); expect(w.laps).toEqual([]);
    const d = new Stopwatch('digital'); d.start(0); expect(d.reset(5)).toBe(true);
  });
  it('WATCH-003 reading quantization', () => {
    const a = new Stopwatch('analog'); a.start(0); expect(a.reading(12.33)).toBeCloseTo(12.4, 9);
    const d = new Stopwatch('digital'); d.start(0); expect(d.reading(12.333)).toBeCloseTo(12.33, 9);
  });
  it('WATCH-004 clock tod and bezel', () => {
    const c = new RallyClock(); expect(c.tod(28800)).toBe(28800);
    c.setBezel(45); expect(c.bezelRemaining(28800 + 30)).toBe(15); expect(c.bezelRemaining(28800 + 50)).toBe(55);
  });
});

describe('car', () => {
  function accelTime(toMph: number): number { const c = new Car(FORD_1939); let t = 0; const target = mphToFps(toMph); while (c.v < target - 0.01 && t < 60) { c.step(0.1, target, null); t += 0.1; } return t; }
  it('CAR-001 1939 Ford 0-35 in 8..12 s and 0-50 in 15..22 s', () => {
    const t35 = accelTime(35), t50 = accelTime(50);
    expect(t35).toBeGreaterThanOrEqual(8); expect(t35).toBeLessThanOrEqual(12);
    expect(t50).toBeGreaterThanOrEqual(15); expect(t50).toBeLessThanOrEqual(22);
  });
  it('CAR-002 brakes from 35 to a stop at the line in ~6.4 s', () => {
    const c = new Car(FORD_1939); c.v = mphToFps(35); c.mode = 'cruise';
    const line = c.s + c.stoppingDistance() + 200; let t = 0; let braking = -1;
    while ((c.mode as string) !== 'stopped' && t < 30) { c.step(0.1, mphToFps(35), line); if (braking < 0 && c.a < -0.5) braking = t; t += 0.1; }
    expect(c.mode).toBe('stopped');
    expect(Math.abs(c.s - line)).toBeLessThanOrEqual(2);
    expect(t - braking).toBeGreaterThanOrEqual(6.2); expect(t - braking).toBeLessThanOrEqual(6.8);
  });
  it('CAR-003 holds a constant target exactly with no noise', () => {
    const c = new Car(FORD_1939); const target = mphToFps(40);
    for (let i = 0; i < 600; i++) c.step(0.1, target, null);
    expect(Math.abs(c.mph() - 40)).toBeLessThanOrEqual(0.05);
  });
  it('CAR-004 ramp from 30 to 40 begins on command and is deterministic', () => {
    const run = () => { const c = new Car(FORD_1939); c.v = mphToFps(30); let t = 0; const trace: number[] = []; while (c.v < mphToFps(40) - 0.01) { c.step(0.1, mphToFps(40), null); t += 0.1; trace.push(c.v); } return { t, trace }; };
    const a = run(), b = run();
    expect(a.t).toBeCloseTo(b.t, 9); expect(a.trace).toEqual(b.trace);
    expect(a.trace[0]!).toBeGreaterThan(mphToFps(30));
    expect(a.t).toBeGreaterThan(2); expect(a.t).toBeLessThan(8);
  });
  it('CAR-005 distance integrates speed', () => {
    const c = new Car(FORD_1939); c.v = 44; const s0 = c.s;
    for (let i = 0; i < 10; i++) c.step(0.1, 44, null);
    expect(c.s - s0).toBeCloseTo(44, 1);
  });
});
