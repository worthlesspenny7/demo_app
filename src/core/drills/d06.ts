/** D06 "Build your charts": measure stop & go, acceleration/deceleration and turn losses for 3 speed pairs each (DRILL-023, CHART-001/002). */
import { EXITS } from '../builder.js';
import { annotatePerfectTimes, buildGhost, ghostTimeAt } from '../ghost.js';
import type { StageResult } from '../sim.js';
import { buildPerfTable, matrixAt, stopLoss } from '../perf-table.js';
import { rng, type Rng } from '../rng.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base, carFor } from './common.js';
import { MEASURE_RUN_TAG, instructionS, type CarSpec, type Scenario } from '../course.js';

/** `stopMid` (CHART-006, 10c): the stop-in-the-middle run: a stop with no pause printed between the two marks, so the net loss against the ghost is the stop-and-go loss (15 s minus chart (b)). */
export type ChartKind = 'stopGo' | 'accel' | 'turn' | 'stopMid';
export interface ChartPair { kind: ChartKind; vIn: number; vOut: number }
const KIND_LABEL: Record<ChartKind, string> = { stopGo: 'stop & go', accel: 'accel/decel', turn: 'turn', stopMid: 'stop in the middle' };

const pairKey = (k: ChartKind, a: number, b: number): string => `${k}:${a}>${b}`;
/** Pairs of a scenario from its tags (the rubric's truth list); players read the same pairs on the marker lines. */
export function chartPairs(tags: string[] | undefined): ChartPair[] {
  const out: ChartPair[] = [];
  for (const t of tags ?? []) { const m = /^chart:(stopGo|accel|turn|stopMid):(\d+)>(\d+)$/.exec(t); if (m) out.push({ kind: m[1] as ChartKind, vIn: Number(m[2]), vOut: Number(m[3]) }); }
  return out;
}

/** CHART-006: one parsed chart entry: the runs written, the ones thrown out as outliers (a negative net loss: "delete or re-run"), the average of the rest. */
export interface ParsedChart { runs: number[]; outliers: number[]; value: number | null; driver: 'A' | 'B' | null }

const HEAD = /\b(stop\s*(?:&|and)?\s*go|stopgo|sg|stop\s*(?:in\s*the\s*)?mid(?:dle)?|stopmid|accel(?:\s*\/\s*decel)?|decel|ad|turns?)\b\s*(\d+)\s*(?:>|->|→|to|\/|-)\s*(\d+)\s*(?:=|:|is)?\s*/gi;
const NUM = /^-?\d+(?:\.\d+)?/;
/**
 * "stopgo 30>40 = 8.4", "turn 40>35 = 4.0", "accel 0>40 = 4.5", "decel 40>30 = 1.2", "stopmid 35>35 = 10.2" and, for the 4-run average of the X-Cup chart
 * spreadsheet, "stopgo 30>40 runs 8.4 8.6 8.5 8.5". An optional leading "A:" / "B:" / "driver B" tags the note for one driver's chart (CHART-006).
 * Seconds only; a negative value is a negative net loss, an outlier: flagged, left out of the average.
 */
export function parseChartRuns(notes: string[], driver?: 'A' | 'B'): Map<string, ParsedChart> {
  const out = new Map<string, ParsedChart>();
  for (const text0 of notes) {
    let text = text0; let tag: 'A' | 'B' | null = null;
    const dm = /^\s*(?:driver\s*)?([AB])\b\s*[:\-]?\s*(?=(?:stop|sg|accel|decel|ad\b|turn))/i.exec(text);
    if (dm) { tag = dm[1]!.toUpperCase() as 'A' | 'B'; text = text.slice(dm[0].length); }
    if (tag && driver && tag !== driver) continue;   // the other driver's chart
    HEAD.lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = HEAD.exec(text))) {
      const w = m[1]!.toLowerCase().replace(/\s+/g, ''); const kind: ChartKind = w.startsWith('stopmid') || /^stop(in)?(the)?mid/.test(w) ? 'stopMid' : w.startsWith('stop') || w === 'sg' ? 'stopGo' : w.startsWith('turn') ? 'turn' : 'accel';
      let rest = text.slice(HEAD.lastIndex); const runs: number[] = [];
      const rw = /^runs?\b\s*[:=]?\s*/i.exec(rest);
      if (rw) { rest = rest.slice(rw[0].length); for (;;) { const nm = NUM.exec(rest); if (!nm) break; runs.push(Number(nm[0])); rest = rest.slice(nm[0].length).replace(/^[\s,;/]+/, ''); } }
      else { const nm = NUM.exec(rest); if (nm) runs.push(Number(nm[0])); }
      if (!runs.length) continue;
      const used = runs.filter(x => x >= 0), outliers = runs.filter(x => x < 0);
      out.set(pairKey(kind, Number(m[2]), Number(m[3])), { runs, outliers, value: used.length ? Math.round(used.reduce((a, b) => a + b, 0) / used.length * 100) / 100 : null, driver: tag });
    }
  }
  return out;
}
// ---------- CHART-006: raw run times, as the X-Cup chart tool takes them ----------

