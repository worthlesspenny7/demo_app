/**
 * Cockpit information policy and the perf card (UI-014..UI-017). Pure functions, no DOM.
 *  - one turn-capped stop loss shared by the book strip, the perf card and the Debrief (PT-03 W1)
 *  - which line the card shows (stopped line first, then the book pointer)
 *  - what the legal (aids rung <= 1) cockpit hides: digital readouts and the computed answer card
 */
import type { Scenario, Instruction, AidsConfig } from '../../core/course.js';
import { stopLoss, rampLead, accelLoss } from '../../core/perf-table.js';
import { formatClock } from '../../core/units.js';
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

export interface StopCard { line: number; pause: number; vIn: number; vOut: number; loss: number; dwell: number; cap: number | undefined }

/** Stop loss for a line, turn-capped exactly as the Debrief does. Null when the line has no usable exit speed. */
export function stopCardFor(sc: Scenario, line: number): StopCard | null {
  const ins = sc.book[line - 1]; if (!ins) return null;
  const { vIn, vOut } = lineSpeeds(sc, line);
  if (!vOut) return null;
  const vi = vIn && vIn > 0 ? vIn : vOut;
  const cap = turnCap(ins.turn, sc);
  let loss: number;
  try { loss = r1(stopLoss(vi, vOut, sc.car, cap)); } catch { return null; }
  const pause = ins.pause ?? 0;
  return { line, pause, vIn: vi, vOut, loss, dwell: r1(Math.max(0, pause - loss)), cap };
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
    if (ins.section === 'start' && ins.speed) card.start = { speed: ins.speed, early: r1(stopLoss(ins.speed, ins.speed, sc.car) * 0.55) };
  } catch { /* partial card */ }
  return card;
}
