/**
 * SCH-003 widget models: pure, DOM-free state machines behind the purpose-built widget pages. Every number comes from the engine:
 * the ghost's time at a distance (src/core/ghost.ts ghostTimeAt over a one-breakpoint GhostTable), leg scoring (src/core/scoring.ts
 * scoreLeg with DEFAULT_RULES: whole seconds, caps), the digital stopwatch's laps (src/core/stopwatch.ts) and the seeded rng.
 * No rule is re-implemented here.
 */
import { ghostTimeAt, type GhostTable, type Leg } from '../../core/ghost.js';
import { scoreLeg, ageFactor, roundFactored, type LegScore } from '../../core/scoring.js';
import { DEFAULT_RULES } from '../../core/course.js';
import { Stopwatch } from '../../core/stopwatch.js';
import { mphToFps, milesToFt } from '../../core/units.js';
import { rng } from '../../core/rng.js';

/** A ghost driving one assigned speed from s = 0 at t = 0. */
export function steadyGhost(mph: number): GhostTable { return { breakpoints: [{ s: 0, t: 0, v: mphToFps(mph) }], legs: [], observations: [], endTod: 0 }; }

/** "1.4 s late" / "0.6 s early" / "on time" (+ late). */
export function driftText(sec: number): string { const a = Math.abs(sec); return a < 0.05 ? 'on time' : `${a.toFixed(1)} s ${sec > 0 ? 'late' : 'early'}`; }

/** Score one leg the engine's way: the car's actual time against the ghost's perfect duration. */
export function legScore(perfectSeconds: number, actualSeconds: number | null, index = 1): LegScore {
  const leg: Leg = { index, cpId: `CP${index}`, cpS: 0, perfectTod: perfectSeconds, perfectDuration: perfectSeconds, anchor: { kind: 'official', tod: 0 } };
  return scoreLeg({ leg, record: actualSeconds === null ? undefined : { cpId: leg.cpId, kind: 'timing', actualTod: Math.round(actualSeconds), rawTod: actualSeconds, sightViolation: false }, anchorActual: 0, taDeclared: 0, taQualifying: 0 }, DEFAULT_RULES);
}

// ------------------------------------------------------------------ holdSpeed
export const HOLD_TOLERANCE_MPH = 1;
export const HOLD_SECONDS = 10;
/** SCH-003 'holdSpeed': slide the car's speed against the assigned speed; the readout is the car's time against the ghost at the car's
 *  position; the page completes after HOLD_SECONDS within HOLD_TOLERANCE_MPH. The car follows the slider with a short lag (a real car). */
export class HoldSpeedModel {
  readonly ghost: GhostTable;
  t = 0; s = 0; speed: number; target: number; held = 0; complete = false;
  constructor(readonly assigned = 35, start = 25, readonly lag = 0.6) { this.ghost = steadyGhost(assigned); this.speed = start; this.target = start; }
  setTarget(mph: number): void { this.target = mph; }
  step(dt: number): void {
    if (!(dt > 0)) return;
    const k = this.lag > 0 ? Math.min(1, dt / this.lag) : 1;
    this.speed += (this.target - this.speed) * k;
    this.s += mphToFps(this.speed) * dt; this.t += dt;
    if (Math.abs(this.speed - this.assigned) <= HOLD_TOLERANCE_MPH) this.held += dt; else this.held = 0;
    if (this.held >= HOLD_SECONDS) this.complete = true;
  }
  /** + late: the car reached its position this many seconds after the ghost did. */
  drift(): number { return this.t - ghostTimeAt(this.ghost, this.s); }
  holdLeft(): number { return Math.max(0, HOLD_SECONDS - this.held); }
}

// ------------------------------------------------------------------ whereCheckpoint
/** SCH-003 'whereCheckpoint': a car drives a short leg at its assigned speed (a little off, as real cars are); the player taps when they
 *  think the leg ended. The checkpoint sits where the leg ends; the score is the engine's leg score of the tap against the ghost. */
