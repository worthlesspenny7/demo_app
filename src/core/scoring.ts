/** Scoring. DESIGN §10. */
import type { RulesConfig } from './course.js';
import type { Leg } from './ghost.js';

export interface CheckpointRecord {
  cpId: string;
  kind: 'timing' | 'observation';
  /** Rounded TOD when the front wheels crossed; null if never crossed. */
  actualTod: number | null;
  rawTod: number | null;
  sightViolation: boolean;
  /** Observation CP: did the car stop within 200 ft after the line. */
  stopped?: boolean;
}

export interface LegScore {
  index: number;
  cpId: string;
  perfectTod: number;
  perfectDuration: number;
  anchorTod: number;          // actual anchor used (official or previous actual)
  actualTod: number | null;
  error: number | null;       // seconds, + late / - early, after TA credit
  rawError: number | null;    // before TA credit
  taCredit: number;
  taOverDeclared: boolean;
  penalty: number;            // |error| capped + extras
  extras: { sightZone: number; observation: number; missed: boolean };
  ace: boolean;
}

export type Benchmark = 'champion' | 'expert' | 'sportsman' | 'rookie' | 'blown';
/** SCORE-011: label a raw day score against the research benchmarks (R06 §4). */
export function benchmarkLabel(raw: number): Benchmark { return raw <= 3 ? 'champion' : raw <= 13 ? 'expert' : raw <= 25 ? 'sportsman' : raw <= 46 ? 'rookie' : 'blown'; }

export interface StageScore {
  legs: LegScore[];
  benchmark: Benchmark;
  raw: number;
  ageFactor: number;
  score: number;              // raw * factor, 2 decimals
  aces: number;
  earlyRestartPenalty: number;
}

const AGE_POINTS: [number, number][] = [[1911, 0.61], [1912, 0.62], [1925, 0.75], [1926, 0.76], [1939, 0.845], [1940, 0.85], [1953, 0.915], [1954, 1.0]];

export function ageFactor(year: number): number {
  if (year >= 1954) return 1;
  if (year <= 1911) return 0.61;
  for (let i = 1; i < AGE_POINTS.length; i++) {
    const [y0, f0] = AGE_POINTS[i - 1]!, [y1, f1] = AGE_POINTS[i]!;
    if (year >= y0 && year <= y1) return Math.round((f0 + (f1 - f0) * (year - y0) / (y1 - y0)) * 1000) / 1000;
  }
  return 1;
}

export interface LegInputs {
  leg: Leg;
  record: CheckpointRecord | undefined;
  /** Actual anchor TOD: official time for official anchors, previous CP actual for checkpoint anchors. */
  anchorActual: number;
  taDeclared: number;
  taQualifying: number;
}

export function scoreLeg(inp: LegInputs, rules: RulesConfig): LegScore {
  const { leg, record } = inp;
  const extras = { sightZone: 0, observation: 0, missed: false };
  let error: number | null = null, rawError: number | null = null;
  let taCredit = 0; const taOverDeclared = inp.taDeclared > inp.taQualifying + rules.taOverDeclareTolerance;
  let penalty: number;
  if (!record || record.actualTod === null) {
    extras.missed = true; penalty = rules.maxPerCp;
  } else {
    rawError = record.actualTod - (inp.anchorActual + leg.perfectDuration);
    // "to the nearest second": the perfect time is also rounded when compared
    rawError = Math.round(rawError);
    if (rawError > rules.missedCpLateMinutes * 60) { extras.missed = true; penalty = rules.maxPerCp; error = rawError; }
    else {
      const g = Math.max(0.001, rules.taGranularitySeconds ?? 1);
      taCredit = Math.round(Math.max(0, Math.min(inp.taDeclared, inp.taQualifying, Math.max(rawError, 0))) / g) * g;
      error = rawError - taCredit;
      penalty = Math.min(Math.abs(error), rules.maxPerCp);
    }
    if (record.sightViolation) { extras.sightZone = rules.sightZonePenalty; penalty += extras.sightZone; }
  }
  return { index: leg.index, cpId: leg.cpId, perfectTod: leg.perfectTod, perfectDuration: leg.perfectDuration, anchorTod: inp.anchorActual, actualTod: record?.actualTod ?? null, error, rawError, taCredit, taOverDeclared, penalty, extras, ace: error === 0 && !extras.missed };
}

export function scoreStage(legs: LegScore[], year: number, rules: RulesConfig, extra: { observationMissed: boolean; earlyRestartMinutes: number }): StageScore {
  let considered = legs;
  if (rules.rookieDropWorstLeg && legs.length > 1) {
    const worst = legs.reduce((w, l) => (l.penalty > w.penalty ? l : w), legs[0]!);
    considered = legs.filter(l => l !== worst);
  }
  let raw = considered.reduce((a, l) => a + l.penalty, 0);
  if (extra.observationMissed) raw += rules.observationMissPenalty;
  const earlyRestartPenalty = extra.earlyRestartMinutes > rules.earlyRestartMinutes ? rules.earlyRestartPenalty : 0;
  raw += earlyRestartPenalty;
  const f = ageFactor(year);
  return { legs, benchmark: benchmarkLabel(raw), raw, ageFactor: f, score: Math.round(raw * f * 100) / 100, aces: legs.filter(l => l.ace).length, earlyRestartPenalty };
}
