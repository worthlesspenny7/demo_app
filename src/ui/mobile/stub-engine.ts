/**
 * STUB (Phase VIII, UI side): a stand-in for the core DecisionRun while src/core/decision is still signatures only. It builds a
 * seeded run of 12 cards from fixed micro templates, one per decision kind, with the numbers taken from the real 1939 Ford charts
 * (buildPerfTable) and the real GRIID helpers, so every card renders as it will with the core. engine.ts uses it only when the
 * core's Scheduler returns an empty plan or throws; delete it once the core is complete.
 */
import { buildPerfTable, matrixAt, chartLead } from '../../core/perf-table.js';
import { FORD_1939 } from '../../core/course.js';
import { formatInterval, formatClockFace } from '../../core/griid.js';
import { cameoSvg } from '../../core/cameo.js';
import { rng } from '../../core/rng.js';
import {
  SKILL_OF_KIND, SKILLS, type Decision, type DecisionKind, type DecisionResponse, type RunPlan, type RunResult, type RunStep, type Skill, type SkillTally, type Verdict, type RuleCard, type RunItem,
} from '../../core/decision/index.js';

const T = buildPerfTable(FORD_1939);
const mph = (v: number): string => `${v} MPH`;
const r1 = (x: number): number => Math.round(x * 10) / 10;

interface Built { d: Decision; correctId?: string; expected: string; rule: string; ruleId: string; source: string; costWrong: number }

/** The rule cards (<= 60 words, cited) shown before the first card of a skill. */
export const STUB_RULES: Record<Skill, RuleCard> = {
  safetyCourse: { id: 'RULE-COURSE', skill: 'safetyCourse', text: 'Read the next row before you reach it: the CAMEO shows the turn, Column C the speed. Call the turn early and clearly; a wrong road costs minutes, not seconds.', source: 'HB p.13' },
  startOnTime: { id: 'RULE-START', skill: 'startOnTime', text: 'Leave at base time plus your starting position, early by the standing-start loss on your chart. Count the driver down so the car crosses the line on the second.', source: 'REG V.B.2; HB p.11' },
  stayOnTime: { id: 'RULE-PAUSE', skill: 'stayOnTime', text: 'At a pause, sit the chart time: the printed pause minus your stop-and-go loss for this IN and OUT speed. Start the watch when the car stops; say GO at the chart second.', source: 'HB p.7-8' },
  recovery: { id: 'RULE-RECOVER', skill: 'recovery', text: 'Late by a few seconds: add 10 % to the speed for the time lost. A delay you could not avoid (train, tractor) is claimed at the yellow TA point in multiples of 10 s.', source: 'REG V.H.1, V.H.3' },
  instruments: { id: 'RULE-CLOCK', skill: 'instruments', text: 'Near a minute change the loose minute hand cannot be trusted. Read the minute from the digital watch in TOD mode, the seconds from either.', source: 'REG II.H.1.d; HB p.5' },
};

function row(line: number, c: string[], d: string, turn: 'L' | 'R' | 'S' | null, control?: string) {
  const exits = [{ angle: 0, isRoute: turn === 'S' }, { angle: -90, isRoute: turn === 'L' }, { angle: 90, isRoute: turn === 'R' }];
  let svg = '';
  try { svg = cameoSvg(exits, control, turn, 96); } catch { svg = ''; }
  return { line, odometer: '', miles: 0, columnB: [] as string[], columnC: c, columnD: d, cameoSvg: svg };
}

