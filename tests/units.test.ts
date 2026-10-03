import { describe, it, expect } from 'vitest';
import { mphToFps, fpsToMph, formatClock, formatElapsed, roundToSecond, hms } from '../src/core/units.js';
import { rng } from '../src/core/rng.js';

describe('units', () => {
  it('UNIT-001 60 mph is 88 ft/s and inverts', () => {
    expect(mphToFps(60)).toBeCloseTo(88, 9);
    expect(fpsToMph(mphToFps(37.3))).toBeCloseTo(37.3, 9);
  });
  it('UNIT-002 formats clock and elapsed', () => {
    expect(formatClock(hms(8, 5, 9))).toBe('08:05:09');
    expect(formatClock(hms(25, 0, 0))).toBe('01:00:00');
    expect(formatElapsed(65.26)).toBe('1:05.3');
    expect(formatElapsed(-3.2)).toBe('-0:03.2');
  });
  it('UNIT-003 rounds half up to the nearest second', () => {
    expect(roundToSecond(12.5)).toBe(13);
    expect(roundToSecond(12.49)).toBe(12);
    expect(roundToSecond(30000.5)).toBe(30001);
  });
});

describe('rng', () => {
  it('RNG-001 deterministic per seed', () => {
    const a = rng(42), b = rng(42), c = rng(43);
    const sa = [a.next(), a.next(), a.next()], sb = [b.next(), b.next(), b.next()], scq = [c.next(), c.next(), c.next()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(scq);
    expect(rng('abc').next()).toBe(rng('abc').next());
  });
});
