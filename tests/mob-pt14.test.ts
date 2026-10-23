/** Fix sprint PT-14 (docs/playtest/PT-14-phone-replay.md section L): MOB-062..071 (engine parts). The rule-card follower is never marked wrong. */
import { describe, it, expect } from 'vitest';
import { RULES } from '../content/rules.js';
import { follow, hazardPlan, reactions } from './pt14-follower.js';
import {
  microScenario, microRunner, buildMicro, Scheduler, DecisionRun, emptyProgress, introCardFor, KINDS_OF_SKILL, SKILLS, DECISION_KINDS, TIMED_KINDS, MAX_PER_KIND,
  type Decision, type DecisionKind, type DecisionResponse, type MicroSpec, type Skill, type RunPlan,
} from '../src/core/decision/index.js';
import { microSubcase } from '../src/core/decision/scenarios.js';
import { wallOf, wallMaxOf, WALL_MAX_SECONDS, HOLD_MAX_SECONDS, SKIP_LEAD_SECONDS } from '../src/core/decision/runner.js';
import { interleave, maxPerKindFor } from '../src/core/decision/scheduler.js';

const SKILL: Record<DecisionKind, Skill> = { preread: 'safetyCourse', turn: 'safetyCourse', checkpoint: 'safetyCourse', restart: 'startOnTime', transitOut: 'startOnTime', pause: 'stayOnTime', speedChange: 'stayOnTime', timedStart: 'stayOnTime', makeup: 'recovery', hazard: 'recovery', ta: 'recovery', lost: 'recovery', clock: 'instruments', watch: 'instruments' };
const text = (id: string): string => RULES.find(r => r.id === id)!.text;
const arrowOf = (r: ReturnType<typeof microRunner>, d: Decision): string | undefined => (d.kind === 'turn' || (d.kind === 'preread' && /Which way/.test(d.prompt))) ? r.oracle(d).optionId : undefined;
/** The follower's answer to the card on screen (chart = the cell behind the Chart button at rung 1, which the follower opens). */
const answerOf = (r: ReturnType<typeof microRunner>, d: Decision, react: () => number, rung: number): DecisionResponse =>
  follow(d, { react, arrow: arrowOf(r, d), chart: rung === 1 ? d.context.chart?.seconds ?? null : null });

