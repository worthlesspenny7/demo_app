/**
 * PT-14 central test, headless: play every card kind by its rule card (pt14-follower.ts, from what the screen shows, with a 0.15-0.35 s
 * human reaction on timing cards) over 4 variants x 40 seeds at rung 2 (Daily / practice / first Boss) and rung 1 (later Boss: the chart
 * behind the Chart button, which the follower opens). Any "Not quite" for the follower is a contradiction between the cards and the grader.
 * Then whole runs: Daily sets, practice runs and Boss runs (rung 2 and 1) through the Scheduler, follower answering every card.
 * Also the naive rookie for contrast. Writes JSON to the scratchpad.
 */
import { buildMicro, microRunner, Scheduler, DecisionRun, emptyProgress, type Decision, type DecisionResponse, type MicroSpec, type DecisionRunner } from '../src/core/decision/index.js';
import { follow, naive, type Screen, type Action, type Hazard } from './pt14-follower.js';
import * as fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt14';
fs.mkdirSync(OUT, { recursive: true });
let rs = 14; const rnd = (): number => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
const react = (): number => 0.15 + rnd() * 0.2;
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };

export function screenOf(d: Decision, rung: number, arrow?: string): Screen {
  const c = d.context; const lap = c.watch?.laps[c.watch.laps.length - 1];
  return { kind: d.kind, prompt: d.prompt, rowC: (c.row?.columnC ?? []).join(' '), options: d.options ?? [], chart: rung >= 1 && c.chart ? c.chart.seconds : null,
    sign: d.timing?.signSeconds ?? null, lapCum: lap ? Math.round(lap.cumulative * 10) / 10 : null, ...(arrow ? { arrow } : {}) };
}
export function toResponse(a: Action, d: Decision): DecisionResponse {
  if ('optionId' in a) return { optionId: a.optionId, ...(d.deadlineSeconds !== undefined ? { tapSeconds: 2.5 } : {}) };
  if ('taps' in a) return { taps: a.taps };
  if ('tap' in a) return { tapSeconds: a.tap };
  // tap when the TOD digits (floor of the time of day) show the target second, plus the reaction
  const tod0 = d.context.tod; let T = hms(a.tod); const day = tod0 - (tod0 % 43200); T += day; while (T - tod0 > 21600) T -= 43200; while (tod0 - T > 21600) T += 43200;
  return { tapSeconds: Math.max(0, T - tod0) + a.react };
}
const arrowOf = (r: DecisionRunner, d: Decision): string | undefined => (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined;

const KINDS = ['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock', 'watch'] as const;
const SKILL: Record<string, string> = { preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', restart: 'startOnTime', transitOut: 'startOnTime', pause: 'stayOnTime', speedChange: 'stayOnTime', timedStart: 'stayOnTime', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', lost: 'recovery', clock: 'instruments', watch: 'instruments' };

type Row = { kind: string; variant: number; seed: number; rung: number; prompt: string; why: string; verdict: string; expected: string; chosen: string; rule: string; delta: number };
if (process.argv[1]?.includes("pt14-10")) main();
function main(): void {
const out: Record<string, any> = { micro: {}, wrong: [] as Row[], naive: {}, hazardBroad: {}, runs: {} };
for (const rung of [2, 1] as const) {
  for (const kind of KINDS) {
    const rec = { n: 0, none: 0, right: 0, wrong: 0, naiveRight: 0, byVariant: {} as Record<number, { n: number; right: number }> };
    for (let variant = 0; variant < 4; variant++) for (let s = 1; s <= 40; s++) {
      const spec = { kind, skill: SKILL[kind], seed: s * 7919 + variant * 31, variant } as MicroSpec;
      const r = microRunner(buildMicro(spec, rung), rung); const d = r.next();
      if (!d || d.kind !== kind) { rec.none++; continue; }
      const a = follow(screenOf(d, rung, arrowOf(r, d)), react);
      const v = r.answer(d, toResponse(a, d));
      rec.n++; (rec.byVariant[variant] ??= { n: 0, right: 0 }).n++;
      if (v.correct) { rec.right++; rec.byVariant[variant]!.right++; }
      else { rec.wrong++; out.wrong.push({ kind, variant, seed: spec.seed, rung, prompt: d.prompt, why: a.why, verdict: `${v.missed ?? ''} ${v.secondsDelta}`, expected: v.expected, chosen: v.chosen, rule: v.rule, delta: v.secondsDelta }); }
      // naive on a fresh copy
      const r2 = microRunner(buildMicro(spec, rung), rung); const d2 = r2.next()!;
      if (r2.answer(d2, toResponse(naive(screenOf(d2, rung, arrowOf(r2, d2)), react), d2)).correct) rec.naiveRight++;
      // hazard, broad reading of RULE-031
      if (kind === 'hazard' && rung === 2) {
        const r3 = microRunner(buildMicro(spec, rung), rung); const d3 = r3.next()!; const a3 = follow(screenOf(d3, rung), react, 'broad' as Hazard);
        const v3 = r3.answer(d3, toResponse(a3, d3)); const key = d3.context.hazard?.label + (/last cars|blinker/.test(d3.prompt) ? ' (short)' : '');
        const h = (out.hazardBroad[key] ??= { n: 0, strictRight: 0, broadRight: 0, expected: {} as Record<string, number>, sample: d3.prompt });
        h.n++; if (v.correct) h.strictRight++; if (v3.correct) h.broadRight++; h.expected[v3.expected] = (h.expected[v3.expected] ?? 0) + 1;
      }
    }
    out.micro[`${kind}@${rung}`] = rec;
  }
}
// whole runs through the Scheduler: daily sets (3 days x 3 runs), practice (10 seeds), Boss (10 seeds at rung 2, 10 at rung 1)
function playWith(run: DecisionRun, rung: number, who: 'follow' | 'naive'): { n: number; right: number; kinds: Record<string, number>; wrong: Row[]; secs: number } {
  const res = { n: 0, right: 0, kinds: {} as Record<string, number>, wrong: [] as Row[], secs: 0 };
  for (let i = 0; i < 200; i++) {
    const st = run.next(); if (!st) break;
    if (st.type === 'rule') { run.ack(); continue; }
    const d = st.decision; const r = run.currentRunner()!; const sc = screenOf(d, rung, arrowOf(r, d));
    const a = who === 'follow' ? follow(sc, react) : naive(sc, react);
    const v = run.answer(toResponse(a, d));
    res.n++; res.kinds[d.kind] = (res.kinds[d.kind] ?? 0) + 1; res.secs += Math.abs(v.secondsDelta);
    if (v.correct) res.right++; else res.wrong.push({ kind: d.kind, variant: -1, seed: run.plan.seed, rung, prompt: d.prompt, why: a.why, verdict: `${v.missed ?? ''} ${v.secondsDelta}`, expected: v.expected, chosen: v.chosen, rule: v.rule, delta: v.secondsDelta });
  }
  return res;
}
const agg = (label: string, list: ReturnType<typeof playWith>[]) => { const kinds: Record<string, number> = {}; for (const l of list) for (const [k, n] of Object.entries(l.kinds)) kinds[k] = (kinds[k] ?? 0) + n; return { label, runs: list.length, decisions: list.reduce((a, l) => a + l.n, 0), right: list.reduce((a, l) => a + l.right, 0), maxPerKindInARun: Math.max(...list.map(l => Math.max(...Object.values(l.kinds)))), kinds, wrong: list.flatMap(l => l.wrong).slice(0, 30) }; };
const daily: ReturnType<typeof playWith>[] = []; const dailyNaive: ReturnType<typeof playWith>[] = [];
for (const day of ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']) for (let i = 0; i < 3; i++) {
  daily.push(playWith(new DecisionRun(Scheduler.daily(day, i, emptyProgress()).plan()), 2, 'follow'));
  dailyNaive.push(playWith(new DecisionRun(Scheduler.daily(day, i, emptyProgress()).plan()), 2, 'naive'));
}
const practice: ReturnType<typeof playWith>[] = [];
for (let s = 1; s <= 15; s++) practice.push(playWith(new DecisionRun(new Scheduler(['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'], s * 9973, emptyProgress(), { mode: 'practice', rung: 2 }).plan()), 2, 'follow'));
for (const sk of ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'] as const) for (let s = 1; s <= 4; s++) practice.push(playWith(new DecisionRun(new Scheduler([sk], s * 5003, emptyProgress(), { mode: 'practice', rung: 2 }).plan()), 2, 'follow'));
const boss2: ReturnType<typeof playWith>[] = []; const boss1: ReturnType<typeof playWith>[] = [];
for (let s = 1; s <= 10; s++) { boss2.push(playWith(new DecisionRun(Scheduler.boss(s * 1237, null, 2).plan()), 2, 'follow')); boss1.push(playWith(new DecisionRun(Scheduler.boss(s * 1237 + 1, null, 1).plan()), 1, 'follow')); }
out.runs = { daily: agg('daily follower', daily), dailyNaive: agg('daily naive', dailyNaive), practice: agg('practice follower', practice), boss2: agg('boss rung 2 follower', boss2), boss1: agg('boss rung 1 follower', boss1) };
fs.writeFileSync(`${OUT}/s10-follower-audit.json`, JSON.stringify(out, null, 1));
const brief = { micro: Object.fromEntries(Object.entries(out.micro).map(([k, v]: [string, any]) => [k, `${v.right}/${v.n} (none ${v.none}) naive ${v.naiveRight}/${v.n}`])), wrongCount: out.wrong.length, wrongByKind: out.wrong.reduce((a: any, w: Row) => { a[`${w.kind}@${w.rung}`] = (a[`${w.kind}@${w.rung}`] ?? 0) + 1; return a; }, {}), hazardBroad: out.hazardBroad,
  runs: Object.fromEntries(Object.entries(out.runs).map(([k, v]: [string, any]) => [k, { runs: v.runs, decisions: v.decisions, right: v.right, maxPerKindInARun: v.maxPerKindInARun, kinds: v.kinds, wrong: v.wrong.length }])) };
console.log(JSON.stringify(brief, null, 1));
}
