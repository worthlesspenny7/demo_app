/**
 * V3 view-models (UI-037): what the rally school videos add to the cockpit. Pure functions, no DOM.
 *  - launchPlan / startLaunchFor: "your time HH:MM:SS, launch at HH:MM:SS (minus N s)" (START-001)
 *  - startCount: the 30-second warning and the count whose last beat lands on the launch second (START-001)
 *  - makeUpPlan: the 10 % / 20 % options and the "drop at the next sign" reminder (MAKEUP-001)
 *  - scheduleCorrection: "1 s per N minutes" for a stock speedometer (CAL-006)
 *  - inCalibrationRun: no pace bar, no early/late cue in the calibration section (CAL-006)
 *  - nextCallPrompt: the rung >= 2 "next call" reminder (PROTO-001)
 *  - driverLineKind: the driver's new lines: I see it too, mark, holding 35, the count echo (PROTO-001)
 *  - v3Findings: one-minute mistake, timed interval disturbed and late launch, listed separately (INST-002, MAKEUP-001, START-001)
 * Engine names that the core agent adds (launch times, pace cars, findings) are read with feature detection, so the UI compiles and degrades
 * gracefully against an engine that does not have them yet.
 */
import type { Scenario, Instruction } from '../../core/course.js';
import { transitPaceMph } from '../../core/course.js';
import { accelLoss } from '../../core/perf-table.js';
import { formatClock } from '../../core/units.js';
import { formatInterval } from '../../core/griid.js';
import { lineSpeeds } from './cockpitinfo.js';
import { makeUpPlan as coreMakeUpPlan, scheduleCorrectionMinutes } from '../../core/ledger.js';

const r1 = (x: number): number => Math.round(x * 10) / 10;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

// ---------- START-001: your time, launch time, the warning and the count ----------

export interface LaunchPlan {
  /** Your time: the second the car must be at speed (base + position minutes). */
  yourTime: number;
  /** The car's standing-start net loss in seconds (chart (a), 0 -> v), as measured. */
  loss: number;
  /** Whole seconds you launch early. */
  minus: number;
  launchTod: number;
  /** "your time 09:32:00, launch at 09:31:57 (minus 3 s)" */
  text: string;
}

/** Launch at your own time minus the standing-start net loss, to whole seconds (HB p.7, Starting on Time [03:41]). */
export function launchPlan(yourTime: number, loss: number): LaunchPlan {
  const l = isNum(loss) && loss > 0 ? loss : 0;
  const minus = Math.max(0, Math.round(l));
  const launchTod = Math.floor(yourTime) - minus;
  return { yourTime, loss: r1(l), minus, launchTod, text: `your time ${formatClock(yourTime)}, launch at ${formatClock(launchTod)} (minus ${minus} s)` };
}

/** The plan for a start or restart book line, from the car's chart (a); null when the line is not a start/restart with a time. */
export function startLaunchFor(sc: Pick<Scenario, 'book' | 'car'>, line: number): LaunchPlan | null {
  const ins = sc.book[line - 1];
  if (!ins || ins.restartTime === undefined || !(ins.section === 'start' || ins.section === 'restart' || ins.baseTime !== undefined)) return null;
  const vOut = ins.speed ?? transitPaceMph(ins.transit) ?? lineSpeeds(sc as Scenario, line).vOut ?? 30; // PLAY-009: the engine's launch speed rule
  let loss = 0; try { loss = accelLoss(vOut, sc.car); } catch { loss = 0; }
  return launchPlan(ins.restartTime, loss);
}

export type CountPhase = 'idle' | 'warning' | 'counting' | 'go' | 'done';
export interface StartCountVm {
  active: boolean;
  phase: CountPhase;
  /** Seconds to the launch second (negative after it). */
  secondsLeft: number;
  /** The 30-second warning banner is up: from 30 s before the launch until the launch. */
  warning: boolean;
  banner: string | null;
  /** The visible count: 10 ... 1, then 0 = GO on the launch second. Null before the count starts and after GO has been shown. */
  beat: number | null;
  beatText: string | null;
}
export const WARNING_SECONDS = 30;
export const COUNT_FROM = 10;
export const GO_HOLD_SECONDS = 2;

/**
 * "About 30 seconds" warning, then a visible count whose last beat (GO) lands exactly on the launch second:
 * beat n starts at launch - n s, so the count reads 10 at launch - 10, 1 at launch - 1 and GO at the launch second.
 */
