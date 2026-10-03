import { describe, it, expect } from 'vitest';
import { stopLoss, dwellFor, rampLead, rampTime } from '../src/core/perf-table.js';
import { FORD_1939 } from '../src/core/course.js';

describe('performance table', () => {
  it('PERF-001 stop loss for the 1939 preset is 5..11 s and increases with speed', () => {
    let prev = 0;
    for (const v of [25, 30, 35, 40, 45]) {
      const l = stopLoss(v, v, FORD_1939);
      expect(l).toBeGreaterThanOrEqual(5); expect(l).toBeLessThanOrEqual(11);
      expect(l).toBeGreaterThan(prev); prev = l;
    }
  });
  it('PERF-002 different in/out speeds', () => {
    expect(stopLoss(20, 40, FORD_1939)).toBeGreaterThan(stopLoss(20, 20, FORD_1939));
  });
  it('PERF-003 dwell = pause - loss, floored at 0', () => {
    const l = stopLoss(35, 35, FORD_1939);
    expect(dwellFor(15, 35, 35, FORD_1939)).toBeCloseTo(15 - l, 6);
    expect(dwellFor(2, 35, 35, FORD_1939)).toBe(0);
  });
  it('PERF-004 ramp lead is half the ramp time', () => {
    expect(rampLead(30, 40, FORD_1939)).toBeCloseTo(rampTime(30, 40, FORD_1939) / 2, 9);
    expect(rampTime(30, 40, FORD_1939)).toBeGreaterThan(2);
  });
});
