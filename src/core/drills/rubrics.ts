/** Rubric helpers shared by drills. */
import type { Rubric } from './types.js';
import type { StageResult, InstrumentFinding } from '../sim.js';
import type { Scenario } from '../course.js';

export function starsFromMeanAbs(mean: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  return mean <= thresholds[0] ? 3 : mean <= thresholds[1] ? 2 : mean <= thresholds[2] ? 1 : 0;
}
export function legErrors(r: StageResult): number[] { return r.score.legs.map(l => (l.error ?? r.score.legs[0]!.penalty)); }
export function meanAbs(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length : 0; }

const FINDING_NAME: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'time of day taken without reading the clock',
  clockForInterval: 'interval counted on the clock instead of the stopwatch',
  calibrationWithoutLap: 'calibration point passed without a lap',
  lapWhileFrozen: 'lap taken while the split was still frozen',
};
const FINDING_FIX: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'Starts, restarts and exact-transit IN/OUT come from the clock (or the watch in TOD mode), never from a running chrono.',
  clockForInterval: "Timed changes and pauses are counted on the stopwatch (start at the sign, lap at the stop), never off the clock's second hand.",
  calibrationWithoutLap: 'Lap the stopwatch at every calibration point, then read interval and cumulative against the printed box.',
  lapWhileFrozen: 'Press recall (or wait for the display to release) before the next lap, or the split is lost.',
};
const FINDING_SHORT: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'read time of day from the clock, never a running chrono',
  clockForInterval: 'count intervals on the stopwatch, never off the clock',
  calibrationWithoutLap: 'lap at every calibration point',
  lapWhileFrozen: 'recall or wait before the next lap',
};
/** WATCH-009: one line per kind of instrument misuse found in the run, with the count and the first example. */
export function instrumentFindingLines(findings: InstrumentFinding[]): string[] {
  const kinds = [...new Set(findings.map(f => f.kind))];
  return kinds.map(k => { const of = findings.filter(f => f.kind === k); return `Instrument discipline (WATCH-009): ${of.length} x ${FINDING_NAME[k]} (first at line ${of[0]!.line}). ${FINDING_FIX[k]}`; });
}
/** The most frequent kind of instrument misuse in the run, with its count. */
export function topFinding(findings: InstrumentFinding[]): { kind: InstrumentFinding['kind']; count: number } | null {
  if (!findings.length) return null;
  const counts = new Map<InstrumentFinding['kind'], number>(); for (const f of findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const [kind, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { kind, count };
}
/** The short form used in the headline tip: names the most frequent kind only. */
export function instrumentFindingSentence(findings: InstrumentFinding[]): string {
  const t = topFinding(findings); if (!t) return '';
  return ` Instrument discipline (WATCH-009): ${t.count} x ${FINDING_NAME[t.kind]}; ${FINDING_SHORT[t.kind]}.`;
}

/** Largest-bucket headline tip (DEBRIEF-001 at engine level). */
export function headlineTip(r: StageResult, sc?: Scenario): string {
  const totals: Record<string, number> = {};
  for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) totals[k] = (totals[k] ?? 0) + v;
  const errs = legErrors(r); const mean = meanAbs(errs);
  const inst = instrumentFindingSentence(r.instrumentDiscipline ?? []);
  if (mean <= 3 && r.offCourseCount === 0) return `Clean run: the remaining seconds are speed-holding noise, and consistency is what wins over nine days.${inst}`;
  const net = Object.values(totals).reduce((a, b) => a + b, 0);
  // the largest cause with the same sign as the net error (a negative cruise bucket against positive stops is recovery, not a fault)
  const sameSign = Object.entries(totals).filter(([, v]) => Math.sign(v) === Math.sign(net) && Math.abs(v) >= 1.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [k, v] = sameSign[0] ?? Object.entries(totals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['cruise', 0];
  const recovered = -Math.min(0, totals.cruise ?? 0);
  if (k !== 'cruise' && recovered > 3 && net > 0) return `You lost ${Math.round(v)} s in ${k === 'stop' ? 'stops' : k} and recovered ${Math.round(recovered)} s in cruise; recover a little more, or earlier, next time (10 % rule: 10 % faster for 10 x the seconds lost).${inst}`;
  const late = v > 0;
  return `${tipFor(k, late, sc)}${inst}`;
}

function tipFor(k: string, late: boolean, sc?: Scenario): string {
  switch (k) {
    case 'stop': return late ? 'Your stops cost more than the printed pause, so go earlier: dwell = the chart pause time for your IN/OUT pair (the printed pause minus the stop/start loss), written next to every pause.' : 'You left stops too early and are not using the whole pause: dwell = the chart pause time, no less.';
    case 'start': return late ? 'You left the start late: leave early by the standstill acceleration loss (the 0 > speed cell of the acceleration chart, about 4-5 s for the Ford).' : 'You left the start too early: lead by the acceleration loss only (about 4-5 s), not more.';
    case 'speedChange': return 'Landmark speed changes are mistimed: split at the sign, crossing it at the midpoint speed, which means beginning the change half a ramp early.';
    case 'timedChange': return "Timed changes are off: count from the ghost's departure (arrival + pause) and split the change at the sign by calling it half a ramp early.";
    case 'hazard': return 'Lights, trains or traffic cost you: time every delay on the stopwatch, then make it up with the 10 % rule (10 % faster for 10 x the seconds lost, 4 s lost at 35 -> 38.5 mph for 40 s) or, for a train or accident, file a Time Allowance at the TA point, never both.';
    case 'offCourse': return "A wrong turn cost the leg: stay on course first (the third of the Four S's), confirm the landmark before the leading edge of the intersection, and never ask for a Time Allowance for a wrong turn.";
    case 'turn': return 'Turns cost time the ghost does not spend: write the turn chart loss on your card (approach 40, exit 35 = 4 s) and recover it with the 10 % rule right after the turn.';
    case 'cruise': {
      const speedoTrue = sc ? sc.speedo.kind === 'timewise' && Math.abs(sc.speedo.gain - 1) < 0.003 && Math.abs(sc.speedo.offset) < 0.1 : false;
      if (speedoTrue) return late ? 'Cruise segments ran slow because the driver wandered under the assigned speed: watch the needle and call small corrections (+1) sooner, and make up the rest with the 10 % rule.' : 'Cruise segments ran fast because the driver wandered over the assigned speed: call small corrections (-1) sooner.';
      return late ? 'You ran slow on the cruise segments because the speedometer reads high: calibrate and hold a corrected indicated speed.' : 'You ran fast on the cruise segments because the speedometer reads low: calibrate and hold a corrected indicated speed.';
    }
    default: return 'Review the attribution and fix the largest bucket first.';
  }
}

/** Star thresholds scale with the driver's speed-holding noise so that Gold (rookie driver) still grades the navigator. */
export function driverScale(skill: string | undefined): number { return skill === 'rookie' ? 2.2 : skill === 'sportsman' ? 1.5 : 1; }

export function basicRubric(r: StageResult, thresholds: [number, number, number], extra: string[] = [], driverSkill?: string, sc?: Scenario): Rubric {
  const k = driverScale(driverSkill); thresholds = [thresholds[0] * k, thresholds[1] * k, thresholds[2] * k];
  const errs = legErrors(r); const mean = meanAbs(errs);
  const stars = r.offCourseCount > 0 ? Math.min(1, starsFromMeanAbs(mean, thresholds)) as 0 | 1 : starsFromMeanAbs(mean, thresholds);
  const feedback = [headlineTip(r, sc), ...extra];
  const top = topFinding(r.instrumentDiscipline ?? []); // the tip already names the most frequent kind; list the others here
  if (top) feedback.push(...instrumentFindingLines((r.instrumentDiscipline ?? []).filter(f => f.kind !== top.kind)));
  if (r.offCourseCount) feedback.push(`Off course ${r.offCourseCount} time(s): a wrong turn costs far more than a timing error.`);
  if (r.observationMissed) feedback.push('You did not stop at the Observation Checkpoint: call stop before the finish banner.');
  if (r.score.aces) feedback.push(`${r.score.aces} ACE${r.score.aces > 1 ? 's' : ''}!`);
  return { score: Math.round(mean * 10) / 10, stars, feedback, headline: `${r.score.raw} s raw (${r.score.benchmark}), ${r.score.aces} ace(s)` };
}
