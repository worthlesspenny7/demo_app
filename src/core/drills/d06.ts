/** D06 "Build your charts": measure stop & go, acceleration/deceleration and turn losses for 3 speed pairs each (DRILL-023, CHART-001/002). */
import { EXITS } from '../builder.js';
import { annotatePerfectTimes, buildGhost, ghostTimeAt } from '../ghost.js';
import { buildPerfTable, matrixAt } from '../perf-table.js';
import { rng, type Rng } from '../rng.js';
import type { Drill } from './types.js';
import { tiers, tierOf, base } from './common.js';

export type ChartKind = 'stopGo' | 'accel' | 'turn';
export interface ChartPair { kind: ChartKind; vIn: number; vOut: number }
const KIND_LABEL: Record<ChartKind, string> = { stopGo: 'stop & go', accel: 'accel/decel', turn: 'turn' };

const pairKey = (k: ChartKind, a: number, b: number): string => `${k}:${a}>${b}`;
/** Pairs of a scenario from its tags (the rubric's truth list); players read the same pairs on the marker lines. */
export function chartPairs(tags: string[] | undefined): ChartPair[] {
  const out: ChartPair[] = [];
  for (const t of tags ?? []) { const m = /^chart:(stopGo|accel|turn):(\d+)>(\d+)$/.exec(t); if (m) out.push({ kind: m[1] as ChartKind, vIn: Number(m[2]), vOut: Number(m[3]) }); }
  return out;
}

/** "stopgo 30>40 = 8.4", "turn 40>35 = 4.0", "accel 0>40 = 4.5", "decel 40>30 = 1.2" (the accel/decel chart has both). */
export function parseChartNotes(notes: string[]): Map<string, number> {
  const out = new Map<string, number>();
  const re = /\b(stop\s*(?:&|and)?\s*go|stopgo|sg|accel(?:\s*\/\s*decel)?|decel|ad|turns?)\b\s*(\d+)\s*(?:>|->|→|to|\/|-)\s*(\d+)\s*(?:=|:|is)?\s*(-?\d+(?:\.\d+)?)/gi;
  for (const text of notes) {
    for (const m of text.matchAll(re)) {
      const w = m[1]!.toLowerCase().replace(/\s+/g, ''); const kind: ChartKind = w.startsWith('stop') || w === 'sg' ? 'stopGo' : w.startsWith('turn') ? 'turn' : 'accel';
      out.set(pairKey(kind, Number(m[2]), Number(m[3])), Number(m[4]));
    }
  }
  return out;
}

function pick3(r: Rng, speeds: number[], minGap: number, firstFromZero = false): [number, number][] {
  const out: [number, number][] = []; let guard = 0;
  while (out.length < 3 && guard++ < 200) {
    const a = firstFromZero && out.length === 0 ? 0 : r.pick(speeds), b = r.pick(speeds);
    if (Math.abs(a - b) < minGap || out.some(p => p[0] === a && p[1] === b)) continue;
    out.push([a, b]);
  }
  return out;
}

