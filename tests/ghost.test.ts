import { describe, it, expect } from 'vitest';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { buildGhost, ghostTimeAt, annotatePerfectTimes } from '../src/core/ghost.js';
import { milesToFt, hms } from '../src/core/units.js';

const T0 = hms(8, 0, 0);

describe('ghost', () => {
  it('GHOST-001 one mile at 30 mph takes 120 s', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).checkpoint().build();
    const g = buildGhost(sc);
    expect(ghostTimeAt(g, milesToFt(1)) - T0).toBeCloseTo(120, 6);
    expect(g.legs[0]!.perfectDuration).toBeCloseTo(120, 6);
  });
  it('GHOST-002 pause adds 15 s and no distance', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).stop('S', 30).advanceMiles(1).checkpoint().build();
    const g = buildGhost(sc);
    expect(ghostTimeAt(g, milesToFt(1) - 1) - T0).toBeCloseTo(120 - 1 / 44, 3);
    expect(ghostTimeAt(g, milesToFt(1)) - T0).toBeCloseTo(135, 6);
    expect(ghostTimeAt(g, milesToFt(2)) - T0).toBeCloseTo(255, 6);
  });
  it('GHOST-003 speed change takes effect at the node', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).speedAtSign('SPEED LIMIT 60', 60).advanceMiles(1).checkpoint().build();
    const g = buildGhost(sc);
    expect(ghostTimeAt(g, milesToFt(2)) - T0).toBeCloseTo(180, 6);
  });
  it('GHOST-004 timed segment switches at s + v*T', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).timedAt('bridge', { holdSpeed: 30, seconds: 36, thenSpeed: 40 }).advanceMiles(2).checkpoint().build();
    const g = buildGhost(sc);
    const anchor = milesToFt(1), vs = milesToFt(1) + 44 * 36; // 1584 ft past the anchor
    expect(vs - anchor).toBeCloseTo(1584, 6);
    expect(ghostTimeAt(g, vs) - T0).toBeCloseTo(120 + 36, 6);
    // after the switch, 40 mph = 58.667 ft/s
    expect(ghostTimeAt(g, vs + 586.67) - T0).toBeCloseTo(120 + 36 + 10, 2);
  });
  it('GHOST-005 restart line re-anchors time', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).checkpoint().advanceMiles(1).restart(30, hms(12, 30, 0)).advanceMiles(1).checkpoint().build();
    const g = buildGhost(sc);
    expect(g.legs[1]!.perfectTod).toBeCloseTo(hms(12, 30, 0) + 120, 6);
    expect(g.legs[1]!.anchor).toEqual({ kind: 'official', tod: hms(12, 30, 0) });
    expect(g.legs[1]!.perfectDuration).toBeCloseTo(120, 6);
  });
  it('GHOST-006 leg durations chain', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(30).advanceMiles(1).checkpoint().advanceMiles(0.5).stop('R', 40).advanceMiles(1).checkpoint().build();
    const g = buildGhost(sc);
    const sum = g.legs.reduce((a, l) => a + l.perfectDuration, 0);
    expect(sum).toBeCloseTo(g.legs[1]!.perfectTod - T0, 6);
    expect(g.legs[1]!.anchor).toEqual({ kind: 'checkpoint', cpId: 'cp1' });
    expect(g.legs[1]!.perfectDuration).toBeCloseTo(60 + 15 + 90, 6);
  });
  it('GHOST-007 calibration lines get perfect interval and cumulative', () => {
    const b = new ScenarioBuilder({ startTime: T0 }).start(50);
    b.advanceMiles(1).instruction({ sign: { text: 'MILE 1', shape: 'rect', side: 'R' } }, { section: 'calibration', text: 'Calibration start' });
    b.advanceMiles(2).instruction({ sign: { text: 'MILE 3', shape: 'rect', side: 'R' } }, { section: 'calibration', text: 'Cal 2' });
    b.advanceMiles(1).instruction({ sign: { text: 'MILE 4', shape: 'rect', side: 'R' } }, { section: 'calibration', text: 'Cal 3' });
    const sc = b.build();
    annotatePerfectTimes(sc);
    expect(sc.book[1]!.perfectInterval).toBe(0);
    expect(sc.book[2]!.perfectInterval).toBeCloseTo(144, 6);
    expect(sc.book[3]!.perfectInterval).toBeCloseTo(72, 6);
    expect(sc.book[3]!.perfectCumulative).toBeCloseTo(216, 6);
  });
  it('GHOST-008 ghost time is monotone and piecewise linear', () => {
    const sc = new ScenarioBuilder({ startTime: T0 }).start(25).advanceMiles(0.7).stop('L', 45).advanceMiles(0.4).timedAt('bridge', { holdSpeed: 30, seconds: 20, thenSpeed: 50 }).advanceMiles(2).checkpoint().build();
    const g = buildGhost(sc);
    let prev = -Infinity;
    for (let s = 0; s <= sc.course.lengthFt; s += 37) { const t = ghostTimeAt(g, s); expect(t).toBeGreaterThanOrEqual(prev); prev = t; }
    const a = ghostTimeAt(g, 1000), b = ghostTimeAt(g, 2000), c = ghostTimeAt(g, 3000);
    expect(b - a).toBeCloseTo(c - b, 6); // all within the first 25 mph segment (0.7 mi = 3696 ft)
  });
});
