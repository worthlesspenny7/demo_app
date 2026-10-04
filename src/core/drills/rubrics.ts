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

/** EDU-001..003: what the headline knows about the run's stars. `stars` < 3 never yields "Clean run"; 3 never yields the "recover more" lecture. */
export interface TipOptions { stars?: number }

/** Total Time Allowance credit the committee granted over all legs. */
export function taCreditTotal(r: StageResult): number { return (r.score?.legs ?? []).reduce((a, l) => a + (l.taCredit ?? 0), 0); }

/**
 * N3: where the stop bucket came from. `pause` = seconds over the ghost at stops with a printed pause (the navigator's dwell), `noPause` = seconds
 * at STOP signs with no pause printed (the stop and go loss that no dwell can save: it is made up, never "go earlier").
 */
export function stopCauses(r: StageResult): { pause: number; noPause: number } {
  let pause = 0, noPause = 0;
  for (const a of r.attribution ?? []) for (const st of a.stops ?? []) { if (st.pause > 0) pause += st.actualCost; else noPause += st.actualCost; }
  return { pause, noPause };
}

/**
 * ENG-022: the D08 / D18 gates teach recovery. `owed` = the seconds the run lost that the navigator must make up (hazards, turns, speed changes,
 * the start and STOPs with no pause); `shown` = the navigator called a speed above the assigned one at least once (sim event call.over or
 * makeUp.begin) or the committee credited a Time Allowance. A run that owed 5 s or more and never tried to recover earns at most one star.
 */
export function recoveryCheck(r: StageResult): { owed: number; shown: boolean; capped: boolean } {
  const t: Record<string, number> = {}; for (const a of r.attribution ?? []) for (const [k, v] of Object.entries(a.buckets)) t[k] = (t[k] ?? 0) + v;
  const owed = ['hazard', 'turn', 'speedChange', 'start'].reduce((x, k) => x + Math.max(0, t[k] ?? 0), 0) + Math.max(0, stopCauses(r).noPause);
  const shown = (r.events ?? []).some(e => e.type === 'call.over' || e.type === 'makeUp.begin') || taCreditTotal(r) > 0;
  return { owed: Math.round(owed * 10) / 10, shown, capped: owed >= 5 && !shown };
}
export function withRecoveryGate(rb: Rubric, r: StageResult, sc: Scenario): Rubric {
  const c = recoveryCheck(r); if (!c.capped || rb.stars <= 1) return rb;
  rb.stars = 1;
  const tip = `You lost about ${Math.round(c.owed)} s to the hazard, the stops and the turns and never called a make-up speed: the leg came out close only because errors cancelled. Time each loss, then hold 10 % over for 10 x the seconds lost (HB p.10), and back to the assigned speed.`;
  return withSkillTip(rb, r, sc, tip);
}

/** PLAY-028: printed-pause stops where the navigator sat more than 1 s past the chart pause time (the only case for "go earlier"). */
export function longDwells(r: StageResult, over = 1): { line: number | null; seconds: number }[] {
  const out: { line: number | null; seconds: number }[] = [];
  for (const a of r.attribution ?? []) for (const st of a.stops ?? []) if (st.pause > 0 && st.actualCost - Math.max(0, st.trafficWait ?? 0) > over) out.push({ line: st.line, seconds: Math.round((st.actualCost - Math.max(0, st.trafficWait ?? 0)) * 10) / 10 });
  return out;
}