/** The three run types of the chart tool: a flying pass at constant speed, a start from a standstill, braking to a standstill. */
export type RawKind = 'const' | 'acc' | 'brk';
const RAW_WORDS: Record<string, RawKind> = { const: 'const', constant: 'const', flying: 'const', acc: 'acc', accel: 'acc', accelerating: 'acc', start: 'acc', brk: 'brk', brake: 'brk', braking: 'brk' };
const RAW = /\b(const(?:ant)?|flying|acc(?:el(?:erating)?)?|start|brk|brake|braking)\s+(\d+)\s*(?:mph)?\s*runs?\b\s*[:=]?\s*/gi;
/**
 * Raw course times in seconds between the same two fixed marks: "const 25 runs 19.8 19.9 19.1 19.8", "acc 25 runs 18.0 ...", "brk 25 runs 17.0 ..." (three run types, four runs
 * per speed, per driver). The map key is `${kind}:${speed}`. A leading "A:" / "B:" tags the note for one driver as elsewhere.
 */
export function parseRawRuns(notes: string[], driver?: 'A' | 'B'): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const text0 of notes) {
    let text = text0;
    const dm = /^\s*(?:driver\s*)?([AB])\b\s*[:\-]?\s*(?=(?:const|flying|acc|start|brk|brake))/i.exec(text);
    if (dm) { const tag = dm[1]!.toUpperCase(); text = text.slice(dm[0].length); if (driver && tag !== driver) continue; }
    RAW.lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = RAW.exec(text))) {
      const kind = RAW_WORDS[m[1]!.toLowerCase()]!; let rest = text.slice(RAW.lastIndex); const runs: number[] = [];
      for (;;) { const nm = NUM.exec(rest); if (!nm) break; runs.push(Number(nm[0])); rest = rest.slice(nm[0].length).replace(/^[\s,;/]+/, ''); }
      if (runs.length) out.set(`${kind}:${m[2]}`, runs);
    }
  }
  return out;
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); const h = s.length >> 1; return s.length % 2 ? s[h]! : (s[h - 1]! + s[h]!) / 2; };
const r2 = (x: number): number => Math.round(x * 100) / 100;

