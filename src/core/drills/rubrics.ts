/** Rubric helpers shared by drills. */
import type { Rubric } from './types.js';
import type { StageResult, InstrumentFinding } from '../sim.js';
import type { Scenario } from '../course.js';
import { rampLead, stopLoss, accelLoss } from '../perf-table.js';
import type { Instruction } from '../course.js';
import type { SimEvent } from '../sim.js';

/**
 * PLAY-006: when the count of a timed segment starts, in the car's own time: at the sign for a plain line; for a STOP line ("STOP P15, 25 for 40
 * then 45") when the ghost leaves = the wheels-stop time + the printed pause - the braking part of the stop loss (the ghost arrived that much
 * earlier). Used by the D04 stars and the Debrief's worked timed rows alike.
 */
/** The time the car crossed the instruction line before `ins` (-Infinity at the first line). */
export function prevCrossTod(ev: SimEvent[], sc: Scenario, ins: Instruction): number {
  const idx = sc.book.indexOf(ins); const prev = idx > 0 ? sc.book[idx - 1] : undefined; if (!prev) return -Infinity;
  const e = ev.find(x => x.type === 'node' && x.detail?.nodeId === prev.nodeId); return e ? e.tod : -Infinity;
}
export function timedAnchorTod(ev: SimEvent[], sc: Scenario, ins: Instruction, nodeEventIdx: number, vIn: number | undefined): number {
  const cross = ev[nodeEventIdx]!;
  if (!ins.pause || !ins.timed) return cross.tod;
  const wait = [...ev.slice(0, nodeEventIdx)].reverse().find(e => e.type === 'wait');
  if (!wait) return cross.tod;
  const vi = vIn ?? ins.timed.holdSpeed; let brake = 0;
  try { brake = Math.max(0, stopLoss(vi, ins.timed.holdSpeed, sc.car) - accelLoss(ins.timed.holdSpeed, sc.car)); } catch { brake = 0; }
  return wait.tod + ins.pause - brake;
}

export function starsFromMeanAbs(mean: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  return mean <= thresholds[0] ? 3 : mean <= thresholds[1] ? 2 : mean <= thresholds[2] ? 1 : 0;
}
export function legErrors(r: StageResult): number[] { return r.score.legs.map(l => (l.error ?? r.score.legs[0]!.penalty)); }
export function meanAbs(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length : 0; }