function template(kind: DecisionKind, seed: number, n: number): Built {
  const r = rng(`${kind}:${seed}:${n}`);
  const pick = <X,>(xs: X[]): X => xs[Math.floor(r.next() * xs.length)]!;
  const line = 3 + Math.floor(r.next() * 20);
  const skill = SKILL_OF_KIND[kind];
  const base = (prompt: string, extra: Partial<Decision> = {}): Decision => ({ id: `${kind}:${line}:${n}`, kind, skill, prompt, context: { tod: 9 * 3600 + n * 47, elapsed: n * 47, line }, ...extra });
  switch (kind) {
    case 'preread': {
      const turn = pick(['L', 'R'] as const); const v = pick([30, 35, 40, 45]);
      const d = base('Pre-read the next row. What do you tell the driver?', { options: [{ id: 'a', label: `${turn === 'L' ? 'Left' : 'Right'} at STOP, then ${v}` }, { id: 'b', label: `${turn === 'L' ? 'Right' : 'Left'} at STOP, then ${v}` }, { id: 'c', label: `${turn === 'L' ? 'Left' : 'Right'}, no stop, then ${v}` }] });
      d.context.row = row(line, [mph(0), formatInterval(15), mph(v)], 'Comes quick', turn, 'STOP');
      return { d, correctId: 'a', expected: d.options![0]!.label, rule: 'The CAMEO gives the road and the control, Column C the pause and the speed out (REG VII.B.3).', ruleId: 'RULE-COURSE', source: 'REG VII.B.3', costWrong: 60 };
    }
    case 'turn': {
      const turn = pick(['L', 'R'] as const);
      const d = base('Turn in 400 ft. Which way?', { options: [{ id: 'L', label: 'Left' }, { id: 'S', label: 'Straight' }, { id: 'R', label: 'Right' }], deadlineSeconds: 6 });
      d.context.row = row(line, [mph(35)], '', turn); d.context.distanceFt = 400; d.context.speeds = { current: 35, assigned: 35 };
      return { d, correctId: turn, expected: turn === 'L' ? 'Left' : 'Right', rule: 'Call the turn before the decision point; the CAMEO arrow is the road to take (HB p.13).', ruleId: 'RULE-COURSE', source: 'HB p.13', costWrong: 90 };
    }
    case 'checkpoint': {
      const d = base('Green timing sign ahead. You are 4 s early. What now?', { options: [{ id: 'none', label: 'Hold the speed, do nothing' }, { id: 'slow', label: 'Slow to lose the 4 s' }, { id: 'stop', label: 'Stop short of the sign' }] });
      d.context.lateSeconds = -4;
      return { d, correctId: 'none', expected: 'Hold the speed', rule: 'Never slow or stop in sight of a checkpoint; it is unsafe and penalised (REG V.D).', ruleId: 'RULE-COURSE', source: 'REG V.D', costWrong: 60 };
    }
    case 'pause': {
      const vIn = pick([30, 35, 40]), vOut = pick([35, 40, 45]); const chart = r1(matrixAt(T.stopGo, vIn, vOut));
      const d = base(`Stopped at the STOP. Pause 15, in ${vIn}, out ${vOut}. Tap GO at the chart second.`, { timing: { kind: 'countdown', truthSeconds: chart, toleranceSeconds: 0.5, maxSeconds: 20, tapLabel: 'GO' } });
      d.context.row = row(line, [mph(0), formatInterval(15), mph(vOut)], '', 'S', 'STOP'); d.context.chart = { kind: 'stopGo', vIn, vOut, seconds: chart }; d.context.speeds = { current: 0, assigned: vOut, in: vIn, out: vOut }; d.context.times = { pauseSeconds: 15 };
      return { d, expected: `GO at ${chart.toFixed(1)} s`, rule: 'Sit the chart pause: the stop-and-go chart value for this IN/OUT pair (HB p.8).', ruleId: 'RULE-PAUSE', source: 'HB p.8', costWrong: 0 };
    }
    case 'speedChange': {
      const v0 = pick([30, 35]), v1 = v0 + 10; const lead = chartLead(v0, v1, FORD_1939); const atSign = 6 + Math.floor(r.next() * 5); const truth = r1(atSign - lead);
      const d = base(`Speed sign ${v1} in ${atSign} s at ${v0}. Call it early by the lead.`, { timing: { kind: 'tapAt', truthSeconds: truth, toleranceSeconds: 0.5, maxSeconds: atSign + 5, tapLabel: `CALL ${v1}` } });
      d.context.row = row(line, [mph(v1)], '', 'S'); d.context.chart = { kind: 'lead', vIn: v0, vOut: v1, seconds: lead }; d.context.speeds = { current: v0, assigned: v0, target: v1 };
      return { d, expected: `CALL at ${truth.toFixed(1)} s`, rule: 'Call a speed change early by the Lead on your chart so the car crosses the sign at the midpoint speed (HB p.9).', ruleId: 'RULE-PAUSE', source: 'HB p.9', costWrong: 0 };
    }
    case 'timedStart': {
      const hold = pick([25, 30]), then = hold + 15, sec = 10 + Math.floor(r.next() * 8);
      const d = base(`Timed: ${hold} for ${formatInterval(sec)}, then ${then}. START at the sign, then CALL ${then}.`, { timing: { kind: 'startStop', truthSeconds: 2, toleranceSeconds: 0.5, secondTapSeconds: 2 + sec, maxSeconds: sec + 8, tapLabel: 'START', secondTapLabel: `CALL ${then}` } });
      d.context.row = row(line, [mph(hold), formatInterval(sec), mph(then)], '', 'S');
      return { d, expected: `START at 2.0 s, CALL at ${(2 + sec).toFixed(1)} s`, rule: 'Start the watch at the sign and call the new speed when it shows the printed interval (REG VII.B.3.c).', ruleId: 'RULE-PAUSE', source: 'REG VII.B.3.c', costWrong: 0 };
    }
    case 'restart': {
      const base0 = 10 * 3600 + 15 * 60; const asp = pick([3, 7, 12]); const launchIn = 6 + Math.floor(r.next() * 6);
      const d = base(`Restart: base ${formatClockFace(base0)}, ASP ${asp}. Tap LAUNCH on the second.`, { timing: { kind: 'tapAt', truthSeconds: launchIn, toleranceSeconds: 0.5, maxSeconds: launchIn + 6, tapLabel: 'LAUNCH' } });
      d.context.row = row(line, [`CDT ${formatClockFace(base0)}`, mph(35)], '', 'S'); d.context.times = { base: base0, own: base0 + asp * 60, launch: base0 + asp * 60 - 2 }; d.context.tod = base0 + asp * 60 - 2 - launchIn;
      return { d, expected: `LAUNCH at ${launchIn.toFixed(1)} s`, rule: 'Leave at base time plus your starting position in minutes, early by the standing-start loss (REG V.B.2).', ruleId: 'RULE-START', source: 'REG V.B.2', costWrong: 0 };
    }
    case 'transitOut': {
      const inT = 11 * 3600 + pick([3, 12, 27]) * 60 + pick([0, 15, 40]); const iv = pick([10, 15, 20]) * 60;
      const right = formatClockFace(inT + iv);
      const d = base(`IN ${formatClockFace(inT)}. Take exactly ${formatInterval(iv)}. When do you leave?`, { options: [{ id: 'a', label: right }, { id: 'b', label: formatClockFace(inT + iv + 60) }, { id: 'c', label: formatClockFace(inT + iv - 60) }] });
      d.context.row = row(line, [formatInterval(iv)], 'Take exactly', 'S'); d.context.times = { in: inT, intervalSeconds: iv };
      return { d, correctId: 'a', expected: right, rule: 'An exact transit: OUT = IN + the printed interval, to the second (HB #30).', ruleId: 'RULE-START', source: 'HB #30', costWrong: 60 };
    }
    case 'makeup': {
      const late = pick([6, 8, 12]); const v = pick([30, 40]);
      const d = base(`You are ${late} s late at ${v}. Half a mile of open road. What do you call?`, { options: [{ id: 'p10', label: `${Math.round(v * 1.1)} for ${late * 10} s (10 %)` }, { id: 'p20', label: `${Math.round(v * 1.2)} for ${late * 5} s (20 %)` }, { id: 'leave', label: 'Leave it' }] });
      d.context.lateSeconds = late; d.context.speeds = { current: v, assigned: v };
      return { d, correctId: 'p10', expected: '10 % for ten times the loss', rule: 'Make up a small loss at 10 % over the assigned speed for ten times the seconds lost (HB p.15).', ruleId: 'RULE-RECOVER', source: 'HB p.15', costWrong: late };
    }
    case 'hazard': {
      const d = base('A train holds you at the crossing. What do you do?', { options: [{ id: 'ta', label: 'Time it, claim it at the TA point' }, { id: 'make', label: 'Make it all up after' }, { id: 'both', label: 'Make it up and claim it' }] });
      d.context.hazard = { kind: 'train', label: 'Train at the crossing' };
      return { d, correctId: 'ta', expected: 'Time it and claim it', rule: 'A train is an unavoidable delay: time it and claim it at the yellow TA point (REG V.H.1).', ruleId: 'RULE-RECOVER', source: 'REG V.H.1', costWrong: 30 };
    }
    case 'ta': {
      const measured = pick([37, 44, 52, 68]); const claim = Math.round(measured / 10) * 10;
      const d = base(`TA point. The tractor cost you ${measured} s on the watch. Claim:`, { options: [claim - 10, claim, claim + 10].map(c => ({ id: String(c), label: formatInterval(c) })) });
      d.context.ta = { measured, claim, cause: 'tractor', legIndex: 2 };
      return { d, correctId: String(claim), expected: formatInterval(claim), rule: 'Claim the measured delay in multiples of 10 s, not more than 29m30s (REG V.H.3).', ruleId: 'RULE-RECOVER', source: 'REG V.H.3', costWrong: 10 };
    }
    case 'lost': {
      const d = base('You missed the turn 20 s ago. What now?', { options: [{ id: 'back', label: 'Turn around safely, time the loss' }, { id: 'keep', label: 'Keep going, hope it rejoins' }, { id: 'race', label: 'Speed back to catch up' }] });
      return { d, correctId: 'back', expected: 'Turn around, time it', rule: 'Lost: turn around where it is safe, time the excursion, then make it up at 10 % (HB p.13).', ruleId: 'RULE-RECOVER', source: 'HB p.13', costWrong: 120 };
    }
    case 'clock':
    default: {
      const m = pick([14, 27, 41]);
      const d = base(`The dash clock shows ${m}:58 near the minute change. The watch TOD reads ${m}:58. Which minute is it?`, { options: [{ id: String(m), label: `${m}, per the watch` }, { id: String(m + 1), label: `${m + 1}, per the minute hand` }] });
      d.context.clock = { hourAngle: 300, minuteAngle: m * 6 + 6, secondAngle: 348, minuteAmbiguous: true, minute: null };
      return { d, correctId: String(m), expected: `${m}, from the watch`, rule: 'Near the minute change read the minute from the digital watch, not the loose minute hand (REG II.H.1.d).', ruleId: 'RULE-CLOCK', source: 'REG II.H.1.d', costWrong: 60 };
    }
  }
}

