/**
 * Debrief view-model (UI-007, DEBRIEF-001, DEBRIEF-003, DEBRIEF-004): per-CP rows, attribution buckets that sum to
 * the leg error, worked arithmetic per maneuver, ledger accuracy, bias vs noise, timeline.
 * Stops come from the engine's attribution[].stops (line, pause, dwell, entry/exit speed, turn); the event log only
 * supplies the wait/go/release times, and is the fallback for stops in the unscored tail after the last checkpoint.
 * Restart holds (lunch) are not stops: they are judged against the out-time (workedRestarts).
 */
import type { StageResult, Bucket, LegAttribution, SimEvent } from '../../core/sim.js';
import type { Scenario, AidsConfig, Instruction } from '../../core/course.js';
import { buildGhost, ghostTimeAt } from '../../core/ghost.js';
import { stopLoss, rampLead, accelLoss } from '../../core/perf-table.js';
import { headlineTip as engineHeadlineTip } from '../../core/drills/rubrics.js';
import { formatClock, formatSigned } from '../../core/units.js';
import { stopsFromEvents, speedsByNode, turnCap } from './counterfactual.js';
import { restartLabel, lineSpeeds } from './cockpitinfo.js';

export const BUCKETS: Bucket[] = ['cruise', 'stop', 'speedChange', 'timedChange', 'hazard', 'offCourse', 'turn', 'start', 'ta'];
export const BUCKET_LABEL: Record<Bucket, string> = {
  cruise: 'Cruise (speed holding / card)', stop: 'Stops & pauses', speedChange: 'Speed changes', timedChange: 'Timed changes',
  hazard: 'Hazards (lights, trains, slow traffic)', offCourse: 'Off course', turn: 'Turns', start: 'Start / restart', ta: 'Time allowance credit',
};

export interface CpRow {
  legIndex: number; cpId: string;
  perfect: string; actual: string;
  perfectTod: number; actualTod: number | null;
  error: number | null; errorText: string;
  penalty: number; ace: boolean; missed: boolean; sightZone: boolean; taCredit: number;
}

export interface BucketSeg { bucket: Bucket; label: string; seconds: number }
export interface LegAttributionVm { legIndex: number; cpId: string; error: number | null; segments: BucketSeg[]; sum: number; residual: number; cruiseSeconds: number; meanSpeedRatio: number }

/** Worked stop arithmetic (DEBRIEF-001). `net`/`delta` = yourDwell + carLoss - pause (seconds late, + = late). */
export interface StopRow {
  legIndex: number; nodeId: string | null; line: number | null;
  vIn: number | null; vOut: number | null; entrySpeed: number | null; exitSpeed: number | null;
  pause: number; carLoss: number | null; cardLoss: number | null; idealDwell: number | null; correctDwell: number | null;
  yourDwell: number; goAt: number | null; net: number; delta: number;
  /** TOD of the driver's "Stopped" and of the release. */
  waitTod: number; releaseTod: number | null;
  text: string; formulaText: string;
}

export interface TimedRow { legIndex: number; line: number; nodeId: string; T: number; holdSpeed: number; thenSpeed: number; rampLead: number; correctCall: number; yourCall: number | null; delta: number | null; text: string }
export interface LandmarkRow { legIndex: number; line: number; nodeId: string; from: number; to: number; rampLead: number; correctCall: number; yourCall: number | null; delta: number | null; text: string }
export interface TurnRow {
  legIndex: number; line: number; nodeId: string; dir: string;
  /** Seconds relative to the node crossing (negative = before). */
  calledAt: number | null;
  /** Distance (ft) the car had left to the node when the call was made, and the distance the car needs to brake for the turn. */
  callFt: number | null; neededFt: number;
  /** The call was made while the car stood at this node's STOP: fine, and not part of the callout statistic. */
  whileStopped: boolean;
  /** Seconds of braking time missing (0 when on time). */
  lateBy: number | null;
  /** The driver refused the turn because it was called too late (engine event turnMissed). */
  missed: boolean;
  late: boolean; text: string;
}
/** Lunch / restart hold judged against the printed out-time (not a stop). */
export interface RestartRow { legIndex: number; line: number | null; nodeId: string | null; outTod: number; idealGoTod: number; goTod: number | null; delta: number | null; accelLoss: number; text: string }
export interface CruiseRow { legIndex: number; assigned: number | null; meanTrue: number | null; ratio: number; cruiseSeconds: number; secondsOver: number; cardCorrectionPct: number; text: string }

export interface LedgerRow { tod: number; believed: number; truth: number; diff: number; legIndex: number }
export interface LedgerVm { rows: LedgerRow[]; count: number; meanAbs: number | null; maxAbs: number | null; text: string }

export type ManeuverType = 'stop' | 'timed' | 'landmark' | 'turn' | 'cruise' | 'restart';
export interface BiasRow { type: ManeuverType; label: string; n: number; mean: number | null; sd: number | null; histN: number; histMean: number | null; histSd: number | null; verdict: 'bias' | 'noise' | 'none'; fix: string }
export interface BiasNoiseVm { rows: BiasRow[]; tip: string | null; topType: ManeuverType | null; errors: Record<ManeuverType, number[]> }

