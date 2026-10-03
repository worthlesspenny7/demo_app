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