describe('MOB-062 C-1: RULE-031 names the Time Allowance causes as the sources do; the hazard card follows it', () => {
  it('MOB-062 RULE-031 names a train, an accident scene, a farm tractor or combine you cannot pass, construction holding traffic (REG V.H.1, V.H.5; Time Delay Form) and says a slow truck you can pass, a red light and traffic you can get around are not', () => {
    const r = RULES.find(c => c.id === 'RULE-031')!;
    expect(r.text).toMatch(/beyond your control, such as a train, an accident scene, a school bus, a farm tractor or combine you cannot pass, construction holding traffic/);
    expect(r.text).toMatch(/A slow truck you can pass, a red light and traffic you can get around are not/);
    expect(r.source).toMatch(/REG V\.H\.1, V\.H\.5/); expect(r.source).toMatch(/Time Delay Form \[00:04\]/);
    expect(r.short).toMatch(/farm tractor or combine you cannot pass/);
  });
  it('MOB-062 a rule-card follower is right on 160 of 160 hazard cards at rung 2 and at rung 1 (4 scenes x 40 seeds)', () => {
    for (const rung of [2, 1] as const) {
      let right = 0; const react = reactions(31 + rung); const scenes = new Map<string, string>();
      for (let variant = 0; variant < 4; variant++) for (let s = 1; s <= 40; s++) {
        const r = microRunner(buildMicro({ kind: 'hazard', skill: 'recovery', seed: s * 7919 + variant * 31, variant }, rung), rung); const d = r.next()!;
        expect(d.kind).toBe('hazard');
        const v = r.answer(d, answerOf(r, d, react, rung));
        scenes.set(`${d.context.hazard!.kind}:${hazardPlan(d.prompt)}`, d.prompt);
        expect(v.correct, `rung ${rung}: ${d.prompt} -> ${v.chosen}; right ${v.expected}`).toBe(true); if (v.correct) right++;
      }
      expect(right).toBe(160);
      for (const k of ['slow:makeup', 'signal:makeup', 'train:claim', 'tractor:claim', 'tractor:makeup']) expect([...scenes.keys()], k).toContain(k);
    }
  }, 120_000);
  it('MOB-062 a cause miss cites RULE-031\'s cause sentence; a light or a truck claimed cites its "are not" sentence', () => {
    let claim = 0, notCause = 0;
    for (let s = 1; s <= 30 && (claim < 2 || notCause < 2); s++) for (const variant of [0, 2]) {
      const r = microRunner(microScenario('hazard', s, variant), 2); const d = r.next()!; const o = r.oracle(d);
      if (o.optionId === 'both') { const v = r.answer(d, { optionId: 'makeup' }); expect(v.ruleId).toBe('RULE-031'); expect(v.rule).toMatch(/^Claim time only for a delay beyond your control, such as a train/); claim++; }
      else if (d.context.hazard!.kind === 'slow') { const v = r.answer(d, { optionId: 'ta' }); expect(v.correct).toBe(false); expect(v.rule).toMatch(/^A slow truck you can pass, a red light and traffic you can get around are not/); notCause++; }
    }
    expect(claim).toBeGreaterThan(0); expect(notCause).toBeGreaterThan(0);
  });
  it('MOB-062 the scenes say what the card decides on: a slow truck you can pass, a farm tractor you cannot pass or one turning off, gates with a long freight or the last cars, a red light', () => {
    const p = (v: number, s: number): string => microRunner(microScenario('hazard', s, v), 2).next()!.prompt;
    expect(p(0, 1)).toMatch(/^A slow truck \d+ ft ahead at \d+ mph; you can pass it soon\./);
    const tractors = Array.from({ length: 12 }, (_, i) => p(2, i + 1));
    expect(tractors.some(x => /farm tractor .*you cannot pass for miles/.test(x))).toBe(true); expect(tractors.some(x => /turning into a field gate/.test(x))).toBe(true);
    expect(p(3, 1)).toMatch(/signal .* turned red/);
  });
});

describe('MOB-063 C-2: timed starts are graded from the car\'s own arrival at the sign (REG VII.E.2.d), as the watch card', () => {
  it('MOB-063 the CALL truth is START + interval - the printed lead, whatever the car\'s pace; the card never closes before its CALL time', () => {
    for (let s = 1; s <= 20; s++) {
      const r = microRunner(microScenario('timedStart', s, s % 4), 2); const d = r.next()!; const t = d.timing!;
      const seg = Number(/0m(\d\d)s/.exec(d.prompt)![1]); const L = Number(/CALL \d+ ([\d.]+) s before/.exec(d.prompt)![1]);
      expect(t.secondTapSeconds!).toBeCloseTo(t.truthSeconds + seg - L, 1);
      expect(t.maxSeconds).toBeGreaterThan(t.secondTapSeconds! + 5);
    }
  });
  it('MOB-063 a rule-card follower is right on 32 of 32 Boss timed starts (the generated leg and its micro cards, rung 2 and rung 1)', () => {
    let n = 0, right = 0, leg = 0; const react = reactions(63); const misses: string[] = [];
    for (let s = 1; s <= 80 && n < 32; s++) {
      const rung = s % 2 === 0 ? 1 : 2;
      const run = new DecisionRun(Scheduler.boss(s * 1237 + rung, null, rung).plan());
      for (let i = 0; i < 200 && n < 32; i++) {
        const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
        const d = st.decision; const r = run.currentRunner()!;
        if (d.kind !== 'timedStart') { run.answer(r.oracle(d)); continue; }
        n++; if (r.scenario.tags?.includes('boss')) leg++;
        const a = follow(d, { react, chart: rung === 1 ? d.context.chart?.seconds ?? null : null });
        // the card is still open at the follower's CALL (in card seconds and in wall seconds)
        expect(d.timing!.maxSeconds, d.prompt).toBeGreaterThan(a.taps![1]!);
        const v = run.answer(a);
        if (v.correct) right++; else misses.push(`${d.prompt} -> ${v.missed} (${v.chosen}; ${v.expected})`);
      }
    }
    expect(n).toBe(32); expect(misses).toEqual([]); expect(right).toBe(32); expect(leg).toBeGreaterThan(0);
  }, 120_000);
});