export interface TimelinePoint { tod: number; s: number; e: number; label?: string; kind: 'event' | 'checkpoint' | 'start' }

export interface CpCard { cpId: string; legIndex: number; tod: number; showUntil: number; error: number; largestBucket: Bucket | null; largestBucketSeconds: number; largestEvent: string | null }

export interface DebriefVm {
  rows: CpRow[];
  legs: LegAttributionVm[];
  stops: StopRow[];
  timed: TimedRow[];
  landmarks: LandmarkRow[];
  turns: TurnRow[];
  restarts: RestartRow[];
  cruise: CruiseRow[];
  ledger: LedgerVm;
  bias: BiasNoiseVm;
  totals: Record<Bucket, number>;
  headline: string;
  /** The one tip shown as "Fix this next" (the engine headline: largest bucket). */
  tip: string;
  /** tip first, then at most one maneuver-specific follow-up (never a turn tip that outranks a larger stops bucket). */
  tips: string[];
  score: { raw: number; ageFactor: number; score: number; aces: number; legs: number };
  timeline: TimelinePoint[];
  offCourseCount: number;
  observationMissed: boolean;
  drivingSeconds: number;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
/** Signed with one decimal: "+3.3", "-0.4", "0.0". */
export const signed1 = (x: number): string => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));

export interface DebriefOptions { history?: Partial<Record<ManeuverType, number[]>> | null }

export function debriefViewModel(result: StageResult | null | undefined, scenario?: Scenario | null, opts: DebriefOptions = {}): DebriefVm {
  const legsScore = result?.score?.legs ?? [];
  const attribution: LegAttribution[] = Array.isArray(result?.attribution) ? result!.attribution : [];
  const events: SimEvent[] = Array.isArray(result?.events) ? result!.events : [];
  const rows: CpRow[] = legsScore.map(l => {
    const perfectTod = num(l.anchorTod) + num(l.perfectDuration);
    const missed = !!l.extras?.missed || l.actualTod === null;
    return {
      legIndex: l.index, cpId: l.cpId, perfectTod, actualTod: l.actualTod,
      perfect: formatClock(perfectTod), actual: l.actualTod === null ? 'missed' : formatClock(l.actualTod),
      error: l.error, errorText: l.error === null ? '-' : formatSigned(l.error),
      penalty: num(l.penalty), ace: !!l.ace, missed, sightZone: num(l.extras?.sightZone) > 0, taCredit: num(l.taCredit),
    };
  });

  const totals = emptyBuckets();
  const legs: LegAttributionVm[] = legsScore.map(l => {
    const att = attribution.find(a => a.legIndex === l.index);
    const segments: BucketSeg[] = [];
    let sum = 0;
    for (const b of BUCKETS) {
      let v = num(att?.buckets?.[b]);
      if (b === 'ta') v -= num(l.taCredit); // TA credit reduces the scored error
      if (Math.abs(v) < 0.05) continue;
      v = r1(v);
      segments.push({ bucket: b, label: BUCKET_LABEL[b], seconds: v });
      totals[b] += v; sum += v;
    }
    const residual = l.error === null ? 0 : r1(l.error - sum);
    return { legIndex: l.index, cpId: l.cpId, error: l.error, segments, sum: r1(sum), residual, cruiseSeconds: num(att?.cruiseSeconds), meanSpeedRatio: num(att?.meanSpeedRatio, 1) };
  });

  const stops = workedStops(events, scenario, attribution);
  const timed = workedTimed(events, scenario);
  const landmarks = workedLandmarks(events, scenario);
  const turns = workedTurns(events, scenario);
  const restarts = workedRestarts(events, scenario);
  const cruise = workedCruise(attribution, scenario);
  const ledger = ledgerAccuracy(result?.ledgerLog);
  const perfectSpeedo = !!scenario && scenario.speedo.kind === 'timewise' && Math.abs(scenario.speedo.gain - 1) < 0.003 && Math.abs(scenario.speedo.offset) < 0.1;
  const bias = biasNoise({ stops, timed, landmarks, turns, cruise, restarts }, opts.history ?? null, { perfectSpeedo });
  const { headline, tip: bucketTip } = headlineTip(totals, rows, result);
  const tips = rankTips(result, scenario, rows.length > 0, bucketTip, bias, totals);
  const tip = tips[0]!;
  const score = { raw: num(result?.score?.raw), ageFactor: num(result?.score?.ageFactor, 1), score: num(result?.score?.score), aces: num(result?.score?.aces), legs: rows.length };
  return {
    rows, legs, stops, timed, landmarks, turns, restarts, cruise, ledger, bias, totals, headline, tip, tips, score,
    timeline: timelinePoints(events, scenario),
    offCourseCount: num(result?.offCourseCount), observationMissed: !!result?.observationMissed, drivingSeconds: num(result?.drivingSeconds),
  };
}

function emptyBuckets(): Record<Bucket, number> { return { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 }; }

/** Leg index for each event index (timing checkpoints crossed before + 1). */
function legAt(events: SimEvent[]): number[] {
  const out: number[] = []; let leg = 1;
  for (const ev of events) { out.push(leg); if (ev?.type === 'checkpoint' && ev.detail?.kind === 'timing') leg++; }
  return out;
}

