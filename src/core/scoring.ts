/** Scoring. DESIGN §10, rewritten for the 2026 Event Regulations (REG-001..REG-005, TA-003). */
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
  anchorTod: number;          // actual anchor used (official time, exact-transit OUT time, or previous actual)
  actualTod: number | null;
  error: number | null;       // seconds, + late / - early, after TA credit
  rawError: number | null;    // before TA credit
  taCredit: number;
  taOverDeclared: boolean;
  /** Committee decision text for the debrief (TA-003, UI-031); empty when nothing was requested. */
  taReason: string;
  penalty: number;            // |error| capped (late 120 s, early 300 s) + extras; missed = 180 s
  /** True when the 1 s/s penalty hit the late or early cap. */
  capped: boolean;
  extras: { sightZone: number; observation: number; missed: boolean };
  ace: boolean;
}

export type Benchmark = 'champion' | 'expert' | 'sportsman' | 'rookie' | 'blown';
/** SCORE-011: label a raw day score against the research benchmarks (R06 §4). */
export function benchmarkLabel(raw: number): Benchmark { return raw <= 3 ? 'champion' : raw <= 13 ? 'expert' : raw <= 25 ? 'sportsman' : raw <= 46 ? 'rookie' : 'blown'; }

export interface EarlyDeparture { minutesEarly: number; penalty: number; /** third and later offences go to VI.B.3 */ referral: boolean }

export interface StageScore {
  legs: LegScore[];
  benchmark: Benchmark;
  raw: number;
  ageFactor: number;
  score: number;              // raw * factor, 0.01 s (V.C.2.e)
  aces: number;
  /** Total of the V.E.3.h promoted-stop early departure penalties. Legacy name kept for the UI. */
  earlyRestartPenalty: number;
  earlyDeparturePenalty: number;
  earlyDepartures: EarlyDeparture[];
  /** Observation Checkpoint stop missed (180 s). */
  observationPenalty: number;
  /** DNF / FNS (V.E.2.b, d): final Timing or Observation Checkpoint missed. Excluded from championship awards. */
  dnf: boolean;
  dnfReason?: string;
  /** Every discardable item of the stage (one per leg, plus each separate V.E.3 penalty): the pool of I.F.3. */
  penaltyItems: number[];
}

/** REG-002: the printed age-factor table (V.D). Never interpolated. 1954+ 1.000, 1953 0.915, -0.005/yr to 1930 = 0.800, -0.010/yr to 1900 = 0.500. */
export function ageFactor(year: number): number {
  const y = Math.floor(year);
  let milli: number;
  if (y >= 1954) milli = 1000;
  else if (y === 1953) milli = 915;
  else if (y >= 1930) milli = 800 + 5 * (y - 1930);
  else if (y >= 1900) milli = 500 + 10 * (y - 1900);
  else milli = 500; // earlier than 1900 is not in the regulations
  return milli / 1000;
}

export interface LegInputs {
  leg: Leg;
  record: CheckpointRecord | undefined;
  /** Actual anchor TOD: official time (start/restart), exact-transit OUT time, or the previous CP actual. */
  anchorActual: number;
  /** Time Allowance requested for this leg, already adjusted to a multiple of 10 s (TA-001). */
  taDeclared: number;
  /** Measured qualifying delay on this leg (trains, accidents, hazard-forced stops, emergency reduced speed). */
  taQualifying: number;
  /** Time the team could have made up before the checkpoint at +10 % (TA-003). */
  taRecoverable?: number;
  /** TOD of the most recent official start/restart/transit-OUT, for the V.C.2.b(2) "more than 30 minutes after the cumulative perfect time" rule. */
  cumulativeAnchorActual?: number;
}