describe('MOB-064 N3: the rule card before a slot is the rule of that slot\'s own kind and sub-case', () => {
  const WANT: Record<string, string> = {
    'preread:turn': 'RULE-041', 'preread:pause': 'RULE-016', 'preread:speed': 'RULE-042', 'turn:default': 'RULE-041', 'checkpoint:green': 'RULE-003', 'checkpoint:red': 'RULE-003', 'checkpoint:carAhead': 'RULE-004',
    'restart:own': 'RULE-011', 'restart:transitOut': 'RULE-014', 'restart:base': 'RULE-010', 'transitOut:default': 'RULE-014', 'pause:default': 'RULE-016', 'speedChange:default': 'RULE-020',
    'timedStart:default': 'RULE-021', 'makeup:open': 'RULE-025', 'makeup:limit': 'RULE-026', 'makeup:timed': 'RULE-027', 'hazard:truck': 'RULE-031', 'hazard:train': 'RULE-031', 'hazard:tractor': 'RULE-031', 'hazard:light': 'RULE-031',
    'ta:train': 'RULE-033', 'ta:tractor': 'RULE-033', 'lost:deadEnd': 'RULE-034', 'lost:detour': 'RULE-043', 'clock:minute': 'RULE-038', 'clock:second': 'RULE-038', 'clock:interval': 'RULE-039', 'watch:default': 'RULE-021',
  };
  it('MOB-064 introCardFor(kind, sub-case): pause vs red light vs TA, which way vs how long vs what speed, own time vs base + position vs transit OUT', () => {
    for (const kind of DECISION_KINDS) for (let v = 0; v < 12; v++) {
      const sc = microSubcase(kind, v); const c = introCardFor(SKILL[kind], kind, sc);
      expect(c.id, `${kind}:${sc}`).toBe(WANT[`${kind}:${sc}`]); expect(c.kinds).toContain(kind);
    }
  });
  it('MOB-064 in planned runs (40 practice, 15 daily, single-skill) every rule card is the rule of the decision right after it, whatever the player has seen', () => {
    const plans: RunPlan[] = [];
    const seen = emptyProgress(); seen.rulesSeen = RULES.map(r => r.id);
    for (let s = 1; s <= 40; s++) plans.push(new Scheduler(SKILLS.filter((_, i) => (s >> i) & 1).length ? SKILLS.filter((_, i) => (s >> i) & 1) : [...SKILLS], s, s % 2 ? seen : null).plan());
    for (const day of ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']) for (let i = 0; i < 3; i++) plans.push(Scheduler.daily(day, i, emptyProgress()).plan());
    let n = 0;
    for (const plan of plans) plan.items.forEach((it, i) => {
      if (it.type !== 'rule') return; const nx = plan.items[i + 1]!; expect(nx.type).toBe('decision'); if (nx.type !== 'decision') return;
      expect(it.card.id, `${nx.micro.kind}:${microSubcase(nx.micro.kind, nx.micro.variant)}`).toBe(WANT[`${nx.micro.kind}:${microSubcase(nx.micro.kind, nx.micro.variant)}`]); n++;
    });
    expect(n).toBeGreaterThan(60);
  });
  it('MOB-064 the card that follows the rule card is of the planned sub-case (pre-read pause, red light, transit OUT restart)', () => {
    const d = (kind: DecisionKind, v: number, s = 3): Decision => microRunner(microScenario(kind, s, v), 2).next()!;
    expect(d('hazard', 3).context.hazard!.kind).toBe('signal');
    expect(d('restart', 1).prompt).toMatch(/^Transit OUT/); expect(d('restart', 2).prompt).toMatch(/base [A-Z]{3} \d/);
    expect(d('clock', 3).prompt).toMatch(/interval/);
  });
});

/** N4 audit: over 40 seeds per kind, the right answer's shown position and its rank among the option values. */
function audit(kind: DecisionKind, val: (label: string) => number, accept: (d: Decision) => boolean = () => true, variantOf: (s: number) => number = s => s % 4) {
  const pos: number[] = [0, 0, 0, 0]; const rank: number[] = [0, 0, 0, 0]; let n = 0; let k = 0;
  for (let s = 1; s <= 400 && n < 40; s++) {
    const r = microRunner(buildMicro({ kind, skill: SKILL[kind], seed: s * 104729 + 17, variant: variantOf(s) } as MicroSpec, 2), 2); const d = r.next();
    if (!d || d.kind !== kind || !accept(d)) continue;
    const o = r.oracle(d); const opts = d.options!; const i = opts.findIndex(x => x.id === o.optionId); k = opts.length;
    const sorted = opts.map(x => val(x.label)).sort((a, b) => a - b);
    expect(new Set(sorted).size, d.prompt).toBe(opts.length);
    n++; pos[i]!++; rank[sorted.indexOf(val(opts[i]!.label))]!++;
  }
  return { n, k, pos: pos.slice(0, k), rank: rank.slice(0, k) };
}
const ivl = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
describe('MOB-065 N4: no positional give-away on the transit OUT, TA claim, watch reading and pre-read pause cards', () => {
  const cases: [DecisionKind, (l: string) => number, ((d: Decision) => boolean)?, ((s: number) => number)?][] = [
    ['transitOut', l => { const [h, m, x] = l.split(':').map(Number); return h! * 3600 + m! * 60 + x!; }],
    ['ta', l => (/No claim/.test(l) ? 0 : ivl(l))],
    ['watch', ivl],
    ['preread', l => (/Go at once/.test(l) ? 0 : Number(/Wait ([\d.]+)/.exec(l)?.[1])), d => /How long do you sit/.test(d.prompt), s => 1 + 3 * (s % 4)],
  ];
  for (const [kind, val, accept, variantOf] of cases) {
    it(`MOB-065 ${kind}: over 40 seeds no fixed position and no rank (smallest, middle, second-smallest...) is right more often than chance + 15 %`, () => {
      const a = audit(kind, val, accept, variantOf);
      expect(a.n).toBe(40);
      const limit = 40 * (1 / a.k + 0.15);
      for (let i = 0; i < a.k; i++) {
        expect(a.pos[i]!, `${kind} position ${i}: ${a.pos}`).toBeLessThanOrEqual(limit);
        expect(a.rank[i]!, `${kind} rank ${i}: ${a.rank}`).toBeLessThanOrEqual(limit);
      }
      // every rank turns up: the smallest and the largest are both sometimes right
      expect(a.rank.filter(x => x > 0).length, `${kind} ranks ${a.rank}`).toBe(a.k);
    }, 60_000);
  }
});

describe('MOB-066 N5: a single-skill run is at least two thirds that skill', () => {
  it('MOB-066 the per-kind cap is relaxed to 3 in a single-skill run (4 for a two-kind skill); runs of several skills keep 2', () => {
    expect(maxPerKindFor(['stayOnTime'], 12)).toBe(3); expect(maxPerKindFor(['recovery'], 12)).toBe(3);
    expect(maxPerKindFor(['startOnTime'], 12)).toBe(4); expect(maxPerKindFor(['instruments'], 10)).toBe(4);
    expect(maxPerKindFor(['startOnTime', 'instruments'], 12)).toBe(MAX_PER_KIND);
  });
  for (const skill of SKILLS) {
    it(`MOB-066 Try it: ${skill}: planned and played (oracle and random answers, repeats included) the run is >= 2/3 ${skill} over 8 seeds`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const plan = new Scheduler([skill], seed * 101, emptyProgress()).plan();
        const ks = plan.items.flatMap(i => (i.type === 'decision' ? [i.micro.skill] : []));
        expect(ks.filter(x => x === skill).length / ks.length, `${skill} ${seed}: ${ks}`).toBeGreaterThanOrEqual(2 / 3);
        const run = new DecisionRun(plan);
        for (let i = 0; i < 100; i++) { const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; } run.answer(i % 3 === 0 ? wrong(st.decision, run.oracle()!) : run.oracle()); }
        const vs = run.result().verdicts;
        expect(vs.filter(v => v.skill === skill).length / vs.length, `${skill} ${seed} played`).toBeGreaterThanOrEqual(2 / 3);
        for (const k of KINDS_OF_SKILL[skill]) expect(vs.filter(v => v.kind === k).length).toBeLessThanOrEqual(plan.maxPerKind!);
      }
    }, 120_000);
  }
});