export function startCount(now: number, launchTod: number | null | undefined): StartCountVm {
  const idle: StartCountVm = { active: false, phase: 'idle', secondsLeft: Number.POSITIVE_INFINITY, warning: false, banner: null, beat: null, beatText: null };
  if (!isNum(now) || !isNum(launchTod)) return idle;
  const left = r3(launchTod - now);
  if (left > WARNING_SECONDS) return { ...idle, secondsLeft: left };
  if (left <= -GO_HOLD_SECONDS) return { ...idle, phase: 'done', secondsLeft: left };
  if (left <= 0) return { active: true, phase: 'go', secondsLeft: left, warning: false, banner: null, beat: 0, beatText: 'GO' };
  const beat = Math.ceil(left - 1e-9);
  if (left <= COUNT_FROM) return { active: true, phase: 'counting', secondsLeft: left, warning: true, banner: warningText(launchTod), beat, beatText: String(beat) };
  return { active: true, phase: 'warning', secondsLeft: left, warning: true, banner: warningText(launchTod), beat: null, beatText: null };
}
function warningText(launchTod: number): string { return `About 30 seconds: tell the driver. Launch at ${formatClock(launchTod)}; the last count lands on that second.`; }
const r3 = (x: number): number => Math.round(x * 1000) / 1000;

// ---------- MAKEUP-001: the make-up options ----------

export interface MakeUpOption {
  pct: 10 | 20;
  /** The speed to hold, one decimal: 38.5 for +10 % at 35. */
  mph: number;
  /** Seconds to hold it to clear what is owed: 10 x owed at +10 %, 5 x owed at +20 %. */
  seconds: number;
  /** Seconds gained per minute of driving at that speed: 6 and 12. */
  perMinute: number;
  /** "+10 %: 38.5 mph for 40 s (6 s per minute)" */
  text: string;
}
export interface MakeUpChunk { minutes: number; gain10: number; gain20: number }
export interface MakeUpVm {
  /** Seconds still owed (late, positive) or to lose (early, negative); 0 when the ledger is clear or not set. */
  owed: number;
  /** late: drive over; early: drive under (the same numbers, below the assigned speed). */
  direction: 'over' | 'under' | 'none';
  assigned: number | null;
  options: MakeUpOption[];
  chunks: MakeUpChunk[];
  /** "Drop the extra speed at the next speed-change sign, then re-apply." */
  dropReminder: string;
  /** Shown when the ledger is open and the car is inside a stopwatch-timed interval: do not make up here. */
  timedWarning: string | null;
  /** A printed pause can be shortened: "shorten this stop by up to 9 s". */
  stopShortening: string | null;
  text: string;
}
export const DROP_REMINDER = 'Drop the extra speed at the next speed-change sign, then re-apply it at the new assigned speed.';
export const TIMED_WARNING = 'Timed interval: do not make up time inside it. Hold the speed and let the interval finish.';

export function makeUpOptions(owed: number, assigned: number): MakeUpOption[] {
  const e = Math.abs(owed);
  const core = coreMakeUpPlan(e, assigned);   // the engine's own arithmetic: +10 % for 10 x the seconds, +20 % for 5 x
  return ([10, 20] as const).map(pct => {
    const o = pct === 10 ? core.plus10 : core.plus20;
    const mph = owed < 0 ? r1(assigned * (1 - pct / 100)) : o.mph;
    const seconds = o.seconds;
    const perMinute = pct === 10 ? 6 : 12;
    return { pct, mph, seconds, perMinute, text: `${owed < 0 ? '-' : '+'}${pct} %: ${mph} mph for ${seconds} s (${perMinute} s per minute)` };
  });
}

/** The ledger's make-up panel: running total, the 10 % and 20 % options in mph and seconds, chunk table, the drop-at-the-next-sign reminder. */
export function makeUpPlan(owed: number | null | undefined, assigned: number | null | undefined, opts: { inTimedInterval?: boolean; pause?: number | null } = {}): MakeUpVm {
  const o = isNum(owed) && Math.abs(owed) >= 0.5 ? owed : 0;
  const a = isNum(assigned) && assigned > 0 ? assigned : null;
  const options = o !== 0 && a !== null ? makeUpOptions(o, a) : [];
  const chunks = [1, 2, 3, 5].map(m => ({ minutes: m, gain10: 6 * m, gain20: 12 * m }));
  const direction: MakeUpVm['direction'] = o > 0 ? 'over' : o < 0 ? 'under' : 'none';
  const timedWarning = o !== 0 && opts.inTimedInterval ? TIMED_WARNING : null;
  const stop = o > 0 && isNum(opts.pause) && opts.pause > 1 ? `A printed pause can be shortened: leave ${Math.min(Math.round(o), Math.round(opts.pause) - 1)} s early and the stop pays it back (1 s of a 10 s pause gains 9 s).` : null;
  const text = o === 0 ? 'Nothing owed: stay on the assigned speed.' : `${o > 0 ? 'Owed' : 'Early by'} ${formatInterval(Math.abs(Math.round(o)))}${options.length ? `. ${options.map(x => x.text).join('; ')}` : ''}`;
  return { owed: o, direction, assigned: a, options, chunks, dropReminder: DROP_REMINDER, timedWarning, stopShortening: stop, text };
}