/** Largest-bucket headline tip (DEBRIEF-001 at engine level). */
export function headlineTip(r: StageResult, sc?: Scenario, opts: TipOptions = {}): string {
  const totals: Record<string, number> = {};
  for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) totals[k] = (totals[k] ?? 0) + v;
  const errs = legErrors(r); const mean = meanAbs(errs);
  const inst = instrumentFindingSentence(r.instrumentDiscipline ?? []);
  // EDU-001: a misread minute (60 s at the next checkpoint) heads the tip whatever the leg error says (Start on time, the second S)
  const minute = (r.findings ?? []).find(f => f.kind === 'oneMinuteMistake');
  if (minute) return `Start on time (the second S): ${minute.text}${inst}`;
  // PLAY-006: "Clean run" only with no penalty item (observation miss, early departure, DNF) and no start / minute / timed-interval finding
  const penalties = !!r.observationMissed || (r.score.earlyDeparturePenalty ?? 0) > 0 || !!r.score.dnf || (r.findings ?? []).length > 0;
  // B7: an instrument finding is a finding too: the verdict is never "Clean run" next to one
  const instrumentFindings = (r.instrumentDiscipline ?? []).length > 0;
  if (!penalties && instrumentFindings && mean <= 3 && r.offCourseCount === 0) return `Leg times are clean, but the instruments were not used as taught:${inst}`;
  if (penalties && mean <= 3 && r.offCourseCount === 0) {
    const f = (r.findings ?? [])[0];
    if ((r.score.earlyDeparturePenalty ?? 0) > 0) return `Leg times are clean, but you left a promoted stop more than ${5} minutes before its departure time (+${r.score.earlyDeparturePenalty} s): leave AT the printed time, never earlier.${inst}`;
    if (r.observationMissed) return `Leg times are clean, but the Observation Checkpoint was missed (+${r.score.observationPenalty} s): stop at the red GREAT RACE STOP board.${inst}`;
    if (f) return `Leg times are clean, but: ${f.text}${inst}`;
  }
  // EDU-002: under three stars the verdict is never "Clean run"; the largest cause below is named instead
  const underThree = opts.stars !== undefined && opts.stars < 3;
  if (mean <= 3 && r.offCourseCount === 0 && !penalties && !underThree) return `Clean run: the remaining seconds are speed-holding noise, and consistency is what wins over nine days.${inst}`;
  // EDU-003: a wrong turn gets the stay-on-course and lost doctrine, never the 10 % lecture
  if (r.offCourseCount > 0) return `${tipFor('offCourse', true, sc, r.events)}${inst}`;
  const net = Object.values(totals).reduce((a, b) => a + b, 0);
  // the largest cause with the same sign as the net error (a negative cruise bucket against positive stops is recovery, not a fault)
  const sameSign = Object.entries(totals).filter(([k, v]) => k !== 'ta' && Math.sign(v) === Math.sign(net) && Math.abs(v) >= 1.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [k, v] = sameSign[0] ?? Object.entries(totals).filter(([k]) => k !== 'ta').sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['cruise', 0];
  const recovered = -Math.min(0, totals.cruise ?? 0);
  const credit = taCreditTotal(r);
  const name = k === 'stop' ? 'stops' : k;
  // EDU-003: a Time Allowance that covers the delay is the procedure working, not a recovery shortfall
  if (credit > 0 && k === 'hazard') {
    const left = Math.round(v - recovered - credit);
    const what = `Delayed ${Math.round(v)} s by hazards: you made up ${Math.round(recovered)} s and the committee credited ${Math.round(credit)} s at the TA point`;
    if (opts.stars === 3) return `Clean run: three stars. ${what}.${inst}`;
    return `${what}${left > 3 ? `; the ${left} s still owed are made up with the 10 % rule before the checkpoint` : ': the credit covers what was left, which is the Time Allowance working as intended'}.${inst}`;
  }
  if (k !== 'cruise' && recovered > 3 && net > 0) {
    if (opts.stars === 3) return `Clean run: three stars. You lost ${Math.round(v)} s in ${name} and made up ${Math.round(recovered)} s in cruise; what is left is inside this drill's tolerance.${inst}`;
    return `You lost ${Math.round(v)} s in ${name} and recovered ${Math.round(recovered)} s in cruise; recover a little more, or earlier, next time (10 % rule: 10 % faster for 10 x the seconds lost).${inst}`;
  }
  const late = v > 0;
  return `${tipFor(k, late, sc, r.events, r)}${inst}`;
}

/** The turn cap (mph) the car obeys at a stop that turns: the car's own 90 / 45 / acute turn speed (the same cap the Debrief and the card use). */
function stopTurnCap(turn: string | null | undefined, car: Scenario['car']): number | undefined {
  const ang = ({ L: 90, R: 90, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 } as Record<string, number>)[turn ?? ''];
  if (ang === undefined) return undefined;
  return ang > 120 ? car.turnSpeedMph.acute : ang >= 60 ? car.turnSpeedMph.turn : car.turnSpeedMph.bear;
}
/**
 * PT-10 N-C5: the stops at a turn that ran long. A stop that turns out of the stop costs more than a straight one on the chart (the car leaves at the turn speed and
 * accelerates from there): `extra` is that difference for the stop's own speeds, `cap` the turn speed. Empty for table cars (the Packard prints no turning stops).
 */