describe('MOB-067 N6: long holds are shown compressed; no card stays open over 30 s of wall time', () => {
  it('MOB-067 a Boss-leg hold over 25 s fast-forwards to 5 s before the CALL (the watch jumps, the card says so); every card of 12 Boss runs closes within 30 s of wall time', () => {
    let skipped = 0, cards = 0;
    for (let s = 1; s <= 12; s++) {
      const run = new DecisionRun(Scheduler.boss(s * 1237, null, s % 2 ? 2 : 1).plan());
      for (let i = 0; i < 200; i++) {
        const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
        const d = st.decision; const t = d.timing; cards++;
        if (t) {
          const last = t.secondTapSeconds ?? t.truthSeconds;
          expect(wallMaxOf(t), `${d.prompt} ${JSON.stringify(t)}`).toBeLessThanOrEqual(WALL_MAX_SECONDS + 1e-9);
          expect(wallOf(t, last), d.prompt).toBeLessThanOrEqual(HOLD_MAX_SECONDS + 1e-9);
          if (t.skip) {
            skipped++;
            expect(t.skip.to).toBeCloseTo(last - SKIP_LEAD_SECONDS, 1); expect(t.skip.at).toBeLessThan(t.skip.to);
            if (t.kind === 'startStop') expect(t.skip.at).toBeGreaterThan(t.truthSeconds + 1.5);   // after the START
            expect(d.prompt).toMatch(/Long hold: the watch skips ahead to 5 s before the/); expect(t.skip.note).toMatch(/skips ahead/);
          }
        }
        run.answer(run.oracle());
      }
    }
    expect(cards).toBeGreaterThan(200); expect(skipped).toBeGreaterThan(0);
  }, 120_000);
  it('MOB-067 micro cards: every timed kind closes within 30 s of wall time over 40 seeds', () => {
    for (const kind of TIMED_KINDS) for (let s = 1; s <= 40; s++) {
      const d = microRunner(microScenario(kind, s, s % 4), 2).next()!; const t = d.timing!;
      expect(wallMaxOf(t), `${kind} ${s} ${JSON.stringify(t)}`).toBeLessThanOrEqual(WALL_MAX_SECONDS + 1e-9);
      expect(t.maxSeconds).toBeGreaterThanOrEqual((t.secondTapSeconds ?? t.truthSeconds) + t.toleranceSeconds + 2 - 1e-9);
    }
  });
});