export function workedStops(events: SimEvent[] | null | undefined, scenario?: Scenario | null, attribution?: LegAttribution[]): StopRow[] {
  const by = speedsByNode(scenario);
  const out: StopRow[] = [];
  const att = (attribution ?? []).flatMap(a => (a.stops ?? []).map(st => ({ ...st, legIndex: a.legIndex })));
  const used = new Set<number>();
  const stops = stopsFromEvents(events).filter(s => s.reason === 'stop' || s.reason === 'hold');
  for (const st of stops) {
    const insAt = st.nodeId ? scenario?.book.find(i => i.nodeId === st.nodeId) : undefined;
    if (insAt && restartLabel(insAt)) continue; // a restart hold is judged against the out-time, not as a stop
    const ai = att.findIndex((x, i) => !used.has(i) && x.nodeId === st.nodeId && x.legIndex === st.legIndex);
    const a = ai >= 0 ? att[ai] : undefined; if (ai >= 0) used.add(ai);
    const sp = st.nodeId ? by.get(st.nodeId) : undefined;
    const vIn = sp?.vIn ?? (a ? a.vIn : null), vOut = sp?.vOut ?? (a ? a.vOut : null);
    const pause = a ? num(a.pause) : sp ? sp.pause : 0;
    const turn = sp?.turn ?? (a?.turn as Instruction['turn'] | null | undefined) ?? undefined;
    let carLoss: number | null = null;
    if (scenario && vOut !== null && vOut > 0) {
      const vi = vIn !== null && vIn > 0 ? vIn : vOut;
      try { carLoss = r1(stopLoss(vi, vOut, scenario.car, turnCap(turn, scenario))); } catch { carLoss = null; }
    }
    const idealDwell = carLoss === null ? null : r1(Math.max(0, pause - carLoss));
    const end = st.releaseTod ?? st.goTod ?? st.waitTod;
    const yourDwell = a ? r1(Math.max(0, a.dwell)) : r1(Math.max(0, end - st.waitTod));
    const goAt = st.goTod === null ? null : r1(st.goTod - st.waitTod);
    const net = carLoss === null ? r1(yourDwell - pause) : r1(yourDwell + carLoss - pause);
    const line = a?.line ?? sp?.line ?? null;
    const formulaText = carLoss === null
      ? `dwell = ${pause} - ? ; you called go at ${yourDwell.toFixed(1)} s`
      : `dwell = ${pause} - ${carLoss.toFixed(1)} = ${idealDwell!.toFixed(1)} s; you called go at ${yourDwell.toFixed(1)} s; ${signed1(net)} s`;
    const text = carLoss === null
      ? `Stop at line ${line ?? '?'}: pause ${pause} s; you waited ${yourDwell.toFixed(1)} s; ${signed1(net)} s vs the printed pause.`
      : `Stop at line ${line ?? '?'}: entry ${vIn ?? vOut} / exit ${vOut}${turn && turn !== 'S' ? ` (turn ${turn}, capped at ${turnCap(turn, scenario!)} mph)` : ''}. Pause ${pause} s minus car loss ${carLoss.toFixed(1)} s = ideal dwell ${idealDwell!.toFixed(1)} s. You waited ${yourDwell.toFixed(1)} s -> ${signed1(net)} s.`;
    out.push({
      legIndex: st.legIndex, nodeId: st.nodeId, line, vIn, vOut, entrySpeed: vIn, exitSpeed: vOut, pause, carLoss, cardLoss: carLoss,
      idealDwell, correctDwell: idealDwell, yourDwell, goAt, net, delta: net, waitTod: st.waitTod, releaseTod: st.releaseTod, text, formulaText,
    });
  }
  return out;
}

/** Lunch / restart holds: the ideal "go" is the out-time minus the standing-start loss; the pause and stop loss do not apply. */
export function workedRestarts(events: SimEvent[] | null | undefined, scenario?: Scenario | null): RestartRow[] {
  const out: RestartRow[] = [];
  if (!scenario) return out;
  for (const st of stopsFromEvents(events)) {
    if (st.reason !== 'hold' || !st.nodeId) continue;
    const ins = scenario.book.find(i => i.nodeId === st.nodeId);
    if (!ins || !restartLabel(ins) || ins.restartTime === undefined) continue;
    const vOut = lineSpeeds(scenario, ins.n).vOut ?? ins.speed ?? 30;
    let accel = 0; try { accel = r1(accelLoss(vOut, scenario.car)); } catch { accel = 0; }
    const outTod = ins.restartTime;
    const idealGoTod = outTod - accel;
    const goTod = st.goTod ?? st.releaseTod;
    const delta = goTod === null ? null : r1(goTod - idealGoTod);
    const text = delta === null
      ? `Restart at line ${ins.n}: out-time ${formatClock(outTod)}; you never called go.`
      : `Restart at line ${ins.n}: out-time ${formatClock(outTod)}. Ideal go = out-time - standing-start loss ${accel.toFixed(1)} s = ${formatClock(idealGoTod)}; you called go at ${formatClock(goTod!)} -> ${signed1(delta)} s.`;
    out.push({ legIndex: st.legIndex, line: ins.n, nodeId: st.nodeId, outTod, idealGoTod, goTod: goTod ?? null, delta, accelLoss: accel, text });
  }
  return out;
}