export function turningStopExtras(r: StageResult, sc: Scenario, over = 1): { line: number | null; extra: number; cap: number }[] {
  const out: { line: number | null; extra: number; cap: number }[] = [];
  if (sc.car.tables) return out;
  for (const a of r.attribution ?? []) for (const st of a.stops ?? []) {
    if (!(st.pause > 0) || st.actualCost - Math.max(0, st.trafficWait ?? 0) <= over) continue;
    const cap = stopTurnCap(st.turn, sc.car); if (cap === undefined || !st.vIn || !st.vOut) continue;
    try { const extra = Math.round((stopLoss(st.vIn, st.vOut, sc.car, cap) - stopLoss(st.vIn, st.vOut, sc.car)) * 10) / 10; if (extra >= 0.3) out.push({ line: st.line, extra, cap }); } catch { /* skip */ }
  }
  return out;
}
/** The sentence that says why a turning stop runs long (PT-10 N-C5). */
export function turningStopNote(r: StageResult, sc: Scenario): string {
  const ex = turningStopExtras(r, sc); if (!ex.length) return '';
  const avg = Math.round(ex.reduce((x, e) => x + e.extra, 0) / ex.length * 10) / 10;
  return ` ${ex.length === 1 ? `Line ${ex[0]!.line} is a stop that turns` : `${ex.length} of the stops turn`}: the turn adds ${avg.toFixed(1)} s to the stop and go (the car leaves at the ${ex[0]!.cap} mph turn speed and accelerates from there), so go ${avg.toFixed(1)} s earlier than the straight-stop chart pause time: the simple chart's turning-stop column has it.`;
}

function tipForStop(late: boolean): string {
  return late ? 'Your stops cost more than the printed pause, so go earlier: dwell = the chart pause time for your IN/OUT pair (the printed pause minus the stop/start loss), written next to every pause.' : 'You left stops too early and are not using the whole pause: dwell = the chart pause time, no less.';
}

