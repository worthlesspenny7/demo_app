/**
 * Time Allowance point screen (UI-031, TA-005): the form at a TA point, the live 10 s rounding, the 15-minute window, and the
 * end-of-stage scorecard acknowledgement. Pure view-model, no DOM.
 */
import type { TaState, TaAdvice, TaRequestRecord, TaRequestType, TaWitness, Action } from '../../core/sim.js';
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

// ---------- TAF-001 / TAF-002 / TAF-003: the 2026 web form exactly as labelled, the paper sheet, and the arithmetic helper ----------

export type TaFormMode = 'web' | 'paper';
export interface TaFieldDef {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'select' | 'readonly' | 'password' | 'tel' | 'textarea';
  /** Which form carries the field: the 2026 web form, the older paper sheet, or both. */
  forms: TaFormMode[];
  hint?: string;
}
/** The delay causes the rally school names (Time Delay Form [00:04]) plus the regulation's accident scene. */
export const TA_CAUSES = ['train', 'tractor', 'school bus', 'construction', 'combine', 'accident scene'] as const;
export const TA_STEP = 10;

/**
 * The 2026 web form, word for word (10a 2026 [110:28]; frame 2026-110m28s): the login page "Great Race / Time Allowance / Login" with Car Number, Password, Phone Number and a
 * green Login button; the entry page with Stage, Leg Number (a select: "Leg 3"), Between Instructions a & b, Allowance m s, Reason (one line) and a green Submit; a yellow
 * "CLICK to see Time Allowances Submitted" and a red "CLICK this after submitting ALL Time Allowances for the ENTIRE stage". There is NO witness field on the web form.
 */
export const TA_WEB = {
  loginTitle: ['Great Race', 'Time Allowance', 'Login'],
  login: { car: 'Car Number', password: 'Password', phone: 'Phone Number', button: 'Login' },
  entry: { stage: 'Stage', leg: 'Leg Number', between: 'Between Instructions', and: '&', allowance: 'Allowance', minutes: 'm', seconds: 's', reason: 'Reason', submit: 'Submit', seeSubmitted: 'CLICK to see Time Allowances Submitted', done: 'CLICK this after submitting ALL Time Allowances for the ENTIRE stage', host: 'grscores.com' },
} as const;

/** The paper Time Delay Form's own wording (11b section 2.4; the sheet serves three requests). */
export const TA_PAPER = {
  intro: 'You may use this form to submit a Time Allowance Request under V.H.1, or an Emergency Reduced Speed Request under V.H.2, or a Formal Problem Resolution Request under VI.A.2. (Be sure you are familiar with the applicable rules before submitting the request.) Only one Request or Problem should be submitted on each form (use additional paper if you need more room). A separate Request must be submitted for each delay under V.H.1, and for each leg under V.H.2.',
  types: [
    { id: 'time-allowance', label: 'Time Allowance Request (V.H.1)' },
    { id: 'emergency-reduced-speed', label: 'Emergency Reduced Speed Request (V.H.2)' },
    { id: 'formal-problem', label: 'Formal Problem Resolution Request (VI.A.2): +30 s on the stage score' },
  ] as { id: TaRequestType; label: string }[],
  conditions: 'The conditions described below occurred between Instructions #',
  allowance: 'We request an allowance of',
  multiples: '(in multiples of 0m10s)',
  because: 'because of the conditions described below (describe the circumstances causing the delay or conditions which required reduced speed):',
  formal: 'For a FORMAL PROBLEM RESOLUTION REQUEST: Describe the problem. State what instructions you believe were in error, rules violated, where the problem occurred, others who will confirm the problem, etc. (see VI.A.2.a(2)). Also state the remedy that you request.',
  witnessed: 'Witnessed by (for V.H.1):',
  witnessCols: ['Car No.', 'Name (or description)', 'Contestant/official'],
  certify: 'I certify, by submitting a Time Allowance Request or Emergency Reduced Speed Request, that the above-described circumstances occurred on course, and were the sole cause of our delay or reduced speed. I understand that by submitting a Formal Problem Resolution Request, I consent to the addition of 30 seconds to my total stage score.',
  signature: 'Signature of Contestant', status: 'Status', statusHint: '(Driver or Navigator)',
  received: 'Received for Great Race by', decision: 'EXECUTIVE COMMITTEE DECISION',
} as const;

/**
 * The fields of the Time Allowance form (TAF-001, TAF-003). Web (labels exactly as printed): Car Number, Password, Phone Number, Stage, Leg Number, Between Instructions
 * a & b, Allowance m s, Reason. Paper: Car #, Stage #, Leg #, Instructions # and #, minutes and seconds, circumstances, request type, "Witnessed by" rows
 * (Car No. / Name or description / Contestant-official), Signature, Status.
 */