/** Timed changes: T, ramp lead, correct call (after the car's node crossing), your call, delta. */
export function workedTimed(events: SimEvent[] | null | undefined, scenario?: Scenario | null): TimedRow[] {
  const out: TimedRow[] = [];
  if (!scenario?.book || !Array.isArray(events)) return out;
  const legs = legAt(events);
  for (const ins of scenario.book) {
    if (!ins.timed) continue;
    const ci = events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === ins.nodeId);
    if (ci < 0) continue;
    const cross = events[ci]!;
    const T = num(ins.timed.seconds);
    let lead = 0; try { lead = r1(rampLead(ins.timed.holdSpeed, ins.timed.thenSpeed, scenario.car)); } catch { lead = 0; }
    const correctCall = r1(T - lead);
    const call = events.slice(ci + 1).find(e => e?.type === 'call.speed' && e.detail?.mph === ins.timed!.thenSpeed && e.tod <= cross.tod + T + 90);
    const yourCall = call ? r1(call.tod - cross.tod) : null;
    const delta = yourCall === null ? null : r1(yourCall - correctCall);
    const text = yourCall === null
      ? `Timed change at line ${ins.n}: T = ${T}, ramp ${ins.timed.holdSpeed}->${ins.timed.thenSpeed} lead ${lead.toFixed(1)} s, call at ${correctCall.toFixed(1)}; you never called ${ins.timed.thenSpeed}.`
      : `Timed change at line ${ins.n}: T = ${T}, lead ${lead.toFixed(1)} s, call at ${correctCall.toFixed(1)}; you called at ${yourCall.toFixed(1)}; ${signed1(delta!)} s.`;
    out.push({ legIndex: legs[ci] ?? 1, line: ins.n, nodeId: ins.nodeId, T, holdSpeed: ins.timed.holdSpeed, thenSpeed: ins.timed.thenSpeed, rampLead: lead, correctCall, yourCall, delta, text });
  }
  return out;
}

/** Landmark speed changes (no stop, no timed): call should be rampLead before the crossing. */
export function workedLandmarks(events: SimEvent[] | null | undefined, scenario?: Scenario | null): LandmarkRow[] {
  const out: LandmarkRow[] = [];
  if (!scenario?.book || !Array.isArray(events)) return out;
  const by = speedsByNode(scenario);
  const legs = legAt(events);
  let prevTimed = false;
  for (const ins of scenario.book) {
    const sp = by.get(ins.nodeId);
    const isStop = scenario.course.nodes.find(n => n.id === ins.nodeId)?.control === 'STOP';
    const skip = !sp || sp.vIn === null || sp.vOut === null || sp.vIn === sp.vOut || ins.timed || ins.pause || isStop || ins.section === 'start' || ins.section === 'restart' || prevTimed;
    prevTimed = !!ins.timed;
    if (skip) continue;
    const ci = events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === ins.nodeId);
    if (ci < 0) continue;
    const cross = events[ci]!;
    let lead = 0; try { lead = r1(rampLead(sp.vIn!, sp.vOut!, scenario.car)); } catch { lead = 0; }
    const call = [...events.slice(0, ci + 1)].reverse().find(e => e?.type === 'call.speed' && e.detail?.mph === sp.vOut && e.tod >= cross.tod - 120)
      ?? events.slice(ci + 1).find(e => e?.type === 'call.speed' && e.detail?.mph === sp.vOut && e.tod <= cross.tod + 60);
    const yourCall = call ? r1(call.tod - cross.tod) : null;
    const correctCall = r1(-lead);
    const delta = yourCall === null ? null : r1(yourCall - correctCall);
    const text = yourCall === null
      ? `Speed change at line ${ins.n} (${sp.vIn}->${sp.vOut}): call ${lead.toFixed(1)} s before the landmark; you never called it.`
      : `Speed change at line ${ins.n} (${sp.vIn}->${sp.vOut}): call ${lead.toFixed(1)} s before the landmark; you called ${yourCall <= 0 ? `${(-yourCall).toFixed(1)} s before` : `${yourCall.toFixed(1)} s after`}; ${signed1(delta!)} s.`;
    out.push({ legIndex: legs[ci] ?? 1, line: ins.n, nodeId: ins.nodeId, from: sp.vIn!, to: sp.vOut!, rampLead: lead, correctCall, yourCall, delta, text });
  }
  return out;
}

/** Required distance (ft) for a turn call: braking from the assigned speed to the car's turn cap, plus one second of reaction. */
export function turnCallDistanceFt(sc: Scenario, vMph: number, turn: Instruction['turn']): number {
  const cap = turnCap(turn, sc) ?? vMph;
  const v = vMph * 1.46667, vc = Math.min(cap, vMph) * 1.46667;
  const brake = Math.max(0, (v * v - vc * vc) / (2 * sc.car.aDec));
  return Math.round(brake + v);
}

