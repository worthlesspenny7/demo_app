/**
 * Time Allowance point screen (UI-031, TA-005): the form at a TA point, the live 10 s rounding, the 15-minute window, and the
 * end-of-stage scorecard acknowledgement. Pure view-model, no DOM.
 */
import type { TaState, TaAdvice, TaRequestRecord } from '../../core/sim.js';
import { formatInterval } from '../../core/griid.js';

/** The handbook example wording (TA-005): "Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s." */
export function taNoteText(f: { delay: number; madeUp: number; request: number; cause?: string; witness?: string }): string {
  const cause = (f.cause ?? '').trim();
  const w = (f.witness ?? '').trim();
  return `Delayed ${formatInterval(f.delay)}${cause ? ` by ${cause}` : ''}. Made up ${formatInterval(f.madeUp)}. Request ${formatInterval(f.request)}.${w ? ` Witness: ${w}.` : ''}`;
}

/**
 * Rounding against the team (V.H.6): a request that is not a multiple of 10 s goes down when the measured delay is below the midpoint
 * of the two neighbouring multiples, else up. Mirrors the engine so the form can show it live.
 */
export function taRounding(requested: number, measured: number): { adjusted: number; changed: boolean; text: string } {
  const r = Math.round(requested);
  if (!(r > 0)) return { adjusted: 0, changed: false, text: 'enter a request of at least 0m10s' };
  if (r % 10 === 0) return { adjusted: r, changed: false, text: `${formatInterval(r)}, a multiple of 10 s` };
  const lo = Math.floor(r / 10) * 10, hi = lo + 10;
  const adjusted = measured < (lo + hi) / 2 ? lo : hi;
  return { adjusted, changed: true, text: `${formatInterval(r)} adjusted to ${formatInterval(adjusted)}` };
}

/** "14:32" for the countdown of the window. */
export function windowClock(secondsLeft: number | null): string {
  if (secondsLeft === null) return '--:--';
  const s = Math.max(0, Math.ceil(secondsLeft)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface TaLegRow {
  legIndex: number; measured: number; recoverable: number; possible: number; suggested: number;
  fromLine: number | null; toLine: number | null;
  /** The request already filed for this leg, if any. */
  filed: TaRequestRecord | null;
  text: string;
}
export interface TaFormVm {
  /** Show the form: a TA window is open. */
  visible: boolean; endOfStage: boolean;
  secondsLeft: number | null; countdown: string;
  legs: TaLegRow[];
  /** Offer the end-of-stage scorecard acknowledgement. */
  ackAvailable: boolean; acked: boolean;
  requests: TaRequestRecord[];
  example: string;
  title: string;
}

export function taFormVm(ta: TaState | null | undefined, advice: (legIndex: number) => TaAdvice): TaFormVm {
  const t = ta ?? null;
  const open = !!t && t.windowOpen;
  const legs: TaLegRow[] = (open ? t!.eligibleLegs : []).map(leg => {
    const a = advice(leg);
    const filed = [...(t!.requests ?? [])].reverse().find(r => r.legIndex === leg && r.status === 'filed') ?? null;
    return {
      legIndex: leg, measured: a.measuredDelay, recoverable: a.recoverable, possible: a.possible, suggested: a.suggested, fromLine: a.fromLine, toLine: a.toLine, filed,
      text: `Leg ${leg}: delay ${formatInterval(a.measuredDelay)}, could be made up ${formatInterval(a.recoverable)}, suggested request ${formatInterval(a.suggested)}${a.fromLine !== null ? ` (lines ${a.fromLine}-${a.toLine})` : ''}`,
    };
  });
  return {
    visible: open, endOfStage: !!t?.endOfStage, secondsLeft: t?.secondsLeft ?? null, countdown: windowClock(t?.secondsLeft ?? null), legs,
    ackAvailable: open && !!t?.endOfStage && !t?.scorecardAcked, acked: !!t?.scorecardAcked, requests: t?.requests ?? [],
    example: 'Delayed 0m45s by a farm tractor. Made up 0m25s. Request 0m20s.',
    title: t?.endOfStage ? 'Time Allowance point and scorecard (end of stage)' : 'Time Allowance point',
  };
}