/** A wrong answer of the right shape: another option, or a tap 5 s late. */
function wrong(d: Decision, o: DecisionResponse): DecisionResponse {
  if (d.options?.length) return { optionId: d.options.find(x => x.id !== o.optionId)!.id, ...(o.tapSeconds !== undefined ? { tapSeconds: o.tapSeconds } : {}) };
  if (o.taps) return { taps: o.taps.map(x => x + 5) };
  return { tapSeconds: (o.tapSeconds ?? 0) + 5 };
}
/** Human model (PT-14 section E): reading and tapping an option card 3 s, a timed tap 0.3 s after its moment, a verdict 2 s, a rule card 4 s. */
function pace(plan: RunPlan): { perMinute: number; cards: number; seconds: number } {
  const run = new DecisionRun(plan); let wall = 0; let cards = 0; let started = false;
  for (let i = 0; i < 100; i++) {
    const st = run.next(); if (!st) break;
    if (st.type === 'rule') { if (started) wall += 4; run.ack(); continue; }
    started = true; cards++;
    const d = st.decision; const o = run.oracle()!; const t = d.timing;
    wall += t ? wallOf(t, (o.taps ? o.taps[o.taps.length - 1]! : o.tapSeconds ?? t.truthSeconds)) + 0.3 : 3;
    run.answer(o); wall += 2;
  }
  return { perMinute: cards / (wall / 60), cards, seconds: wall };
}
describe('MOB-068 N7: Stay-on-time runs keep >= 4 decisions a minute', () => {
  it('MOB-068 interleave: an option card between two timing cards whenever there are enough; otherwise even groups of at most two', () => {
    const T = (n: number) => Array.from({ length: n }, (_, i) => `T${i}`); const O = (n: number) => Array.from({ length: n }, (_, i) => `O${i}`);
    const isT = (x: string): boolean => x.startsWith('T');
    const pairs = (xs: string[]): number => xs.filter((x, i) => i > 0 && isT(x) && isT(xs[i - 1]!)).length;
    expect(pairs(interleave([...T(4), ...O(6)], isT))).toBe(0);
    const tight = interleave([...T(8), ...O(4)], isT); expect(tight.length).toBe(12); expect(tight.join('')).not.toMatch(/T\dT\dT/);
    const few = interleave(['O0', 'T0', 'T1', 'O1', 'O2'], isT); expect(pairs(few)).toBe(0); expect([...few].sort()).toEqual(['O0', 'O1', 'O2', 'T0', 'T1']);
  });
  it('MOB-068 Try it: Stay on time (40 seeds) plans >= 4 decisions a minute under the human model, with no three timing cards in a row; Daily sets too', () => {
    const rates: number[] = [];
    for (let s = 1; s <= 40; s++) {
      const plan = new Scheduler(['stayOnTime'], s * 37, emptyProgress()).plan();
      const timed = plan.items.flatMap(i => (i.type === 'decision' ? [TIMED_KINDS.includes(i.micro.kind)] : []));
      expect(timed.map(x => (x ? 'T' : 'O')).join(''), `seed ${s}`).not.toMatch(/TTT/);
      const p = pace(plan); rates.push(p.perMinute);
      expect(p.perMinute, `seed ${s}: ${p.cards} cards in ${p.seconds.toFixed(0)} s`).toBeGreaterThanOrEqual(4);
    }
    for (let i = 0; i < 3; i++) expect(pace(Scheduler.daily('2026-10-24', i, emptyProgress()).plan()).perMinute).toBeGreaterThanOrEqual(4);
    expect(rates.reduce((a, b) => a + b, 0) / rates.length).toBeGreaterThan(4.3);
  }, 180_000);
});