/** The assigned speed in force after a book line (what the car holds between lines). */
export function assignedAfter(sc: Pick<Scenario, 'book'>, lastExecutedLine: number | null | undefined): number | null {
  const n = isNum(lastExecutedLine) && lastExecutedLine >= 1 ? lastExecutedLine : 1;
  return lineSpeeds(sc as Scenario, n).vOut;
}

/**
 * True while a stopwatch-timed hold is running: the last node the car crossed carries a timed segment (hold N s, then change) and fewer than N seconds
 * have passed since (a printed pause before it moves the start; the interval counts from the car's departure, so this is conservative by the pause).
 */
export function inTimedInterval(sc: Pick<Scenario, 'book'>, events: { tod: number; type: string; detail?: Record<string, unknown> }[] | null | undefined, tod: number): boolean {
  const evs = Array.isArray(events) ? events : [];
  for (let i = evs.length - 1; i >= 0; i--) {
    const e = evs[i]!; if (e.type !== 'node') continue;
    const ins = sc.book.find(b => b.nodeId === e.detail?.['nodeId']);
    if (!ins) continue;
    return !!ins.timed && tod - e.tod < ins.timed.seconds + (ins.pause ?? 0);
  }
  return false;
}

// ---------- CAL-006: calibration ----------

export interface ScheduleCorrection {
  /** Seconds per hour: the error x 3600 / run seconds ("double the error on a 28 minute run"). */
  perHour: number;
  /** One second every N minutes (null when there is no error). */
  everyMinutes: number | null;
  /** "1 s per 5 min" */
  text: string;
  /** Timewise clicks = error s/h x factor / 3600, when a factor is given. */
  clicks: number | null;
}
/** The stock-speedometer alternative to adjusting: a schedule correction from the measured error (2024 Training Session [90:59]). */
export function scheduleCorrection(errorSeconds: number, runMinutes: number, factor?: number): ScheduleCorrection {
  if (!isNum(errorSeconds) || !isNum(runMinutes) || runMinutes <= 0 || errorSeconds === 0) return { perHour: 0, everyMinutes: null, text: 'No error: no correction needed.', clicks: null };
  const perHour = r1(errorSeconds * 3600 / (runMinutes * 60));
  const every = scheduleCorrectionMinutes(errorSeconds, runMinutes * 60) ?? r1(runMinutes / Math.abs(errorSeconds));
  const late = errorSeconds > 0;
  const clicks = isNum(factor) && factor > 0 ? Math.round(Math.abs(perHour) * factor / 3600 * 10) / 10 : null;
  return { perHour, everyMinutes: every, clicks, text: `${late ? 'late' : 'early'} ${Math.abs(errorSeconds)} s in ${r1(runMinutes)} min = ${Math.abs(perHour)} s per hour: ${late ? 'gain' : 'lose'} 1 s per ${every} min` };
}

/** True while the car is working the speedometer calibration run: no pace bar, no early/late cue, no feedback to the driver (CAL-006). */
export function inCalibrationRun(sc: Pick<Scenario, 'book'>, lastExecutedLine: number | null | undefined, currentLine?: number | null): boolean {
  const book = sc.book ?? [];
  const cal = (i: Instruction | undefined): boolean => !!i && i.section === 'calibration';
  // the run starts once its begin line has been executed and ends with the last calibration point
  if (isNum(lastExecutedLine) && lastExecutedLine >= 1) return cal(book[lastExecutedLine - 1]) && cal(book[lastExecutedLine]);
  void currentLine;
  return false;
}

// ---------- PROTO-001: the driver's lines and the next-call prompt ----------

