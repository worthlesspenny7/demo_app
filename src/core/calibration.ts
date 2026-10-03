/** Calibration-run math. DESIGN §12, R07 §3. */
export interface CalibrationInterval { perfect: number; actual: number }

/** k = sum(P)/sum(A): true = k * indicated. */
export function calibrationFactor(intervals: CalibrationInterval[]): number {
  const P = intervals.reduce((a, i) => a + i.perfect, 0), A = intervals.reduce((a, i) => a + i.actual, 0);
  return A > 0 ? P / A : 1;
}
/** Indicated speed to hold for a wanted true (assigned) speed. */
export function indicatedToHold(assigned: number, k: number): number { return assigned / k; }
/** Percent error: positive => car slower than the speedo says (actual interval longer than perfect). */
export function percentError(intervals: CalibrationInterval[]): number { return (1 / calibrationFactor(intervals) - 1) * 100; }

export const CARD_SPEEDS = [20, 25, 30, 35, 40, 45, 50];
export function cheatCard(k: number, speeds: number[] = CARD_SPEEDS): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of speeds) out[String(v)] = Math.round(indicatedToHold(v, k) * 10) / 10;
  return out;
}
/** Per-speed card from per-speed measurements (mechanical speedo): map assigned -> indicated to hold. */
export function perSpeedCard(points: { assigned: number; indicatedHeld: number; perfect: number; actual: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) {
    const k = p.actual > 0 ? p.perfect / p.actual : 1; // true = k * indicatedHeld at this speed
    const trueHeld = k * p.indicatedHeld;              // what the car really did
    // indicated needed for assigned: scale the held indicated by assigned/trueHeld
    out[String(p.assigned)] = Math.round((p.indicatedHeld * p.assigned / trueHeld) * 10) / 10;
  }
  return out;
}
/** Shift an existing per-speed card by a morning-run factor (true = k * indicated today). */
export function shiftCard(card: Record<string, number>, k: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [a, ind] of Object.entries(card)) out[a] = Math.round((ind / k) * 10) / 10;
  return out;
}

// ---------- Timewise factor adjustment (CHART-005, HB Appendix C) ----------

/**
 * New factor = old factor x correct / actual (HB Appendix C method #2; the printed fast-case formula "actual / correct" is an erratum).
 * Slow (actual > correct) reduces the factor, fast increases it. calibrationFactor() above is the same rule with k = sum(P)/sum(A).
 */
export function adjustFactor(oldFactor: number, correctSeconds: number, actualSeconds: number): number {
  return actualSeconds > 0 ? oldFactor * correctSeconds / actualSeconds : oldFactor;
}

/** "Clicks" the factor must change per second-per-hour of error: factor / 3600, to the nearest tenth (4315 -> 1.2). */
export function clicksPerSecondPerHour(factor: number): number { return Math.round(factor / 3600 * 10) / 10; }

export interface TimewiseAdjustment {
  /** Error of the calibration run: + = late (slow), - = early (fast). */
  errorSeconds: number;
  /** The error scaled to a full hour; the handbook multiplies by 2 for a run of about 29 minutes. */
  secondsPerHour: number;
  clicks: number;
  direction: 'reduce' | 'increase' | 'none';
  /** Method #1 (no calculator): old factor -/+ clicks. */
  newFactor: number;
  /** Method #2 (calculator): old x correct / actual, unrounded. */
  exactFactor: number;
}
/** HB Appendix C method #1, worked example 28m43.2s correct vs 28m47.3s actual: 4.1 s late = 8.2 s/h = 10 clicks, 4315 -> 4305. */
export function timewiseAdjustment(oldFactor: number, correctSeconds: number, actualSeconds: number): TimewiseAdjustment {
  const err = Math.round((actualSeconds - correctSeconds) * 10) / 10;
  const hourMultiplier = Math.max(1, Math.round(3600 / correctSeconds));
  const sph = Math.round(err * hourMultiplier * 10) / 10;
  const clicks = Math.round(Math.abs(sph) * clicksPerSecondPerHour(oldFactor));
  const direction = clicks === 0 ? 'none' : sph > 0 ? 'reduce' : 'increase';
  const newFactor = direction === 'reduce' ? oldFactor - clicks : direction === 'increase' ? oldFactor + clicks : oldFactor;
  return { errorSeconds: err, secondsPerHour: sph, clicks, direction, newFactor, exactFactor: adjustFactor(oldFactor, correctSeconds, actualSeconds) };
}