const ORDER: DecisionKind[] = ['preread', 'pause', 'turn', 'restart', 'makeup', 'speedChange', 'checkpoint', 'timedStart', 'ta', 'clock', 'hazard', 'transitOut', 'lost'];

export function stubPlan(skills: Skill[], seed: number, mode: RunPlan['mode'], rung: 0 | 1 | 2 | 3, decisions = 12, seenRules: string[] = []): RunPlan {
  const want = skills.length ? skills : [...SKILLS];
  const kinds = ORDER.filter(k => want.includes(SKILL_OF_KIND[k]));
  const items: RunItem[] = []; const shown = new Set(seenRules);
  const count = Math.max(10, Math.min(mode === 'boss' ? 25 : 15, decisions));
  for (let i = 0; i < count; i++) {
    const kind = kinds[(i + seed) % kinds.length]!; const skill = SKILL_OF_KIND[kind];
    const rc = STUB_RULES[skill];
    if (!shown.has(rc.id) && items.filter(x => x.type === 'rule').length < 3) { items.push({ type: 'rule', card: rc }); shown.add(rc.id); }
    items.push({ type: 'decision', micro: { kind, skill, seed, variant: i } });
  }
  return { seed, mode, skills: want, rung, items, decisionCount: count };
}

/** Grade a response against a template. */
function grade(b: Built, resp: DecisionResponse | null): Verdict {
  const d = b.d; let correct = false; let delta = 0; let chosen = 'no answer';
  if (d.timing) {
    const t = d.timing;
    if (t.kind === 'startStop') {
      const taps = resp?.taps ?? (resp?.tapSeconds !== undefined ? [resp.tapSeconds] : []);
      const e1 = taps[0] === undefined ? t.maxSeconds : taps[0] - t.truthSeconds; const e2 = taps[1] === undefined ? t.maxSeconds : taps[1] - (t.secondTapSeconds ?? 0) - (taps[0] ?? 0) + t.truthSeconds;
      delta = r1(Math.abs(e1) >= Math.abs(e2) ? e1 : e2); correct = Math.abs(e1) <= t.toleranceSeconds && Math.abs(e2) <= t.toleranceSeconds;
      chosen = taps.length ? taps.map(x => `${x.toFixed(1)} s`).join(', ') : 'no tap';
    } else {
      const tap = resp?.tapSeconds; delta = tap === undefined ? t.maxSeconds - t.truthSeconds : r1(tap - t.truthSeconds); correct = Math.abs(delta) <= t.toleranceSeconds;
      chosen = tap === undefined ? 'no tap' : `${t.tapLabel} at ${tap.toFixed(1)} s`;
    }
  } else {
    correct = resp?.optionId === b.correctId; delta = correct ? 0 : b.costWrong;
    chosen = d.options?.find(o => o.id === resp?.optionId)?.label ?? 'no answer';
  }
  return { decisionId: d.id, kind: d.kind, skill: d.skill, secondsDelta: delta, correct, rule: b.rule, ruleId: b.ruleId, source: b.source, expected: b.expected, chosen, nextDecisionIn: 8 };
}