export type DriverLineKind = 'confirm' | 'mark' | 'holding' | 'count' | 'readback' | 'question' | 'info';
/** Classify a driver message for the log (the core sets `kind` for its new lines; the text decides when it does not). */
export function driverLineKind(m: { text: string; kind?: string }): DriverLineKind {
  const k = (m.kind ?? '').toLowerCase();
  if (k === 'confirm' || k === 'mark' || k === 'holding' || k === 'count' || k === 'question') return k;
  const t = (m.text ?? '').trim();
  if (/\bI see it too\b/i.test(t)) return 'confirm';
  if (/^mark\b/i.test(t)) return 'mark';
  if (/\bholding\s+\d/i.test(t)) return 'holding';
  if (/^-?\d+[.!]?$/.test(t) || /^(keep counting|\d+\s*(,|\.\.\.|…)|counting)/i.test(t) || /\bcount(ing)?\b/i.test(t)) return 'count';   // the engine echoes each number of the navigator's count as a bare digit
  if (k === 'readback') return 'readback';
  if (k === 'question') return 'question';
  return 'info';
}
export const DRIVER_KIND_LABEL: Record<DriverLineKind, string> = { confirm: 'confirm', mark: 'mark', holding: 'holding', count: 'count', readback: 'read-back', question: 'question', info: '' };

const TURN_WORDS: Record<string, string> = { L: 'turn left', R: 'turn right', S: 'straight', BL: 'bear left', BR: 'bear right', AL: 'acute left', AR: 'acute right', JL: 'jog left', JR: 'jog right' };
/** The rung >= 2 reminder of the next call, in the call pattern of the team protocol: "Next: STOP sign, turn right, 35 after." */
export function nextCallPrompt(sc: Pick<Scenario, 'book' | 'course'>, lastExecutedLine: number | null | undefined, rung: number): string | null {
  if (rung < 2) return null;
  const n = (isNum(lastExecutedLine) ? lastExecutedLine : 0) + 1;
  const ins = sc.book[n - 1]; if (!ins || ins.omitted) return null;
  const node = sc.course.nodes.find(x => x.id === ins.nodeId);
  const bits: string[] = [];
  const ctl = node?.control && node.control !== 'none' ? node.control : null;
  if (ctl === 'STOP') bits.push('STOP sign'); else if (ctl === 'YIELD') bits.push('yield'); else if (ctl === 'SIGNAL') bits.push('signal'); else if (ctl === 'BLINKER') bits.push('blinker'); else if (ctl === 'RR') bits.push('railroad crossing');
  else if (node?.sign?.text) bits.push(`sign "${node.sign.text}"`); else if (node?.kind === 'landmark' && node.label) bits.push(node.label);
  if (ins.turn && ins.turn !== 'S') bits.push(TURN_WORDS[ins.turn] ?? ins.turn);
  if (ins.timed) bits.push(`${ins.timed.holdSpeed} for ${formatInterval(ins.timed.seconds)} then ${ins.timed.thenSpeed}`);
  else if (typeof ins.speed === 'number' && ins.speed > 0) bits.push(`${ins.speed} after`);
  if (ins.pause) bits.push(`pause ${ins.pause}`);
  if (ins.remark) bits.push(`(${ins.remark.toLowerCase()})`);
  if (!bits.length) bits.push(ins.text.slice(0, 60));
  return `Line ${ins.printed ?? n}, next call: ${bits.join(', ')}.`;
}

// ---------- debrief findings (INST-002, MAKEUP-001, START-001) ----------

