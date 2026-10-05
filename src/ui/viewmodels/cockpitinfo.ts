/**
 * Cockpit information policy and the perf card (UI-014..UI-017). Pure functions, no DOM.
 *  - one turn-capped stop loss shared by the book strip, the perf card and the Debrief (PT-03 W1)
 *  - which line the card shows (stopped line first, then the book pointer)
 *  - what the legal (aids rung <= 1) cockpit hides: digital readouts and the computed answer card
 */
import type { Scenario, Instruction, AidsConfig } from '../../core/course.js';
import { transitPaceMph, isMeasureRun, timedFinalSpeed } from '../../core/course.js';
import { stopLoss, chartLead, accelLoss, turnLoss, buildPerfTable } from '../../core/perf-table.js';
import { formatClock } from '../../core/units.js';
import { formatInterval } from '../../core/griid.js';
import { exactTransitBegin } from '../../core/ghost.js';
import { chartStopLoss, stopChartReading, tenPercentRule } from './charts.js';
import { turnCap } from './counterfactual.js';
import { aidsRung } from './debrief.js';

export interface InstrumentPolicy {
  rung: 0 | 1 | 2 | 3;
  /** Numeric clock / stopwatch / speedo captions and road-view feet labels. False in legal mode. */
  digitalReadouts: boolean;
  /** Computed per-line answers (card dwell, ramp lead, loss). False in legal mode: the player's own annotations only. */
  computedCard: boolean;
  /**
   * PT-10 (N-C7): the card PRINTS the dwell and the call times only at Bronze (rung 3). At Silver (rung 2) the card shows the chart and the player does the
   * arithmetic (dwell = pause - Dec(in) - Acc(out) from the simple chart; the call = the timed seconds minus the ramp lead).
   */
  printsTimes: boolean;
}
export function instrumentPolicy(aids: AidsConfig | null | undefined): InstrumentPolicy {
  const rung = aidsRung(aids);
  return { rung, digitalReadouts: rung >= 2, computedCard: rung >= 2, printsTimes: rung >= 3 || (rung === 2 && aids?.printsTimes === true) };
}

/** The D06 tag at Silver and Gold: the car's own numbers are what the player measures, so no chart of this car is shown anywhere (PT-10 N-C1). Bronze copies the printed Packard charts. */
export const CHARTS_HIDDEN_TAG = 'charts:hidden';
export function chartsHidden(sc: { tags?: string[] } | null | undefined): boolean { return !!sc?.tags?.includes(CHARTS_HIDDEN_TAG); }
/** What the chart overlay and the perf card's simple chart say instead of the car's numbers when they are hidden. */
export const HIDDEN_CHARTS_TEXT = "Your car's chart is what you measure today: Silver and Gold hide the car's numbers. Read the pace aid at each MARK and build the chart from the net.";
/** PT-11 N-D8: the line card under a hidden car: no number, and not the chart box's sentence a second time. */
export const HIDDEN_CAR_LINE_TEXT = 'No car numbers on this line: drive it as a measuring run and note the net from the MARK readings.';

