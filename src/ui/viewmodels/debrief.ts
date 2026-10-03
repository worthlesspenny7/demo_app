/**
 * Debrief view-model (UI-007, DEBRIEF-001, DEBRIEF-003, DEBRIEF-004): per-CP rows, attribution buckets that sum to
 * the leg error, worked arithmetic per maneuver, ledger accuracy, bias vs noise, timeline.
 * Stops are reconstructed from the event log (wait / call.go / release) because the engine's
 * attribution[].stops is empty (see docs/status/UI-REQUESTS.md).
 */
import type { StageResult, Bucket, LegAttribution, SimEvent } from '../../core/sim.js';
import type { Scenario, AidsConfig } from '../../core/course.js';
import { buildGhost, ghostTimeAt } from '../../core/ghost.js';
import { stopLoss, rampLead } from '../../core/perf-table.js';
import { formatClock, formatSigned } from '../../core/units.js';
import { stopsFromEvents, speedsByNode, turnCap } from './counterfactual.js';

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
export interface TurnRow { legIndex: number; line: number; nodeId: string; dir: string; calledAt: number | null; late: boolean; text: string }
export interface CruiseRow { legIndex: number; assigned: number | null; meanTrue: number | null; ratio: number; cruiseSeconds: number; secondsOver: number; cardCorrectionPct: number; text: string }

export interface LedgerRow { tod: number; believed: number; truth: number; diff: number; legIndex: number }
export interface LedgerVm { rows: LedgerRow[]; count: number; meanAbs: number | null; maxAbs: number | null; text: string }

export type ManeuverType = 'stop' | 'timed' | 'landmark' | 'turn' | 'cruise';
export interface BiasRow { type: ManeuverType; label: string; n: number; mean: number | null; sd: number | null; histN: number; histMean: number | null; histSd: number | null; verdict: 'bias' | 'noise' | 'none'; fix: string }
export interface BiasNoiseVm { rows: BiasRow[]; tip: string | null; errors: Record<ManeuverType, number[]> }

export interface TimelinePoint { tod: number; s: number; e: number; label?: string; kind: 'event' | 'checkpoint' | 'start' }

export interface CpCard { cpId: string; legIndex: number; tod: number; showUntil: number; error: number; largestBucket: Bucket | null; largestBucketSeconds: number; largestEvent: string | null }