/** A run that sits far from the others of its kind (19.1 among 19.8 / 19.9 / 19.8): named so the player re-runs that one. */
export interface DiscrepantRun { kind: RawKind; speed: number; run: number; others: number[] }
export interface DerivedFromRaw {
  /** net loss of a start from a standstill to `speed`, and of braking from `speed` to a standstill: average of the runs minus the constant-speed average */
  acc: Record<number, number>; dec: Record<number, number>;
  /** the stop-and-go pause for IN > OUT: 15 - dec(IN) - acc(OUT) (the sheet's footnote "(START/STOP TIME)-(accel IN + accel OUT)") */
  pause: Record<string, number>;
  /** every derived cell that came out negative: an impossible loss, "re-run and re-average" */
  negatives: { cell: string; value: number }[];
  /** the run furthest from the rest of its kind, when it is more than 0.5 s off */
  discrepant: DiscrepantRun[];
  /** pause cells above 15 s: the symptom of a negative loss (sitting longer than the printed pause) */
  pauseOver15: string[];
}
/** CHART-006: derive the chart cells from raw runs, as the chart tool does, and flag what is impossible (11c section 3.3-3.4). */
export function deriveFromRaw(raw: Map<string, number[]>): DerivedFromRaw {
  const out: DerivedFromRaw = { acc: {}, dec: {}, pause: {}, negatives: [], discrepant: [], pauseOver15: [] };
  const speeds = new Set<number>(); for (const k of raw.keys()) speeds.add(Number(k.split(':')[1]));
  for (const v of [...speeds].sort((a, b) => a - b)) {
    const c = raw.get(`const:${v}`), a = raw.get(`acc:${v}`), b = raw.get(`brk:${v}`);
    for (const [kind, runs] of [['const', c], ['acc', a], ['brk', b]] as const) {
      if (!runs || runs.length < 3) continue;
      const med = median(runs); const far = runs.reduce((w, x) => (Math.abs(x - med) > Math.abs(w - med) ? x : w), runs[0]!);
      if (Math.abs(far - med) > 0.5) out.discrepant.push({ kind, speed: v, run: far, others: runs.filter(x => x !== far) });
    }
    if (!c) continue;
    const cm = mean(c);
    if (a) { out.acc[v] = r2(mean(a) - cm); if (out.acc[v]! < 0) out.negatives.push({ cell: `accel 0>${v}`, value: out.acc[v]! }); }
    if (b) { out.dec[v] = r2(mean(b) - cm); if (out.dec[v]! < 0) out.negatives.push({ cell: `brake ${v}>0`, value: out.dec[v]! }); }
  }
  for (const i of Object.keys(out.dec).map(Number)) for (const o of Object.keys(out.acc).map(Number)) {
    const p = r2(15 - out.dec[i]! - out.acc[o]!); out.pause[`${i}>${o}`] = p; if (p > 15) out.pauseOver15.push(`${i}>${o}`);
  }
  return out;
}

/** The single value per pair (the average of the runs without outliers); an older, simpler view of parseChartRuns. */
export function parseChartNotes(notes: string[], driver?: 'A' | 'B'): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of parseChartRuns(notes, driver)) if (v.value !== null) out.set(k, v.value);
  return out;
}
/** CHART-006: driver B brakes and accelerates a little differently, so the chart is per driver; driver A is the table's own car. */
export function driverCar(car: CarSpec, driver: 'A' | 'B'): CarSpec { return driver === 'A' || car.tables ? car : { ...car, name: `${car.name} (driver B)`, a0: car.a0 * 0.9, aDec: car.aDec * 0.93 }; }
export function driverOf(tags: string[] | undefined): 'A' | 'B' { return (tags ?? []).includes('driver:B') ? 'B' : 'A'; }

function pick3(r: Rng, speeds: number[], minGap: number, firstFromZero = false, upOnly = false): [number, number][] {
  const out: [number, number][] = []; let guard = 0;
  while (out.length < 3 && guard++ < 400) {
    const a = firstFromZero && out.length === 0 ? 0 : r.pick(speeds), b = r.pick(speeds);
    if (Math.abs(a - b) < minGap || (upOnly && b <= a) || out.some(p => p[0] === a && p[1] === b)) continue;
    out.push([a, b]);
  }
  return out;
}

/**
 * ENG-020: what an honest measurer reads between the MARK lines of THIS run, from the run's own events: the loss against the ghost between MARK in and
 * MARK out (the start from a standstill: seconds late at MARK out), and for a stop & go the chart pause time = the dwell plus the seconds early against
 * the ghost. A note within 1 s of it is a fair measurement even when the driver's noise put this run off the car's mean chart.
 */
export function runMeasurement(r: StageResult, sc: Scenario, p: ChartPair): number | null {
  const pairs = chartPairs(sc.tags); const same = pairs.filter(q => q.kind === p.kind); const k = same.findIndex(q => q.vIn === p.vIn && q.vOut === p.vOut); if (k < 0) return null;
  const id = p.kind === 'stopGo' ? `A${k + 1}` : p.kind === 'accel' ? `B${k + 1}` : p.kind === 'turn' ? `C${k + 1}` : 'D1';
  const g = buildGhost(sc);
  const cross = (inout: 'in' | 'out'): { tod: number; ghost: number } | null => {
    const ins = sc.book.find(i => new RegExp(`^MARK ${id} ${inout}\\b`).test(i.text ?? '')); if (!ins) return null;
    const e = r.events.find(x => x.type === 'node' && x.detail?.nodeId === ins.nodeId); return e ? { tod: e.tod, ghost: ghostTimeAt(g, instructionS(sc.course, ins)) } : null;
  };
  const a = cross('in'), b = cross('out'); if (!b) return null;
  if (p.kind === 'accel' && p.vIn === 0) return b.tod - b.ghost;
  if (!a) return null;
  if (p.kind === 'stopGo') {
    const w = r.events.find(e => e.type === 'wait' && e.tod > a.tod && e.tod < b.tod); const rel = w ? r.events.find(e => e.type === 'release' && e.tod > w.tod) : null;
    const dwell = w && rel ? rel.tod - w.tod : 0; return dwell + ((b.ghost - a.ghost) - (b.tod - a.tod));
  }
  return (b.tod - a.tod) - (b.ghost - a.ghost);
}