/** Turn callouts: made early enough to brake (distance, not seconds-from-the-node), and not counted when made while stopped at that node. */
export function workedTurns(events: SimEvent[] | null | undefined, scenario?: Scenario | null): TurnRow[] {
  const out: TurnRow[] = [];
  if (!scenario?.book || !Array.isArray(events)) return out;
  const legs = legAt(events);
  const stopList = stopsFromEvents(events);
  for (const ins of scenario.book) {
    if (!ins.turn || ins.turn === 'S') continue;
    const ci = events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === ins.nodeId);
    if (ci < 0) continue;
    const cross = events[ci]!;
    const nodeS = scenario.course.nodes.find(n => n.id === ins.nodeId)?.s ?? cross.s;
    const call = [...events.slice(0, ci + 1)].reverse().find(e => e?.type === 'call.turn' && e.detail?.dir === ins.turn && e.tod >= cross.tod - 180);
    const calledAt = call ? r1(call.tod - cross.tod) : null;
    const stopHere = stopList.find(s => s.nodeId === ins.nodeId);
    const whileStopped = !!(call && stopHere && call.tod >= stopHere.waitTod - 0.05 && call.tod <= (stopHere.releaseTod ?? cross.tod) + 0.05);
    const vAssigned = lineSpeeds(scenario, ins.n).vIn ?? lineSpeeds(scenario, ins.n).vOut ?? 35;
    const neededFt = turnCallDistanceFt(scenario, vAssigned, ins.turn);
    const callFt = call ? Math.max(0, Math.round(nodeS - call.s)) : null;
    const lateBy = whileStopped ? 0 : callFt === null ? null : events.some(e => e?.type === 'turnMissed' && e.detail?.nodeId === ins.nodeId) ? r1(Math.max(3, (neededFt - callFt) / (vAssigned * 1.46667))) : callFt >= neededFt ? 0 : r1((neededFt - callFt) / (vAssigned * 1.46667));
    const missed = events.some(e => e?.type === 'turnMissed' && e.detail?.nodeId === ins.nodeId);
    const late = missed || (!whileStopped && (callFt === null || callFt < neededFt));
    const text = missed ? `Turn at line ${ins.n} (${ins.turn}): called ${callFt === null ? 'too late (no callout)' : `${callFt} ft out`}; the driver could not make it at ${vAssigned} mph and went straight on. Call turns 500-600 ft out.`
      : call === undefined || calledAt === null
      ? `Turn at line ${ins.n} (${ins.turn}): no callout before the intersection.`
      : whileStopped ? `Turn at line ${ins.n} (${ins.turn}): called while stopped at the sign: fine.`
      : `Turn at line ${ins.n} (${ins.turn}): called ${callFt} ft before the intersection${late ? ` (late: this car needs about ${neededFt} ft to brake from ${vAssigned} mph; call turns 500-600 ft out)` : ` (needs ${neededFt} ft)`}.`;
    out.push({ legIndex: legs[ci] ?? 1, line: ins.n, nodeId: ins.nodeId, dir: ins.turn, calledAt, callFt, neededFt, whileStopped, lateBy, missed, late, text });
  }
  return out;
}

export function workedCruise(attribution: LegAttribution[] | null | undefined, scenario?: Scenario | null): CruiseRow[] {
  const out: CruiseRow[] = [];
  if (!Array.isArray(attribution)) return out;
  const assigned = scenario?.book?.find(i => typeof i.speed === 'number')?.speed ?? null;
  for (const a of attribution) {
    const ratio = num(a?.meanSpeedRatio, 1);
    const secondsOver = r1(num(a?.buckets?.cruise));
    const cruiseSeconds = r1(num(a?.cruiseSeconds));
    if (cruiseSeconds <= 0) continue;
    const meanTrue = assigned === null ? null : r1(assigned * ratio);
    const pct = ratio > 0 ? r1((1 / ratio - 1) * 100) : 0;
    const text = `Leg ${a.legIndex}: mean true speed ${meanTrue === null ? `${(ratio * 100).toFixed(1)} % of assigned` : `${meanTrue.toFixed(1)} for assigned ${assigned}`} -> ratio ${ratio.toFixed(3)} -> ${signed1(secondsOver)} s over ${Math.round(cruiseSeconds)} s of cruise${Math.abs(pct) >= 0.3 ? ` -> your card is ${Math.abs(pct).toFixed(1)} % ${pct > 0 ? 'low (call more)' : 'high (call less)'}` : ''}.`;
    out.push({ legIndex: a.legIndex, assigned, meanTrue, ratio, cruiseSeconds, secondsOver, cardCorrectionPct: pct, text });
  }
  return out;
}

export function ledgerAccuracy(log: StageResult['ledgerLog'] | null | undefined): LedgerVm {
  const rows: LedgerRow[] = (Array.isArray(log) ? log : []).filter(l => l && typeof l.believed === 'number' && typeof l.truth === 'number')
    .map(l => ({ tod: num(l.tod), believed: l.believed, truth: r1(l.truth), diff: r1(l.believed - l.truth), legIndex: num(l.legIndex, 1) }));
  if (!rows.length) return { rows, count: 0, meanAbs: null, maxAbs: null, text: 'No ledger entries: press E during the run to state how early/late you believe you are.' };
  const abs = rows.map(r => Math.abs(r.diff));
  const meanAbs = r1(abs.reduce((a, b) => a + b, 0) / abs.length);
  const maxAbs = r1(Math.max(...abs));
  return { rows, count: rows.length, meanAbs, maxAbs, text: `${rows.length} ledger entr${rows.length === 1 ? 'y' : 'ies'}: mean |believed - truth| ${meanAbs.toFixed(1)} s, worst ${maxAbs.toFixed(1)} s.` };
}

