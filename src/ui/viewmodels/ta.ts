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
  /** What delayed the leg, as the engine names it (train, tractor, schoolBus, ...), when it knows. */
  cause: string | null;
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
      legIndex: leg, measured: a.measuredDelay, recoverable: a.recoverable, possible: a.possible, suggested: a.suggested, fromLine: a.fromLine, toLine: a.toLine, cause: taCauseLabel((a as { cause?: string | null }).cause), filed,
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

// ---------- TAF-001 / TAF-002: the 2026 web form fields, the classic paper sheet and the arithmetic helper ----------

export type TaFormMode = 'web' | 'paper';
export interface TaFieldDef {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'select' | 'readonly' | 'password' | 'tel';
  /** Which form carries the field: the 2026 web form, the older paper sheet, or both. */
  forms: TaFormMode[];
  hint?: string;
}
/** The delay causes the rally school names (Time Delay Form [00:04]) plus the regulation's accident scene. */
export const TA_CAUSES = ['train', 'tractor', 'school bus', 'construction', 'combine', 'accident scene'] as const;
export const TA_STEP = 10;

/**
 * The fields of the Time Allowance form (TAF-001): car number, 4-digit password, phone, stage, leg (filled in for you), instruction numbers
 * from / to, time in 10 s steps, cause, witnesses (the cars ahead and behind). The classic paper sheet drops the password and the phone and adds a signature.
 */
export const TA_FIELDS: TaFieldDef[] = [
  { id: 'ta-car', label: 'Car number', kind: 'text', forms: ['web', 'paper'], hint: 'your car number, not your start position' },
  { id: 'ta-password', label: 'Password', kind: 'password', forms: ['web'], hint: 'four digits' },
  { id: 'ta-phone', label: 'Phone', kind: 'tel', forms: ['web'], hint: 'the number registered for time allowances' },
  { id: 'ta-stage', label: 'Stage', kind: 'number', forms: ['web', 'paper'], hint: 'the day of the rally' },
  { id: 'ta-leg', label: 'Leg', kind: 'select', forms: ['web', 'paper'], hint: 'checkpoints passed + 1, filled in for you' },
  { id: 'ta-from', label: 'From instruction', kind: 'number', forms: ['web', 'paper'] },
  { id: 'ta-to', label: 'to', kind: 'number', forms: ['web', 'paper'] },
  { id: 'ta-request', label: 'Time (s)', kind: 'number', forms: ['web', 'paper'], hint: 'in 10 s steps' },
  { id: 'ta-cause', label: 'Cause', kind: 'text', forms: ['web', 'paper'], hint: TA_CAUSES.join(', ') },
  { id: 'ta-witness-ahead', label: 'Car ahead (witness)', kind: 'text', forms: ['web', 'paper'] },
  { id: 'ta-witness-behind', label: 'Car behind (witness)', kind: 'text', forms: ['web', 'paper'] },
  { id: 'ta-signature', label: 'Signature', kind: 'text', forms: ['paper'] },
];
export function taFormFields(mode: TaFormMode): TaFieldDef[] { return TA_FIELDS.filter(f => f.forms.includes(mode)); }

/** The witnesses as one string for the note: "car 2 ahead, car 8 behind". */
export function taWitnessText(ahead?: string, behind?: string): string {
  const a = (ahead ?? '').trim(), b = (behind ?? '').trim();
  return [a ? `car ${a.replace(/^car\s*/i, '')} ahead` : '', b ? `car ${b.replace(/^car\s*/i, '')} behind` : ''].filter(Boolean).join(', ');
}

/** The arithmetic of the form (TAF-002): measured = stopped time + chart stop-and-go loss; make up the odd seconds; claim a multiple of 10. */
export interface TaHelper {
  measured: number;
  /** Stopped time on the watch, when the engine reports it. */
  stopped: number | null;
  /** The chart stop-and-go loss for the speeds, when the engine reports it. */
  chartLoss: number | null;
  /** The odd seconds to make up so the claim is a multiple of 10. */
  makeUp: number;
  claim: number;
  text: string;
}
export function taHelper(advice: { measuredDelay: number; measured?: number; stoppedSeconds?: number; chartLoss?: number; otherDelay?: number; makeUpToRound?: number; claim?: number; suggested?: number } | null | undefined): TaHelper {
  const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const measured = Math.max(0, Math.round(num(advice?.measured) ?? advice?.measuredDelay ?? 0));
  const stopped = num(advice?.stoppedSeconds);
  const chartLoss = num(advice?.chartLoss);
  const other = num(advice?.otherDelay) ?? 0;
  const makeUp = num(advice?.makeUpToRound) ?? measured % TA_STEP;
  const claim = num(advice?.claim) ?? measured - (measured % TA_STEP);
  const parts = stopped !== null && chartLoss !== null
    ? `measured ${formatInterval(measured)} = stopped ${formatInterval(Math.round(stopped))} + chart loss ${Math.round(chartLoss * 10) / 10} s${other > 0.5 ? ` + drive-through delay ${Math.round(other)} s` : ''}`
    : `measured ${formatInterval(measured)} = stopped time + chart stop-and-go loss`;
  const suggested = num(advice?.suggested);
  const denied = suggested !== null && suggested < claim ? ` The committee denies what you could have made up (V.H.5): suggested request ${formatInterval(suggested)}.` : '';
  const text = measured <= 0 ? 'No delay measured: nothing to claim.' : (makeUp === 0 ? `${parts}; already a multiple of 10 s, claim ${formatInterval(claim)}.` : `${parts}; make up the odd ${makeUp} s, claim ${formatInterval(claim)}.`) + denied;
  return { measured, stopped, chartLoss, makeUp, claim, text };
}

/** The cause as the engine names it (sim.TA_CAUSES: train, tractor, schoolBus, construction, combine, accident) when the text names one, else the text as typed. */
export function taCauseId(text: string): string {
  const t = (text ?? '').trim().toLowerCase();
  if (/\bbus\b/.test(t)) return 'schoolBus';
  for (const id of ['train', 'tractor', 'construction', 'combine', 'accident']) if (t.includes(id)) return id;
  return (text ?? '').trim();
}

/** The engine's cause id as the words the form shows ("schoolBus" -> "school bus"); null when there is none. */
export function taCauseLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return id === 'schoolBus' ? 'school bus' : id === 'accident' ? 'accident scene' : id === 'emergency' ? 'emergency speed' : id;
}