export interface DebriefVm {
  rows: CpRow[];
  legs: LegAttributionVm[];
  stops: StopRow[];
  timed: TimedRow[];
  landmarks: LandmarkRow[];
  turns: TurnRow[];
  cruise: CruiseRow[];
  ledger: LedgerVm;
  bias: BiasNoiseVm;
  totals: Record<Bucket, number>;
  headline: string;
  tip: string;
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
  const cruise = workedCruise(attribution, scenario);
  const ledger = ledgerAccuracy(result?.ledgerLog);
  const bias = biasNoise({ stops, timed, landmarks, turns, cruise }, opts.history ?? null);
  const { headline, tip: bucketTip } = headlineTip(totals, rows, result);
  const tip = bias.tip ?? bucketTip;
  const score = { raw: num(result?.score?.raw), ageFactor: num(result?.score?.ageFactor, 1), score: num(result?.score?.score), aces: num(result?.score?.aces), legs: rows.length };
  return {
    rows, legs, stops, timed, landmarks, turns, cruise, ledger, bias, totals, headline, tip, score,
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
  const stops = stopsFromEvents(events).filter(s => s.reason === 'stop' || s.reason === 'hold');
  for (const st of stops) {
    const sp = st.nodeId ? by.get(st.nodeId) : undefined;
    const vIn = sp?.vIn ?? null, vOut = sp?.vOut ?? null;
    const pause = sp ? sp.pause : num(attribution?.flatMap(a => a.stops ?? []).find(s => s.nodeId === st.nodeId)?.pause);
    let carLoss: number | null = null;
    if (scenario && vOut !== null && vOut > 0) {
      const vi = vIn !== null && vIn > 0 ? vIn : vOut;
      try { carLoss = r1(stopLoss(vi, vOut, scenario.car, turnCap(sp?.turn, scenario))); } catch { carLoss = null; }
    }
    const idealDwell = carLoss === null ? null : r1(Math.max(0, pause - carLoss));
    const end = st.releaseTod ?? st.goTod ?? st.waitTod;
    const yourDwell = r1(Math.max(0, end - st.waitTod));
    const goAt = st.goTod === null ? null : r1(st.goTod - st.waitTod);
    const net = carLoss === null ? r1(yourDwell - pause) : r1(yourDwell + carLoss - pause);
    const line = sp?.line ?? null;
    const formulaText = carLoss === null
      ? `dwell = ${pause} - ? ; you called go at ${yourDwell.toFixed(1)} s`
      : `dwell = ${pause} - ${carLoss.toFixed(1)} = ${idealDwell!.toFixed(1)} s; you called go at ${yourDwell.toFixed(1)} s; ${signed1(net)} s`;
    const text = carLoss === null
      ? `Stop at line ${line ?? '?'}: pause ${pause} s; you waited ${yourDwell.toFixed(1)} s; ${signed1(net)} s vs the printed pause.`
      : `Stop at line ${line ?? '?'}: entry ${vIn ?? vOut} / exit ${vOut}. Pause ${pause} s minus car loss ${carLoss.toFixed(1)} s = ideal dwell ${idealDwell!.toFixed(1)} s. You waited ${yourDwell.toFixed(1)} s -> ${signed1(net)} s.`;
    out.push({
      legIndex: st.legIndex, nodeId: st.nodeId, line, vIn, vOut, entrySpeed: vIn, exitSpeed: vOut, pause, carLoss, cardLoss: carLoss,
      idealDwell, correctDwell: idealDwell, yourDwell, goAt, net, delta: net, waitTod: st.waitTod, releaseTod: st.releaseTod, text, formulaText,
    });
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

/** Turn callouts: were they issued before the decision point (the node)? */
export function workedTurns(events: SimEvent[] | null | undefined, scenario?: Scenario | null): TurnRow[] {
  const out: TurnRow[] = [];
  if (!scenario?.book || !Array.isArray(events)) return out;
  const legs = legAt(events);
  for (const ins of scenario.book) {
    if (!ins.turn || ins.turn === 'S') continue;
    const ci = events.findIndex(e => e?.type === 'node' && e.detail?.nodeId === ins.nodeId);
    if (ci < 0) continue;
    const cross = events[ci]!;
    const call = [...events.slice(0, ci + 1)].reverse().find(e => e?.type === 'call.turn' && e.detail?.dir === ins.turn && e.tod >= cross.tod - 180);
    const calledAt = call ? r1(call.tod - cross.tod) : null;
    const late = calledAt === null || calledAt > -1;
    const text = calledAt === null ? `Turn at line ${ins.n} (${ins.turn}): no callout before the intersection.` : `Turn at line ${ins.n} (${ins.turn}): called ${(-calledAt).toFixed(1)} s before the intersection${late ? ' (late: call before the decision point)' : ''}.`;
    out.push({ legIndex: legs[ci] ?? 1, line: ins.n, nodeId: ins.nodeId, dir: ins.turn, calledAt, late, text });
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

const MANEUVER_LABEL: Record<ManeuverType, string> = { stop: 'Stops (dwell)', timed: 'Timed changes', landmark: 'Landmark speed changes', turn: 'Turn callouts', cruise: 'Cruise (card)' };
const FIX: Record<ManeuverType, { bias: (m: number) => string; noise: string }> = {
  stop: { bias: m => (m > 0 ? `Your "go" calls average ${Math.abs(m).toFixed(1)} s late: subtract ${Math.abs(m).toFixed(0)} more from every dwell on the card, or react on "one", not "go".` : `Your "go" calls average ${Math.abs(m).toFixed(1)} s early: add ${Math.abs(m).toFixed(0)} s to every dwell on the card.`), noise: 'Your dwells scatter: count the bezel out loud ("three, two, one, go") so every stop uses the same rhythm.' },
  timed: { bias: m => (m > 0 ? `Timed changes average ${Math.abs(m).toFixed(1)} s late: write T - lead on the page before the segment and call on the count.` : `Timed changes average ${Math.abs(m).toFixed(1)} s early: the count starts at the landmark, not at your call.`), noise: 'Timed-change calls scatter: lap the watch at the landmark every time and read the lap, not the sweep.' },
  landmark: { bias: m => (m > 0 ? `Speed changes average ${Math.abs(m).toFixed(1)} s late: call the new speed half a ramp before the sign.` : `Speed changes average ${Math.abs(m).toFixed(1)} s early: lead by half the ramp, not a full one.`), noise: 'Speed-change timing scatters: pick one visual cue (sign post abeam) and call on it.' },
  turn: { bias: m => `Turn callouts come ${Math.abs(m).toFixed(1)} s ${m > 0 ? 'after' : 'before'} the intersection on average: call 150 ft before the decision point.`, noise: 'Turn callout timing scatters: read the next line before you look up, then call it as the intersection appears.' },
  cruise: { bias: m => (m > 0 ? `You lose ${Math.abs(m).toFixed(1)} s per leg at cruise: your indicated speed reads high; correct the card by about 0.5 mph.` : `You gain ${Math.abs(m).toFixed(1)} s per leg at cruise: the speedometer reads low; call half a mph less.`), noise: 'Cruise error scatters: the driver is wandering; ask for the read-back ("At 36") after every call.' },
};

export function biasNoise(src: { stops: StopRow[]; timed: TimedRow[]; landmarks: LandmarkRow[]; turns: TurnRow[]; cruise: CruiseRow[] }, history: Partial<Record<ManeuverType, number[]>> | null): BiasNoiseVm {
  const errors: Record<ManeuverType, number[]> = {
    stop: src.stops.map(s => s.delta).filter(Number.isFinite),
    timed: src.timed.map(t => t.delta).filter((x): x is number => typeof x === 'number'),
    landmark: src.landmarks.map(t => t.delta).filter((x): x is number => typeof x === 'number'),
    turn: src.turns.map(t => t.calledAt).filter((x): x is number => typeof x === 'number'),
    cruise: src.cruise.map(c => c.secondsOver).filter(Number.isFinite),
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
    const fix = verdict === 'bias' ? FIX[type].bias(hs.mean ?? mean ?? 0) : verdict === 'noise' ? FIX[type].noise : '';
    return { type, label: MANEUVER_LABEL[type], n: xs.length, mean, sd, histN: all.length, histMean: hs.mean, histSd: hs.sd, verdict, fix };
  });
  const biasRows = rows.filter(r => r.verdict === 'bias' && (r.histMean ?? 0) !== 0).sort((a, b) => Math.abs(b.histMean ?? 0) - Math.abs(a.histMean ?? 0));
  const noiseRows = rows.filter(r => r.verdict === 'noise' && (r.histSd ?? 0) > 0.5).sort((a, b) => (b.histSd ?? 0) - (a.histSd ?? 0));
  const top = biasRows[0] ?? noiseRows[0] ?? null;
  return { rows, tip: top && Math.abs(top.histMean ?? 0) + (top.histSd ?? 0) >= 1 ? top.fix : null, errors };
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
    offCourse: `Off-course cost ${n} s. Read the CAMEO before the intersection and call the turn 150 ft before the decision point; when unsure, stop before the leading edge.`,
    turn: `Turns cost ${n} s: the car must slow for a 90; recover with +5 mph for (v/5 + 1) x seconds lost.`,
    start: late ? `You left the start ${n} s late. Leave on the official second, or a few seconds early to cover the standing-start loss.` : `You left the start ${n} s early. The start-line loss is about 4 s at 35 mph; do not lead by more than that.`,
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
