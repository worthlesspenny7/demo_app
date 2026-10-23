/**
 * PT-15 give-away audit: 40 seeds per option-card kind (variant = seed % 4, as the Scheduler's r.int(0, 3) draws it uniformly), plus 40
 * extra pre-read "How long" cards. For every card each skill-free guess is graded by the real grader on a fresh runner:
 *   position (always the i-th button on screen), rank (always the k-th smallest value; numeric cards), label (always the same label when
 *   it is offered, else the first button), and "fixed answer" (the most frequent right label). Writes JSON to the scratchpad.
 */
import { buildMicro, microRunner, type Decision, type MicroSpec } from '../src/core/decision/index.js';
import * as fs from 'node:fs';
const OUT = '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt15';
const SKILL: Record<string, string> = { preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', transitOut: 'startOnTime', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', lost: 'recovery', clock: 'instruments', watch: 'instruments' };
const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
function val(label: string): number {
  if (/Go at once|No claim/.test(label)) return 0;
  const w = /Wait ([\d.]+)/.exec(label); if (w) return Number(w[1]);
  const t = /(\d+):(\d\d):(\d\d)/.exec(label); if (t) return Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]);
  const i = iv(label); if (Number.isFinite(i)) return i;
  const n = /^(\d+) mph/.exec(label); if (n) return Number(n[1]);
  return NaN;
}
type Card = { spec: MicroSpec; d: Decision };
function cards(kind: string, n: number, filter?: (d: Decision) => boolean, base = 0): Card[] {
  const out: Card[] = [];
  for (let s = 1; out.length < n && s < 2000; s++) {
    const seed = s * 7907 + 101 + base; const spec = { kind, skill: SKILL[kind], seed, variant: seed % 4 } as MicroSpec;
    const r = microRunner(buildMicro(spec, 2), 2); const d = r.next(); if (!d || d.kind !== kind || !d.options) continue;
    if (filter && !filter(d)) continue; out.push({ spec, d });
  }
  return out;
}
function grade(c: Card, pick: (d: Decision) => string): boolean {
  const r = microRunner(buildMicro(c.spec, 2), 2); const d = r.next()!; const id = pick(d);
  return r.answer(d, { optionId: id, ...(d.deadlineSeconds !== undefined ? { tapSeconds: 2.5 } : {}) }).correct;
}
const res: Record<string, any> = {};
const groups: [string, Card[]][] = [
  ['clock', cards('clock', 40)], ['checkpoint', cards('checkpoint', 40)], ['lost', cards('lost', 40)], ['makeup', cards('makeup', 40)], ['hazard', cards('hazard', 40)],
  ['preread (as drawn)', cards('preread', 40)], ['preread How long', cards('preread', 40, d => /How long/.test(d.prompt), 5000)], ['preread What speed', cards('preread', 40, d => /What speed/.test(d.prompt), 9000)],
  ['transitOut', cards('transitOut', 40)], ['ta', cards('ta', 40)], ['watch', cards('watch', 40)],
];
for (const [name, cs] of groups) {
  const r: any = { n: cs.length, mix: {} as Record<string, number>, position: [] as number[], rank: [] as number[], middle: 0, label: {} as Record<string, number>, rightLabel: {} as Record<string, number>, rightPos: [0, 0, 0, 0], rightRank: [0, 0, 0, 0], nOpts: {} as Record<number, number> };
  for (const c of cs) {
    const key = /How long|Which way|What speed/.exec(c.d.prompt)?.[0] ?? c.d.context.hazard?.label ?? `v${c.spec.variant}`; r.mix[key] = (r.mix[key] ?? 0) + 1;
    const opts = c.d.options!; r.nOpts[opts.length] = (r.nOpts[opts.length] ?? 0) + 1;
    for (let i = 0; i < 4; i++) { r.position[i] = (r.position[i] ?? 0) + (grade(c, d => d.options![Math.min(i, d.options!.length - 1)]!.id) ? 1 : 0); }
    const numeric = opts.every(o => Number.isFinite(val(o.label)));
    if (numeric) {
      for (let k = 0; k < 4; k++) r.rank[k] = (r.rank[k] ?? 0) + (grade(c, d => [...d.options!].sort((a, b) => val(a.label) - val(b.label))[Math.min(k, d.options!.length - 1)]!.id) ? 1 : 0);
      if (grade(c, d => [...d.options!].sort((a, b) => val(a.label) - val(b.label))[Math.floor((d.options!.length - 1) / 2)]!.id)) r.middle++;
    }
    for (const o of opts) { const L = numeric ? '(numeric)' : o.label; if (numeric) continue; r.label[L] ??= 0; }
    // which option is right, by position and rank (a card may accept two)
    const sorted = [...opts].sort((a, b) => val(a.label) - val(b.label));
    opts.forEach((o, i) => { if (grade(c, () => o.id)) { r.rightPos[i]++; if (numeric) r.rightRank[sorted.findIndex(x => x.id === o.id)]++; if (!numeric) r.rightLabel[o.label] = (r.rightLabel[o.label] ?? 0) + 1; } });
  }
  for (const L of Object.keys(r.label)) { let k = 0; for (const c of cs) if (grade(c, d => (d.options!.find(o => o.label === L) ?? d.options![0]!).id)) k++; r.label[L] = k; }
  const best = Math.max(...r.position, ...(r.rank.length ? r.rank : [0]), r.middle, ...Object.values(r.label as Record<string, number>));
  r.bestGuess = best; res[name] = r;
}
fs.writeFileSync(`${OUT}/s12-guess-audit.json`, JSON.stringify(res, null, 1));
for (const [k, r] of Object.entries(res)) console.log(k, JSON.stringify({ n: r.n, mix: r.mix, nOpts: r.nOpts, position: r.position, rank: r.rank, middle: r.middle, label: r.label, rightPos: r.rightPos, rightRank: r.rightRank, best: r.bestGuess }));
