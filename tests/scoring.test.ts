import { describe, it, expect } from 'vitest';
import { ageFactor, scoreLeg, scoreStage, type LegScore } from '../src/core/scoring.js';
import { DEFAULT_RULES } from '../src/core/course.js';
import type { Leg } from '../src/core/ghost.js';
import { calibrationFactor, indicatedToHold, cheatCard, shiftCard, perSpeedCard } from '../src/core/calibration.js';
import { signalIsRed, trainActive } from '../src/core/hazards.js';
import { Stopwatch } from '../src/core/stopwatch.js';

const leg = (i: number, dur: number): Leg => ({ index: i, cpId: `cp${i}`, cpS: 1000 * i, perfectTod: 28800 + dur, perfectDuration: dur, anchor: i === 1 ? { kind: 'official', tod: 28800 } : { kind: 'checkpoint', cpId: `cp${i - 1}` } });
const rec = (cpId: string, actual: number | null, sight = false) => ({ cpId, kind: 'timing' as const, actualTod: actual, rawTod: actual, sightViolation: sight });

describe('scoring', () => {
  it('SCORE-001 leg error uses official anchor for leg 1 and actual arrival for later legs', () => {
    const l1 = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 612), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(l1.error).toBe(12);
    // leg 2: anchor = actual arrival at cp1 (28800+612), perfect duration 300 -> arrive 28800+912 is an ace
    const l2 = scoreLeg({ leg: leg(2, 300), record: rec('cp2', 28800 + 912), anchorActual: 28800 + 612, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(l2.error).toBe(0); expect(l2.ace).toBe(true);
  });
  it('SCORE-002 per-leg caps (late 120 s, early 300 s) and missed checkpoints (180 s) replace the single 300 s cap; superseded by REG-001', () => {
    const big = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 600 + 1000), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(big.penalty).toBe(120); expect(big.capped).toBe(true);
    const missed = scoreLeg({ leg: leg(1, 600), record: undefined, anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(missed.penalty).toBe(180); expect(missed.extras.missed).toBe(true);
    const late = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 600 + 31 * 60), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(late.extras.missed).toBe(true); expect(late.penalty).toBe(180);
  });
  it('SCORE-003 sight-zone violation adds 30', () => {
    const l = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 602, true), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
    expect(l.penalty).toBe(32); expect(l.extras.sightZone).toBe(30);
  });
  it('SCORE-004 observation miss adds 180 to the stage (REG-005)', () => {
    const legs: LegScore[] = [scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 603), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES)];
    const st = scoreStage(legs, 1974, DEFAULT_RULES, { observationMissed: true });
    expect(st.raw).toBe(183); expect(st.observationPenalty).toBe(180);
  });
  it('SCORE-005 age factor is the printed table (REG-002) and a 40 s raw stage in a 1939 car scores 33.80', () => {
    expect(ageFactor(1954)).toBe(1); expect(ageFactor(1970)).toBe(1); expect(ageFactor(1939)).toBe(0.845); expect(ageFactor(1953)).toBe(0.915);
    expect(ageFactor(1946)).toBe(0.88);
    const legs: LegScore[] = [scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 640), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES)];
    expect(scoreStage(legs, 1939, DEFAULT_RULES, { observationMissed: false }).score).toBe(33.8);
  });
  it('SCORE-006 aces counted', () => {
    const legs: LegScore[] = [1, 2, 3].map(i => scoreLeg({ leg: leg(i, 600), record: rec(`cp${i}`, 28800 + 600 + (i === 2 ? 4 : 0)), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES));
    expect(scoreStage(legs, 1939, DEFAULT_RULES, { observationMissed: false }).aces).toBe(2);
  });
  it('SCORE-007 leaving a promoted stop > 5 min early is 60 s the first time and 300 s the second (REG-005); a time-of-day restart left early only makes the leg early', () => {
    const st = scoreStage([], 1939, DEFAULT_RULES, { observationMissed: false, earlyDepartureMinutes: [6] });
    expect(st.earlyRestartPenalty).toBe(60); expect(st.earlyDeparturePenalty).toBe(60);
    expect(scoreStage([], 1939, DEFAULT_RULES, { observationMissed: false, earlyDepartureMinutes: [4] }).earlyRestartPenalty).toBe(0);
    expect(scoreStage([], 1939, DEFAULT_RULES, { observationMissed: false, earlyDepartureMinutes: [6, 9] }).earlyDeparturePenalty).toBe(360);
  });
  it('SCORE-008 trophy run excluded by default (rules flag)', () => { expect(DEFAULT_RULES.trophyRunCounts).toBe(false); });
  it('SCORE-009 rules.rookieDropWorstLeg is gone: stage scores have no discards, only the championship does (REG-003)', () => {
    expect('rookieDropWorstLeg' in DEFAULT_RULES).toBe(false);
    const legs: LegScore[] = [5, 40, 7].map((e, i) => scoreLeg({ leg: leg(i + 1, 600), record: rec(`cp${i + 1}`, 28800 + 600 + e), anchorActual: 28800, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES));
    expect(scoreStage(legs, 1974, DEFAULT_RULES, { observationMissed: false }).raw).toBe(52);
  });
  it('SIM-009 time allowance credit = min(request, measured delay) with over-request flagged beyond 10 s (see TA-003 and SCORE-010)', () => {
    const l = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 640), anchorActual: 28800, taDeclared: 50, taQualifying: 35 }, DEFAULT_RULES);
    expect(l.taCredit).toBe(30); expect(l.error).toBe(10); expect(l.taOverDeclared).toBe(true);   // 35 s possible: the committee credit rounds DOWN to a multiple of 10 s (V.H.3, V.H.6)
    const ok = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 640), anchorActual: 28800, taDeclared: 30, taQualifying: 35 }, DEFAULT_RULES);
    expect(ok.taCredit).toBe(30); expect(ok.taOverDeclared).toBe(false);
    const edge = scoreLeg({ leg: leg(1, 600), record: rec('cp1', 28800 + 640), anchorActual: 28800, taDeclared: 45, taQualifying: 35 }, DEFAULT_RULES);
    expect(edge.taOverDeclared).toBe(false); // 10 s tolerance
  });
});