export function scoreLeg(inp: LegInputs, rules: RulesConfig): LegScore {
  const { leg, record } = inp;
  const extras = { sightZone: 0, observation: 0, missed: false };
  let error: number | null = null, rawError: number | null = null;
  let taCredit = 0, capped = false, taReason = '';
  const possible = Math.max(0, inp.taQualifying - (inp.taRecoverable ?? 0));
  const taOverDeclared = inp.taDeclared > possible + rules.taOverDeclareTolerance;
  let penalty: number;
  if (!record || record.actualTod === null) {
    extras.missed = true; penalty = rules.missedCheckpoint;
    if (inp.taDeclared > 0) taReason = 'Checkpoint missed: nothing to credit';
  } else {
    // times are recorded to the nearest second (V.C.1.d); the perfect time is compared to the same resolution
    rawError = Math.round(record.actualTod - (inp.anchorActual + leg.perfectDuration));
    // V.C.2.b(2): more than 30 min after the computed cumulative perfect time from the most recent start/restart = missed
    const cumLate = inp.cumulativeAnchorActual !== undefined && leg.cumulativePerfect !== undefined
      ? record.actualTod - (inp.cumulativeAnchorActual + leg.cumulativePerfect) : rawError;
    if (cumLate > rules.missedCpLateMinutes * 60) { extras.missed = true; penalty = rules.missedCheckpoint; error = rawError; if (inp.taDeclared > 0) taReason = 'More than 30 minutes late: counted as missed'; }
    else {
      const g = Math.max(0.001, rules.taGranularitySeconds ?? 1);
      taCredit = Math.round(Math.max(0, Math.min(inp.taDeclared, possible, Math.max(rawError, 0))) / g) * g;
      error = rawError - taCredit;
      const cap = error >= 0 ? rules.maxLate : rules.maxEarly;
      capped = Math.abs(error) > cap;
      penalty = Math.min(Math.abs(error), cap);
      if (inp.taDeclared > 0) {
        taReason = taCredit >= inp.taDeclared ? `Allowed ${fmt(taCredit)} of ${fmt(inp.taDeclared)} requested`
          : possible < inp.taDeclared ? `Allowed ${fmt(taCredit)} of ${fmt(inp.taDeclared)} requested: measured delay ${fmt(inp.taQualifying)}, ${fmt(inp.taRecoverable ?? 0)} could have been made up`
          : `Allowed ${fmt(taCredit)} of ${fmt(inp.taDeclared)} requested: a Time Allowance never turns a late leg into an early one`;
      }
    }
    if (record.sightViolation) { extras.sightZone = rules.sightZonePenalty; penalty += extras.sightZone; }
  }
  return { index: leg.index, cpId: leg.cpId, perfectTod: leg.perfectTod, perfectDuration: leg.perfectDuration, anchorTod: inp.anchorActual, actualTod: record?.actualTod ?? null, error, rawError, taCredit, taOverDeclared, taReason, penalty, capped, extras, ace: error === 0 && !extras.missed };
}
function fmt(sec: number): string { const s = Math.round(sec); return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`; }

/** VI.B.3.a: a third or later early departure is referred for "up to 2 minutes". */
const THIRD_OFFENCE_PENALTY = 120;

export function scoreStage(
  legs: LegScore[], year: number, rules: RulesConfig,
  extra: { observationMissed: boolean; /** the final Observation Checkpoint was never reached in time (V.E.2.d) */ observationNeverReached?: boolean; /** minutes early for each promoted-stop departure (V.E.3.h) */ earlyDepartureMinutes?: number[] },
): StageScore {
  const penaltyItems: number[] = legs.map(l => l.penalty);
  let raw = penaltyItems.reduce((a, b) => a + b, 0);
  const observationPenalty = extra.observationMissed ? rules.observationMissPenalty : 0;
  if (observationPenalty) { raw += observationPenalty; penaltyItems.push(observationPenalty); }
  const earlyDepartures: EarlyDeparture[] = [];
  let offence = 0;
  for (const m of extra.earlyDepartureMinutes ?? []) {
    if (!(m > rules.earlyDepartureMinutes)) continue;
    const penalty = offence < 2 ? rules.earlyDeparturePenalties[offence]! : THIRD_OFFENCE_PENALTY;
    earlyDepartures.push({ minutesEarly: m, penalty, referral: offence >= 2 }); offence++;
  }
  const earlyDeparturePenalty = earlyDepartures.reduce((a, e) => a + e.penalty, 0);
  for (const e of earlyDepartures) penaltyItems.push(e.penalty);
  raw += earlyDeparturePenalty;
  const lastLeg = legs[legs.length - 1];
  let dnf = false, dnfReason: string | undefined;
  if (lastLeg?.extras.missed) { dnf = true; dnfReason = 'The final Timing Checkpoint was missed (V.E.2.b)'; }
  else if (extra.observationNeverReached) { dnf = true; dnfReason = 'The final Observation Checkpoint was missed (V.E.2.d)'; }
  const f = ageFactor(year);
  return { legs, benchmark: benchmarkLabel(raw), raw, ageFactor: f, score: Math.round(raw * f * 100) / 100, aces: legs.filter(l => l.ace).length, earlyRestartPenalty: earlyDeparturePenalty, earlyDeparturePenalty, earlyDepartures, observationPenalty, dnf, dnfReason, penaltyItems };
}

// ---------- championship (REG-003, REG-004) ----------

export type Division = 'grand' | 'expert' | 'sportsman' | 'rookie' | 'xcup';
export const DEFAULT_DIVISION: Division = 'rookie';
/** I.F.3: the worst N legs of Qualifying Stages 1-7 are discarded per division. */
export const DIVISION_DISCARDS: Record<Division, number> = { grand: 3, expert: 4, sportsman: 5, rookie: 6, xcup: 5 };
export const QUALIFYING_STAGES = [1, 2, 3, 4, 5, 6, 7];

export interface ChampionshipStageInput { stage: number; score: Pick<StageScore, 'legs' | 'dnf'> & Partial<StageScore> }
export interface ChampionshipTotal {
  division: Division;
  /** Number of worst legs removed from the pool of Stages 1-7. */
  discardCount: number;
  /** The discarded items (largest first). */
  discarded: number[];
  /** Total of all stages 1-9 before discards. */
  raw: number;
  /** After the I.F.3 discards. */
  afterDiscards: number;
  ageFactor: number;
  /** afterDiscards x age factor, to 0.01 s. */
  ageFactored: number;
  /** Stage 0 (Trophy Run) never counts; these are the stages that did. */
  stagesCounted: number[];
  /** DNF/FNS on Stage 8 or 9 removes Championship eligibility (V.F.5). */
  championshipEligible: boolean;
}

function itemsOf(s: ChampionshipStageInput['score']): number[] {
  if (s.penaltyItems) return s.penaltyItems;
  const items = s.legs.map(l => l.penalty);
  if (s.observationPenalty) items.push(s.observationPenalty);
  if (s.earlyDepartures) for (const e of s.earlyDepartures) items.push(e.penalty);
  return items;
}

/** REG-003: pool Stages 1-7, discard the division's worst legs, keep Stages 8-9 whole, then apply the age factor. */
export function championshipTotal(stages: ChampionshipStageInput[], division: Division = DEFAULT_DIVISION, opts: { year?: number } = {}): ChampionshipTotal {
  const counted = stages.filter(s => s.stage >= 1 && s.stage <= 9);
  const pool: number[] = []; let kept = 0; let raw = 0;
  for (const s of counted) {
    const items = itemsOf(s.score); const sum = items.reduce((a, b) => a + b, 0); raw += sum;
    if (QUALIFYING_STAGES.includes(s.stage)) pool.push(...items); else kept += sum;
  }
  const n = DIVISION_DISCARDS[division];
  const sorted = [...pool].sort((a, b) => b - a);
  const discarded = sorted.slice(0, n);
  const afterDiscards = sorted.slice(n).reduce((a, b) => a + b, 0) + kept;
  const f = opts.year !== undefined ? ageFactor(opts.year) : (counted[0]?.score.ageFactor ?? 1);
  return {
    division, discardCount: n, discarded, raw, afterDiscards, ageFactor: f, ageFactored: Math.round(afterDiscards * f * 100) / 100,
    stagesCounted: counted.map(s => s.stage), championshipEligible: !counted.some(s => (s.stage === 8 || s.stage === 9) && s.score.dnf),
  };
}

export interface Standing { name: string; /** cumulative / stage score */ total: number; scoringYear: number; /** finishing position on the Trophy Run (1 = best) */ trophyRunPosition?: number }
/** REG-004 (V.C.2.f(2)): lower score first; a tie goes to the older Scoring Year, then to the better Trophy Run position. */
export function compareStandings(a: Standing, b: Standing): number {
  if (a.total !== b.total) return a.total - b.total;
  if (a.scoringYear !== b.scoringYear) return a.scoringYear - b.scoringYear;
  const ta = a.trophyRunPosition ?? Infinity, tb = b.trophyRunPosition ?? Infinity;
  return ta === tb ? 0 : ta < tb ? -1 : 1;
}
export function rankStandings(list: Standing[]): Standing[] { return [...list].sort(compareStandings); }
export const TIE_BREAK_ORDER = ['lower score', 'older Scoring Year', 'higher Trophy Run finishing position'] as const;