const MANEUVER_LABEL: Record<ManeuverType, string> = { stop: 'Stops (dwell)', timed: 'Timed changes', landmark: 'Landmark speed changes', turn: 'Turn callouts (late by, s)', cruise: 'Cruise (card)', restart: 'Restart (go vs out-time)' };
const FIX: Record<ManeuverType, { bias: (m: number, o: { perfectSpeedo: boolean }) => string; noise: string }> = {
  stop: { bias: m => (m > 0 ? `Your "go" calls average ${Math.abs(m).toFixed(1)} s late: subtract ${Math.abs(m).toFixed(0)} more from every dwell on the card, or react on "one", not "go".` : `Your "go" calls average ${Math.abs(m).toFixed(1)} s early: add ${Math.abs(m).toFixed(0)} s to every dwell on the card.`), noise: 'Your dwells scatter: count the bezel out loud ("three, two, one, go") so every stop uses the same rhythm.' },
  timed: { bias: m => (m > 0 ? `Timed changes average ${Math.abs(m).toFixed(1)} s late: write T - lead on the page before the segment and call on the count.` : `Timed changes average ${Math.abs(m).toFixed(1)} s early: the count starts at the landmark, not at your call.`), noise: 'Timed-change calls scatter: lap the watch at the landmark every time and read the lap, not the sweep.' },
  landmark: { bias: m => (m > 0 ? `Speed changes average ${Math.abs(m).toFixed(1)} s late: call the new speed half a ramp before the sign.` : `Speed changes average ${Math.abs(m).toFixed(1)} s early: lead by half the ramp, not a full one.`), noise: 'Speed-change timing scatters: pick one visual cue (sign post abeam) and call on it.' },
  turn: { bias: m => `Turn callouts are late by ${Math.abs(m).toFixed(1)} s of braking on average: call turns 500-600 ft out, as soon as the driver has the landmark (braking from 45 to 12 mph alone needs about 250 ft).`, noise: 'Turn callout timing scatters: read the next line before you look up, then call it while the intersection is still 500 ft away.' },
  cruise: { bias: (m, o) => (o.perfectSpeedo
    ? (m > 0 ? `You lose ${Math.abs(m).toFixed(1)} s per leg at cruise: the driver wanders under the assigned speed (the speedometer is a perfect Timewise). Call +1 sooner.` : `You gain ${Math.abs(m).toFixed(1)} s per leg at cruise: the driver wanders over the assigned speed. Call -1 sooner.`)
    : (m > 0 ? `You lose ${Math.abs(m).toFixed(1)} s per leg at cruise: your indicated speed reads high; correct the card by about 0.5 mph.` : `You gain ${Math.abs(m).toFixed(1)} s per leg at cruise: the speedometer reads low; call half a mph less.`)),
    noise: 'Cruise error scatters: the driver is wandering; ask for the read-back ("At 36") after every call.' },
  restart: { bias: m => (m > 0 ? `You leave restarts ${Math.abs(m).toFixed(1)} s late: call go at the out-time minus the standing-start loss, on the clock, not on the stopwatch.` : `You leave restarts ${Math.abs(m).toFixed(1)} s early: hold until the out-time minus the standing-start loss.`), noise: 'Restart timing scatters: set the clock bezel to the out-time and call go on the count.' },
};

