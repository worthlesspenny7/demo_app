/** The ghost car: perfect-time integrator. DESIGN §4. */
import { type Scenario, type Instruction, nodeById, instructionS } from './course.js';
import { mphToFps } from './units.js';

export interface Breakpoint { s: number; t: number; v: number /* ft/s after this point; 0 if undefined */ }

/** Where a leg's clock starts: an official time (start/restart), the previous checkpoint, or the OUT time of an exact transit (STAGE-003). */
export type LegAnchor =
  | { kind: 'official'; tod: number }
  | { kind: 'checkpoint'; cpId: string }
  | { kind: 'transit'; beginN: number; endN: number; seconds: number };

export interface Leg {
  index: number;            // 1-based
  cpId: string;
  cpS: number;
  perfectTod: number;       // ghost TOD at the CP
  perfectDuration: number;  // seconds from the anchor
  /** Perfect seconds from the most recent official start / restart / exact-transit end (V.C.2.b(2)). */
  cumulativePerfect?: number;
  anchor: LegAnchor;
}

export interface GhostObservation { cpId: string; s: number; perfectTod: number; cumulativePerfect: number }

export interface GhostTable {
  breakpoints: Breakpoint[];
  legs: Leg[];
  /** Observation Checkpoints with their perfect times (the final one is judged against the 30-minute rule). */
  observations: GhostObservation[];
  /** Ghost TOD at the end of the course. */
  endTod: number;
}

export function ghostTimeAt(table: GhostTable, s: number): number {
  const bps = table.breakpoints;
  let lo = 0, hi = bps.length - 1;
  // last breakpoint with bp.s <= s
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bps[mid]!.s <= s) lo = mid; else hi = mid - 1; }
  const bp = bps[lo]!;
  if (bp.v <= 0) return bp.t;
  return bp.t + Math.max(0, s - bp.s) / bp.v;
}

interface Ev { s: number; order: number; ins?: Instruction; cp?: Scenario['checkpoints'][number] }

/** Index of the instruction that ends the transit begun at book index i (next transit end, restart, calibration start or finish), or -1. */
export function transitEndIndex(book: Instruction[], i: number): number {
  const b = book[i]!;
  for (let k = i + 1; k < book.length; k++) {
    const x = book[k]!;
    if (x.transit?.end || x.restartTime !== undefined || x.section === 'finish') return k;
    if (b.section !== 'calibration' && x.calibrationStart) return k;
  }
  return -1;
}

/** The exact-transit begin line that pairs with an end line (nearest preceding exact begin). */
export function exactTransitBegin(book: Instruction[], endIdx: number): Instruction | null {
  for (let k = endIdx - 1; k >= 0; k--) { const x = book[k]!; if (x.transit && !x.transit.end && x.transit.exact) return x; }
  return null;
}