function tipFor(k: string, late: boolean, sc?: Scenario, events?: SimEvent[], r?: StageResult): string {
  switch (k) {
    case 'stop': {
      // PLAY-028: "go earlier" only when a dwell at a printed pause was really long (more than 1 s over the chart pause time at some stop)
      if (late && r) { const long = longDwells(r); const c = stopCauses(r);
        const pauseStops = (r.attribution ?? []).some(a => (a.stops ?? []).some(st => st.pause > 0));
        if (!long.length && (pauseStops || c.noPause >= 1.5)) {
          if (c.noPause >= 1.5) return `Your stops cost ${Math.round(c.noPause + Math.max(0, c.pause))} s, but your dwells were right (every printed pause within 1 s): the loss is at STOP signs with no pause printed, where the stop and go costs the car time that no dwell can save. Go as soon as it is safe and make the seconds up with the 10 % rule (10 % faster for 10 x the seconds lost).`;
          return `Your dwells were right (every printed pause within 1 s of the chart pause time); the ${Math.round(c.pause)} s in the stop bucket is small overruns added up: keep counting from "Stopped" on the stopwatch and say GO on the chart second.`;
        }
        if (c.noPause >= 1.5 && c.pause < 1.5) return `Your stops cost ${Math.round(c.noPause + Math.max(0, c.pause))} s, but your dwells were right: the loss is at STOP signs with no pause printed, where the stop and go costs the car time that no dwell can save. Go as soon as it is safe and make the seconds up with the 10 % rule (10 % faster for 10 x the seconds lost).`; }
      return `${tipForStop(late)}${late && r && sc ? turningStopNote(r, sc) : ''}`;
    }
    case 'start': return late ? 'You left the start late: leave early by the standstill acceleration loss (the 0 > speed cell of your acceleration chart; about 4-5 s for the simulator\'s Ford, a simulator default: measure your car).' : 'You left the start too early: lead by the acceleration loss only (about 4-5 s for the simulator\'s Ford), not more.';
    case 'speedChange': return 'Landmark speed changes are mistimed: split at the sign, crossing it at the midpoint speed, which means beginning the change half a ramp early.';
    case 'timedChange': return "Timed changes are off: count from the ghost's departure (arrival + pause) and split the change at the sign by calling it half a ramp early.";
    case 'hazard': return 'Lights, trains or traffic cost you: time every delay on the stopwatch, then make it up with the 10 % rule (10 % faster for 10 x the seconds lost, 4 s lost at 35 -> 38.5 mph for 40 s) or, for a train or accident, file a Time Allowance at the TA point, never both.';
    case 'offCourse': return "A wrong turn cost the leg: stay on course first (the third of the Four S's) and confirm the landmark before the leading edge of the intersection. Once you know you are lost: turn around where it is safe, start the stopwatch at the turn-around and double it for the lost time, rejoin 30 s behind a car known to be on course, and never ask for a Time Allowance for a wrong turn.";
    case 'turn': return 'Turns cost time the ghost does not spend: write the turn chart loss on your card (the handbook\'s Packard: approach 40, exit 35 = 4.0 s) and recover it with the 10 % rule right after the turn.';
    case 'cruise': {
      if (sc && events && uncalledSpeeds(events, sc).length) { const m = uncalledSpeeds(events, sc); return `Cruise ran ${late ? 'slow' : 'fast'} because ${m.length === 1 ? `${m[0]!.mph} at line ${m[0]!.line} was` : `${m.length} new speeds (first ${m[0]!.mph} at line ${m[0]!.line}) were`} never called: the driver keeps the old speed until you call the new one (a stop that leaves at the speed it came in at needs no call).`; }
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
  const tip = headlineTip(r, sc, { stars });
  const feedback = [tip, ...extra];
  const top = topFinding(r.instrumentDiscipline ?? []); // the tip already names the most frequent kind; list the others here
  if (top) feedback.push(...instrumentFindingLines((r.instrumentDiscipline ?? []).filter(f => f.kind !== top.kind)));
  if (r.offCourseCount) feedback.push(`Off course ${r.offCourseCount} time(s): a wrong turn costs far more than a timing error.`);
  if (r.observationMissed) feedback.push('You did not stop at the Observation Checkpoint: call stop before the finish banner.');
  if (r.score.aces) feedback.push(`${r.score.aces} ACE${r.score.aces > 1 ? 's' : ''}!`);
  return { score: Math.round(mean * 10) / 10, stars, feedback, tip, headline: `${r.score.raw} s raw (${r.score.benchmark}), ${r.score.aces} ace(s)` };
}

/**
 * EDU-002: a rubric whose stars were lowered by its own skill check (call timing, chart cells, reads) names that skill as the tip, in place of
 * the leg-error verdict (which moves down the list unless it was a "Clean run"). With `stars` already final, the leg-error tip is recomputed so it
 * is never "Clean run" under three stars.
 */
export function withSkillTip(rb: Rubric, r: StageResult, sc: Scenario, skillTip: string | null): Rubric {
  const legTip = headlineTip(r, sc, { stars: rb.stars });
  const oldTip = rb.tip ?? rb.feedback[0];
  const rest = rb.feedback.filter(f => f !== oldTip);
  if (skillTip) { rb.tip = skillTip; rb.feedback = [skillTip, ...(legTip.startsWith('Clean run') ? [] : [legTip]), ...rest]; }
  else { rb.tip = legTip; rb.feedback = [legTip, ...rest]; }
  return rb;
}

/**
 * PLAY-006: the navigator's call error at each timed change (D04) or landmark speed change (D05): when the new speed was called against when it
 * should have been (timed: T - half the ramp after the line; landmark: half the ramp before the sign). + = late. A change never called counts as
 * `missedPenalty` seconds late. These are the same numbers the Debrief's bias row prints, so the stars and the bias row agree.
 */
export function callErrors(r: StageResult, sc: Scenario, kind: 'timed' | 'landmark', missedPenalty = 5, only?: (ins: Instruction) => boolean): number[] {
  const ev = r.events; const out: number[] = []; let assigned: number | undefined = undefined; let prevTimed = false;
  for (const ins of sc.book) {
    const vBefore = assigned;
    if (ins.timed) assigned = ins.timed.thenSpeed; else if (ins.speed !== undefined) assigned = ins.speed;
    const node = sc.course.nodes.find(n => n.id === ins.nodeId);
    const ci = ev.findIndex(e => e.type === 'node' && e.detail?.nodeId === ins.nodeId);
    const wasTimed = prevTimed; prevTimed = !!ins.timed;
    if (ci < 0) continue;
    if (only && !only(ins)) continue;
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
    if (!called && before !== v) out.push({ legIndex: legs[ci] ?? 1, line: ins.n, mph: v }); // N4: after a STOP the driver resumes the speed he carried in by himself: only a different out speed has to be called
  }
  return out;
}