describe('MOB-070 item 9: the watch and pre-read pause cards are answerable from their own text at rung 2', () => {
  it('MOB-070 the watch prompt prints the lap and the lead, the pre-read pause prompt the loss; a follower reading only the prompt is right on 40 + 40 seeds', () => {
    let w = 0, p = 0;
    for (let s = 1; s <= 400 && (w < 40 || p < 40); s++) {
      if (w < 40) {
        const r = microRunner(microScenario('watch', s, s % 4), 2); const d = r.next()!;
        expect(d.prompt).toMatch(/; lead \d+\.\d s\. You lapped \d+m\d\d\.\ds at the sign/);
        expect(r.answer(d, follow(d)).correct, d.prompt).toBe(true); w++;
      }
      if (p < 40) {
        const r = microRunner(microScenario('preread', s, 1 + 3 * (s % 4)), 2); const d = r.next()!;
        if (!/How long do you sit/.test(d.prompt)) continue;
        expect(d.prompt).toMatch(/pause \d+ s, in \d+, out \d+, loss \d+\.\d s/);
        expect(r.answer(d, follow(d)).correct, d.prompt).toBe(true); p++;
      }
    }
    expect([w, p]).toEqual([40, 40]);
  }, 60_000);
});

describe('MOB-071 item 10 (engine part): one clock format, varied distances', () => {
  it('MOB-071 times on the cards are 12-hour with the zone label in front, as Column C prints it; no 24-hour time anywhere in a prompt', () => {
    for (const [kind, v] of [['restart', 0], ['restart', 2], ['transitOut', 0], ['clock', 0], ['clock', 2]] as [DecisionKind, number][]) for (let s = 1; s <= 6; s++) {
      const d = microRunner(microScenario(kind, s, v), 2).next()!;
      expect(d.prompt, d.prompt).toMatch(/CDT (1[0-2]|[1-9]):\d\d:\d\d/); expect(d.prompt).not.toMatch(/\b(1[3-9]|2[0-3]|0\d):\d\d:\d\d/);
      expect(d.context.zone).toBe('CDT');
    }
  });
  it('MOB-071 distances in the prompts vary: turns, checkpoints, hazards (40 seeds each)', () => {
    const ft = (kind: DecisionKind, v: (s: number) => number): Set<string> => new Set(Array.from({ length: 40 }, (_, i) => /(\d+) ft ahead/.exec(microRunner(microScenario(kind, i + 1, v(i + 1)), 2).next()!.prompt)?.[1] ?? '?'));
    expect(ft('turn', () => 0).size).toBeGreaterThanOrEqual(5);
    expect(ft('checkpoint', s => (s % 2 ? 0 : 1)).size).toBeGreaterThanOrEqual(5);
    expect(ft('hazard', s => s % 4).size).toBeGreaterThanOrEqual(5);
  }, 60_000);
});