export const TA_FIELDS: TaFieldDef[] = [
  { id: 'ta-car', label: 'Car Number', kind: 'text', forms: ['web', 'paper'], hint: 'your car number, not your start position' },
  { id: 'ta-password', label: 'Password', kind: 'password', forms: ['web'], hint: 'four digits' },
  { id: 'ta-phone', label: 'Phone Number', kind: 'tel', forms: ['web'], hint: 'the number registered for time allowances' },
  { id: 'ta-stage', label: 'Stage', kind: 'number', forms: ['web', 'paper'], hint: 'the day of the rally' },
  { id: 'ta-leg', label: 'Leg Number', kind: 'select', forms: ['web', 'paper'], hint: 'checkpoints passed + 1, filled in for you' },
  { id: 'ta-from', label: 'Between Instructions', kind: 'number', forms: ['web', 'paper'] },
  { id: 'ta-to', label: '&', kind: 'number', forms: ['web', 'paper'] },
  { id: 'ta-min', label: 'Allowance (m)', kind: 'number', forms: ['web', 'paper'], hint: 'minutes' },
  { id: 'ta-sec', label: 'Allowance (s)', kind: 'number', forms: ['web', 'paper'], hint: 'seconds, in 10 s steps' },
  { id: 'ta-cause', label: 'Reason', kind: 'text', forms: ['web'], hint: TA_CAUSES.join(', ') },
  { id: 'ta-type', label: 'Request', kind: 'select', forms: ['paper'] },
  { id: 'ta-circumstances', label: 'Circumstances', kind: 'textarea', forms: ['paper'] },
  { id: 'ta-w1-car', label: 'Witness 1: Car No.', kind: 'text', forms: ['paper'] },
  { id: 'ta-w1-name', label: 'Witness 1: Name (or description)', kind: 'text', forms: ['paper'] },
  { id: 'ta-w1-role', label: 'Witness 1: Contestant/official', kind: 'select', forms: ['paper'] },
  { id: 'ta-w2-car', label: 'Witness 2: Car No.', kind: 'text', forms: ['paper'] },
  { id: 'ta-w2-name', label: 'Witness 2: Name (or description)', kind: 'text', forms: ['paper'] },
  { id: 'ta-w2-role', label: 'Witness 2: Contestant/official', kind: 'select', forms: ['paper'] },
  { id: 'ta-signature', label: 'Signature of Contestant', kind: 'text', forms: ['paper'] },
  { id: 'ta-status', label: 'Status (Driver or Navigator)', kind: 'select', forms: ['paper'] },
];
export function taFormFields(mode: TaFormMode): TaFieldDef[] { return TA_FIELDS.filter(f => f.forms.includes(mode)); }

/** The witnesses as one string for the note: "car 2 ahead, car 8 behind". */
export function taWitnessText(ahead?: string, behind?: string): string {
  const a = (ahead ?? '').trim(), b = (behind ?? '').trim();
  return [a ? `car ${a.replace(/^car\s*/i, '')} ahead` : '', b ? `car ${b.replace(/^car\s*/i, '')} behind` : ''].filter(Boolean).join(', ');
}
/** The "Witnessed by" rows of the paper sheet as one string for the note: "car 8 (black 32 Ford), car 77 (57 Chevy)". */
export function taWitnessRowsText(rows: TaWitness[]): string {
  return rows.filter(r => r.car !== undefined && String(r.car).trim() !== '' || (r.description ?? '').trim() !== '')
    .map(r => `${r.car !== undefined && String(r.car).trim() !== '' ? `car ${String(r.car).trim()}` : ''}${r.description?.trim() ? ` (${r.description.trim()})` : ''}${r.role ? ` [${r.role}]` : ''}`.trim()).join(', ');
}

/** Everything the two forms can hold, as typed (strings) so the pure builder below can validate them. */
export interface TaFormValues {
  car?: string; password?: string; phone?: string; stage?: string; leg: number; from?: string; to?: string; minutes?: string; seconds?: string;
  /** web: the one-line Reason */ reason?: string;
  /** paper */ type?: TaRequestType; circumstances?: string; status?: 'driver' | 'navigator'; signature?: string; witnesses?: TaWitness[];
  /** the navigator's own arithmetic (worksheet): delay and made-up seconds, for the note only */ delay?: number; madeUp?: number;
}
export type TaRequestAction = Extract<Action, { type: 'ta.request' }>;

/** The seconds of an Allowance given as minutes and seconds ("3 m 40 s" = 220). */
export function allowanceSeconds(minutes?: string, seconds?: string): number {
  const m = Number((minutes ?? '').trim() || 0), s = Number((seconds ?? '').trim() || 0);
  return Number.isFinite(m) && Number.isFinite(s) ? Math.round(m * 60 + s) : NaN;
}

/**
 * Build the `ta.request` action from what is typed in a form, or say what is wrong (TAF-001, TAF-003). Web: a request needs an Allowance above zero and the two instruction numbers; the
 * password, when typed, is four digits; there is no witness. Paper: the request type decides: a Formal Problem Resolution Request asks no allowance (30 s are added to the stage score),
 * the others need minutes and seconds and the instruction numbers; the "Witnessed by" rows, the status and the circumstances travel with it.
 */
