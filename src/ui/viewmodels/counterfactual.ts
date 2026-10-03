/**
 * Counterfactual replays (DEBRIEF-002). The simulator logs every world-affecting callout as an event with
 * `tod`, `s` (car position) and `detail`; we replay those through a fresh Simulator and substitute the
 * "go" times at stops (and optionally the timed-change calls, the speedometer, the TA declarations).
 * Position-dependent calls (speed, turn, stop, pass, u-turn, TA, ledger) fire when the replayed car reaches
 * the position they were made at; "go" fires after a dwell measured from the driver's "Stopped".
 */
import { Simulator, type StageResult, type SimEvent, type SimOptions } from '../../core/sim.js';
import type { Scenario, TurnDir } from '../../core/course.js';
import { nodeById } from '../../core/course.js';
import { rampLead } from '../../core/perf-table.js';
import { chartStopLoss } from './charts.js';
import { formatSigned } from '../../core/units.js';

const DT = 0.1;
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

export interface StopCtx { index: number; nodeId: string | null; pause: number; vIn: number | null; vOut: number | null; originalDwell: number; reason: string; legIndex: number }

export interface ReplayOptions extends SimOptions {
  /** Return a dwell (s) for a stop, or null to keep the player's original dwell. */
  dwell?: (ctx: StopCtx) => number | null;
  /** Replace timed-change calls with calls at T - rampLead after the node crossing. */
  idealTimedCalls?: boolean;
  /** Declare the full qualifying hazard delay as TA in every leg. */
  fullTa?: boolean;
  /** Replace the scenario before replaying (e.g. a perfect speedometer). */
  scenario?: (sc: Scenario) => Scenario;
  maxSeconds?: number;
}

export interface OriginalStop { index: number; nodeId: string | null; waitTod: number; releaseTod: number | null; goTod: number | null; reason: string; legIndex: number; stopBeginTod: number | null }

/** Stops (waits for "go") reconstructed from the event log; leg index = timing checkpoints crossed before + 1. */
export function stopsFromEvents(events: SimEvent[] | null | undefined): OriginalStop[] {
  const out: OriginalStop[] = [];
  if (!Array.isArray(events)) return out;
  let leg = 1; let open: OriginalStop | null = null; let lastStopBegin: number | null = null;
  for (const ev of events) {
    if (!ev || typeof ev.tod !== 'number') continue;
    if (ev.type === 'checkpoint' && ev.detail?.kind === 'timing') leg++;
    if (ev.type === 'stop.begin') lastStopBegin = ev.tod;
    if (ev.type === 'wait') {
      const reason = String(ev.detail?.reason ?? '');
      if (reason === 'stop' || reason === 'hold' || reason === 'finish') {
        open = { index: out.length, nodeId: typeof ev.detail?.nodeId === 'string' ? ev.detail.nodeId : null, waitTod: ev.tod, releaseTod: null, goTod: null, reason, legIndex: leg, stopBeginTod: lastStopBegin };
        out.push(open); lastStopBegin = null;
      } else open = null;
      continue;
    }
    if (!open) continue;
    if (ev.type === 'call.go' && open.goTod === null) open.goTod = ev.tod;
    if (ev.type === 'release') { open.releaseTod = ev.tod; open = null; }
  }
  return out;
}

/** Assigned speed before/after each book line (by node id). */
export function speedsByNode(sc: Scenario | null | undefined): Map<string, { vIn: number | null; vOut: number | null; line: number; pause: number; turn?: TurnDir }> {
  const m = new Map<string, { vIn: number | null; vOut: number | null; line: number; pause: number; turn?: TurnDir }>();
  if (!sc?.book) return m;
  let v: number | null = null;
  for (const ins of sc.book) {
    const vIn = v;
    if (ins.timed) v = ins.timed.holdSpeed; else if (typeof ins.speed === 'number') v = ins.speed;
    m.set(ins.nodeId, { vIn, vOut: v, line: ins.n, pause: num(ins.pause), turn: ins.turn });
    if (ins.timed) v = ins.timed.thenSpeed;
  }
  return m;
}

const POSITIONAL = new Set(['call.speed', 'call.turn', 'call.stop', 'call.pass', 'call.pullover', 'call.uturn', 'ta.declare', 'ledger.set', 'speedo.setFactor']);