export function stubResult(plan: RunPlan, verdicts: Verdict[], rulesShown: string[]): RunResult {
  const tallies = Object.fromEntries(SKILLS.map(s => [s, { skill: s, correct: 0, total: 0, seconds: 0 } as SkillTally])) as Record<Skill, SkillTally>;
  for (const v of verdicts) { const t = tallies[v.skill]; t.total++; if (v.correct) t.correct++; t.seconds = r1(t.seconds + Math.abs(v.secondsDelta)); }
  const correct = verdicts.filter(v => v.correct).length, total = verdicts.length;
  const secondsTotal = r1(verdicts.reduce((a, v) => a + Math.abs(v.secondsDelta), 0));
  const share = total ? correct / total : 0;
  const stars = (share >= 0.9 && secondsTotal <= 10 ? 3 : share >= 0.75 ? 2 : share >= 0.5 ? 1 : 0) as 0 | 1 | 2 | 3;
  const worst = [...verdicts].sort((a, b) => (Number(a.correct) - Number(b.correct)) || Math.abs(b.secondsDelta) - Math.abs(a.secondsDelta)).slice(0, 3).map(v => ({ verdict: v, rule: v.rule, source: v.source }));
  return { seed: plan.seed, mode: plan.mode, verdicts, secondsTotal, correct, total, tallies, stars, worst, ruleCardsShown: rulesShown };
}