describe('MOB-062..070 whole runs: a rule-card follower is right on every card', () => {
  it('MOB-062 MOB-063 MOB-070 Daily sets, practice and single-skill runs and Boss runs at rung 2 and 1: the follower is never marked wrong', () => {
    const plans: [RunPlan, number][] = [];
    for (const day of ['2026-10-23', '2026-10-24', '2026-10-25']) for (let i = 0; i < 3; i++) plans.push([Scheduler.daily(day, i, emptyProgress()).plan(), 2]);
    for (const sk of SKILLS) for (let s = 1; s <= 2; s++) plans.push([new Scheduler([sk], s * 5003, emptyProgress()).plan(), 2]);
    for (let s = 1; s <= 4; s++) plans.push([Scheduler.boss(s * 991, null, s % 2 ? 2 : 1).plan(), s % 2 ? 2 : 1]);
    const misses: string[] = []; let n = 0; const react = reactions(70);
    for (const [plan, rung] of plans) {
      const run = new DecisionRun(plan);
      for (let i = 0; i < 200; i++) {
        const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
        const d = st.decision; const r = run.currentRunner()!; n++;
        const v = run.answer(answerOf(r, d, react, rung));
        if (!v.correct) misses.push(`${plan.mode} ${d.kind}: ${d.prompt} -> ${v.missed}`);
      }
    }
    expect(n).toBeGreaterThan(250); expect(misses).toEqual([]);
  }, 180_000);
});

describe('MOB-062 rule texts used by the verdicts', () => {
  it('MOB-062 the "are not" sentence and the cause sentence are whole sentences of RULE-031', () => {
    expect(text('RULE-031').split(/(?<=\.)\s+/)).toEqual(expect.arrayContaining([expect.stringMatching(/^A slow truck you can pass/), expect.stringMatching(/^Claim time only for a delay beyond your control/)]));
  });
});