export function biasNoise(src: { stops: StopRow[]; timed: TimedRow[]; landmarks: LandmarkRow[]; turns: TurnRow[]; cruise: CruiseRow[]; restarts?: RestartRow[] }, history: Partial<Record<ManeuverType, number[]>> | null, opts: { perfectSpeedo?: boolean } = {}): BiasNoiseVm {
  const errors: Record<ManeuverType, number[]> = {
    stop: src.stops.map(s => s.delta).filter(Number.isFinite),
    timed: src.timed.map(t => t.delta).filter((x): x is number => typeof x === 'number'),
    landmark: src.landmarks.map(t => t.delta).filter((x): x is number => typeof x === 'number'),
    turn: src.turns.filter(t => !t.whileStopped).map(t => t.lateBy).filter((x): x is number => typeof x === 'number'),
    cruise: src.cruise.map(c => c.secondsOver).filter(Number.isFinite),
    restart: (src.restarts ?? []).map(r => r.delta).filter((x): x is number => typeof x === 'number'),
  };
  const rows: BiasRow[] = (Object.keys(errors) as ManeuverType[]).map(type => {
    const xs = errors[type];
    const h = (history?.[type] ?? []).filter(x => typeof x === 'number' && Number.isFinite(x));
    const all = [...h, ...xs];
    const { mean, sd } = stats(xs);
    const hs = stats(all);
    let verdict: BiasRow['verdict'] = 'none';
    if (all.length >= 2 && hs.mean !== null && hs.sd !== null) verdict = Math.abs(hs.mean) > hs.sd ? 'bias' : 'noise';
    else if (xs.length === 1 && mean !== null && Math.abs(mean) >= 1) verdict = 'bias';
    const fix = verdict === 'bias' ? FIX[type].bias(hs.mean ?? mean ?? 0, { perfectSpeedo: !!opts.perfectSpeedo }) : verdict === 'noise' ? FIX[type].noise : '';
    return { type, label: MANEUVER_LABEL[type], n: xs.length, mean, sd, histN: all.length, histMean: hs.mean, histSd: hs.sd, verdict, fix };
  });
  const biasRows = rows.filter(r => r.verdict === 'bias' && (r.histMean ?? 0) !== 0).sort((a, b) => Math.abs(b.histMean ?? 0) - Math.abs(a.histMean ?? 0));
  const noiseRows = rows.filter(r => r.verdict === 'noise' && (r.histSd ?? 0) > 0.5).sort((a, b) => (b.histSd ?? 0) - (a.histSd ?? 0));
  const top = biasRows[0] ?? noiseRows[0] ?? null;
  const ok = top && Math.abs(top.histMean ?? 0) + (top.histSd ?? 0) >= 1;
  return { rows, tip: ok ? top.fix : null, topType: ok ? top.type : null, errors };
}
/**
 * "Fix this next": the engine's largest-bucket headline first (src/core/drills/rubrics.ts, which already knows a perfect
 * Timewise speedo cannot read low), then at most one maneuver follow-up. A turn-callout follow-up never outranks a larger
 * stops bucket, and a clean run gets no follow-up.
 */
export function rankTips(result: StageResult | null | undefined, scenario: Scenario | null | undefined, hasRows: boolean, bucketTip: string, bias: BiasNoiseVm, totals: Record<Bucket, number>): string[] {
  let first = bucketTip;
  if (hasRows && result) { try { first = engineHeadlineTip(result, scenario ?? undefined); } catch { first = bucketTip; } }
  const tips = [first];
  if (!hasRows || !bias.tip || !bias.topType || first.startsWith('Clean run')) return tips;
  if (bias.topType === 'cruise') return tips; // the headline already covers cruise, with the speedometer caveat
  if (bias.topType === 'turn') {
    const row = bias.rows.find(r => r.type === 'turn');
    const turnSeconds = Math.abs((row?.mean ?? 0) * (row?.n ?? 0));
    if (Math.abs(totals.stop) > turnSeconds || Math.abs(totals.stop) > Math.abs(totals.turn)) return tips;
  }
  if (!tips.includes(bias.tip)) tips.push(bias.tip);
  return tips;
}

function stats(xs: number[]): { mean: number | null; sd: number | null } {
  if (!xs.length) return { mean: null, sd: null };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (xs.length - 1)) : 0;
  return { mean: r1(mean), sd: r1(sd) };
}

/** Aids rung (DRILL-007) inferred from the AidsConfig. */
export function aidsRung(aids: AidsConfig | null | undefined): 0 | 1 | 2 | 3 {
  if (!aids) return 0;
  const r = (aids as { rung?: unknown }).rung;
  if (r === 0 || r === 1 || r === 2 || r === 3) return r;
  if (aids.paceBar && aids.cumulativeTimes) return 3;
  if (aids.paceBar || aids.countdown) return 2;
  if (aids.autoAdvanceLine) return 1;
  return 0;
}

/** Immediate CP cards (DEBRIEF-004): at rung >= 2 every timing CP crossing yields a 3-second card; below that, nothing. */
export function cpCards(events: SimEvent[] | null | undefined, attribution: LegAttribution[] | null | undefined, aids: AidsConfig | null | undefined, scenario?: Scenario | null, showSeconds = 3): CpCard[] {
  const out: CpCard[] = [];
  if (aidsRung(aids) < 2 || !Array.isArray(events)) return out;
  const stops = workedStops(events, scenario);
  let leg = 1;
  for (const ev of events) {
    if (ev?.type !== 'checkpoint' || ev.detail?.kind !== 'timing') continue;
    const att = attribution?.find(a => a.legIndex === leg);
    let largest: Bucket | null = null; let mag = 0; let secs = 0;
    for (const b of BUCKETS) { const v = num(att?.buckets?.[b]); if (Math.abs(v) > mag) { mag = Math.abs(v); largest = b; secs = r1(v); } }
    const worstStop = stops.filter(s => s.legIndex === leg).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    out.push({ cpId: String(ev.detail?.cpId ?? ''), legIndex: leg, tod: ev.tod, showUntil: ev.tod + showSeconds, error: Math.round(num(ev.detail?.pace)), largestBucket: largest, largestBucketSeconds: secs, largestEvent: worstStop ? `stop at line ${worstStop.line ?? '?'} ${formatSigned(worstStop.delta)} s` : null });
    leg++;
  }
  return out;
}

