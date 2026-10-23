/**
 * PT-15 central test, headless: the rule-card follower (pt15-follower.ts -> tests/pt14-follower.ts) on every card kind, 4 variants x 40 seeds
 * (seeds of my own, not the fix sprint's), at rung 2 and rung 1 (the cell behind "Chart" passed as the follower opens it). Any "Not quite" is
 * a contradiction between the cards and the grader. Also: the naive rookie, my own independent reading of RULE-031 on the hazard card,
 * whether a follower's taps land inside the card's open time (card seconds and wall seconds), the compressed holds, then whole runs through
 * the Scheduler (Daily 5 days x 3, practice 15, single-skill 5 x 4, Boss 20 at rung 2 and 20 at rung 1) with a human pace model.
 * Writes JSON to the scratchpad.
 */
import { buildMicro, microRunner, Scheduler, DecisionRun, emptyProgress, type Decision, type DecisionResponse, type MicroSpec, type DecisionRunner, type Verdict } from '../src/core/decision/index.js';
import { wallOf, wallMaxOf } from '../src/core/decision/runner.js';
import { follow, naive, hazardMine, reactions } from './pt15-follower.js';
import * as fs from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt15';
fs.mkdirSync(OUT, { recursive: true });
const react = reactions(1515);
const KINDS = ['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock', 'watch'] as const;
const SKILL: Record<string, string> = { preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', restart: 'startOnTime', transitOut: 'startOnTime', pause: 'stayOnTime', speedChange: 'stayOnTime', timedStart: 'stayOnTime', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', lost: 'recovery', clock: 'instruments', watch: 'instruments' };
const TIMED = new Set(['pause', 'restart', 'timedStart', 'speedChange']);
const arrowOf = (r: DecisionRunner, d: Decision): string | undefined => (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined;
const chartOf = (d: Decision, rung: number): number | null => rung === 1 ? d.context.chart?.seconds ?? null : null;
function answerer(d: Decision, r: DecisionRunner, rung: number): { resp: DecisionResponse | null; err?: string } {
  try { const a = follow(d, { react, arrow: arrowOf(r, d), chart: chartOf(d, rung) }); return { resp: d.deadlineSeconds !== undefined && a.optionId ? { ...a, tapSeconds: a.tapSeconds ?? 2.5 } : a }; }
  catch (e) { return { resp: null, err: String((e as Error).message ?? e) }; }
}
/** The last tap of a response in card seconds and whether the card is still open then (card and wall time). */
function openCheck(d: Decision, resp: DecisionResponse | null): { last: number; open: boolean; wall: number; wallMax: number } | null {
  const t = d.timing; if (!t || !resp) return null;
  const last = resp.taps ? resp.taps[1] : resp.tapSeconds ?? NaN;
  return { last, open: last <= t.maxSeconds, wall: wallOf(t, last), wallMax: wallMaxOf(t) };
}
type Row = { kind: string; variant: number; seed: number; rung: number; prompt: string; verdict: string; expected: string; chosen: string; rule: string; delta: number; err?: string };
const out: Record<string, any> = { micro: {}, wrong: [] as Row[], hazardMine: { agree: 0, n: 0, disagree: [] as string[] }, holds: { n: 0, skipped: 0, jumps: [] as number[], wallOpen: [] as number[], closedEarly: [] as string[] }, runs: {} };

for (const rung of [2, 1] as const) {
  for (const kind of KINDS) {
    const rec = { n: 0, none: 0, right: 0, wrong: 0, errs: 0, naiveRight: 0, byVariant: {} as Record<number, { n: number; right: number }> };
    for (let variant = 0; variant < 4; variant++) for (let s = 1; s <= 40; s++) {
      const spec = { kind, skill: SKILL[kind], seed: s * 104729 + variant * 53 + 15, variant } as MicroSpec;
      const r = microRunner(buildMicro(spec, rung), rung); const d = r.next();
      if (!d || d.kind !== kind) { rec.none++; continue; }
      const { resp, err } = answerer(d, r, rung);
      const oc = openCheck(d, resp);
      if (d.timing) {
        out.holds.n++; if (d.timing.skip) { out.holds.skipped++; out.holds.jumps.push(+(d.timing.skip.to - d.timing.skip.at).toFixed(1)); }
        if (oc) { out.holds.wallOpen.push(+oc.wall.toFixed(1)); if (!oc.open || oc.wall > oc.wallMax) out.holds.closedEarly.push(`${kind}@${rung} seed ${spec.seed}: tap ${oc.last.toFixed(1)} max ${d.timing.maxSeconds} wall ${oc.wall.toFixed(1)}/${oc.wallMax.toFixed(1)}`); }
      }
      const v: Verdict = r.answer(d, resp);
      rec.n++; (rec.byVariant[variant] ??= { n: 0, right: 0 }).n++;
      if (err) rec.errs++;
      if (v.correct) { rec.right++; rec.byVariant[variant]!.right++; }
      else { rec.wrong++; out.wrong.push({ kind, variant, seed: spec.seed, rung, prompt: d.prompt, verdict: `${v.missed ?? ''} ${v.secondsDelta}`, expected: v.expected, chosen: v.chosen, rule: v.rule, delta: v.secondsDelta, ...(err ? { err } : {}) }); }
      const r2 = microRunner(buildMicro(spec, rung), rung); const d2 = r2.next()!;
      let nv = false; try { nv = r2.answer(d2, naive(d2, { react, arrow: arrowOf(r2, d2), chart: chartOf(d2, rung) })).correct; } catch { nv = false; }
      if (nv) rec.naiveRight++;
      if (kind === 'hazard') {
        const mine = hazardMine(d.prompt); out.hazardMine.n++;
        const agrees = mine === 'either' || (mine === 'claim' ? v.expected.startsWith('Make up what you can') || /claim the rest/.test(v.expected) : /Make it all up/.test(v.expected));
        if (agrees) out.hazardMine.agree++; else out.hazardMine.disagree.push(`${d.prompt} | mine ${mine} | grader ${v.expected}`);
      }
    }
    out.micro[`${kind}@${rung}`] = rec;
  }
}

// whole runs, with a human pace model: option card 2.5 s read + 0.3 s tap; timed card: the wall time of the last tap; verdict 2 s
// (3 s when wrong); rule card 3 s; card build 0.1 s
function playWith(run: DecisionRun, rung: number, who: 'follow' | 'naive'): { n: number; right: number; kinds: Record<string, number>; skills: Record<string, number>; wrong: Row[]; wall: number; gaps: number[]; rules: string[]; ruleThenKind: string[]; maxHold: number } {
  const res = { n: 0, right: 0, kinds: {} as Record<string, number>, skills: {} as Record<string, number>, wrong: [] as Row[], wall: 0, gaps: [] as number[], rules: [] as string[], ruleThenKind: [] as string[], maxHold: 0 };
  let lastTap = 0; let pendingRule: string | null = null;
  for (let i = 0; i < 300; i++) {
    const st = run.next(); if (!st) break;
    if (st.type === 'rule') { res.rules.push(st.card.id); pendingRule = st.card.id; res.wall += 3; run.ack(); continue; }
    const d = st.decision; const r = run.currentRunner()!;
    if (pendingRule) { res.ruleThenKind.push(`${pendingRule}->${d.kind}:${/How long|Which way|What speed/.exec(d.prompt)?.[0] ?? ''}${/red|truck|tractor|Gates|bus|accident|Road work|combine/i.exec(d.prompt)?.[0] ?? ''}${/base|your time|OUT|leave at/.exec(d.prompt)?.[0] ?? ''}`); pendingRule = null; }
    let resp: DecisionResponse | null;
    try { resp = who === 'follow' ? follow(d, { react, arrow: arrowOf(r, d), chart: chartOf(d, rung) }) : naive(d, { react, arrow: arrowOf(r, d), chart: chartOf(d, rung) }); if (d.deadlineSeconds !== undefined && resp.optionId) resp = { ...resp, tapSeconds: 2.5 }; }
    catch { resp = null; }
    const cardWall = d.timing ? (resp ? wallOf(d.timing, resp.taps ? resp.taps[1] : resp.tapSeconds ?? d.timing.maxSeconds) : wallMaxOf(d.timing)) : 2.8;
    if (d.timing) res.maxHold = Math.max(res.maxHold, cardWall);
    res.wall += 0.1 + cardWall; const tapAt = res.wall; if (res.n > 0) res.gaps.push(tapAt - lastTap); lastTap = tapAt;
    const v = run.answer(resp);
    res.wall += v.correct ? 2 : 3;
    res.n++; res.kinds[d.kind] = (res.kinds[d.kind] ?? 0) + 1; res.skills[d.skill] = (res.skills[d.skill] ?? 0) + 1;
    if (v.correct) res.right++; else res.wrong.push({ kind: d.kind, variant: -1, seed: run.plan.seed, rung, prompt: d.prompt, verdict: `${v.missed ?? ''} ${v.secondsDelta}`, expected: v.expected, chosen: v.chosen, rule: v.rule, delta: v.secondsDelta });
  }
  return res;
}
const q = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo]! + (s[hi]! - s[lo]!) * (k - lo); };
const agg = (label: string, list: ReturnType<typeof playWith>[], skill?: string) => {
  const kinds: Record<string, number> = {}; for (const l of list) for (const [k, n] of Object.entries(l.kinds)) kinds[k] = (kinds[k] ?? 0) + n;
  const gaps = list.flatMap(l => l.gaps); const dpm = list.map(l => +(l.n / (l.wall / 60)).toFixed(2));
  return { label, runs: list.length, decisions: list.reduce((a, l) => a + l.n, 0), right: list.reduce((a, l) => a + l.right, 0), maxPerKindInARun: Math.max(...list.map(l => Math.max(...Object.values(l.kinds)))),
    kinds, ...(skill ? { skillShare: list.map(l => `${l.skills[skill] ?? 0}/${l.n}`) } : {}), decPerMin: { min: Math.min(...dpm), median: q(dpm, 0.5), max: Math.max(...dpm) }, gap: { median: +q(gaps, 0.5).toFixed(1), p75: +q(gaps, 0.75).toFixed(1), p90: +q(gaps, 0.9).toFixed(1), max: +Math.max(...gaps).toFixed(1), over15: `${gaps.filter(g => g > 15).length}/${gaps.length}` },
    maxHold: +Math.max(...list.map(l => l.maxHold)).toFixed(1), wall: list.map(l => Math.round(l.wall)), rules: list.flatMap(l => l.ruleThenKind), wrong: list.flatMap(l => l.wrong).slice(0, 40) };
};
const daily: ReturnType<typeof playWith>[] = []; const dailyNaive: ReturnType<typeof playWith>[] = [];
for (const day of ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']) for (let i = 0; i < 3; i++) {
  daily.push(playWith(new DecisionRun(Scheduler.daily(day, i, emptyProgress()).plan()), 2, 'follow'));
  dailyNaive.push(playWith(new DecisionRun(Scheduler.daily(day, i, emptyProgress()).plan()), 2, 'naive'));
}
const practice: ReturnType<typeof playWith>[] = [];
for (let s = 1; s <= 15; s++) practice.push(playWith(new DecisionRun(new Scheduler(['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'], s * 7717, emptyProgress(), { mode: 'practice', rung: 2 }).plan()), 2, 'follow'));
const single: Record<string, ReturnType<typeof playWith>[]> = {};
for (const sk of ['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'] as const) for (let s = 1; s <= 4; s++) (single[sk] ??= []).push(playWith(new DecisionRun(new Scheduler([sk], s * 6007 + 3, emptyProgress(), { mode: 'practice', rung: 2 }).plan()), 2, 'follow'));
const boss2: ReturnType<typeof playWith>[] = []; const boss1: ReturnType<typeof playWith>[] = [];
for (let s = 1; s <= 20; s++) { boss2.push(playWith(new DecisionRun(Scheduler.boss(s * 4241 + 7, null, 2).plan()), 2, 'follow')); boss1.push(playWith(new DecisionRun(Scheduler.boss(s * 4241 + 8, null, 1).plan()), 1, 'follow')); }
out.runs = { daily: agg('daily follower', daily), dailyNaive: agg('daily naive', dailyNaive), practice: agg('practice follower', practice),
  ...Object.fromEntries(Object.entries(single).map(([k, v]) => [`single:${k}`, agg(`single ${k}`, v, k)])), boss2: agg('boss rung 2 follower', boss2), boss1: agg('boss rung 1 follower', boss1) };