export function buildTaRequest(mode: TaFormMode, v: TaFormValues): { action: TaRequestAction } | { error: string } {
  const type: TaRequestType = mode === 'paper' ? (v.type ?? 'time-allowance') : 'time-allowance';
  const seconds = allowanceSeconds(v.minutes, v.seconds);
  const from = Math.round(Number(v.from)), to = Math.round(Number(v.to));
  const formal = type === 'formal-problem';
  if (!formal) {
    if (!(seconds > 0)) return { error: 'Fill in the Allowance (minutes and seconds)' };
    if (!(from >= 1) || !(to >= from)) return { error: 'Fill in the two instruction numbers the delay happened between' };
  }
  if (mode === 'web' && (v.password ?? '') !== '' && !/^\d{4}$/.test(v.password!.trim())) return { error: 'The password is four digits' };
  const asNum = (t: string | undefined): number | undefined => { const x = (t ?? '').trim(); return x !== '' && Number.isFinite(Number(x)) ? Number(x) : undefined; };
  const reasonText = mode === 'paper' ? (v.circumstances ?? '') : (v.reason ?? '');
  const witnessedBy = mode === 'paper' ? (v.witnesses ?? []).filter(w => (w.car !== undefined && String(w.car).trim() !== '') || (w.description ?? '').trim() !== '').slice(0, 4) : [];
  const note = formal ? `Formal Problem Resolution Request${reasonText.trim() ? `: ${reasonText.trim()}` : ''}.`
    : `${taNoteText({ delay: v.delay ?? 0, madeUp: v.madeUp ?? 0, request: seconds, cause: reasonText.replace(/^delayed by\s+/i, '') })}${witnessedBy.length ? ` Witnessed by ${taWitnessRowsText(witnessedBy)}.` : ''}`;
  const action: TaRequestAction = {
    type: 'ta.request', legIndex: v.leg, seconds: formal ? 0 : seconds, fromLine: formal ? Math.max(1, from || 1) : from, toLine: formal ? Math.max(1, to || from || 1) : to, note,
    ...(asNum(v.car) !== undefined ? { carNumber: asNum(v.car) } : {}),
    ...(mode === 'web' && (v.password ?? '').trim() ? { password: v.password!.trim() } : {}), ...(mode === 'web' && (v.phone ?? '').trim() ? { phone: v.phone!.trim() } : {}),
    ...(asNum(v.stage) !== undefined ? { stage: asNum(v.stage) } : {}),
    ...(reasonText.trim() ? { cause: taCauseId(reasonText) } : {}),
    ...(mode === 'paper' ? { requestType: type, ...(v.status ? { contestantStatus: v.status } : {}), ...(reasonText.trim() ? { circumstances: reasonText.trim().slice(0, 600) } : {}), ...(witnessedBy.length ? { witnessedBy } : {}) } : {}),
  };
  return { action };
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
  /** PLAY-032: the navigator's own lapped delay (the stopwatch), when there is one */
  own?: number | null;
}
/** PLAY-032: the delay the navigator's own stopwatch shows: the reading of a stopped watch, else the last lap split. */
export function ownLappedDelay(sw: { running: boolean; reading: number; laps: number[] } | null | undefined): number | null {
  if (!sw) return null;
  if (!sw.running && sw.reading > 0) return sw.reading;
  const l = sw.laps.length ? sw.laps[sw.laps.length - 1]! - (sw.laps.length > 1 ? sw.laps[sw.laps.length - 2]! : 0) : null;
  return l !== null && l > 0 ? l : null;
}
export function taHelper(advice: { measuredDelay: number; measured?: number; stoppedSeconds?: number; chartLoss?: number; otherDelay?: number; makeUpToRound?: number; claim?: number; suggested?: number } | null | undefined, ownWatch: number | null = null): TaHelper {
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
  // PLAY-032: at Bronze the worksheet puts the navigator's own lapped delay beside the engine's number
  const own = ownWatch !== null && Number.isFinite(ownWatch) && ownWatch > 0 ? Math.round(ownWatch) : null;
  const ownText = own === null ? '' : `Your watch ${formatInterval(own)} beside the engine's ${formatInterval(measured)}${Math.abs(own - measured) > 2 ? ` (off by ${Math.abs(own - measured)} s: start the watch when the car is held and stop it when it is back at speed)` : ' (agrees)'}. `;
  const text = ownText + (measured <= 0 ? 'No delay measured: nothing to claim.' : (makeUp === 0 ? `${parts}; already a multiple of 10 s, claim ${formatInterval(claim)}.` : `${parts}; make up the odd ${makeUp} s, claim ${formatInterval(claim)}.`) + denied);
  return { measured, stopped, chartLoss, makeUp, claim, text, own };
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

/** ENG-028: the Stage number the book's TA rows print ("Today is Stage N.", REG Example #18 / #36): the web form's Stage field starts with it. */
export function taStageOf(book: readonly { taPoint?: { stage?: number } }[] | null | undefined): string { const st = (book ?? []).find(i => i.taPoint?.stage !== undefined)?.taPoint?.stage; return st === undefined ? '' : String(st); }