/** The stub run: the same surface as the core DecisionRun plus an oracle. */
export class StubRun {
  readonly responses: (DecisionResponse | null)[] = [];
  readonly verdicts: Verdict[] = [];
  private i = 0; private built: Built | null = null; private rules: string[] = [];
  constructor(readonly plan: RunPlan) {}
  next(): RunStep | null {
    const it = this.plan.items[this.i]; if (!it) return null;
    const of = this.plan.decisionCount; const index = this.verdicts.length;
    if (it.type === 'rule') return { type: 'rule', card: it.card, index, of };
    this.built ??= template(it.micro.kind, it.micro.seed, it.micro.variant);
    return { type: 'decision', decision: this.built.d, index, of };
  }
  ack(): void { const it = this.plan.items[this.i]; if (it?.type === 'rule') { this.rules.push(it.card.id); this.i++; } }
  answer(response: DecisionResponse | null): Verdict {
    const step = this.next(); if (!step || step.type !== 'decision' || !this.built) throw new Error('no decision to answer');
    const v = grade(this.built, response); this.responses.push(response); this.verdicts.push(v); this.built = null; this.i++;
    return v;
  }
  oracle(d: Decision): DecisionResponse | null {
    const it = this.plan.items[this.i]; if (!it || it.type !== 'decision') return null;
    const b = this.built ?? template(it.micro.kind, it.micro.seed, it.micro.variant);
    if (b.d.id !== d.id) return null;
    if (d.timing?.kind === 'startStop') return { taps: [d.timing.truthSeconds, d.timing.secondTapSeconds ?? d.timing.truthSeconds] };
    if (d.timing) return { tapSeconds: d.timing.truthSeconds };
    return { optionId: b.correctId! };
  }
  done(): boolean { return this.i >= this.plan.items.length; }
  result(): RunResult { return stubResult(this.plan, this.verdicts, this.rules); }
}

/** Every decision kind once (tests and the card gallery). */
export function stubDecision(kind: DecisionKind, seed = 1): Decision { return template(kind, seed, 0).d; }
