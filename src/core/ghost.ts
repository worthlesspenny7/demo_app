/** The ghost car: perfect-time integrator. DESIGN §4. */
import { type Scenario, type Instruction, nodeById } from './course.js';
import { mphToFps } from './units.js';

export interface Breakpoint { s: number; t: number; v: number /* ft/s after this point; 0 if undefined */ }

export interface Leg {
  index: number;            // 1-based
  cpId: string;
  cpS: number;
  perfectTod: number;       // ghost TOD at the CP
  perfectDuration: number;  // seconds from the anchor
  anchor: { kind: 'official'; tod: number } | { kind: 'checkpoint'; cpId: string };
}

export interface GhostTable {
  breakpoints: Breakpoint[];
  legs: Leg[];
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

interface Ev { s: number; order: number; ins?: Instruction; virtualTo?: number; cp?: Scenario['checkpoints'][number] }

export function buildGhost(sc: Scenario): GhostTable {
  const events: Ev[] = [];
  for (const ins of sc.book) events.push({ s: nodeById(sc.course, ins.nodeId).s, order: 1, ins });
  for (const cp of sc.checkpoints) events.push({ s: cp.s, order: 0, cp });
  events.sort((a, b) => a.s - b.s || a.order - b.order);

  const bps: Breakpoint[] = [];
  const legs: Leg[] = [];
  let s = 0, t = sc.startTime, v = 0;
  let anchor: Leg['anchor'] = { kind: 'official', tod: sc.startTime };
  let anchorTod = sc.startTime;
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
        legs.push({ index: legs.length + 1, cpId: ev.cp.id, cpS: ev.cp.s, perfectTod: t, perfectDuration: t - anchorTod, anchor });
        anchor = { kind: 'checkpoint', cpId: ev.cp.id }; anchorTod = t;
      }
      continue;
    }
    const ins = ev.ins!;
    let changed = false;
    if (ins.restartTime !== undefined) { t = ins.restartTime; anchor = { kind: 'official', tod: t }; anchorTod = t; changed = true; }
    if (ins.pause) { bps.push({ s, t, v }); t += ins.pause; changed = true; }
    if (ins.timed) {
      v = mphToFps(ins.timed.holdSpeed);
      pending = { s: s + v * ins.timed.seconds, v: mphToFps(ins.timed.thenSpeed) };
      changed = true;
    } else if (ins.speed !== undefined) { v = mphToFps(ins.speed); changed = true; }
    if (changed) bps.push({ s, t, v });
  }
  travelTo(sc.course.lengthFt);
  return { breakpoints: bps, legs, endTod: t };
}

/** Fill perfectInterval / perfectCumulative on calibration-section lines (and all lines if `all`). */
export function annotatePerfectTimes(sc: Scenario, all = false): void {
  const g = buildGhost(sc);
  let prevT: number | null = null, startT: number | null = null;
  for (const ins of sc.book) {
    const inCal = ins.section === 'calibration';
    if (!(inCal || all)) { prevT = null; startT = null; continue; }
    const t = ghostTimeAt(g, nodeById(sc.course, ins.nodeId).s);
    if (prevT === null || startT === null) { startT = t; prevT = t; ins.perfectInterval = 0; ins.perfectCumulative = 0; continue; }
    ins.perfectInterval = t - prevT; ins.perfectCumulative = t - startT; prevT = t;
  }
}