export type V3FindingKind = 'oneMinuteMistake' | 'timedIntervalDisturbed' | 'lateLaunch' | 'earlyLaunch';
export interface V3Finding { kind: V3FindingKind; line: number | null; text: string }
export interface V3FindingsVm {
  oneMinuteMistake: V3Finding[];
  timedIntervalDisturbed: V3Finding[];
  lateLaunch: V3Finding[];
  earlyLaunch: V3Finding[];
  /** All findings of the three kinds, in the order above. */
  all: V3Finding[];
  /** The other instrument findings (clock for time of day, interval off the clock, ...) stay with WATCH-009. */
  other: { kind: string; line: number; text: string }[];
  summary: string;
}
export const V3_KINDS: V3FindingKind[] = ['oneMinuteMistake', 'timedIntervalDisturbed', 'lateLaunch', 'earlyLaunch'];
export const V3_LABEL: Record<V3FindingKind, string> = {
  oneMinuteMistake: 'One-minute mistake',
  timedIntervalDisturbed: 'Timed interval disturbed',
  lateLaunch: 'Late launch',
  earlyLaunch: 'Early launch',
};
export const V3_NONE: Record<V3FindingKind, string> = {
  oneMinuteMistake: 'No restart was left on the wrong minute.',
  timedIntervalDisturbed: 'No time was made up inside a stopwatch-timed interval.',
  lateLaunch: 'Every start and restart launched on its launch second.',
  earlyLaunch: 'No start or restart was launched before its launch second.',
};
const FALLBACK_TEXT: Record<V3FindingKind, string> = {
  oneMinuteMistake: 'Left a restart on the wrong minute: the clock\'s loose minute hand was read near the top of a minute. Read the minute on the stopwatch in TOD mode.',
  timedIntervalDisturbed: 'Made up time inside a stopwatch-timed interval: it disturbs the interval you are already holding.',
  lateLaunch: 'Launched after the launch second: leave your own time minus the car\'s standing-start loss.',
  earlyLaunch: 'Launched before the launch second: leaving early costs the same as leaving late.',
};

interface RawFinding { kind?: unknown; line?: unknown; text?: unknown; seconds?: unknown }
function asList(x: unknown): RawFinding[] { return Array.isArray(x) ? (x as RawFinding[]).filter(f => f && typeof f === 'object') : []; }

/**
 * Pull the three V3 finding kinds out of a stage result. The engine may carry them in `instrumentDiscipline` (with a `kind`), in a
 * `findings` / `startFindings` array, or under one named field per kind; all are read, so the debrief lists them separately either way.
 */
export function v3Findings(result: unknown): V3FindingsVm {
  const r = (result ?? {}) as Record<string, unknown>;
  const out: Record<V3FindingKind, V3Finding[]> = { oneMinuteMistake: [], timedIntervalDisturbed: [], lateLaunch: [], earlyLaunch: [] };
  const other: V3FindingsVm['other'] = [];
  const seen = new Set<string>();
  const add = (kind: V3FindingKind, f: RawFinding | null): void => {
    const line = isNum(f?.line) ? f!.line as number : null;
    const text = typeof f?.text === 'string' && f.text ? f.text : FALLBACK_TEXT[kind];
    const key = `${kind}|${line}|${text}`; if (seen.has(key)) return; seen.add(key);
    out[kind].push({ kind, line, text });
  };
  const lists = [asList(r['instrumentDiscipline']), asList(r['findings']), asList(r['startFindings']), asList(r['v3Findings'])];
  for (const list of lists) for (const f of list) {
    const kind = String(f.kind ?? '');
    if ((V3_KINDS as string[]).includes(kind)) add(kind as V3FindingKind, f);
    else if (list === lists[0]) other.push({ kind, line: isNum(f.line) ? f.line : 0, text: String(f.text ?? '') });
  }
  for (const kind of V3_KINDS) {
    const v = r[kind] ?? r[`${kind}s`];
    if (Array.isArray(v)) for (const f of asList(v)) add(kind, f);
    else if (v === true) add(kind, null);
    else if (isNum(v) && v > 0) for (let i = 0; i < v; i++) add(kind, { text: `${FALLBACK_TEXT[kind]}${i ? ` (${i + 1})` : ''}` });
  }
  const all = V3_KINDS.flatMap(k => out[k]);
  const summary = all.length === 0 ? 'No one-minute mistake, no disturbed timed interval, no late or early launch.' : V3_KINDS.filter(k => out[k].length).map(k => `${V3_LABEL[k]} x${out[k].length}`).join(', ');
  return { ...out, all, other, summary };
}

// ---------- START-002: pace cars ----------

export interface PaceCar { side: 'ahead' | 'behind'; /** feet from our car (always positive) */ distanceFt: number; label: string; offsetSeconds: number }
/**
 * The cars one minute ahead and one minute behind (START-002), from `observe().paceCars` = { ahead, behind }, each {offsetSeconds, distanceFt} or null.
 * The seeded error of each car stays hidden: the player judges by whether the car ahead is being run down ("gaining on them").
 */