export const D06: Drill = {
  id: 'D06', title: 'Build your charts', objective: 'Bronze: copy the Packard charts. Every pair on the marker lines is inside the 15-50 mph the handbook prints (HB p.7-9): note the printed cell for each, as "stopgo 30>40 = 8.4", "accel 0>40 = 4.5" or "turn 40>35 = 4.0"; you are graded on copying it right. Silver and Gold: measure the car. Drive each section as a measuring run: leave restarts ON the second and call every speed AT its sign (measure, do not compensate), lap the stopwatch at each MARK and note the seconds lost against the ghost. Retry the seed to drive the pairs again: your notes are kept and the last one per pair counts ("stopgo 30>40 runs 8.4 8.6" averages runs). Notes of raw run times work too ("const 25 runs 19.8 19.9 19.8 19.9", "acc 25 runs ...", "brk 25 runs ...").', skills: ['P12'], minutes: 22, kind: 'drive',
  tiers: tiers([3, 3, 2]), unlock: [], readFirst: ['measure-car'],
  scenario(seed, t) {
    const tier = tierOf(D06, t); const r = rng(seed * 6007 + 6);
    const driver: 'A' | 'B' = tier.name === 'Bronze' ? 'A' : rng(seed * 6007 + 99).chance(0.5) ? 'B' : 'A';   // CHART-006: each driver has his own chart; Bronze copies the printed Packard (driver A)
    const b = base('D06', 'Build your charts', seed, tier, { car: driverCar(carFor('D06', seed, tier), driver) }).start(30);
    const tags: string[] = [`driver:${driver}`];
    const bronze = tier.name === 'Bronze';
    // PLAY-027: the MARK lines say what this tier grades: Bronze copies the printed Packard cell; Silver and Gold measure, and a measuring run never compensates
    const how = bronze ? 'Bronze: copy the Packard chart cell for this pair (Reference, HB p.7-9).' : 'Measure, do not compensate: no lead, no early call.';
    const mark = (id: string, what: string): void => { b.advanceMiles(0.2); b.instruction({ label: `MARK ${id}`, sightDistance: 450 }, { text: `MARK ${id}: lap the stopwatch here. ${what}${/ out$/.test(id) ? '' : ` ${how}`}` }); };
    let cur = 30;
    // EDU-009: Bronze copies the printed Packard charts (HB p.7-9), which run 15-50 mph: no Bronze pair falls outside them (55 is measured from Silver up)
    const inPrinted = (xs: number[]): number[] => (tier.name === 'Bronze' ? xs.filter(v => v <= 50) : xs);
    const setIn = (v: number, id: string): void => { b.advanceMiles(0.35); if (v !== cur) { b.speedAtSign(`SPEED ${v}`, v); cur = v; } else b.instruction({ sign: { text: `SPEED ${v}`, shape: 'rect', side: 'R' }, sightDistance: 450 }, { speed: v }); void id; };
    // section A: stop & go (15 s pause printed): IN speed, a straight-through STOP with a 15 s pause, OUT speed. ENG-020: straight, because chart (b) is a straight stop
    // (a turning stop costs about 1.4 s more, PT-09 MEDIUM 1); the draw of the turn direction is kept so the later sections draw the same pairs
    pick3(r, inPrinted([25, 30, 35, 40, 45, 50, 55]), 0).forEach(([vi, vo], k) => {
      const id = `A${k + 1}`; tags.push(`chart:stopGo:${vi}>${vo}`);
      setIn(vi, id); mark(`${id} in`, `Stop & go ${vi} > ${vo}: approach at ${vi}.`);
      void r.pick(['L', 'R']); b.advanceMiles(0.2).stop('S', vo, { pause: 15 }); cur = vo;
      mark(`${id} out`, `Leave at ${vo}. Chart pause time = 15 s minus your seconds late against the ghost here (the pace aid at Bronze), with the full 15 s sat at the stop.`);
    });
    b.advanceMiles(0.6).checkpoint();
    // section B: acceleration / deceleration: the first pair starts from a standstill (a time-of-day restart), the others are speed changes at a sign
    // ENG-020: speed-ups only (and the start from a standstill): chart (a) books a slow-down as a loss against the OLD speed, which a run against the ghost cannot show
    pick3(r, inPrinted([20, 25, 30, 35, 40, 45, 50, 55]), 10, true, true).forEach(([vi, vo], k) => {
      const id = `B${k + 1}`; tags.push(`chart:accel:${vi}>${vo}`);
      if (vi === 0) {
        b.advanceMiles(0.4);
        const g = buildGhost(b.build()); const arrive = ghostTimeAt(g, b.position) + 45; // the restart waits for the car
        b.restart(vo, Math.ceil(arrive / 5) * 5, { text: `Restart: leave ON the second, no launch lead (a measuring run). Accel 0 > ${vo}: lap at MARK ${id} out.` }); cur = vo;
        mark(`${id} out`, `Accel 0 > ${vo}: your seconds late at this mark against the ghost are the chart value.`);
      } else {
        setIn(vi, id); mark(`${id} in`, `Accel ${vi} > ${vo}: you are at ${vi}; call ${vo} AT the sign, not before.`);
        b.advanceMiles(0.2).speedAtSign(`SPEED ${vo}`, vo); cur = vo;
        mark(`${id} out`, `Now ${vo}. Net seconds lost against the ghost is the chart value.`);
      }
    });
    b.advanceMiles(0.6).checkpoint();
    // section C: turns: IN speed, a 90 degree turn at the crossroad, OUT speed
    pick3(r, [25, 30, 35, 40, 45, 50], 0).forEach(([vi, vo], k) => {
      const id = `C${k + 1}`; tags.push(`chart:turn:${vi}>${vo}`); const dir = r.pick(['L', 'R'] as const);
      setIn(vi, id); mark(`${id} in`, `Turn ${vi} > ${vo}: approach at ${vi}.`);
      b.advanceMiles(0.25).instruction({ exits: EXITS.crossroads(dir), sightDistance: 700 }, { turn: dir, speed: vo }); cur = vo;
      mark(`${id} out`, `Turn done, ${vo}. Seconds lost against the ghost is the chart value.`);
    });
    b.advanceMiles(0.7).checkpoint().advanceFt(300);
    // section D (CHART-006, 10c): the stop-in-the-middle run: a stop with no pause printed between the marks; the net loss is the zero-dwell stop & go loss
    { const [vi, vo] = pick3(r, inPrinted([25, 30, 35, 40, 45, 50, 55]), 0)[0]!; const id = 'D1'; tags.push(`chart:stopMid:${vi}>${vo}`);
      setIn(vi, id); mark(`${id} in`, `Stop in the middle ${vi} > ${vo}: approach at ${vi}; the car stops at the sign and you call go at once.`);
      b.advanceMiles(0.2).stop('S', vo, { noPause: true }); cur = vo;
      mark(`${id} out`, `Leave at ${vo}. Net seconds lost against the ghost = the stop-and-go loss for ${vi} > ${vo}.`);
      b.advanceMiles(0.5).checkpoint().advanceFt(300); }
    const sc = b.finish().build();
    sc.tags = [...(sc.tags ?? []), ...tags, 'd06', MEASURE_RUN_TAG, tier.name === 'Bronze' ? 'charts:packard' : 'charts:hidden'];
    annotatePerfectTimes(sc, true);
    return sc;
  },
  rubric(r, sc) {
    const pairs = chartPairs(sc.tags); const notes = r.actions.filter(a => a.action.type === 'note').map(a => (a.action as { text: string }).text);
    const driver = driverOf(sc.tags); const parsed = parseChartRuns(notes, driver); const perf = buildPerfTable(sc.car);
    const raw = parseRawRuns(notes, driver); const derived = deriveFromRaw(raw);   // CHART-006: raw run times -> net losses, as the chart tool computes them
    const fromRaw = (p: ChartPair): number | null => p.kind === 'stopGo' ? (derived.pause[`${p.vIn}>${p.vOut}`] ?? null) : p.kind === 'accel' && p.vIn === 0 ? (derived.acc[p.vOut] ?? null) : p.kind === 'accel' && p.vOut === 0 ? (derived.dec[p.vIn] ?? null) : null;
    const truth = (p: ChartPair): number => p.kind === 'stopMid' ? Math.round(stopLoss(p.vIn, p.vOut, sc.car) * 10) / 10 : Math.round(matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut) * 10) / 10;
    // ENG-020: Bronze is graded on copying the printed Packard cell; a cell measured honestly on the Packard the sim drives is credited too (its physics are not the 1936 table's)
    const packard = (sc.tags ?? []).includes('charts:packard');
    const physCar = packard && sc.car.tables ? { ...sc.car, tables: undefined } : null; const physPerf = physCar ? buildPerfTable(physCar) : null;
    const measuredTruth = (p: ChartPair): number | null => !physCar || !physPerf ? null : Math.round((p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, physCar) : matrixAt(p.kind === 'stopGo' ? physPerf.stopGo : p.kind === 'accel' ? physPerf.accel : physPerf.turns, p.vIn, p.vOut)) * 10) / 10;
    let good = 0; const lines: string[] = []; const per: Record<ChartKind, number> = { stopGo: 0, accel: 0, turn: 0, stopMid: 0 };
    const extrap = new Set(perf.extrapolated);
    for (const p of pairs) {
      const tv = truth(p); let e = parsed.get(pairKey(p.kind, p.vIn, p.vOut)); const lab = `${KIND_LABEL[p.kind]} ${p.vIn}>${p.vOut}`;
      if (!e) { const dv = fromRaw(p); if (dv !== null && dv >= 0) e = { runs: [dv], outliers: [], value: dv, driver: null }; }
      const flagged = extrap.has(p.vIn) || extrap.has(p.vOut) ? ' (extrapolated: the handbook prints 15-50)' : '';
      if (e?.outliers.length) lines.push(`${lab}: a run of ${e.outliers.join(', ')} s is a negative net loss, an outlier: delete it or re-run.`);
      // ENG-020: a negative note that is what this run really measured is a fair measurement of a noisy run (the driver's noise, Gold): credited, and named as a run to repeat
      if (e && e.value === null && e.outliers.length) { const rm0 = runMeasurement(r, sc, p); const neg = e.outliers[e.outliers.length - 1]!; if (rm0 !== null && Math.abs(neg - rm0) <= 1) { good++; per[p.kind]++; lines.push(`${lab}: you noted ${neg}, which is what this run measured (${rm0.toFixed(1)} s): fair, but a negative loss is the driver's noise, so drive the pair again and average (chart ${tv.toFixed(1)} s)${flagged}`); continue; } }
      if (!e || e.value === null) { lines.push(`${lab}: not noted (chart ${tv.toFixed(1)} s)${flagged}`); continue; }
      const mt = measuredTruth(p); const errM = mt === null ? Infinity : Math.abs(e.value - mt);
      const rm = runMeasurement(r, sc, p); const errR = rm === null ? Infinity : Math.abs(e.value - rm);
      const err = Math.abs(e.value - tv); const ok = err <= 1 || errM <= 1 || errR <= 1;
      if (ok) { good++; per[p.kind]++; }
      lines.push(`${lab}: you noted ${e.value}${e.runs.length > 1 ? ` (average of ${e.runs.length - e.outliers.length} runs)` : ''}, chart ${tv.toFixed(1)} s (${err <= 1 ? 'within 1 s' : errM <= 1 ? `measured on this car: ${mt!.toFixed(1)} s, within 1 s` : errR <= 1 ? `this run measured ${rm!.toFixed(1)} s, within 1 s: a fair measurement, the driver's noise put this run off the mean` : `off by ${err.toFixed(1)} s${rm !== null ? `; this run measured ${rm.toFixed(1)} s` : ''}`})${flagged}`);
    }
    // CHART-006: a negative derived cell is impossible (a start or a stop cannot beat a flying run): name it, name the run that disagrees, say what to do
    for (const n of derived.negatives) lines.push(`Your chart cell ${n.cell} = ${n.value.toFixed(2)} s is NEGATIVE: Double-check there are no negative numbers in the completed chart. If negative numbers are present, check for large discrepancies in each speed run, then re-run and re-average (do not delete the run).`);
    for (const d of derived.discrepant) lines.push(`${d.kind === 'const' ? 'Constant-speed' : d.kind === 'acc' ? 'Start-from-a-standstill' : 'Braking'} run at ${d.speed}: ${d.run} s disagrees with ${d.others.join(' / ')}: re-run it and re-average.`);
    for (const k of derived.pauseOver15) lines.push(`Stop & go ${k} comes out above 15 s (${derived.pause[k]!.toFixed(1)} s): you would sit longer than the printed pause, which is the symptom of a negative loss. Re-run and re-average.`);
    const total = pairs.length || 1; const ratio = good / total;
    const stars: 0 | 1 | 2 | 3 = ratio >= 0.88 ? 3 : ratio >= 0.66 ? 2 : ratio >= 0.33 ? 1 : 0;
    const other = [...parseChartRuns(notes).values()].filter(v => v.driver && v.driver !== driver).length;
    // EDU-002: the tip names the chart cells, the thing this drill grades (never the leg-error "Clean run")
    const firstMiss = lines.find(l => /not noted|off by|NEGATIVE|disagrees|above 15 s/.test(l));
    const tip = stars === 3 ? `Clean run: ${good}/${pairs.length} chart cells within 1 s. Keep the chart in the car and write its numbers beside the book's stops and turns.`
      : good === 0 && !notes.length ? `No chart cells were noted: write each pair as you measure it ("stopgo 30>40 = 8.4", "accel 0>40 = 4.5", "turn 40>35 = 4.0"), or the raw runs ("const 25 runs 19.8 19.9 19.8 19.9"). ${packard ? 'At Bronze copy the printed Packard charts (Reference, HB p.7-9).' : 'Lesson "Measure your car" shows the runs.'}`
        : `${good}/${pairs.length} chart cells within 1 s${firstMiss ? `; first to fix: ${firstMiss}` : ''}. ${packard ? 'Bronze is graded on copying: every pair is on the printed Packard charts (Reference, HB p.7-9); copy the cell for the IN > OUT pair.' : 'Retry this seed to drive the pairs again (your notes are kept; the last note per pair counts, "runs a b c" averages them), and measure without compensating: no launch lead, no early call.'}`;
    return {
      score: good, stars, tip, headline: `${good}/${pairs.length} chart cells within 1 s (stop & go ${per.stopGo}/3, accel/decel ${per.accel}/3, turns ${per.turn}/3, stop in the middle ${per.stopMid}/1)`,
      feedback: [
        tip,
        packard ? 'Bronze hands you the 1936 Packard charts and drives the Packard: your notes should match the printed tables; Silver and Gold hide the car\'s numbers, so measure.' : `This car (${sc.car.name}) is hidden: the notes are your own measurements. Four runs per pair in a real car ("stopgo 30>40 runs 8.4 8.6 8.5 8.5" is averaged); a negative net loss is an outlier to delete or re-run.`,
        `Charts are per driver: this run is driver ${driver}${other ? `; ${other} note(s) tagged for the other driver were ignored` : ' (tag a note "A:" or "B:" to chart both drivers)'}.`,
        'Chart (b): the pause time to sit for a 15 s stop at this IN/OUT. Chart (a): net seconds lost changing speed (the 0 row is a start from a stop). Chart (c): seconds lost in a 90 degree turn. Stop in the middle: the same stop with no pause, whose net loss is 15 s minus chart (b).',
        'A simple chart is enough (10a 2024 54:51): a few speeds measured well beat a 25-year chart you do not trust.',
        'The chart tool takes RAW course times in seconds: "const 25 runs 19.8 19.9 19.8 19.9", "acc 25 runs 18.0 ...", "brk 25 runs 17.0 ..." (three run types, four runs per speed); the net loss is the average minus the constant-speed average, and the stop & go pause is 15 - brake loss(IN) - accel loss(OUT). The distance between the marks does not matter provided it is the same on every run; use things that never move; the front wheels are the point that counts.',
        ...lines,
      ],
    };
  },
};