/** Ledger-box pace aid text (N11): while the car waits at a restart line (D16 hold) the early/late number is meaningless, so show no number. */
export function paceAidText(earlyLate: number, waitReason: string | null | undefined): string {
  if (waitReason === 'hold') return 'holding for restart';
  return `${earlyLate > 0 ? '+' : ''}${earlyLate.toFixed(1)} s`;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Assigned speed before and after a book line. */
export function lineSpeeds(sc: Scenario, line: number): { vIn: number | null; vOut: number | null } {
  let v: number | null = null;
  for (const ins of sc.book) {
    const vIn = v;
    if (ins.timed) v = ins.timed.holdSpeed; else if (typeof ins.speed === 'number') v = ins.speed;
    if (ins.n === line) return { vIn, vOut: v };
    if (ins.timed) v = timedFinalSpeed(ins.timed);
  }
  return { vIn: null, vOut: null };
}

export interface StopCard {
  line: number; pause: number; vIn: number; vOut: number; loss: number; dwell: number; cap: number | undefined;
  /** UI-030: the pause time read straight from chart (b) (a 15 s stop) and the sit time for this printed pause; null for a stop at a turn (the turn-capped model number is used). */
  chart: { chart: number; sit: number } | null;
}

/** Stop loss for a line, turn-capped exactly as the Debrief does. Null when the line has no usable exit speed. */
export function stopCardFor(sc: Scenario, line: number): StopCard | null {
  const ins = sc.book[line - 1]; if (!ins) return null;
  const { vIn, vOut } = lineSpeeds(sc, line);
  if (!vOut) return null;
  const vi = vIn && vIn > 0 ? vIn : vOut;
  const cap = turnCap(ins.turn, sc);
  let loss: number;
  try { loss = chartStopLoss(sc.car, vi, vOut, cap); } catch { return null; }
  const pause = ins.pause ?? 0;
  let chart: StopCard['chart'] = null;
  if (cap === undefined) { try { const rd = stopChartReading(sc.car, vi, vOut, pause || 15); chart = { chart: rd.chart, sit: rd.sit }; } catch { chart = null; } }
  return { line, pause, vIn: vi, vOut, loss, dwell: r1(Math.max(0, pause - loss)), cap, chart };
}

/** "card x s" for the book strip: pause minus turn-capped loss. */
export function cardDwell(sc: Scenario, line: number): number | null {
  const ins = sc.book[line - 1]; if (!ins?.pause) return null;
  return stopCardFor(sc, line)?.dwell ?? null;
}

/** Seconds still to wait at a stop: card dwell minus the dwell so far (negative = go now / overdue). */
export function waitMore(card: StopCard | null, dwellSoFar: number): number | null {
  return card ? r1(card.dwell - dwellSoFar) : null;
}

/** "RESTART at 10:43:00" for restart lines, else null. */
export function restartLabel(ins: Instruction | undefined | null): string | null {
  return ins && ins.section === 'restart' && ins.restartTime !== undefined ? `RESTART at ${formatClock(ins.restartTime)}` : null;
}
export function isRestartLine(sc: Scenario, line: number): boolean { return restartLabel(sc.book[line - 1]) !== null; }
export function restartLines(sc: Scenario): { line: number; label: string }[] {
  return sc.book.map(i => ({ line: i.n, label: restartLabel(i) })).filter((x): x is { line: number; label: string } => x.label !== null);
}

/** Which line the book/perf card should show: the stopped line first, then the pointer; at rung >= 1 the pointer is last executed + 1. */
export function focusLine(o: { stoppedAtLine?: number | null; currentLine: number; driver: { lastExecutedLine: number | null } }, rung: number, bookLength: number): { line: number; stopped: boolean } {
  if (o.stoppedAtLine) return { line: o.stoppedAtLine, stopped: true };
  const le = o.driver.lastExecutedLine;
  if (rung >= 1 && le !== null && le !== undefined) return { line: Math.min(bookLength, Math.max(1, le + 1)), stopped: false };
  return { line: o.currentLine, stopped: false };
}

export interface PerfCard {
  line: number; text: string;
  /** 'answers' = computed from the car; 'own' = legal mode: only what the player wrote. */
  mode: 'answers' | 'own';
  stop?: StopCard;
  stopNoPause?: { loss: number };
  timed?: { hold: number; seconds: number; then: number; lead: number; call: number;
    /** N5: a STOP + timed line: the count starts when the ghost leaves (arrival + pause), i.e. `afterStopped` s after the car stops, not at your go */
    fromGhost?: { pause: number; afterStopped: number; callAfterStopped: number } };
  speedChange?: { from: number; to: number; lead: number; ft: number };
  start?: { speed: number; early: number };
  restart?: { label: string; accel: number | null };
  /** PLAY-002: a transit / warm-up line that prints no speed: the suggested pace = printed miles / printed minutes. */
  transitPace?: { mph: number; miles: number; minutes: number; text: string };
  /** Non-stop turn loss (seconds the car loses slowing for the turn and re-accelerating), from the car's performance table. */
  turnLoss?: TurnLossBlock;
  /** PLAY-027: a measuring run (D06): no launch lead and no early call on the card, only this line */
  measure?: string;
  /** PT-10 N-C1: the scenario hides the car's numbers (D06 Silver / Gold): no stop, turn or ramp numbers of this car are on the card */
  hiddenCar?: boolean;
  /** PT-10 N-C7: Silver prints no dwell and no call times: the card names what to work out from the simple chart instead */
  withheld?: boolean;
}
/** PLAY-027: what the card says on a measuring run instead of the leads. */
export const MEASURE_TEXT = 'Measure, do not compensate: leave restarts ON the second and call each speed AT its sign; lap the stopwatch at every MARK and note the net: the pace-aid reading at MARK out minus the reading at MARK in.';
/** PT-10 (N-C3): Bronze copies the printed Packard charts; the same run (no launch lead, speeds called AT the sign) but no measuring wording. */
export const MEASURE_COPY_TEXT = 'Copy mode: copy the Packard chart cell for each pair (press C, Reference HB p.7-9). Leave restarts ON the second and call each speed AT its sign.';
export interface TurnLossBlock {
  /** Common speeds, 25..45 mph. */
  speeds: number[];
  rows: { angle: 90 | 45; losses: number[] }[];
  /** This line's own turn: angle band, entry/exit speeds and loss, when the line has a 90 or 45 degree turn. */
  here: { turn: string; angle: 90 | 45; vIn: number; vOut: number; loss: number; /** CHART-003: "this turn: N s" and the 10 % rule to recover it */ rule: { mph: number; seconds: number; text: string } } | null;
}
const TURN_SPEEDS = [25, 30, 35, 40, 45];
const turnTables = new WeakMap<object, TurnLossBlock['rows']>();
/** "Turn loss" block for the perf card: 90 and 45 degree rows at the common speeds (same table the engine uses). */
export function turnLossBlock(sc: Scenario, line: number): TurnLossBlock {
  let rows = turnTables.get(sc.car);
  if (!rows) {
    const t = buildPerfTable(sc.car).turn;
    rows = ([90, 45] as const).map(angle => ({ angle, losses: TURN_SPEEDS.map(v => t[`${angle}:${v}>${v}`] ?? 0) }));
    turnTables.set(sc.car, rows);
  }
  let here: TurnLossBlock['here'] = null;
  const ins = sc.book[line - 1];
  const dir = ins?.turn;
  if (dir && dir !== 'S') {
    const angle: 90 | 45 | null = dir === 'L' || dir === 'R' || dir === 'JL' || dir === 'JR' ? 90 : dir === 'BL' || dir === 'BR' ? 45 : null;
    const { vIn, vOut } = lineSpeeds(sc, line);
    const vi = vIn && vIn > 0 ? vIn : vOut; const vo = vOut && vOut > 0 ? vOut : vi;
    if (angle && vi && vo) { try { { const loss = r1(turnLoss(angle, vi, vo, sc.car)); here = { turn: dir, angle, vIn: vi, vOut: vo, loss, rule: tenPercentRule(vo, loss) }; } } catch { here = null; } }
  }
  return { speeds: TURN_SPEEDS, rows, here };
}

export function perfCardFor(sc: Scenario, line: number, policy: InstrumentPolicy): PerfCard | null {
  const ins = sc.book[line - 1]; if (!ins) return null;
  const node = sc.course.nodes.find(n => n.id === ins.nodeId);
  const card: PerfCard = { line, text: ins.text, mode: policy.computedCard ? 'answers' : 'own' };
  const rl = restartLabel(ins);
  const measuring = isMeasureRun(sc);
  if (measuring) card.measure = (sc.tags ?? []).includes('charts:packard') ? MEASURE_COPY_TEXT : MEASURE_TEXT;
  if (rl) {
    let accel: number | null = null;
    if (policy.computedCard && !measuring) { try { accel = r1(accelLoss(lineSpeeds(sc, line).vOut ?? ins.speed ?? 30, sc.car)); } catch { accel = null; } }
    card.restart = { label: rl, accel };
    return card;
  }
  // PLAY-002: no speed printed on a transit or warm-up line: give the driver a pace (the box's miles over its minutes) so the day stage moves
  if (ins.speed === undefined && !ins.timed) { const mph0 = transitPaceMph(ins.transit); if (mph0 !== null) { const minutes = Math.round(ins.transit!.seconds / 60); const afterCal = ins.section === 'calibration' && !ins.calibrationStart; const mph = afterCal ? Math.max(mph0, 35) : mph0;   // ENG-027: after the calibration run the time carries the allowance: a deadline, not a pace
      card.transitPace = { mph, miles: ins.transit!.miles!, minutes, text: afterCal ? `No speed printed: ${ins.transit!.miles} mi in ${minutes} min, which includes the calibration allowance: drive about ${mph} mph and wait at the restart. Nothing is timed in a transit.` : `No speed printed: call about ${mph} mph (${ins.transit!.miles} mi / ${minutes} min). Nothing is timed in a transit; arrive at the end on time.` }; } }
  if (!policy.computedCard) return card;
  if (chartsHidden(sc)) { card.hiddenCar = true; return card; }   // PT-10 N-C1: nothing of the hidden car's numbers on the card
  if (!policy.printsTimes) card.withheld = true;
  try {
    const sp = lineSpeeds(sc, line);
    const sc1 = stopCardFor(sc, line);
    if (ins.pause && sc1) card.stop = sc1;
    else if (node?.control === 'STOP' && sc1) card.stopNoPause = { loss: sc1.loss };
    if (ins.timed) {
      const lead = chartLead(ins.timed.holdSpeed, ins.timed.thenSpeed, sc.car); const call = r1(ins.timed.seconds - lead);
      card.timed = { hold: ins.timed.holdSpeed, seconds: ins.timed.seconds, then: ins.timed.thenSpeed, lead, call };
      // N5: on a STOP + timed line the same anchor as timedAnchorTod (the Debrief and the D04 stars): the ghost's departure = the car's stop + the pause - the braking part of the stop loss
      if (ins.pause) { const vi = sp.vIn && sp.vIn > 0 ? sp.vIn : ins.timed.holdSpeed; let brake = 0; try { brake = Math.max(0, stopLoss(vi, ins.timed.holdSpeed, sc.car) - accelLoss(ins.timed.holdSpeed, sc.car)); } catch { brake = 0; } const afterStopped = r1(ins.pause - brake); card.timed.fromGhost = { pause: ins.pause, afterStopped, callAfterStopped: r1(afterStopped + call) }; }
    }
    else if (!measuring && sp.vIn !== null && sp.vOut !== null && sp.vIn !== sp.vOut && !ins.pause && node?.control !== 'STOP') { const lead = chartLead(sp.vIn, sp.vOut, sc.car); card.speedChange = { from: sp.vIn, to: sp.vOut, lead, ft: Math.round(sp.vIn * 1.4667 * lead) }; }
    if (ins.turn && ins.turn !== 'S' && !ins.pause && node?.control !== 'STOP') card.turnLoss = turnLossBlock(sc, line);   // PLAY-008: a stop's turn-capped loss already includes the turn
    if (ins.section === 'start' && ins.speed && !measuring) card.start = { speed: ins.speed, early: Math.round(accelLoss(ins.speed, sc.car)) }; // PLAY-009: the launch lead, rounded like every launch time
  } catch { /* partial card */ }
  return card;
}

/**
 * S at the finish: when the finish banner or the observation checkpoint is in sight and the book's finish line asks for a stop
 * (or the course has an observation checkpoint), the pending-callout box shows it like any other line until the player has called S.
 */
export function finishPrompt(ahead: { kind: string; approxDistanceFt: number; label?: string }[] | null | undefined, sc: Pick<Scenario, 'book' | 'checkpoints'>, stopCalled: boolean): string | null {
  if (stopCalled || !Array.isArray(ahead)) return null;
  const needsStop = sc.checkpoints.some(c => c.kind === 'observation') || sc.book.some(i => i.section === 'finish' && /stop/i.test(i.text ?? ''));
  if (!needsStop) return null;
  const f = ahead.find(a => a.kind === 'finish' || (a.kind === 'checkpoint' && /observation/i.test(a.label ?? '')));
  if (!f) return null;
  return `S: stop at the observation checkpoint / finish (${f.approxDistanceFt} ft)`;
}

// ---------- UI-032: restart, exact-transit and promoted-stop cards ----------

/** The slice of the simulator the hold cards read (so a view-model test can pass a Simulator or a stub). */
export interface HoldSource {
  transitIn: Record<number, number>;
  transitOutFor(endIns: Instruction): number | null;
  holdGoTod(node: { id: string; s: number }): number | null;
}
export interface HoldCard {
  kind: 'restart' | 'transit' | 'promoted'; line: number; title: string; text: string; /** TOD to say go, when known */ goTod: number | null;
  /** N6: the standing-start loss (whole seconds) the navigator leads the out-time by; the same rule at every hold (null when the car is unknown) */
  lead: number | null;
  /** the line is the start line (the launch card above it says when to leave) */
  start?: boolean;
}
/** N6: the lead at a hold: the standing-start loss to the speed the car leaves at, rounded to the whole second like every launch time. */
function holdLead(sc: Pick<Scenario, 'book'> & { car?: Scenario['car']; tags?: string[] }, line: number): number | null {
  if (!sc.car || isMeasureRun(sc)) return null;   // PLAY-027: a measuring run leaves ON the second
  const ins = sc.book[line - 1]; const v = lineSpeeds(sc as Scenario, line).vOut ?? ins?.speed ?? null; if (!v || v <= 0) return null;
  try { return Math.round(accelLoss(v, sc.car)); } catch { return null; }
}

/**
 * The card for a time-of-day restart, an exact transit or a promoted stop on `line`, or null.
 * Restart: "base 08:55:00 + ASP 17 min = your time 09:12:00, leave at that second, do not pull up before your minute".
 * Exact transit: "IN 10:14:07 + 20m00s = OUT 10:34:07". Promoted stop: "leave AT 12:10:00 (not before 12:05:00 - 5 min penalty window; 45m00s prior to end of transit)".
 */
export function holdCardFor(sc: Pick<Scenario, 'book' | 'course' | 'asp'> & { car?: Scenario['car'] }, src: HoldSource | null, line: number, asp = sc.asp): HoldCard | null {
  const ins = sc.book[line - 1]; if (!ins) return null;
  if (ins.restartTime !== undefined && (ins.section === 'restart' || ins.section === 'start' || ins.baseTime !== undefined)) {
    const base = ins.baseTime ?? ins.restartTime - asp * 60;
    // N9: the start line is a start, not a restart, and the launch card says when to leave (your time minus the standing-start loss)
    if (ins.section === 'start') return { kind: 'restart', line, title: `Start, line ${line}`, goTod: ins.restartTime, lead: holdLead(sc, line), start: true, text: `base ${formatClock(base)} + ASP ${asp} min = your time ${formatClock(ins.restartTime)}; do not pull up before the car ahead has left` };
    return { kind: 'restart', line, title: `Restart, line ${line}`, goTod: ins.restartTime, lead: holdLead(sc, line), text: `base ${formatClock(base)} + ASP ${asp} min = your time ${formatClock(ins.restartTime)}: launch on the count (your time minus the standing-start loss), do not pull up before your minute` };   // PLAY-032: never "leave at that second" under a launch lead
  }
  if (ins.transit?.exact) {
    const begin = ins.transit.end ? exactTransitBegin(sc.book, sc.book.indexOf(ins)) : ins;
    if (begin?.transit?.exact) {
      const sec = begin.transit.seconds; const inT = src?.transitIn[begin.n];
      const out = ins.transit.end ? (src?.transitOutFor(ins) ?? (inT !== undefined ? inT + sec : null)) : (inT !== undefined ? inT + sec : null);
      const text = inT !== undefined && out !== null ? `IN ${formatClock(inT)} + ${formatInterval(sec)} = OUT ${formatClock(out)}` : `IN (read the clock at the sign) + ${formatInterval(sec)} = OUT`;
      return { kind: 'transit', line, title: ins.transit.end ? `End of exact transit, line ${line}` : `Exact transit, line ${line}`, goTod: out, lead: ins.transit.end ? holdLead(sc, line) : null, text };
    }
  }
  if (ins.promotedStop) {
    const node = sc.course.nodes.find(n => n.id === ins.nodeId);
    const go = node && src ? src.holdGoTod(node) : null;
    const prior = formatInterval(ins.promotedStop.leaveBeforeEndSeconds);
    // PLAY-007: "leave AT", never "leave by": leaving more than 5 minutes early is a penalty (V.E.3.h)
    const win = (sc as { rules?: { earlyDepartureMinutes?: number } }).rules?.earlyDepartureMinutes ?? 5;
    return { kind: 'promoted', line, lead: holdLead(sc, line), title: `${ins.promotedStop.kind === 'meal' ? 'Meal' : ins.promotedStop.kind === 'pit' ? 'Pit' : ins.promotedStop.kind === 'refuel' ? 'Refuel' : 'Rest'} stop, line ${line}`, goTod: go, text: go !== null ? `leave AT ${formatClock(go)} (not before ${formatClock(go - win * 60)} - ${win} min penalty window; ${prior} prior to end of transit)` : `leave AT ${prior} prior to your end-of-transit time (not more than ${win} min earlier)` };
  }
  return null;
}

/**
 * UI-032: an exact transit that is under way (IN crossed and recorded, OUT line not yet reached): the card keeps showing "IN 09:55:14 + 20m00s = OUT 10:15:14"
 * whatever line the book pointer is on, so the navigator never has to re-read the IN time. Null when no exact transit is open.
 */
export function openTransitCard(sc: Pick<Scenario, 'book' | 'course' | 'asp'>, src: HoldSource | null, lastExecutedLine: number | null): HoldCard | null {
  if (!src) return null;
  for (let i = 0; i < sc.book.length; i++) {
    const ins = sc.book[i]!; if (!ins.transit?.exact || ins.transit.end || src.transitIn[ins.n] === undefined) continue;
    const endIdx = sc.book.findIndex((x, k) => k > i && x.transit?.end && x.transit.exact);
    const end = endIdx >= 0 ? sc.book[endIdx]! : null;
    if (end && lastExecutedLine !== null && lastExecutedLine >= end.n) continue;   // the OUT line has been crossed: the transit is over
    return holdCardFor(sc, src, (end ?? ins).n);
  }
  return null;
}

/** PLAY-029: the exact-transit IN prompt shows from this many seconds before the IN sign (inside the 60 s window the Debrief accepts) to this many after it. */
export const IN_PROMPT_SECONDS = 45;
export const IN_PROMPT_AFTER = 20;
/** PLAY-029: seconds until the car reaches route position `s` at its current speed (null when stopped or past it by more than the window). */
export function secondsToReach(carS: number, carV: number, s: number): number | null {
  const d = s - carS; if (d < 0) return carV > 0.5 ? d / carV : null;
  return carV > 0.5 ? d / carV : null;
}
/**
 * N7: at Bronze (computed card) the hold cards ask for the clock read the Debrief grades (a read within the last minute before an out time, and a read as the IN sign
 * goes by). `secondsToOut` is the time to the out time when the car waits at that hold, null otherwise.
 */
export function clockReadPrompt(hold: HoldCard | null, secondsToOut: number | null, secondsToSign: number | null = null): string | null {
  if (!hold || hold.start) return null;
  // PLAY-029: the IN prompt shows only once the IN sign is close (within the minute the Debrief accepts a read in), never from the start line
  if (hold.kind === 'transit' && /^Exact transit,/.test(hold.title)) return secondsToSign !== null && secondsToSign <= IN_PROMPT_SECONDS && secondsToSign >= -IN_PROMPT_AFTER ? `Read the clock now (K) as you pass this sign${secondsToSign > 2 ? ` (about ${Math.round(secondsToSign)} s ahead)` : ''}: that is your IN time.` : null;
  if (secondsToOut !== null && secondsToOut <= 60 && secondsToOut > -30) return `Read the clock now (K): the out time is ${Math.max(0, Math.round(secondsToOut))} s away; the time of day comes from the clock, never a running chrono.`;
  return null;
}

/** PLAY-032: the alert chip goes after 3.5 s of real time OR `simSeconds` of sim time, whichever comes first, so a fast-forward never leaves a stale alert up. */
export function alertExpired(nowMs: number, untilMs: number, tod: number, sinceTod: number, simSeconds = 8): boolean {
  return nowMs > untilMs || tod - sinceTod > simSeconds;
}

/**
 * PLAY-032: the ledger's Time Allowance line. Only a train, an accident scene, a tractor with nowhere to pass or an emergency speed is a TA (REG V.H.1, V.H.5);
 * a slow truck, a light or traffic is made up with the 10 % rule; a wrong turn never is; a drill with no TA point never suggests one.
 */
export function ledgerTaHint(ta: { hasTaPoints: boolean; windowOpen: boolean }, offCourse: boolean): string {
  if (offCourse) return 'Off course: a wrong turn is never a Time Allowance. Run the lost procedure and rejoin.';
  if (!ta.hasTaPoints) return 'No TA point in this drill: time any delay on the watch and make it up with the 10 % rule.';
  if (ta.windowOpen) return 'TA window open: file the request in the form on the road view (T).';
  return 'Held by a train, an accident scene or a tractor with nowhere to pass? At the yellow TA box press T for the form (15 minutes). A slow truck, a light or traffic is made up with the 10 % rule.';
}