export function paceCarsFrom(obs: unknown): PaceCar[] {
  const pc = ((obs ?? {}) as Record<string, unknown>)['paceCars'] as Record<string, unknown> | null | undefined;
  const cars: PaceCar[] = [];
  if (!pc || typeof pc !== 'object') return cars;
  for (const side of ['ahead', 'behind'] as const) {
    const c = pc[side] as Record<string, unknown> | null | undefined;
    if (!c || typeof c !== 'object' || !isNum(c['distanceFt'])) continue;
    cars.push({ side, distanceFt: Math.abs(c['distanceFt'] as number), offsetSeconds: isNum(c['offsetSeconds']) ? (c['offsetSeconds'] as number) : side === 'ahead' ? -60 : 60, label: side === 'ahead' ? 'car one minute ahead' : 'car one minute behind' });
  }
  return cars;
}

// ---------- START-001: the queue at the sign ----------

export interface StartQueueVm { state: 'none' | 'waiting' | 'sitting' | 'clear' | 'pulledUp'; text: string; canPullUp: boolean }
/**
 * Nobody releases you: the cars queued at the sign leave on their own minute and you pull up only when the car ahead has gone; if it sits there, go around it.
 * `q` is observe().startQueue; `tod` the current time of day; the clock times are shown only at aids rung >= 2.
 */
export function startQueueVm(q: { carAheadAtSign?: boolean; carAheadLeavesTod?: number | null; pulledUp?: boolean; cars?: { relative?: string; sitting?: boolean; atSign?: boolean }[] } | null | undefined, tod: number, rung: number): StartQueueVm {
  if (!q) return { state: 'none', text: '', canPullUp: false };
  if (q.pulledUp) return { state: 'pulledUp', text: 'Pulled up to the sign: hold until your launch time. Nobody releases you.', canPullUp: false };
  if (q.carAheadAtSign) {
    const at = isNum(q.carAheadLeavesTod) ? q.carAheadLeavesTod : null;
    const sitting = !!q.cars?.some(c => c.relative === 'ahead' && c.sitting) || (at !== null && tod > at + 5);
    if (sitting) return { state: 'sitting', text: 'The car ahead is sitting at the sign and has missed its minute: pull up around it and leave on your own minute.', canPullUp: true };
    return { state: 'waiting', text: `The car ahead is still at the sign${rung >= 2 && at !== null ? ` (it leaves at ${formatClock(at)})` : ''}: wait until it leaves on its minute, then pull up (Q). Never a minute early.`, canPullUp: false };
  }
  return { state: 'clear', text: 'The car ahead has left: pull up to the sign (Q) and wait for your launch time.', canPullUp: true };
}

// ---------- START-001: the launch info the engine reports ----------

/** observe().launch (LaunchInfo): own time, net loss, launch time. The plan is shown to the whole second, as the count runs. */
export function launchPlanFromInfo(info: { ownTime: number; netLoss: number; launchTime?: number } | null | undefined): LaunchPlan | null {
  if (!info || !isNum(info.ownTime)) return null;
  // PLAY-009: the engine's launch second is authoritative (own time minus the net loss rounded to the second)
  if (isNum(info.launchTime)) { const p = launchPlan(info.ownTime, info.ownTime - info.launchTime); return { ...p, loss: isNum(info.netLoss) ? r1(info.netLoss) : p.loss }; }
  return launchPlan(info.ownTime, isNum(info.netLoss) ? info.netLoss : 0);
}

export interface StartDeltaRow { line: number; kind: string; text: string; delta: number | null; flagged: boolean }
/** The starts and restarts against their launch times (result.startDeltas): "line 1 start: own 09:32:00, launch 09:31:57, left 09:31:58 (+1.0 s)". */
export function startDeltaRows(result: unknown): StartDeltaRow[] {
  const list = ((result ?? {}) as Record<string, unknown>)['startDeltas'];
  if (!Array.isArray(list)) return [];
  return (list as Record<string, unknown>[]).filter(d => d && typeof d === 'object' && isNum(d['line'])).map(d => {
    const own = isNum(d['ownTime']) ? formatClock(d['ownTime'] as number) : '?'; const launch = isNum(d['launchTime']) ? formatClock(Math.round(d['launchTime'] as number)) : '?';   // to the whole second, as the start card shows it
    const actual = isNum(d['actual']) ? formatClock(d['actual'] as number) : 'did not leave';
    const delta = isNum(d['delta']) ? (d['delta'] as number) : null;
    return { line: d['line'] as number, kind: String(d['kind'] ?? 'start'), delta, flagged: delta === null || Math.abs(delta) > 1.5,
      text: `line ${d['line']} ${d['kind'] ?? 'start'}: own time ${own}, launch ${launch}, left ${actual}${delta === null ? '' : ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)} s)`}${d['warned'] === false ? ', no warning to the driver' : ''}` };
  });
}