export class WhereCheckpointModel {
  readonly ghost: GhostTable; readonly legFt: number; readonly perfect: number; readonly carMph: number;
  tap: number | null = null;
  constructor(readonly assigned = 30, readonly miles = 0.1, seed = 1) {
    this.ghost = steadyGhost(assigned); this.legFt = milesToFt(miles); this.perfect = ghostTimeAt(this.ghost, this.legFt);
    // PT-16 B7: the car drives the book exactly beside the ghost, so a tap as the cars reach the drawn sign is the right answer (seed kept for the API)
    void seed; this.carMph = assigned;
  }
  /** The car's distance at t seconds. */
  carS(t: number): number { return mphToFps(this.carMph) * t; }
  /** When the car actually reached the checkpoint. */
  carAtCheckpoint(): number { return this.legFt / mphToFps(this.carMph); }
  /** Max seconds the leg runs before giving up (the cars stop at the sign; a little longer to tap). */
  maxSeconds(): number { return this.perfect + 6; }
  /** PT-16 B7: the score explained: the ghost's time at the sign, the tap, the gap and the points (one per whole second off). */
  explain(): string {
    const sc = this.score(); if (!sc || this.tap === null) return '';
    const gap = this.tap - this.perfect; const a = Math.abs(gap);
    const off = a < 0.05 ? 'exactly with it' : `${a.toFixed(1)} s ${gap > 0 ? 'after' : 'before'} it`;
    return `The ghost reached the sign at ${this.perfect.toFixed(1)} s. You tapped at ${this.tap.toFixed(1)} s, ${off}. The crew counts whole seconds: ${sc.penalty} point${sc.penalty === 1 ? '' : 's'}${sc.penalty === 0 ? ', an Ace!' : '.'}`;
  }
  press(t: number): LegScore { this.tap = t; return this.score()!; }
  /** The score of the tap: the tap is when you say the car crossed; the ghost's perfect time is the leg's. */
  score(): LegScore | null { return this.tap === null ? null : legScore(this.perfect, this.tap); }
  /** Where the car was when the player tapped, as a fraction of the checkpoint distance. */
  tapFrac(): number { return this.tap === null ? 0 : this.carS(this.tap) / this.legFt; }
}

// ------------------------------------------------------------------ tapLap
/** SCH-003 'tapLap': the car passes `markers` markers at known times; the player taps LAP at each on the real digital stopwatch; then
 *  reads a split (the cumulative time at a marker) from the lap table. */
export class TapLapModel {
  readonly watch = new Stopwatch('digital', 60, 0);
  readonly markerTimes: number[];
  readonly ask: number;
  constructor(readonly markers = 3, seed = 1, readonly spacing = 3.5) {
    const r = rng(`taplap:${seed}`);
    let t = 0; this.markerTimes = Array.from({ length: markers }, () => (t += spacing + r.next() * 1.5));
    this.ask = Math.min(markers - 1, 1);
    this.watch.start(0);
  }
  lap(t: number): number | null { if (this.watch.laps.length >= this.markers) return null; return this.watch.lap(t); }
  get done(): boolean { return this.watch.laps.length >= this.markers; }
  table(): { interval: number; cumulative: number }[] { return this.watch.lapTable(); }
  /** Lap errors against the markers (+ late). */
  errors(): number[] { return this.watch.laps.map((l, i) => l - (this.markerTimes[i] ?? l)); }
  /** The split question: the cumulative time at marker ask+1 (right) against the interval and a misread. */
  splitOptions(): { label: string; right: boolean }[] {
    const row = this.table()[this.ask]; if (!row) return [];
    const f = (x: number): string => `${x.toFixed(2)} s`;
    const opts = [{ label: f(row.cumulative), right: true }, { label: f(row.interval), right: false }, { label: f(row.cumulative + (this.table()[this.ask + 1]?.interval ?? 1.5)), right: false }];
    const seen = new Set<string>(); return opts.filter(o => (seen.has(o.label) ? false : (seen.add(o.label), true))).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }
}

// ------------------------------------------------------------------ readScorecard
export interface CardLeg { index: number; perfect: number; actual: number; score: LegScore }
/** SCH-003 'readScorecard': a sample scorecard of five legs (seeded), each scored by the engine; tap the leg that cost the most. */
export function sampleScorecard(seed = 1, legs = 5): CardLeg[] {
  const r = rng(`scorecard:${seed}`);
  const out: CardLeg[] = [];
  for (let i = 1; i <= legs; i++) {
    const perfect = 120 + r.int(0, 300);
    const err = i === 1 + (seed % legs) ? 0 : (r.next() < 0.5 ? -1 : 1) * r.int(1, 12);
    out.push({ index: i, perfect, actual: perfect + err, score: legScore(perfect, perfect + err, i) });
  }
  // one clear worst leg
  const w = out.reduce((a, b) => (b.score.penalty > a.score.penalty ? b : a));
  if (out.filter(x => x.score.penalty === w.score.penalty).length > 1) { w.actual += 3; w.score = legScore(w.perfect, w.actual, w.index); }
  return out;
}
export const worstLeg = (legs: CardLeg[]): CardLeg => legs.reduce((a, b) => (b.score.penalty > a.score.penalty ? b : a));
export const aceLegs = (legs: CardLeg[]): CardLeg[] => legs.filter(l => l.score.ace);
export const cardTotal = (legs: CardLeg[]): number => legs.reduce((a, l) => a + l.score.penalty, 0);

/** The day's score the scorecard prints: raw seconds x the age factor of the car's Scoring Year (REG V.C.2.e, the engine's rounding). */
export function scorecardTotal(legs: CardLeg[], year = 1939): { raw: number; factor: number; score: number; options: { label: string; right: boolean }[] } {
  const raw = cardTotal(legs); const factor = ageFactor(year); const score = roundFactored(raw, factor);
  const f = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(2));
  const opts = [{ label: f(score), right: true }, { label: f(raw), right: false }, { label: f(roundFactored(raw, 1 / factor)), right: false }];
  return { raw, factor, score, options: opts.sort((a, b) => Number(a.label) - Number(b.label)) };
}
