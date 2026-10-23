/** PT-13 guessability and verdict audit (no browser): over 60 seeds per kind, answer each card with a fixed "guess" policy or with a rule
 *  card's literal recipe and count how often the grader accepts it. */
import { buildMicro, DecisionRunner, type MicroSpec } from '../src/core/decision/index.js';
const skillOf: Record<string, string> = { makeup: 'recovery', ta: 'recovery', hazard: 'recovery', preread: 'safetyCourse', transitOut: 'startOnTime' };
const fresh = (kind: string, seed: number, variant: number) => {
  const m = buildMicro({ kind, skill: skillOf[kind], seed, variant } as MicroSpec, 2);
  const r = new DecisionRunner(m.scenario, { kinds: m.kinds, maxDecisions: m.maxDecisions, prereadRows: m.prereadRows, missTurns: m.missTurns, rung: 2 });
  return { r, d: r.next() };
};
const iv = (s: string): number => { const m = /(\d+)m(\d\d)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const out: Record<string, unknown> = {};
// make-up: always +20 %
{ let n = 0, ok20 = 0, ok10 = 0, oracle20 = 0; for (let s = 1; s <= 60; s++) { const a = fresh('makeup', s * 104729, s % 4); if (a.d?.kind !== 'makeup') continue; n++; if (a.r.oracle(a.d).optionId === 'p20') oracle20++; if (a.r.answer(a.d, { optionId: 'p20' }).correct) ok20++; const b = fresh('makeup', s * 104729, s % 4); if (b.r.answer(b.d!, { optionId: 'p10' }).correct) ok10++; } out.makeup = { n, alwaysPlus20Right: ok20, alwaysPlus10Right: ok10, oracleSays20: oracle20 }; }
// TA: RULE-033 literal (floor((measured - recoverable)/10)*10) vs the grader
{ let n = 0, agree = 0; const rows: string[] = []; for (let s = 1; s <= 60; s++) { const a = fresh('ta', s * 7907, s % 4); if (a.d?.kind !== 'ta') continue; n++; const m = iv(/delayed (\d+m\d\ds)/.exec(a.d.prompt)?.[1] ?? ''); const rec = Number(/about (\d+) s of it could be made up/.exec(a.d.prompt)?.[1] ?? 0); const want = Math.floor((m - rec) / 10) * 10; const o = Number(a.r.oracle(a.d).optionId!.slice(1)); if (want === o) agree++; else if (rows.length < 8) rows.push(`${a.d.prompt} -> RULE-033 ${want}, grader ${o}`); } out.ta = { n, rule033Agrees: agree, disagreements: rows }; }
// hazard: answer by label alone (train/tractor -> both, light/truck -> makeup)
{ let n = 0, ok = 0; for (let s = 1; s <= 60; s++) { const a = fresh('hazard', s * 3571, s % 4); if (a.d?.kind !== 'hazard') continue; n++; const lab = a.d.context.hazard?.label ?? ''; const pick = /Train|Tractor|Accident|Combine|Construction|School/.test(lab) ? 'both' : 'makeup'; if (pick === a.r.oracle(a.d).optionId) ok++; } out.hazardByLabel = { n, right: ok }; }
// pre-read speed: pick the option equal to the "out" chip
{ let n = 0, ok = 0; for (let s = 1; s <= 60; s++) { const a = fresh('preread', s * 6007, 2); if (a.d?.kind !== 'preread' || !/What speed/.test(a.d.prompt)) continue; n++; const outChip = a.d.context.speeds?.out; if (`v${outChip}` === a.r.oracle(a.d).optionId) ok++; } out.prereadSpeedFromChip = { n, right: ok }; }
// transit OUT: distinct IN times
{ const ins = new Set<string>(); let n = 0; for (let s = 1; s <= 60; s++) { const a = fresh('transitOut', s * 1301, s % 4); if (a.d?.kind !== 'transitOut') continue; n++; ins.add(/IN (\d+:\d\d:\d\d)/.exec(a.d.prompt)?.[1] ?? '?'); } out.transitOut = { n, distinctInTimes: [...ins] }; }
console.log(JSON.stringify(out, null, 1));
