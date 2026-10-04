/**
 * Ledger helpers (MAKEUP-001, CAL-006): the navigator's running list of seconds to make up, the +10 % / +20 % rules, and the
 * stock-speedometer schedule correction. Pure functions, no simulator state.
 */

/** One line of the make-up ledger: seconds still to make up (+ late, - early) and where they came from ("stop", "turn", "train", ...). */
export interface LedgerEntry { seconds: number; source: string }

/** The running make-up total of a ledger (seconds, to 0.1). */
export function makeUpTotal(entries: readonly LedgerEntry[]): number { return Math.round(entries.reduce((a, e) => a + e.seconds, 0) * 10) / 10; }

export interface MakeUpOption { /** the speed to hold (mph, 0.1) */ mph: number; /** how long to hold it (s) to win the seconds */ seconds: number }
export interface MakeUpPlan { plus10: MakeUpOption; plus20: MakeUpOption }

/**
 * 10c Making Up Time: 10 % over the assigned speed gains 6 s per minute (so 10 x the seconds owed), 20 % over gains 12 s per minute
 * (5 x the seconds owed). `seconds` = the seconds to make up, `assigned` = the assigned speed in force. Example: 4 s at 35 mph is
 * 38.5 mph for 40 s, or 42 mph for 20 s. The plan is for the navigator to work off in chunks, dropping the extra at the next speed-change sign.
 */
export function makeUpPlan(seconds: number, assigned: number): MakeUpPlan {
  const s = Math.max(0, seconds); const r1 = (x: number): number => Math.round(x * 10) / 10;
  return { plus10: { mph: r1(assigned * 1.1), seconds: r1(s * 10) }, plus20: { mph: r1(assigned * 1.2), seconds: r1(s * 5) } };
}

/** Seconds gained per minute at +10 % and +20 % over the assigned speed (10c). */
export const MAKEUP_RATES = { plus10: 6, plus20: 12 } as const;

/**
 * CAL-006: the stock-speedometer alternative to adjusting the speedometer: a schedule correction "1 s per N min" from the measured
 * calibration error. N = run minutes / error seconds, rounded to a whole minute (at least 1). No error -> "no correction".
 * Example: 5.6 s late over a 28 min run -> "1 s per 5 min".
 */
export function scheduleCorrectionMinutes(errorSeconds: number, runSeconds: number): number | null {
  const e = Math.abs(errorSeconds);
  if (!(e > 0) || !(runSeconds > 0)) return null;
  return Math.max(1, Math.round(runSeconds / 60 / e));
}
export function scheduleCorrection(errorSeconds: number, runSeconds: number): string {
  const n = scheduleCorrectionMinutes(errorSeconds, runSeconds);
  return n === null ? 'no correction' : `1 s per ${n} min`;
}
