/** Debrief view-model (UI-007): per-CP rows, attribution buckets that sum to the leg error, worked arithmetic, timeline. */
import type { StageResult, Bucket, LegAttribution, SimEvent } from '../../core/sim.js';
import type { Scenario } from '../../core/course.js';
import { buildGhost, ghostTimeAt } from '../../core/ghost.js';
import { stopLoss } from '../../core/perf-table.js';
import { formatClock, formatSigned } from '../../core/units.js';

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

export interface StopRow {
  legIndex: number; nodeId: string; line: number | null; vIn: number | null; vOut: number | null;
  pause: number; carLoss: number | null; idealDwell: number | null; yourDwell: number; net: number;
  text: string;
}

export interface TimelinePoint { tod: number; s: number; e: number; label?: string; kind: 'event' | 'checkpoint' | 'start' }

export interface DebriefVm {
  rows: CpRow[];
  legs: LegAttributionVm[];
  stops: StopRow[];
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

export function debriefViewModel(result: StageResult | null | undefined, scenario?: Scenario | null): DebriefVm {
  const legsScore = result?.score?.legs ?? [];
  const attribution: LegAttribution[] = Array.isArray(result?.attribution) ? result!.attribution : [];
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

  const stops = workedStops(attribution, scenario);
  const { headline, tip } = headlineTip(totals, rows, result);
  const score = { raw: num(result?.score?.raw), ageFactor: num(result?.score?.ageFactor, 1), score: num(result?.score?.score), aces: num(result?.score?.aces), legs: rows.length };
  return {
    rows, legs, stops, totals, headline, tip, score,
    timeline: timelinePoints(result?.events ?? [], scenario),
    offCourseCount: num(result?.offCourseCount), observationMissed: !!result?.observationMissed, drivingSeconds: num(result?.drivingSeconds),
  };
}

function emptyBuckets(): Record<Bucket, number> { return { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 }; }

/** Speed assigned before and after each book line (by node id). */
function speedsByNode(scenario: Scenario | null | undefined): Map<string, { vIn: number | null; vOut: number | null; line: number }> {
  const m = new Map<string, { vIn: number | null; vOut: number | null; line: number }>();
  if (!scenario?.book) return m;
  let v: number | null = null;
  for (const ins of scenario.book) {
    const vIn = v;
    if (ins.timed) v = ins.timed.holdSpeed; else if (typeof ins.speed === 'number') v = ins.speed;
    m.set(ins.nodeId, { vIn, vOut: v, line: ins.n });
  }
  return m;
}

export function workedStops(attribution: LegAttribution[], scenario?: Scenario | null): StopRow[] {
  const by = speedsByNode(scenario);
  const out: StopRow[] = [];
  for (const leg of attribution) {
    for (const st of leg.stops ?? []) {
      const sp = by.get(st.nodeId);
      const vIn = sp?.vIn ?? null, vOut = sp?.vOut ?? null;
      let carLoss: number | null = null;
      if (scenario && vIn !== null && vOut !== null && vIn > 0 && vOut > 0) { try { carLoss = r1(stopLoss(vIn, vOut, scenario.car)); } catch { carLoss = null; } }
      const pause = num(st.pause);
      const idealDwell = carLoss === null ? null : r1(Math.max(0, pause - carLoss));
      const yourDwell = r1(num(st.dwell));
      const net = r1(num(st.actualCost));
      const text = carLoss === null
        ? `Stop at line ${sp?.line ?? '?'}: pause ${pause} s; you waited ${yourDwell.toFixed(1)} s; net ${formatSigned(net)} s vs the ghost.`
        : `Stop at line ${sp?.line ?? '?'}: entry ${vIn} / exit ${vOut}. Pause ${pause} s minus car loss ${carLoss.toFixed(1)} s = ideal dwell ${idealDwell!.toFixed(1)} s. You waited ${yourDwell.toFixed(1)} s -> ${formatSigned(net)} s.`;
      out.push({ legIndex: leg.legIndex, nodeId: st.nodeId, line: sp?.line ?? null, vIn, vOut, pause, carLoss, idealDwell, yourDwell, net, text });
    }
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
    stop: late ? `Stops cost ${n} s net: you are dwelling longer than pause minus car loss. Compute the dwell before the stop (P15 at 35 in / 35 out is about 15 - 7 = 8 s) and call "go" on the count.` : `You are leaving stops ${n} s early: the pause is credited to the ghost in full; dwell = pause - car loss, not zero.`,
    speedChange: late ? `Speed changes cost ${n} s: start the change half a ramp early so the ramp straddles the landmark (rampLead).` : `You are gaining ${n} s on speed changes: you call the new speed too early. Lead by half the ramp, not a full one.`,
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