function toAction(ev: SimEvent): Parameters<Simulator['act']>[0] | null {
  const d = ev.detail ?? {};
  switch (ev.type) {
    case 'call.speed': return typeof d.mph === 'number' ? { type: 'call.speed', mph: d.mph } : null;
    case 'call.turn': return typeof d.dir === 'string' ? { type: 'call.turn', dir: d.dir as TurnDir } : null;
    case 'call.stop': return { type: 'call.stop' };
    case 'call.pass': return { type: 'call.pass' };
    case 'call.pullover': return { type: 'call.pullover' };
    case 'call.uturn': return { type: 'call.uturn' };
    case 'ta.declare': return typeof d.seconds === 'number' ? { type: 'ta.declare', seconds: d.seconds } : null;
    case 'ledger.set': return typeof d.seconds === 'number' ? { type: 'ledger.set', seconds: d.seconds } : null;
    case 'speedo.setFactor': return typeof d.k === 'number' ? { type: 'speedo.setFactor', k: d.k } : null;
    default: return null;
  }
}

/** Replay the event log through a fresh simulator. Never throws; returns null if the scenario is unusable. */
export function replay(scenario: Scenario | null | undefined, events: SimEvent[] | null | undefined, opts: ReplayOptions = {}): StageResult | null {
  if (!scenario || !Array.isArray(events)) return null;
  let sc = scenario;
  try { if (opts.scenario) sc = opts.scenario(scenario); } catch { sc = scenario; }
  let sim: Simulator;
  try { sim = new Simulator(sc, { watch: opts.watch ?? 'analog', useCard: false, mainRoadRule: opts.mainRoadRule, navigatorLatency: opts.navigatorLatency }); } catch { return null; }
  const departEv = events.find(e => e?.type === 'depart');
  const departTod = departEv ? departEv.tod : sc.startTime;
  const stops = stopsFromEvents(events);
  const speeds = speedsByNode(sc);
  const timedByNode = new Map<string, { T: number; hold: number; then: number }>();
  for (const ins of sc.book) if (ins.timed) timedByNode.set(ins.nodeId, { T: ins.timed.seconds, hold: ins.timed.holdSpeed, then: ins.timed.thenSpeed });
  // positional queue after departure; preread actions by tod
  const pre: SimEvent[] = []; const pos: SimEvent[] = [];
  let started = false;
  for (const ev of events) {
    if (!ev) continue;
    if (ev.type === 'depart') { started = true; continue; }
    if (!POSITIONAL.has(ev.type)) continue;
    (started ? pos : pre).push(ev);
  }
  // identify the timed-change calls to drop when idealTimedCalls is on
  const dropped = new Set<SimEvent>();
  if (opts.idealTimedCalls) {
    let i = 0;
    for (const ev of events) {
      if (ev?.type === 'node' && typeof ev.detail?.nodeId === 'string' && timedByNode.has(ev.detail.nodeId)) {
        const seg = timedByNode.get(ev.detail.nodeId)!;
        const later = events.slice(i + 1).find(e => e.type === 'call.speed' && e.detail?.mph === seg.then && e.tod >= ev.tod && e.tod <= ev.tod + seg.T + 90);
        if (later) dropped.add(later);
      }
      i++;
    }
  }
  const scheduled: { at: number; mph: number }[] = [];
  const max = opts.maxSeconds ?? 4 * 3600;
  let t = 0; let pi = 0; let qi = 0; let stopIdx = 0; let goIssued = false; let prevWaitingStop = false; let seenEvents = sim.events.length;
  try {
    while (sim.phase !== 'finished' && t < max) {
      if (sim.phase === 'preread') {
        while (pi < pre.length && pre[pi]!.tod <= sim.tod + 1e-6) { const a = toAction(pre[pi]!); if (a) safeAct(sim, a); pi++; }
        if (sim.tod >= departTod - 1e-6) sim.act({ type: 'start' });
      } else {
        while (qi < pos.length && pos[qi]!.s <= sim.car.s + 1e-6) {
          const ev = pos[qi]!; qi++;
          if (dropped.has(ev)) continue;
          const a = toAction(ev); if (a) safeAct(sim, a);
        }
        for (let k = scheduled.length - 1; k >= 0; k--) { if (sim.tod >= scheduled[k]!.at - 1e-6) { safeAct(sim, { type: 'call.speed', mph: scheduled[k]!.mph }); scheduled.splice(k, 1); } }
        if (opts.fullTa) { const q = sim.taQualifying[sim.legIndex] ?? 0; if (q > 0 && (sim.taDeclared[sim.legIndex] ?? 0) < q - 1e-6) safeAct(sim, { type: 'ta.declare', seconds: Math.round(q) }); }
        const waitingStop = sim.waitingForGo && (sim.waitReason === 'stop' || sim.waitReason === 'hold' || sim.waitReason === 'finish');
        if (waitingStop) {
          const orig = stops[stopIdx];
          const nodeId = orig?.nodeId ?? null;
          const sp = nodeId ? speeds.get(nodeId) : undefined;
          const originalDwell = orig ? ((orig.releaseTod ?? orig.goTod ?? orig.waitTod) - orig.waitTod) : 0;
          const ctx: StopCtx = { index: stopIdx, nodeId, pause: sp?.pause ?? 0, vIn: sp?.vIn ?? null, vOut: sp?.vOut ?? null, originalDwell, reason: sim.waitReason as string, legIndex: sim.legIndex };
          let dwell: number | null = null;
          try { dwell = opts.dwell ? opts.dwell(ctx) : null; } catch { dwell = null; }
          if (!goIssued) {
            if (sim.waitReason === 'hold' && dwell === null) {
              // lunch/restart: the go is a time-of-day decision, keep the original absolute time
              const at = orig ? (orig.releaseTod ?? orig.goTod ?? orig.waitTod) : sim.waitStartTod + originalDwell;
              if (sim.tod >= at - 1e-6) { goIssued = true; safeAct(sim, { type: 'call.go' }); }
            } else {
              const target = dwell === null ? originalDwell : Math.max(0, dwell);
              const known = !!orig || dwell !== null;
              if (known && sim.tod - sim.waitStartTod >= target - 1e-6) { goIssued = true; safeAct(sim, { type: 'call.go' }); }
              else if (!known && sim.tod - sim.waitStartTod >= 5) { goIssued = true; safeAct(sim, { type: 'call.go' }); }
            }
          }
        } else if (prevWaitingStop) { stopIdx++; goIssued = false; }
        prevWaitingStop = waitingStop;
      }
      sim.step(DT); t += DT;
      if (opts.idealTimedCalls) {
        for (let k = seenEvents; k < sim.events.length; k++) {
          const ev = sim.events[k]!;
          if (ev.type === 'node' && typeof ev.detail?.nodeId === 'string' && timedByNode.has(ev.detail.nodeId)) {
            const seg = timedByNode.get(ev.detail.nodeId)!;
            let lead = 0; try { lead = rampLead(seg.hold, seg.then, sc.car); } catch { lead = 0; }
            scheduled.push({ at: ev.tod + seg.T - lead, mph: seg.then });
          }
        }
      }
      seenEvents = sim.events.length;
    }
    return sim.result();
  } catch { try { return sim.result(); } catch { return null; } }
}
function safeAct(sim: Simulator, a: Parameters<Simulator['act']>[0]): void { try { sim.act(a); } catch { /* e.g. setFactor on a mechanical speedo */ } }

