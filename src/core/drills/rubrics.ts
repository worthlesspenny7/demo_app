/** Rubric helpers shared by drills. */
import type { Rubric } from './types.js';
import type { StageResult } from '../sim.js';

export function starsFromMeanAbs(mean: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  return mean <= thresholds[0] ? 3 : mean <= thresholds[1] ? 2 : mean <= thresholds[2] ? 1 : 0;
}
export function legErrors(r: StageResult): number[] { return r.score.legs.map(l => (l.error ?? r.score.legs[0]!.penalty)); }
export function meanAbs(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length : 0; }

/** Largest-bucket headline tip (DEBRIEF-001 at engine level). */
export function headlineTip(r: StageResult): string {
  const totals: Record<string, number> = {};
  for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) totals[k] = (totals[k] ?? 0) + v;
  const [k, v] = Object.entries(totals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['cruise', 0];
  if (Math.abs(v) < 2) return 'Clean run. The remaining seconds are speed-holding noise; consistency is what wins over nine days.';
  const late = v > 0;
  switch (k) {
    case 'stop': return late ? 'Your stops cost more than the printed pause. Go earlier: dwell = pause - your car\'s stop/start loss (write it on the card).' : 'You left stops too early: you are not using the whole pause. Dwell = pause - stop/start loss, no less.';
    case 'start': return late ? 'You left the start late. Leave early by the standstill acceleration loss (about 4-5 s for the Ford).' : 'You left the start too early. Only lead by the acceleration loss (about 4-5 s), not more.';
    case 'speedChange': return 'Landmark speed changes are mistimed. Begin the change half a ramp early so the car is mid-ramp at the sign.';
    case 'timedChange': return 'Timed changes are off. Count from the ghost\'s departure (arrival + pause), and call the change half a ramp early.';
    case 'hazard': return 'Lights, trains or traffic cost you. Time every delay on the watch, then either declare a Time Allowance or make it up with +5 mph for (speed/5 + 1) x the seconds lost, never both.';
    case 'offCourse': return 'A wrong turn cost the leg. Stay on course first: confirm the landmark before the leading edge of the intersection, and read ahead.';
    case 'turn': return 'Turns cost time the ghost does not spend. Include turn losses on your card and recover gently after each turn.';
    case 'cruise': return late ? 'You ran slow on the cruise segments: the speedometer reads high. Calibrate and hold a corrected indicated speed.' : 'You ran fast on the cruise segments: the speedometer reads low. Calibrate and hold a corrected indicated speed.';
    default: return 'Review the attribution: fix the largest bucket first.';
  }
}

/** Star thresholds scale with the driver's speed-holding noise so that Gold (rookie driver) still grades the navigator. */
export function driverScale(skill: string | undefined): number { return skill === 'rookie' ? 2.2 : skill === 'sportsman' ? 1.5 : 1; }

export function basicRubric(r: StageResult, thresholds: [number, number, number], extra: string[] = [], driverSkill?: string): Rubric {
  const k = driverScale(driverSkill); thresholds = [thresholds[0] * k, thresholds[1] * k, thresholds[2] * k];
  const errs = legErrors(r); const mean = meanAbs(errs);
  const stars = r.offCourseCount > 0 ? Math.min(1, starsFromMeanAbs(mean, thresholds)) as 0 | 1 : starsFromMeanAbs(mean, thresholds);
  const feedback = [headlineTip(r), ...extra];
  if (r.offCourseCount) feedback.push(`Off course ${r.offCourseCount} time(s): a wrong turn costs far more than a timing error.`);
  if (r.observationMissed) feedback.push('You did not stop at the Observation Checkpoint: call stop before the finish banner.');
  if (r.score.aces) feedback.push(`${r.score.aces} ACE${r.score.aces > 1 ? 's' : ''}!`);
  return { score: Math.round(mean * 10) / 10, stars, feedback, headline: `${r.score.raw} s raw (${r.score.benchmark}), ${r.score.aces} ace(s)` };
}