describe('calibration math', () => {
  it('CAL-001 k = sum(P)/sum(A)', () => { expect(calibrationFactor([{ perfect: 100, actual: 103 }, { perfect: 100, actual: 103 }, { perfect: 100, actual: 103 }])).toBeCloseTo(0.9709, 4); });
  it('CAL-002 indicated to hold and cheat card', () => {
    const k = 0.9709; expect(indicatedToHold(35, k)).toBeCloseTo(36.05, 2);
    const card = cheatCard(k); expect(Object.keys(card)).toEqual(['20', '25', '30', '35', '40', '45', '50']); expect(card['40']).toBeCloseTo(41.2, 1);
  });
  it('CAL-004 per-speed card for a mechanical speedo, shifted by the morning factor', () => {
    // At indicated 36 the car took 103 s where perfect was 100 -> true 34.95; to run 35 hold 36.05
    const card = perSpeedCard([{ assigned: 35, indicatedHeld: 36, perfect: 100, actual: 103 }]);
    expect(Math.abs(card['35']! - 36.05)).toBeLessThanOrEqual(0.06);
    const shifted = shiftCard(card, 1.01); // today the car is 1% faster than indicated -> hold less
    expect(shifted['35']!).toBeLessThan(card['35']!);
  });
});

describe('hazards', () => {
  it('HAZ-001 signal red iff phase within red window', () => {
    const h = { kind: 'signal' as const, s: 0, redSeconds: 40, greenSeconds: 50, offset: 1000 };
    expect(signalIsRed(h, 1000)).toBe(true); expect(signalIsRed(h, 1039.9)).toBe(true); expect(signalIsRed(h, 1040)).toBe(false); expect(signalIsRed(h, 1090)).toBe(true); expect(signalIsRed(h, 990)).toBe(false);
  });
  it('HAZ-002 train blocks for its duration', () => {
    const h = { kind: 'train' as const, s: 0, startTod: 1000, durationSeconds: 90 };
    expect(trainActive(h, 999)).toBe(false); expect(trainActive(h, 1000)).toBe(true); expect(trainActive(h, 1089)).toBe(true); expect(trainActive(h, 1090)).toBe(false);
  });
});

describe('stopwatch bezel', () => {
  it('WATCH-005 countdown bezel on the stopwatch dial', () => {
    const w = new Stopwatch('analog', 60); w.setBezel(8.5); w.start(0);
    expect(w.bezelRemaining(0)).toBeCloseTo(8.5, 6); expect(w.bezelRemaining(5)).toBeCloseTo(3.5, 6); expect(w.bezelRemaining(10)).toBeCloseTo(58.5, 6);
  });
});