export function buildGhost(sc: Scenario): GhostTable {
  const events: Ev[] = [];
  for (const ins of sc.book) events.push({ s: instructionS(sc.course, ins), order: 1, ins });
  for (const cp of sc.checkpoints) events.push({ s: cp.s, order: 0, cp });
  events.sort((a, b) => a.s - b.s || a.order - b.order);

  // Ghost speed through each transit: the course distance to its end divided by the allowed seconds, so an exact transit takes exactly that long.
  const transitSpeed = new Map<number, number>();
  sc.book.forEach((ins, i) => {
    if (!ins.transit || ins.transit.end || ins.speed !== undefined || ins.timed || ins.transit.seconds <= 0) return;
    const j = transitEndIndex(sc.book, i); if (j < 0) return;
    const dist = instructionS(sc.course, sc.book[j]!) - instructionS(sc.course, ins);
    if (dist > 0) transitSpeed.set(ins.n, dist / ins.transit.seconds);
  });

  const bps: Breakpoint[] = [];
  const legs: Leg[] = [];
  const observations: GhostObservation[] = [];
  let s = 0, t = sc.startTime, v = 0;
  let anchor: LegAnchor = { kind: 'official', tod: sc.startTime };
  let anchorTod = sc.startTime;      // ghost TOD of the current leg's anchor
  let officialGhostTod = sc.startTime; // ghost TOD of the most recent official anchor
  let resumeV = 0;                    // assigned speed in force before the current transit
  let pending: { s: number; v: number } | null = null;

  const travelTo = (target: number): void => {
    while (pending && pending.s <= target) {
      if (v > 0) t += (pending.s - s) / v;
      s = pending.s; v = pending.v; pending = null;
      bps.push({ s, t, v });
    }
    if (target > s) { if (v > 0) t += (target - s) / v; s = target; }
  };

  bps.push({ s: 0, t, v });
  for (const ev of events) {
    travelTo(ev.s);
    if (ev.cp) {
      if (ev.cp.kind === 'timing') {
        legs.push({ index: legs.length + 1, cpId: ev.cp.id, cpS: ev.cp.s, perfectTod: t, perfectDuration: t - anchorTod, cumulativePerfect: t - officialGhostTod, anchor });
        anchor = { kind: 'checkpoint', cpId: ev.cp.id }; anchorTod = t;
      } else observations.push({ cpId: ev.cp.id, s: ev.cp.s, perfectTod: t, cumulativePerfect: t - officialGhostTod });
      continue;
    }
    const ins = ev.ins!;
    let changed = false;
    if (ins.restartTime !== undefined) { t = ins.restartTime; anchor = { kind: 'official', tod: t }; anchorTod = t; officialGhostTod = t; changed = true; }
    else if (ins.transit?.end && ins.transit.exact) {
      const idx = sc.book.indexOf(ins); const begin = exactTransitBegin(sc.book, idx);
      if (begin) { anchor = { kind: 'transit', beginN: begin.n, endN: ins.n, seconds: begin.transit!.seconds }; anchorTod = t; officialGhostTod = t; }
    }
    if (ins.transit && !ins.transit.end) {
      const tv = transitSpeed.get(ins.n);
      if (tv !== undefined) { resumeV = v; v = tv; changed = true; pending = null; }
    }
    if (ins.pause) { bps.push({ s, t, v }); t += ins.pause; changed = true; }
    if (ins.timed) {
      v = mphToFps(ins.timed.holdSpeed);
      pending = { s: s + v * ins.timed.seconds, v: mphToFps(ins.timed.thenSpeed) };
      changed = true;
    } else if (ins.speed !== undefined) { v = mphToFps(ins.speed); changed = true; }
    else if ((ins.transit?.end || ins.restartTime !== undefined) && resumeV > 0) { v = resumeV; changed = true; }
    if (changed) bps.push({ s, t, v });
  }
  travelTo(sc.course.lengthFt);
  return { breakpoints: bps, legs, observations, endTod: t };
}

/**
 * Fill perfectInterval / perfectCumulative on calibration-section lines (and all lines if `all`). The official times are printed to 0.1 s
 * (VII.F.1), so each cumulative time is rounded to a tenth and each interval is the difference of two printed cumulative times.
 */
export function annotatePerfectTimes(sc: Scenario, all = false): void {
  const g = buildGhost(sc);
  const r1 = (x: number): number => Math.round(x * 10) / 10;
  let prevCum: number | null = null, startT: number | null = null;
  for (const ins of sc.book) {
    const inCal = ins.section === 'calibration';
    if (!(inCal || all)) { prevCum = null; startT = null; continue; }
    const t = ghostTimeAt(g, instructionS(sc.course, ins));
    if (prevCum === null || startT === null) { startT = t; prevCum = 0; ins.perfectInterval = 0; ins.perfectCumulative = 0; continue; }
    const cum = r1(t - startT);
    ins.perfectInterval = r1(cum - prevCum); ins.perfectCumulative = cum; prevCum = cum;
  }
}
export { nodeById };