const FINDING_NAME: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'time of day taken without reading the clock',
  clockForInterval: 'no stopwatch start or lap at the landmark of a timed interval',
  calibrationWithoutLap: 'calibration point passed without a lap',
  lapWhileFrozen: 'lap taken while the split was still frozen',
};
const FINDING_FIX: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'Starts, restarts and exact-transit IN/OUT come from the clock (or the watch in TOD mode), never from a running chrono.',
  clockForInterval: "Timed changes and pauses are counted on the stopwatch (start at the sign, lap at the stop), never off the clock's second hand.",
  calibrationWithoutLap: 'Lap the stopwatch at every calibration point, then read interval and cumulative against the printed box.',
  lapWhileFrozen: 'Press recall (or wait for the display to release) before the next lap, or the split is lost.',
};
const FINDING_SHORT: Record<InstrumentFinding['kind'], string> = {
  clockForTimeOfDay: 'read time of day from the clock, never a running chrono',
  clockForInterval: 'count intervals on the stopwatch, never off the clock',
  calibrationWithoutLap: 'lap at every calibration point',
  lapWhileFrozen: 'recall or wait before the next lap',
};
/** WATCH-009: one line per kind of instrument misuse found in the run, with the count and the first example. */
export function instrumentFindingLines(findings: InstrumentFinding[]): string[] {
  const kinds = [...new Set(findings.map(f => f.kind))];
  return kinds.map(k => { const of = findings.filter(f => f.kind === k); return `Instrument discipline (WATCH-009): ${of.length} x ${FINDING_NAME[k]} (first at line ${of[0]!.line}). ${FINDING_FIX[k]}`; });
}
/** The most frequent kind of instrument misuse in the run, with its count. */
export function topFinding(findings: InstrumentFinding[]): { kind: InstrumentFinding['kind']; count: number } | null {
  if (!findings.length) return null;
  const counts = new Map<InstrumentFinding['kind'], number>(); for (const f of findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  const [kind, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { kind, count };
}
/** The short form used in the headline tip: names the most frequent kind only. */
export function instrumentFindingSentence(findings: InstrumentFinding[]): string {
  const t = topFinding(findings); if (!t) return '';
  return ` Instrument discipline (WATCH-009): ${t.count} x ${FINDING_NAME[t.kind]}; ${FINDING_SHORT[t.kind]}.`;
}

/** Largest-bucket headline tip (DEBRIEF-001 at engine level). */
export function headlineTip(r: StageResult, sc?: Scenario): string {
  const totals: Record<string, number> = {};
  for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) totals[k] = (totals[k] ?? 0) + v;
  const errs = legErrors(r); const mean = meanAbs(errs);
  const inst = instrumentFindingSentence(r.instrumentDiscipline ?? []);
  // PLAY-006: "Clean run" only with no penalty item (observation miss, early departure, DNF) and no start / minute / timed-interval finding
  const penalties = !!r.observationMissed || (r.score.earlyDeparturePenalty ?? 0) > 0 || !!r.score.dnf || (r.findings ?? []).length > 0;
  if (penalties && mean <= 3 && r.offCourseCount === 0) {
    const f = (r.findings ?? [])[0];
    if ((r.score.earlyDeparturePenalty ?? 0) > 0) return `Leg times are clean, but you left a promoted stop more than ${5} minutes before its departure time (+${r.score.earlyDeparturePenalty} s): leave AT the printed time, never earlier.${inst}`;
    if (r.observationMissed) return `Leg times are clean, but the Observation Checkpoint was missed (+${r.score.observationPenalty} s): stop at the red GREAT RACE STOP board.${inst}`;
    if (f) return `Leg times are clean, but: ${f.text}${inst}`;
  }
  if (mean <= 3 && r.offCourseCount === 0 && !penalties) return `Clean run: the remaining seconds are speed-holding noise, and consistency is what wins over nine days.${inst}`;
  const net = Object.values(totals).reduce((a, b) => a + b, 0);
  // the largest cause with the same sign as the net error (a negative cruise bucket against positive stops is recovery, not a fault)
  const sameSign = Object.entries(totals).filter(([, v]) => Math.sign(v) === Math.sign(net) && Math.abs(v) >= 1.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [k, v] = sameSign[0] ?? Object.entries(totals).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['cruise', 0];
  const recovered = -Math.min(0, totals.cruise ?? 0);
  if (k !== 'cruise' && recovered > 3 && net > 0) return `You lost ${Math.round(v)} s in ${k === 'stop' ? 'stops' : k} and recovered ${Math.round(recovered)} s in cruise; recover a little more, or earlier, next time (10 % rule: 10 % faster for 10 x the seconds lost).${inst}`;
  const late = v > 0;
  return `${tipFor(k, late, sc, r.events)}${inst}`;
}

function tipFor(k: string, late: boolean, sc?: Scenario, events?: SimEvent[]): string {
  switch (k) {
    case 'stop': return late ? 'Your stops cost more than the printed pause, so go earlier: dwell = the chart pause time for your IN/OUT pair (the printed pause minus the stop/start loss), written next to every pause.' : 'You left stops too early and are not using the whole pause: dwell = the chart pause time, no less.';
    case 'start': return late ? 'You left the start late: leave early by the standstill acceleration loss (the 0 > speed cell of the acceleration chart, about 4-5 s for the Ford).' : 'You left the start too early: lead by the acceleration loss only (about 4-5 s), not more.';
    case 'speedChange': return 'Landmark speed changes are mistimed: split at the sign, crossing it at the midpoint speed, which means beginning the change half a ramp early.';
    case 'timedChange': return "Timed changes are off: count from the ghost's departure (arrival + pause) and split the change at the sign by calling it half a ramp early.";
    case 'hazard': return 'Lights, trains or traffic cost you: time every delay on the stopwatch, then make it up with the 10 % rule (10 % faster for 10 x the seconds lost, 4 s lost at 35 -> 38.5 mph for 40 s) or, for a train or accident, file a Time Allowance at the TA point, never both.';
    case 'offCourse': return "A wrong turn cost the leg: stay on course first (the third of the Four S's), confirm the landmark before the leading edge of the intersection, and never ask for a Time Allowance for a wrong turn.";
    case 'turn': return 'Turns cost time the ghost does not spend: write the turn chart loss on your card (approach 40, exit 35 = 4 s) and recover it with the 10 % rule right after the turn.';
    case 'cruise': {
      if (sc && events && uncalledSpeeds(events, sc).length) { const m = uncalledSpeeds(events, sc); return `Cruise ran ${late ? 'slow' : 'fast'} because ${m.length === 1 ? `${m[0]!.mph} at line ${m[0]!.line} was` : `${m.length} new speeds (first ${m[0]!.mph} at line ${m[0]!.line}) were`} never called: the driver keeps the old speed until you call the new one, and after every stop he needs the out speed again.`; }
      const speedoTrue = sc ? sc.speedo.kind === 'timewise' && Math.abs(sc.speedo.gain - 1) < 0.003 && Math.abs(sc.speedo.offset) < 0.1 : false;
      if (speedoTrue) return late ? 'Cruise segments ran slow because the driver wandered under the assigned speed: watch the needle and call small corrections (+1) sooner, and make up the rest with the 10 % rule.' : 'Cruise segments ran fast because the driver wandered over the assigned speed: call small corrections (-1) sooner.';
      return late ? 'You ran slow on the cruise segments because the speedometer reads high: calibrate and hold a corrected indicated speed.' : 'You ran fast on the cruise segments because the speedometer reads low: calibrate and hold a corrected indicated speed.';
    }
    default: return 'Review the attribution and fix the largest bucket first.';
  }
}

/** Star thresholds scale with the driver's speed-holding noise so that Gold (rookie driver) still grades the navigator. */
export function driverScale(skill: string | undefined): number { return skill === 'rookie' ? 2.2 : skill === 'sportsman' ? 1.5 : 1; }

export function basicRubric(r: StageResult, thresholds: [number, number, number], extra: string[] = [], driverSkill?: string, sc?: Scenario): Rubric {
  const k = driverScale(driverSkill); thresholds = [thresholds[0] * k, thresholds[1] * k, thresholds[2] * k];
  const errs = legErrors(r); const mean = meanAbs(errs);
  const stars = r.offCourseCount > 0 ? Math.min(1, starsFromMeanAbs(mean, thresholds)) as 0 | 1 : starsFromMeanAbs(mean, thresholds);
  const feedback = [headlineTip(r, sc), ...extra];
  const top = topFinding(r.instrumentDiscipline ?? []); // the tip already names the most frequent kind; list the others here
  if (top) feedback.push(...instrumentFindingLines((r.instrumentDiscipline ?? []).filter(f => f.kind !== top.kind)));
  if (r.offCourseCount) feedback.push(`Off course ${r.offCourseCount} time(s): a wrong turn costs far more than a timing error.`);
  if (r.observationMissed) feedback.push('You did not stop at the Observation Checkpoint: call stop before the finish banner.');
  if (r.score.aces) feedback.push(`${r.score.aces} ACE${r.score.aces > 1 ? 's' : ''}!`);
  return { score: Math.round(mean * 10) / 10, stars, feedback, headline: `${r.score.raw} s raw (${r.score.benchmark}), ${r.score.aces} ace(s)` };
}

/**
 * PLAY-006: the navigator's call error at each timed change (D04) or landmark speed change (D05): when the new speed was called against when it
 * should have been (timed: T - half the ramp after the line; landmark: half the ramp before the sign). + = late. A change never called counts as
 * `missedPenalty` seconds late. These are the same numbers the Debrief's bias row prints, so the stars and the bias row agree.
 */
export function callErrors(r: StageResult, sc: Scenario, kind: 'timed' | 'landmark', missedPenalty = 5): number[] {
  const ev = r.events; const out: number[] = []; let assigned: number | undefined = undefined; let prevTimed = false;
  for (const ins of sc.book) {
    const vBefore = assigned;
    if (ins.timed) assigned = ins.timed.thenSpeed; else if (ins.speed !== undefined) assigned = ins.speed;
    const node = sc.course.nodes.find(n => n.id === ins.nodeId);
    const ci = ev.findIndex(e => e.type === 'node' && e.detail?.nodeId === ins.nodeId);
    const wasTimed = prevTimed; prevTimed = !!ins.timed;
    if (ci < 0) continue;
    const cross = ev[ci]!;
    if (kind === 'timed' && ins.timed) {
      const T = ins.timed.seconds; const lead = rampLead(ins.timed.holdSpeed, ins.timed.thenSpeed, sc.car);
      const t0 = timedAnchorTod(ev, sc, ins, ci, vBefore);
      const call = ev.slice(ci + 1).find(e => e.type === 'call.speed' && e.detail?.mph === ins.timed!.thenSpeed && e.tod <= t0 + T + 90);
      out.push(call ? call.tod - t0 - (T - lead) : missedPenalty);
    } else if (kind === 'landmark' && !ins.timed && !ins.pause && ins.speed !== undefined && vBefore !== undefined && vBefore !== ins.speed && node?.control !== 'STOP' && ins.section !== 'start' && ins.section !== 'restart' && !wasTimed) {
      const lead = rampLead(vBefore, ins.speed, sc.car);
      const since = Math.max(cross.tod - 120, prevCrossTod(ev, sc, ins)); // never a call made for an earlier line (PLAY-006)
      const before = [...ev.slice(0, ci + 1)].reverse().find(e => e.type === 'call.speed' && e.detail?.mph === ins.speed && e.tod >= since);
      const call = before ?? ev.slice(ci + 1).find(e => e.type === 'call.speed' && e.detail?.mph === ins.speed && e.tod <= cross.tod + 60);
      out.push(call ? call.tod - cross.tod + lead : missedPenalty);
    }
  }
  return out;
}

/** PLAY-006: assigned speeds in a leg that the navigator never called (the driver kept the old speed): line and speed. */
export function uncalledSpeeds(events: SimEvent[] | null | undefined, scenario: Scenario): { legIndex: number; line: number; mph: number }[] {
  const out: { legIndex: number; line: number; mph: number }[] = [];
  if (!Array.isArray(events)) return out;
  const legs: number[] = []; { let leg = 1; for (const ev of events) { legs.push(leg); if (ev?.type === 'checkpoint' && ev.detail?.kind === 'timing') leg++; } }
  for (let k = 0; k < scenario.book.length; k++) {
    const ins = scenario.book[k]!; const v = ins.timed ? ins.timed.thenSpeed : ins.speed;
    if (v === undefined || ins.section === 'start') continue;
    const ci = events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === ins.nodeId); if (ci < 0) continue;
    const prev = k > 0 ? events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === scenario.book[k - 1]!.nodeId) : -1;
    const next = scenario.book[k + 1]; const ni = next ? events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === next.nodeId) : -1;
    const lo = prev >= 0 ? events[prev]!.tod : -Infinity; const hi = ni >= 0 ? events[ni]!.tod : Infinity;
    const called = events.some(e => e?.type === 'call.speed' && e.tod >= lo && e.tod <= hi && Math.abs(Number(e.detail?.mph) - v) <= 1.5)
      || events.some(e => e?.type === 'makeUp.dropped' && e.detail?.line === ins.n);
    // the speed before was the same: nothing to call
    const before = k > 0 ? (() => { for (let j = k - 1; j >= 0; j--) { const b = scenario.book[j]!; const bv = b.timed ? b.timed.thenSpeed : b.speed; if (bv !== undefined) return bv; } return undefined; })() : undefined;
    if (!called && (before !== v || ins.pause)) out.push({ legIndex: legs[ci] ?? 1, line: ins.n, mph: v }); // after a STOP the out speed is called again
  }
  return out;
}

