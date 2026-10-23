/** PT-13 core audit (no browser): over many micro scenarios, check that what a card SAYS agrees with what it GRADES, and how often each answer is right. */
import { buildMicro, DecisionRunner, Scheduler, type MicroSpec } from '../src/core/decision/index.js';
const kinds = ['pause', 'preread', 'makeup', 'hazard', 'ta', 'clock', 'restart', 'speedChange', 'timedStart', 'turn', 'checkpoint', 'lost', 'transitOut'] as const;
const skillOf: Record<string, string> = { pause: 'stayOnTime', speedChange: 'stayOnTime', timedStart: 'stayOnTime', preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', restart: 'startOnTime', transitOut: 'startOnTime', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', lost: 'recovery', clock: 'instruments' };
const out: Record<string, any> = {};
for (const kind of kinds) {
  const rec: any = { n: 0, none: 0, samples: [] as string[], mismatch: [] as string[], truths: {} as Record<string, number>, timingTruth: [] as number[], clockMisleading: 0, waits: [] as number[] };
  for (let seed = 1; seed <= 40; seed++) {
    const spec: MicroSpec = { kind, skill: skillOf[kind] as any, seed: seed * 7919, variant: seed % 4 };
    const m = buildMicro(spec, 2);
    const r = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns, rung: 2 });
    const d = r.next(); if (!d) { rec.none++; continue; }
    if (d.kind !== kind) { rec.samples.push(`got ${d.kind}`); }
    rec.n++;
    const o = r.oracle(d);
    if (d.timing) rec.waits.push(d.timing.secondTapSeconds ?? d.timing.truthSeconds);
    if (kind === 'pause' && d.kind === 'pause') { const sit = /sit ([\d.]+) s/.exec(d.prompt); if (sit && Math.abs(Number(sit[1]) - d.timing!.truthSeconds) > 1.0) rec.mismatch.push(`${d.prompt} | truth ${d.timing!.truthSeconds}`); }
    if (kind === 'preread' && d.kind === 'preread' && /How long/.test(d.prompt)) { rec.samples.push(`${d.prompt} chart(${d.context.chart?.kind} ${d.context.chart?.seconds}) -> ${o.optionId}`); }
    if (d.options) { const lab = d.options.find(x => x.id === o.optionId)?.label ?? o.optionId!; const key = kind === 'makeup' ? lab.replace(/:.*/, '') : kind === 'hazard' ? `${d.context.hazard?.kind}: ${lab}` : kind === 'turn' || kind === 'preread' || kind === 'transitOut' || kind === 'ta' ? 'n/a' : lab; rec.truths[key] = (rec.truths[key] ?? 0) + 1; }
    if (kind === 'makeup' && d.kind === 'makeup') {
      // is "+20 %" also accepted? grade it on a fresh copy
      const r2 = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns, rung: 2 }); const d2 = r2.next()!;
      const v20 = r2.answer(d2, { optionId: 'p20' });
      const r3 = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns, rung: 2 }); const d3 = r3.next()!;
      const v10 = r3.answer(d3, { optionId: 'p10' });
      rec.samples.push(`${d.prompt.slice(0, 40)} facts ${d.context.distanceFt} ft | +20: ${v20.correct} (${v20.secondsDelta}) rule ${v20.ruleId} | +10: ${v10.correct} (${v10.secondsDelta}) rule ${v10.ruleId} expected '${v10.expected}'`);
    }
    if (kind === 'clock' && d.kind === 'clock') { const r2 = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, rung: 2 }); const d2 = r2.next()!; const v = r2.answer(d2, { optionId: 'clock' }); if (v.secondsDelta) rec.clockMisleading++; }
    if (kind === 'hazard' && d.kind === 'hazard') { const r2 = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, missTurns: m.missTurns, rung: 2 }); const d2 = r2.next()!; const v = r2.answer(d2, { optionId: 'ta' }); rec.samples.push(`${d.context.hazard?.label}: TA-only -> ${v.correct} ${v.secondsDelta}s rule '${v.rule.slice(0, 60)}'`); }
    if (kind === 'turn' && d.kind === 'turn') rec.samples.push(`deadline ${d.deadlineSeconds}s opts ${d.options?.length}`);
  }
  rec.samples = rec.samples.slice(0, 12); rec.mismatch = rec.mismatch.slice(0, 8);
  rec.waitMedian = rec.waits.length ? rec.waits.sort((a: number, b: number) => a - b)[rec.waits.length >> 1] : null; rec.waitMax = rec.waits.length ? Math.max(...rec.waits) : null; delete rec.waits;
  out[kind] = rec;
}
// daily run 2 composition when Instruments is the weakest skill
const prog: any = { version: 1, meters: Object.fromEntries(['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments'].map(s => [s, { value: s === 'instruments' ? 0 : s === 'startOnTime' ? 0.1 : 0.4, correct: 0, total: 0, lastDay: null, passed: false }])), streak: { current: 0, best: 0, lastDay: null }, daily: { day: null, completed: [], best: {} }, rulesSeen: [], unfinished: null, runs: 1 };
const plan = new Scheduler(['instruments', 'startOnTime'], 12345, prog, { mode: 'daily', rung: 2 }).plan();
out.dailyRun2Kinds = plan.items.map(i => i.type === 'rule' ? `RULE ${i.card.id}` : i.micro.kind);
const fs = await import('node:fs'); fs.writeFileSync('/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13/s08-core-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