function headlineTip(totals: Record<Bucket, number>, rows: CpRow[], result: StageResult | null | undefined): { headline: string; tip: string } {
  if (!rows.length) return { headline: 'No checkpoints were timed.', tip: 'Finish the course to see where the seconds went.' };
  const aces = rows.filter(r => r.ace).length;
  const raw = num(result?.score?.raw);
  const headline = aces === rows.length ? `Perfect run: ${aces} ace${aces === 1 ? '' : 's'}.` : `${raw} point${raw === 1 ? '' : 's'} over ${rows.length} checkpoint${rows.length === 1 ? '' : 's'}${aces ? `, ${aces} ace${aces === 1 ? '' : 's'}` : ''}.`;
  let worst: Bucket | null = null; let mag = 0;
  for (const b of BUCKETS) { if (Math.abs(totals[b]) > mag) { mag = Math.abs(totals[b]); worst = b; } }
  if (!worst || mag < 1) return { headline, tip: 'Nothing systematic to fix. Keep the stopwatch habit: start it on the mark, lap at every speed change.' };
  const late = totals[worst] > 0;
  const n = Math.round(mag);
  const tips: Record<Bucket, string> = {
    cruise: late ? `You are running ${n} s slow at cruise: your indicated speed reads high. Correct the card (call about 0.5 mph more) or check the calibration factor.` : `You are running ${n} s fast at cruise: the speedometer reads low. Call half a mph less, or fix the card.`,
    stop: late ? `Stops cost ${n} s net: you are dwelling longer than pause minus car loss. Compute the dwell before the stop (P15 at 35 in / 35 out is about 15 - 7.5 = 7.5 s) and call "go" on the count.` : `You are leaving stops ${n} s early: the pause is credited to the ghost in full; dwell = pause - car loss, not zero.`,
    speedChange: late ? `Speed changes cost ${n} s: start the change half a ramp early so the ramp straddles the landmark (ramp lead).` : `You are gaining ${n} s on speed changes: you call the new speed too early. Lead by half the ramp, not a full one.`,
    timedChange: late ? `Timed changes cost ${n} s: lap the watch at the start of the segment and call the new speed half a ramp before the count expires.` : `Timed changes run ${n} s early: the count starts when the ghost leaves the landmark, not when you call it.`,
    hazard: `Hazards cost ${n} s. Start the watch when you are held by a light or a train and declare the time allowance (T) before the checkpoint.`,
    offCourse: `Off-course cost ${n} s. Read the CAMEO before the intersection and call the turn 500-600 ft out; when unsure, stop before the leading edge.`,
    turn: `Turns cost ${n} s: the car must slow for a 90; recover by holding +5 mph for (v/5) x the seconds lost (8 s late at 35: 40 mph for 56 s).`,
    start: late ? `You left the start ${n} s late. Leave on the official second, or a few seconds early to cover the standing-start loss.` : `You left the start ${n} s early. The start-line loss is your car's standing-start loss (about 4-7 s depending on speed); do not lead by more than that.`,
    ta: `Time allowance changed the score by ${n} s. Declare only what the hazard cost; over-declaring is penalised.`,
  };
  return { headline, tip: tips[worst] };
}

/** e(t) = actual elapsed - ghost elapsed since the leg anchor, sampled at logged events. */
export function timelinePoints(events: SimEvent[], scenario?: Scenario | null): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  if (!Array.isArray(events) || !events.length) return out;
  let ghost: ReturnType<typeof buildGhost> | null = null;
  try { if (scenario) ghost = buildGhost(scenario); } catch { ghost = null; }
  const start = scenario?.startTime ?? events.find(e => e.type === 'depart')?.tod ?? events[0]!.tod;
  let anchorActual = start, anchorGhost = start;
  let began = false;
  for (const ev of events) {
    if (!ev || typeof ev.tod !== 'number') continue;
    if (ev.type === 'depart') { began = true; out.push({ tod: ev.tod, s: ev.s, e: r1(ev.tod - start), label: 'depart', kind: 'start' }); continue; }
    if (!began) continue;
    if (ev.type === 'restart' && typeof ev.detail?.early === 'number') { anchorActual = ev.tod + ev.detail.early; anchorGhost = anchorActual; }
    let e: number | null = null;
    if (ev.type === 'checkpoint' && typeof ev.detail?.pace === 'number') e = ev.detail.pace;
    else if (ghost) e = (ev.tod - anchorActual) - (ghostTimeAt(ghost, ev.s) - anchorGhost);
    if (e === null || !Number.isFinite(e)) continue;
    const kind: TimelinePoint['kind'] = ev.type === 'checkpoint' ? 'checkpoint' : 'event';
    const label = ev.type === 'checkpoint' ? 'CP' : ev.type.startsWith('call.') ? ev.type.slice(5) : ev.type === 'wait' || ev.type === 'release' || ev.type === 'offCourse' || ev.type === 'rejoin' || ev.type === 'turn' ? ev.type : undefined;
    out.push({ tod: ev.tod, s: ev.s, e: r1(e), label, kind });
    if (ev.type === 'checkpoint' && ev.detail?.kind === 'timing' && ghost) {
      anchorActual = Math.floor(ev.tod + 0.5);
      anchorGhost = ghostTimeAt(ghost, ev.s);
    }
  }
  return out;
}
