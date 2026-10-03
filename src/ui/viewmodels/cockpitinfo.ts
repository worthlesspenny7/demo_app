/**
 * Cockpit information policy and the perf card (UI-014..UI-017). Pure functions, no DOM.
 *  - one turn-capped stop loss shared by the book strip, the perf card and the Debrief (PT-03 W1)
 *  - which line the card shows (stopped line first, then the book pointer)
 *  - what the legal (aids rung <= 1) cockpit hides: digital readouts and the computed answer card
 */
import type { Scenario, Instruction, AidsConfig } from '../../core/course.js';
import { stopLoss, rampLead, accelLoss, turnLoss, buildPerfTable } from '../../core/perf-table.js';
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
}
export function instrumentPolicy(aids: AidsConfig | null | undefined): InstrumentPolicy {
  const rung = aidsRung(aids);
  return { rung, digitalReadouts: rung >= 2, computedCard: rung >= 2 };
}

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
    if (ins.timed) v = ins.timed.thenSpeed;
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
  timed?: { hold: number; seconds: number; then: number; lead: number; call: number };
  speedChange?: { from: number; to: number; lead: number; ft: number };
  start?: { speed: number; early: number };
  restart?: { label: string; accel: number | null };
  /** Non-stop turn loss (seconds the car loses slowing for the turn and re-accelerating), from the car's performance table. */
  turnLoss?: TurnLossBlock;
}
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
  if (rl) {
    let accel: number | null = null;
    if (policy.computedCard) { try { accel = r1(accelLoss(lineSpeeds(sc, line).vOut ?? ins.speed ?? 30, sc.car)); } catch { accel = null; } }
    card.restart = { label: rl, accel };
    return card;
  }
  if (!policy.computedCard) return card;
  try {
    const sp = lineSpeeds(sc, line);
    const sc1 = stopCardFor(sc, line);
    if (ins.pause && sc1) card.stop = sc1;
    else if (node?.control === 'STOP' && sc1) card.stopNoPause = { loss: sc1.loss };
    if (ins.timed) { const lead = r1(rampLead(ins.timed.holdSpeed, ins.timed.thenSpeed, sc.car)); card.timed = { hold: ins.timed.holdSpeed, seconds: ins.timed.seconds, then: ins.timed.thenSpeed, lead, call: r1(ins.timed.seconds - lead) }; }
    else if (sp.vIn !== null && sp.vOut !== null && sp.vIn !== sp.vOut && !ins.pause && node?.control !== 'STOP') { const lead = r1(rampLead(sp.vIn, sp.vOut, sc.car)); card.speedChange = { from: sp.vIn, to: sp.vOut, lead, ft: Math.round(sp.vIn * 1.4667 * lead) }; }
    if (ins.turn && ins.turn !== 'S') card.turnLoss = turnLossBlock(sc, line);
    if (ins.section === 'start' && ins.speed) card.start = { speed: ins.speed, early: r1(stopLoss(ins.speed, ins.speed, sc.car) * 0.55) };
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
export interface HoldCard { kind: 'restart' | 'transit' | 'promoted'; line: number; title: string; text: string; /** TOD to say go, when known */ goTod: number | null }

/**
 * The card for a time-of-day restart, an exact transit or a promoted stop on `line`, or null.
 * Restart: "base 08:55:00 + ASP 17 min = your time 09:12:00, leave at that second, do not pull up before your minute".
 * Exact transit: "IN 10:14:07 + 20m00s = OUT 10:34:07". Promoted stop: "leave by 12:10:00 (45m00s prior to end of transit)".
 */
export function holdCardFor(sc: Pick<Scenario, 'book' | 'course' | 'asp'>, src: HoldSource | null, line: number, asp = sc.asp): HoldCard | null {
  const ins = sc.book[line - 1]; if (!ins) return null;
  if (ins.restartTime !== undefined && (ins.section === 'restart' || ins.section === 'start' || ins.baseTime !== undefined)) {
    const base = ins.baseTime ?? ins.restartTime - asp * 60;
    return { kind: 'restart', line, title: `Restart, line ${line}`, goTod: ins.restartTime, text: `base ${formatClock(base)} + ASP ${asp} min = your time ${formatClock(ins.restartTime)}, leave at that second, do not pull up before your minute` };
  }
  if (ins.transit?.exact) {
    const begin = ins.transit.end ? exactTransitBegin(sc.book, sc.book.indexOf(ins)) : ins;
    if (begin?.transit?.exact) {
      const sec = begin.transit.seconds; const inT = src?.transitIn[begin.n];
      const out = ins.transit.end ? (src?.transitOutFor(ins) ?? (inT !== undefined ? inT + sec : null)) : (inT !== undefined ? inT + sec : null);
      const text = inT !== undefined && out !== null ? `IN ${formatClock(inT)} + ${formatInterval(sec)} = OUT ${formatClock(out)}` : `IN (read the clock at the sign) + ${formatInterval(sec)} = OUT`;
      return { kind: 'transit', line, title: ins.transit.end ? `End of exact transit, line ${line}` : `Exact transit, line ${line}`, goTod: out, text };
    }
  }
  if (ins.promotedStop) {
    const node = sc.course.nodes.find(n => n.id === ins.nodeId);
    const go = node && src ? src.holdGoTod(node) : null;
    const prior = formatInterval(ins.promotedStop.leaveBeforeEndSeconds);
    return { kind: 'promoted', line, title: `${ins.promotedStop.kind === 'meal' ? 'Meal' : ins.promotedStop.kind === 'pit' ? 'Pit' : ins.promotedStop.kind === 'refuel' ? 'Refuel' : 'Rest'} stop, line ${line}`, goTod: go, text: go !== null ? `leave by ${formatClock(go)} (${prior} prior to end of transit)` : `leave ${prior} prior to end of transit` };
  }
  return null;
}