fs.writeFileSync(`${OUT}/s10-follower-audit.json`, JSON.stringify(out, null, 1));
const brief = {
  micro: Object.fromEntries(Object.entries(out.micro).map(([k, v]: [string, any]) => [k, `${v.right}/${v.n} (none ${v.none}, errs ${v.errs}) naive ${v.naiveRight}/${v.n}`])),
  wrongCount: out.wrong.length, wrong: out.wrong.slice(0, 10), hazardMine: { agree: out.hazardMine.agree, n: out.hazardMine.n, disagree: out.hazardMine.disagree.slice(0, 6) },
  holds: { n: out.holds.n, skipped: out.holds.skipped, jumps: [Math.min(...out.holds.jumps), Math.max(...out.holds.jumps)], wallOpenMax: Math.max(...out.holds.wallOpen), closedEarly: out.holds.closedEarly.slice(0, 10) },
  runs: Object.fromEntries(Object.entries(out.runs).map(([k, v]: [string, any]) => [k, { runs: v.runs, decisions: v.decisions, right: v.right, maxPerKindInARun: v.maxPerKindInARun, decPerMin: v.decPerMin, gap: v.gap, maxHold: v.maxHold, skillShare: v.skillShare, wrong: v.wrong.length, wrongSample: v.wrong.slice(0, 3) }])),
};
console.log(JSON.stringify(brief, null, 1));