export const D06: Drill = {
  id: 'D06', title: 'Build your charts', objective: 'Measure the car: three stop-and-go pauses, three acceleration/deceleration losses and three turn losses for the IN > OUT pairs on the marker lines. Note each as "stopgo 30>40 = 8.4", "accel 0>40 = 4.5" or "turn 40>35 = 4.0"; the debrief compares with the car\'s true charts.', skills: ['P12'], minutes: 16, kind: 'drive',
  tiers: tiers([3, 3, 2]), unlock: [],
  scenario(seed, t) {
    const tier = tierOf(D06, t); const r = rng(seed * 6007 + 6); const b = base('D06', 'Build your charts', seed, tier).start(30);
    const tags: string[] = [];
    const mark = (id: string, what: string): void => { b.advanceMiles(0.2); b.instruction({ label: `MARK ${id}`, sightDistance: 450 }, { text: `MARK ${id}: lap the stopwatch here. ${what}` }); };
    let cur = 30;
    const setIn = (v: number, id: string): void => { b.advanceMiles(0.35); if (v !== cur) { b.speedAtSign(`SPEED ${v}`, v); cur = v; } else b.instruction({ sign: { text: `SPEED ${v}`, shape: 'rect', side: 'R' }, sightDistance: 450 }, { speed: v }); void id; };
    // section A: stop & go (15 s pause printed): IN speed, a STOP with a 15 s pause, OUT speed
    pick3(r, [25, 30, 35, 40, 45], 0).forEach(([vi, vo], k) => {
      const id = `A${k + 1}`; tags.push(`chart:stopGo:${vi}>${vo}`);
      setIn(vi, id); mark(`${id} in`, `Stop & go ${vi} > ${vo}: approach at ${vi}.`);
      b.advanceMiles(0.2).stop(r.pick(['L', 'R']), vo, { pause: 15 }); cur = vo;
      mark(`${id} out`, `Leave at ${vo}. Chart pause time = your dwell + your seconds early/late against the 15 s pause.`);
    });
    b.advanceMiles(0.6).checkpoint();
    // section B: acceleration / deceleration: the first pair starts from a standstill (a time-of-day restart), the others are speed changes at a sign
    pick3(r, [20, 25, 30, 35, 40, 45], 10, true).forEach(([vi, vo], k) => {
      const id = `B${k + 1}`; tags.push(`chart:accel:${vi}>${vo}`);
      if (vi === 0) {
        b.advanceMiles(0.4);
        const g = buildGhost(b.build()); const arrive = ghostTimeAt(g, b.position) + 45; // the restart waits for the car
        b.restart(vo, Math.ceil(arrive / 5) * 5, { text: `Restart: leave on the second. Accel 0 > ${vo}: lap at MARK ${id} out.` }); cur = vo;
        mark(`${id} out`, `Accel 0 > ${vo}: your seconds late at this mark against the ghost are the chart value.`);
      } else {
        setIn(vi, id); mark(`${id} in`, `Accel/decel ${vi} > ${vo}: you are at ${vi}.`);
        b.advanceMiles(0.2).speedAtSign(`SPEED ${vo}`, vo); cur = vo;
        mark(`${id} out`, `Now ${vo}. Net seconds lost against the ghost is the chart value.`);
      }
    });
    b.advanceMiles(0.6).checkpoint();
    // section C: turns: IN speed, a 90 degree turn at the crossroad, OUT speed
    pick3(r, [25, 30, 35, 40, 45], 0).forEach(([vi, vo], k) => {
      const id = `C${k + 1}`; tags.push(`chart:turn:${vi}>${vo}`); const dir = r.pick(['L', 'R'] as const);
      setIn(vi, id); mark(`${id} in`, `Turn ${vi} > ${vo}: approach at ${vi}.`);
      b.advanceMiles(0.25).instruction({ exits: EXITS.crossroads(dir), sightDistance: 700 }, { turn: dir, speed: vo }); cur = vo;
      mark(`${id} out`, `Turn done, ${vo}. Seconds lost against the ghost is the chart value.`);
    });
    b.advanceMiles(0.7).checkpoint().advanceFt(300);
    const sc = b.finish().build();
    sc.tags = [...(sc.tags ?? []), ...tags, 'd06', tier.name === 'Bronze' ? 'charts:packard' : 'charts:hidden'];
    annotatePerfectTimes(sc, true);
    return sc;
  },
  rubric(r, sc) {
    const pairs = chartPairs(sc.tags); const notes = r.actions.filter(a => a.action.type === 'note').map(a => (a.action as { text: string }).text);
    const parsed = parseChartNotes(notes); const perf = buildPerfTable(sc.car);
    const truth = (p: ChartPair): number => { const m = p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns; return Math.round(matrixAt(m, p.vIn, p.vOut) * 10) / 10; };
    let good = 0; const lines: string[] = []; const per: Record<ChartKind, number> = { stopGo: 0, accel: 0, turn: 0 };
    for (const p of pairs) {
      const tv = truth(p); const nv = parsed.get(pairKey(p.kind, p.vIn, p.vOut)); const lab = `${KIND_LABEL[p.kind]} ${p.vIn}>${p.vOut}`;
      if (nv === undefined) { lines.push(`${lab}: not noted (chart ${tv.toFixed(1)} s)`); continue; }
      const err = Math.abs(nv - tv);
      if (err <= 1) { good++; per[p.kind]++; }
      lines.push(`${lab}: you noted ${nv}, chart ${tv.toFixed(1)} s (${err <= 1 ? 'within 1 s' : `off by ${err.toFixed(1)} s`})`);
    }
    const stars: 0 | 1 | 2 | 3 = good >= 8 ? 3 : good >= 6 ? 2 : good >= 3 ? 1 : 0;
    const packard = (sc.tags ?? []).includes('charts:packard');
    return {
      score: good, stars, headline: `${good}/${pairs.length} chart cells within 1 s (stop & go ${per.stopGo}/3, accel/decel ${per.accel}/3, turns ${per.turn}/3)`,
      feedback: [
        packard ? 'Bronze hands you the 1936 Packard charts and drives the Packard: your notes should match the printed tables; Silver and Gold hide the car\'s numbers, so measure.' : `This car (${sc.car.name}) is hidden: the notes are your own measurements. Four runs per pair in a real car; a wrong chart is worse than none.`,
        'Chart (b): the pause time to sit for a 15 s stop at this IN/OUT. Chart (a): net seconds lost changing speed (the 0 row is a start from a stop). Chart (c): seconds lost in a 90 degree turn.',
        ...lines,
      ],
    };
  },
};