export interface CfCpRow { cpId: string; legIndex: number; error: number | null; was: number | null; text: string }
export interface CounterfactualRow {
  id: 'cardDwell' | 'timedLead' | 'exactCard' | 'fullTa' | `stop:${number}`;
  label: string;
  rows: CfCpRow[];
  /** Sum of |error| over the CPs, for a quick "would have scored" comparison. */
  rawBefore: number; rawAfter: number;
  applicable: boolean;
  result: StageResult | null;
}

function cpRows(actual: StageResult, cf: StageResult | null): CfCpRow[] {
  const legs = actual.score?.legs ?? [];
  return legs.map(l => {
    const r = cf?.score?.legs?.find(x => x.cpId === l.cpId);
    const error = r ? r.error : null;
    const text = error === null ? `${l.cpId}: missed (was ${l.error === null ? 'missed' : formatSigned(l.error)})` : `${l.cpId}: ${formatSigned(error)} (was ${l.error === null ? 'missed' : formatSigned(l.error)})`;
    return { cpId: l.cpId, legIndex: l.index, error, was: l.error, text };
  });
}
const rawOf = (r: StageResult | null): number => num(r?.score?.raw);

/** The standard counterfactual set (DEBRIEF-002 a-d) plus one row per stop ("if you had called go at X"). */
export function counterfactuals(actual: StageResult | null | undefined, scenario: Scenario | null | undefined, opts: { watch?: 'analog' | 'digital'; perStop?: boolean } = {}): CounterfactualRow[] {
  const out: CounterfactualRow[] = [];
  if (!actual || !scenario) return out;
  const events = actual.events ?? [];
  const speeds = speedsByNode(scenario);
  const stops = stopsFromEvents(events).filter(s => s.reason === 'stop');
  const cardDwell = (ctx: StopCtx): number | null => {
    if (ctx.reason !== 'stop') return null;
    const vIn = ctx.vIn ?? ctx.vOut, vOut = ctx.vOut ?? ctx.vIn;
    if (vIn === null || vOut === null || vIn <= 0 || vOut <= 0) return null;
    const sp = ctx.nodeId ? speeds.get(ctx.nodeId) : undefined;
    const cap = turnCap(sp?.turn, scenario);
    try { return Math.max(0, ctx.pause - chartStopLoss(scenario.car, vIn, vOut, cap)); } catch { return null; }
  };
  const push = (id: CounterfactualRow['id'], label: string, applicable: boolean, o: ReplayOptions): void => {
    const res = applicable ? replay(scenario, events, { watch: opts.watch, ...o }) : null;
    out.push({ id, label, rows: cpRows(actual, res), rawBefore: rawOf(actual), rawAfter: rawOf(res), applicable: applicable && res !== null, result: res });
  };
  push('cardDwell', 'If you had called go at the card dwell (pause - car loss) at every stop', stops.length > 0, { dwell: cardDwell });
  const hasTimed = scenario.book.some(i => i.timed);
  push('timedLead', 'If you had called every timed change at T - ramp lead', hasTimed, { idealTimedCalls: true });
  const sp = scenario.speedo; const perfect = sp.gain === 1 && sp.offset === 0 && sp.quad === 0;
  push('exactCard', 'If your calibration card were exact (speedometer read true)', !perfect, { scenario: s => ({ ...s, speedo: { ...s.speedo, gain: 1, offset: 0, quad: 0 } }) });
  const anyQualifying = events.some(e => e.type === 'wait' && (e.detail?.reason === 'signal' || e.detail?.reason === 'train'));
  push('fullTa', 'If you had declared the full qualifying delay as a time allowance', anyQualifying, { fullTa: true });
  if (opts.perStop !== false) {
    for (const st of stops) {
      const spd = st.nodeId ? speeds.get(st.nodeId) : undefined;
      const ideal = cardDwell({ index: st.index, nodeId: st.nodeId, pause: spd?.pause ?? 0, vIn: spd?.vIn ?? null, vOut: spd?.vOut ?? null, originalDwell: 0, reason: 'stop', legIndex: st.legIndex });
      if (ideal === null) continue;
      const yours = (st.releaseTod ?? st.goTod ?? st.waitTod) - st.waitTod;
      const idx = st.index;
      const res = replay(scenario, events, { watch: opts.watch, dwell: ctx => (ctx.index === idx ? ideal : null) });
      const rows = cpRows(actual, res);
      const cp = rows.find(r => r.legIndex === st.legIndex) ?? rows[0];
      const label = cp ? `Line ${spd?.line ?? '?'}: if you had called go at ${ideal.toFixed(1)} s instead of ${yours.toFixed(1)} s, ${cp.cpId} would have been ${cp.error === null ? 'missed' : formatSigned(cp.error)} (was ${cp.was === null ? 'missed' : formatSigned(cp.was)})`
        : `Line ${spd?.line ?? '?'}: if you had called go at ${ideal.toFixed(1)} s instead of ${yours.toFixed(1)} s`;
      out.push({ id: `stop:${idx}`, label, rows, rawBefore: rawOf(actual), rawAfter: rawOf(res), applicable: res !== null, result: res });
    }
  }
  return out;
}

export function turnCap(turn: TurnDir | undefined, sc: Scenario): number | undefined {
  if (!turn) return undefined;
  const ang = { L: 90, R: 90, S: 0, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 }[turn];
  if (ang < 20) return undefined;
  return ang > 120 ? sc.car.turnSpeedMph.acute : ang >= 60 ? sc.car.turnSpeedMph.turn : sc.car.turnSpeedMph.bear;
}

export { nodeById };
