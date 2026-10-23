/** Fix sprint PT-13 (docs/playtest/PT-13-phone-decision-mode.md): MOB-050..061. A rule-card follower is never marked wrong. */
import { describe, it, expect } from 'vitest';
import { formatInterval } from '../src/core/griid.js';
import { RULES } from '../content/rules.js';
import { chartCellHtml, decisionCardHtml, ruleCardHtml, verdictParts, signState, signBarHtml, driverLine, KIND_TITLE } from '../src/ui/mobile/cards.js';
import { SKILL_TITLE, allRuleCards } from '../src/core/decision/index.js';
import { cameoSvg, signFace, CAMEO_W } from '../src/core/cameo.js';
import {
  microScenario, microRunner, ruleClaim, words, cardWords, CARD_MAX_WORDS, sentences, ruleCardById, Scheduler, playRun, oracleAnswerer, randomAnswerer,
  emptyProgress, bossUnlocked, BOSS_UNLOCK, BOSS_DECISIONS, MAX_PER_KIND, KINDS_OF_SKILL, DECISION_KINDS, SKILLS, TIMING_TOLERANCE,
  type Decision, type DecisionKind, type DecisionResponse, type Verdict, type Skill,
} from '../src/core/decision/index.js';

const one = (kind: DecisionKind, seed: number, variant = 0, rung: 0 | 1 | 2 | 3 = 2): { d: Decision; answer: (r: DecisionResponse | null) => Verdict; oracle: DecisionResponse } => {
  const run = microRunner(microScenario(kind, seed, variant, rung), rung); const d = run.next()!;
  expect(d, `${kind} ${seed} ${variant}`).toBeTruthy(); expect(d.kind).toBe(kind);
  return { d, answer: r => run.answer(d, r), oracle: run.oracle(d) };
};
const text = (id: string): string => RULES.find(r => r.id === id)!.text;

describe('MOB-050 the pause card prints the number it grades', () => {
  it('MOB-050 sit = the turn-capped chart dwell; a GO within 1 s of the printed number is right (40 seeds)', () => {
    let turns = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { d, answer } = one('pause', seed, seed % 4);
      const c = d.context.chart!; expect(c.kind).toBe('stopGo'); expect(c.meaning).toBe('sit');
      expect(c.seconds, `seed ${seed}`).toBe(d.timing!.truthSeconds);
      expect(d.prompt).toContain(`sit ${c.seconds.toFixed(1)} s`);
      const ins = microScenario('pause', seed, seed % 4).scenario.book.find(i => i.n === d.context.line)!; if (ins.turn === 'L' || ins.turn === 'R') turns++;
      const off = ((seed * 37) % 19 - 9) / 10;   // -0.9 .. +0.9
      const v = answer({ tapSeconds: Math.max(0, c.seconds + off) });
      expect(v.correct, `seed ${seed}: printed ${c.seconds}, tapped ${c.seconds + off}`).toBe(true);
    }
    expect(turns, 'rows that turn (the capped loss)').toBeGreaterThanOrEqual(10);
  });
  it('MOB-050 the pre-read chip of the same row is the loss to subtract, labelled as such; loss + sit = the printed pause', () => {
    let n = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const { d, oracle } = one('preread', seed, 1);
      if (!d.context.times?.pauseSeconds) continue; n++;
      const c = d.context.chart!; expect(c.meaning).toBe('loss');
      const sit = Number(oracle.optionId!.slice(1));
      expect(Math.round((c.seconds + sit) * 10) / 10, `seed ${seed}`).toBeCloseTo(Math.max(d.context.times.pauseSeconds, c.seconds), 5);
    }
    expect(n).toBeGreaterThanOrEqual(5);
  });
});

describe('MOB-051 the TA grader is the rule card', () => {
  it('MOB-051 ruleClaim: take off what can be made up, the multiple of 10 s at or below the rest (RULE-033, REG V.H.5)', () => {
    expect(ruleClaim(227, 7)).toBe(220);   // Time Delay Form: delayed 3m47s, make up 7 s, claim 3m40s
    expect(ruleClaim(45, 25)).toBe(20);    // REG V.H.5: Delayed 0m45s ... Made up 0m25s. Request 0m20s
    expect(ruleClaim(42, 11)).toBe(30); expect(ruleClaim(15, 13)).toBe(0); expect(ruleClaim(9, 0)).toBe(0);
    expect(text('RULE-033')).toMatch(/claim the rest rounded down to 10 s steps[\s\S]*delayed 3m47s, make up 7 s, claim 3m40s/);
    expect(text('RULE-032')).toMatch(/Claim only what you could not make up/);
  });
  it('MOB-051 a player who applies RULE-033 to the numbers on the card is right on 60 of 60 seeds; the verdict cites the deciding sentence', () => {
    let right = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { d, answer } = one('ta', seed, seed % 2);
      const m = /delayed (\d+)m(\d\d)s/.exec(d.prompt)!; const M = Number(m[1]) * 60 + Number(m[2]);
      const R = /none of it/.test(d.prompt) ? 0 : Number(/about (\d+) s of it could be made up/.exec(d.prompt)![1]);
      const claim = Math.floor(Math.max(0, M - R) / 10) * 10;
      const label = claim === 0 ? 'No claim' : `Claim ${formatInterval(claim)}`;
      const opt = d.options!.find(o => o.label === label); expect(opt, `seed ${seed}: ${d.prompt} -> ${label} in ${d.options!.map(o => o.label)}`).toBeTruthy();
      const v = answer({ optionId: opt!.id }); if (v.correct) right++;
      expect(v.correct, `seed ${seed}: ${d.prompt}`).toBe(true);
      expect(v.ruleId).toBe('RULE-033'); expect(v.rule).toMatch(/odd seconds/);
    }
    expect(right).toBe(60);
  });
  it('MOB-051 claiming more than the rest is wrong and cites "Claim only what you could not make up" (RULE-032)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { d, answer, oracle } = one('ta', seed, seed % 2);
      const truth = Number(oracle.optionId!.slice(1)); const over = d.options!.find(o => Number(o.id.slice(1)) > truth);
      if (!over) continue;
      const v = answer({ optionId: over.id });
      expect(v.correct).toBe(false); expect(v.ruleId).toBe('RULE-032'); expect(v.rule).toMatch(/^Claim only what you could not make up/); expect(v.missed).toMatch(/more than/);
    }
  });
});

describe('MOB-052 timed cards show the sign arriving', () => {
  it('MOB-052 speed-change and timed-start cards carry the sign moment (Dad says Mark!) and the distance; START is on Mark, a CALL leads it by the chart lead', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sc = one('speedChange', seed, seed % 4).d; const t = sc.timing!;
      expect(t.signSeconds, `speed ${seed}`).toBeGreaterThan(t.truthSeconds); expect(t.signFt).toBeGreaterThan(0); expect(sc.prompt).toMatch(/Mark!/);
      expect(Math.abs(t.signSeconds! - sc.context.chart!.seconds - t.truthSeconds), `speed ${seed}`).toBeLessThanOrEqual(TIMING_TOLERANCE.speedChange / 2);
      const ts = one('timedStart', seed, seed % 4).d; expect(ts.timing!.signSeconds).toBe(ts.timing!.truthSeconds); expect(ts.prompt).toMatch(/START on Dad's Mark!/); expect(ts.context.row!.columnC.join(' ')).toMatch(/MPH/);
    }
  });
  it('MOB-052 no card asks for a tap at the sign unless the sign is on screen (its moment is in the timing)', () => {
    for (const kind of DECISION_KINDS) for (let seed = 1; seed <= 4; seed++) for (const variant of [0, 1, 2, 3]) {
      const run = microRunner(microScenario(kind, seed, variant)); for (let d = run.next(); d; d = run.next()) {
        if (/\btap\b[^.]*\bsign\b|\bat the sign\b[^.]*\btap\b/i.test(d.prompt) || /Mark!/.test(d.prompt)) expect(d.timing?.signSeconds, d.prompt).toBeGreaterThan(0);
        run.answer(d, run.oracle(d));
      }
    }
  }, 60_000);
});

describe('MOB-053 the Scheduler caps a kind and varies Instruments', () => {
  const kindsOf = (plan: ReturnType<Scheduler['plan']>): DecisionKind[] => plan.items.flatMap(i => i.type === 'decision' ? [i.micro.kind] : []);
  it('MOB-053 at most 2 cards of one kind per plan; a run with Instruments has both its kinds; runs of one or two skills still have 10+ cards', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const skills = SKILLS.filter((_, i) => (seed >> (i % 5)) & 1); const plan = new Scheduler(skills.length ? skills : [...SKILLS], seed).plan();
      const ks = kindsOf(plan); expect(ks.length).toBeGreaterThanOrEqual(10);
      for (const k of new Set(ks)) expect(ks.filter(x => x === k).length, `${seed} ${k}`).toBeLessThanOrEqual(MAX_PER_KIND);
      const inst = ks.filter(k => (KINDS_OF_SKILL.instruments as readonly string[]).includes(k)); if (inst.length >= 2) expect(new Set(inst).size, `seed ${seed}`).toBe(2);
    }
    for (const pair of [['instruments', 'startOnTime'], ['instruments'], ['startOnTime']] as Skill[][]) {
      const ks = kindsOf(new Scheduler(pair, 5).plan()); expect(ks.length).toBeGreaterThanOrEqual(10);
      expect(new Set(ks).size).toBeGreaterThanOrEqual(5); expect(ks.filter(k => k === 'clock').length).toBeLessThanOrEqual(2);
    }
  });
  it('MOB-053 repeats count toward the cap and "Card n of N" is fixed at plan time (random answers, 12 seeds)', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const run = new Scheduler([...SKILLS], seed).start(); const N = run.plan.decisionCount; const of = new Set<number>(); const who = randomAnswerer(seed);
      for (let s = run.next(); s; s = run.next()) { if (s.type === 'rule') { run.ack(); continue; } of.add(s.of); run.answer(who.respond(s.decision, run)); }
      const r = run.result();
      expect(r.total, `seed ${seed}`).toBe(N); expect([...of]).toEqual([N]);
      const ks = r.verdicts.map(v => v.kind); for (const k of new Set(ks)) expect(ks.filter(x => x === k).length, `${seed} ${k}`).toBeLessThanOrEqual(MAX_PER_KIND);
    }
  });
});

describe('MOB-054 the verdict names what decided it', () => {
  it('MOB-054 every verdict sentence is a whole sentence of its rule card, with the source', () => {
    for (const kind of DECISION_KINDS) for (const seed of [1, 2]) for (const variant of [0, 1, 2, 3]) {
      const fresh = () => { const run = microRunner(microScenario(kind, seed, variant)); return { run, d: run.next()! }; };
      const { d } = fresh(); let v: Verdict | null = null;
      for (const wrong of d.options ? d.options.map(o => ({ optionId: o.id }) as DecisionResponse) : [d.timing!.kind === 'startStop' ? { taps: [d.timing!.truthSeconds - 3, d.timing!.secondTapSeconds!] } : { tapSeconds: d.timing!.truthSeconds + 4 }]) {
        const f = fresh(); const x = f.run.answer(f.d, wrong); if (!x.correct) { v = x; break; }
      }
      expect(v, `${kind} ${seed} ${variant}: some answer is wrong`).toBeTruthy(); if (!v) continue;
      const card = ruleCardById(v.ruleId)!;
      const sent = v.rule.slice(0, v.rule.length - ` (${v.source}).`.length);
      expect(sentences(card.text).map(x => x.replace(/[.!?]$/, '')), `${kind} ${variant}: ${v.rule}`).toContain(sent);
      expect(v.correct).toBe(false); expect(v.missed, `${kind} ${variant}`).toBeTruthy();
    }
  }, 60_000);
  it('MOB-054 outcome picks the rule: an early START heads the timed verdict; a light is made up; a train claim of everything; a wrong turn is no TA', () => {
    const ts = one('timedStart', 3); const t = ts.d.timing!; const v = ts.answer({ taps: [t.truthSeconds - 2, t.secondTapSeconds!] });
    expect(v.correct).toBe(false); expect(v.secondsDelta).toBeCloseTo(-2, 1); expect(v.missed).toBe('START 2.0 s early'); expect(v.ruleId).toBe('RULE-022');
    const light = one('hazard', 1, 3); expect(light.d.context.hazard!.kind).toBe('signal');
    const lv = light.answer({ optionId: 'ta' }); expect(lv.rule).toMatch(/^A traffic light is not named: make that time up \(REG V\.H\.1; HB p\.13\)\.$/);
    for (let seed = 1; seed <= 12; seed++) {
      const h = one('hazard', seed, 1); if (h.oracle.optionId !== 'both') continue;
      const hv = h.answer({ optionId: 'ta' }); expect(hv.ruleId).toBe('RULE-032'); expect(hv.rule).toMatch(/^Claim only what you could not make up/); break;
    }
    const lost = one('lost', 2, 0); const lsv = lost.answer({ optionId: 'ta' }); expect(lsv.rule).toMatch(/^Never for a wrong turn/);
    expect(one('turn', 2).answer({ optionId: 'nope' }).ruleId).toBe('RULE-041');
  });
});

describe('MOB-059 the Boss', () => {
  it('MOB-059 the first Boss is rung 2 (chart on the card), later ones rung 1 with the chart cell behind a button; unlock at 50 % on every meter', () => {
    expect(Scheduler.boss(4).plan().rung).toBe(2);
    const p = emptyProgress(); p.bossRuns = 1; expect(Scheduler.boss(4, p).plan().rung).toBe(1);
    expect(BOSS_UNLOCK).toBe(0.5); for (const s of SKILLS) p.meters[s].value = 0.5; expect(bossUnlocked(p)).toBe(true);
    p.meters.recovery.value = 0.49; expect(bossUnlocked(p)).toBe(false);
    const r1 = microRunner(microScenario('pause', 3, 0, 1), 1).next()!; expect(r1.context.chart?.seconds).toBeGreaterThan(0); expect(r1.prompt).not.toMatch(/sit \d/);
  });
  it('MOB-059 a Boss run gives every kind at least once, at most 2 of a kind, and exactly its fixed count', () => {
    for (const seed of [3, 8]) {
      const r = playRun(Scheduler.boss(seed).start(), oracleAnswerer());
      expect(r.total).toBe(BOSS_DECISIONS); expect(r.correct).toBe(r.total);
      const ks = r.verdicts.map(v => v.kind); for (const k of DECISION_KINDS) { expect(ks, `${seed} ${k}`).toContain(k); expect(ks.filter(x => x === k).length).toBeLessThanOrEqual(MAX_PER_KIND); }
    }
  }, 60_000);
});

describe('MOB-055 MOB-056 MOB-057 no card has a fixed answer', () => {
  const truths = (kind: DecisionKind, n = 24): string[] => Array.from({ length: n }, (_, i) => one(kind, i + 1, i % 4).oracle.optionId ?? '');
  it('MOB-055 checkpoint: green (do nothing), the red STOP board (stop), a car ahead pulling off (still do nothing)', () => {
    const t = truths('checkpoint'); expect(t).toContain('nothing'); expect(t).toContain('stop');
    const car = one('checkpoint', 3, 2); expect(car.d.prompt).toMatch(/car ahead slows and pulls off/); expect(car.answer({ optionId: 'nothing' }).correct).toBe(true);
    const red = one('checkpoint', 3, 1); expect(red.d.prompt).toMatch(/red GREAT RACE STOP/); expect(red.answer({ optionId: 'nothing' }).correct).toBe(false);
    expect(one('checkpoint', 4, 1).answer({ optionId: 'stop' }).correct).toBe(true);
  });
  it('MOB-055 make-up: the room and the limit decide; +20 % is not always right and +10 % is sometimes the only safe choice', () => {
    let p20wrong = 0, p10wrong = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const v = seed % 4; const a = one('makeup', seed, v);
      const good = (r: string): boolean => one('makeup', seed, v).answer({ optionId: r }).correct;
      if (!good('p20')) { p20wrong++; expect(a.d.prompt, 'only with a posted limit').toMatch(/posted limit/); }
      if (!good('p10')) p10wrong++;
      expect(a.d.prompt).toMatch(/\d+ s (late|early) at \d+ mph/); expect(a.d.prompt).toMatch(/about \d+ s/);
    }
    expect(p20wrong).toBeGreaterThan(0); expect(p10wrong).toBeGreaterThan(0);
  });
  it('MOB-055 hazard: the card describes what is seen and how long; a qualifying delay is sometimes short (make it up), sometimes long (claim the rest)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) for (const v of [1, 2]) {
      const h = one('hazard', seed, v); seen.add(`${h.d.context.hazard!.kind}:${h.oracle.optionId}`);
      expect(h.d.prompt).not.toMatch(/Time Allowance|qualif|beyond your control/i);
    }
    expect(seen).toContain('train:both'); expect(seen).toContain('train:makeup'); expect(seen).toContain('tractor:both'); expect(seen).toContain('tractor:makeup');
  });
  it('MOB-055 a speed pre-read never prints the answer outside the book row', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const { d, oracle } = one('preread', seed, 2); if (!oracle.optionId?.startsWith('v')) continue;
      const v = oracle.optionId.slice(1); expect(d.prompt).not.toContain(v); expect(d.context.speeds?.out).toBeUndefined(); expect(d.context.chart ?? null).toBeNull();
    }
  });
  it('MOB-056 lost: never "0 s ago", the time since the turn varies, and keeping on is sometimes cheaper (RULE-043)', () => {
    const agos = new Set<number>(); const t: string[] = [];
    for (let seed = 1; seed <= 24; seed++) {
      const l = one('lost', seed, seed % 4); const ago = Number(/left the route (\d+) s ago/.exec(l.d.prompt)![1]); agos.add(ago); expect(ago).toBeGreaterThanOrEqual(5);
      t.push(l.oracle.optionId!);
      const m = /a detour about (\d+) s longer/.exec(l.d.prompt);
      if (m) expect(l.oracle.optionId, l.d.prompt).toBe(Number(m[1]) < 2 * ago + 20 ? 'continue' : 'uturn'); else expect(l.oracle.optionId).toBe('uturn');
    }
    expect(agos.size).toBeGreaterThanOrEqual(6); expect(t).toContain('continue'); expect(t).toContain('uturn');
    const cont = (() => { for (let seed = 1; seed <= 24; seed++) { const l = one('lost', seed, seed % 4); if (l.oracle.optionId === 'continue') return l; } return null; })()!;
    expect(cont.answer({ optionId: 'continue' }).correct).toBe(true);
  });
  it('MOB-057 clock: the job varies (minute, launch second, interval), the minute is sometimes unambiguous and then the clock is fine too', () => {
    const qs = new Set<string>(); let mid = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const c = one('clock', seed, seed % 4); qs.add(c.oracle.optionId!);
      if (/read the minute/.test(c.d.prompt) && !c.d.context.clock!.minuteAmbiguous) { const v = one('clock', seed, seed % 4).answer({ optionId: 'min' }); if (v.correct) mid++; }
      expect(c.answer({ optionId: 'chrono' }).correct).toBe(c.oracle.optionId === 'chrono');
    }
    expect(qs).toEqual(new Set(['tod', 'sec', 'chrono'])); expect(mid).toBeGreaterThan(0);
  });
  it('MOB-055 transit IN times vary', () => {
    const ins = new Set(Array.from({ length: 20 }, (_, i) => one('transitOut', i + 1).d.context.times!.in)); expect(ins.size).toBeGreaterThanOrEqual(15);
  });
});

describe('MOB-058 restart numbers vary; base + position', () => {
  it('MOB-058 own times, speeds and losses vary; some cards print the base and the position and a RULE-010 / RULE-011 follower launches right; the big digits show the time of day', () => {
    const owns = new Set<string>(); const losses = new Set<number>(); let base = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const r = one('restart', seed, seed % 4); expect(r.d.timing!.todPrimary).toBe(true);
      losses.add(r.d.context.chart?.seconds ?? -1); owns.add(r.d.prompt);
      const m = /base (\d+):(\d\d):(\d\d), you start (\d+)(st|nd|rd|th); standing-start loss ([\d.]+) s/.exec(r.d.prompt);
      if (m) {
        base++;
        const launch = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) * 60 - Number(m[6]);
        const v = r.answer({ tapSeconds: launch - r.d.context.tod }); expect(v.correct, r.d.prompt).toBe(true);
      }
    }
    expect(owns.size).toBe(24); expect(losses.size).toBeGreaterThanOrEqual(3); expect(base).toBeGreaterThan(0);
  });
});

describe('MOB-061 card text budget (engine part)', () => {
  it('MOB-061 prompt plus option labels stay within 32 words on every kind (the phone adds the strip and the kind title)', () => {
    for (const kind of DECISION_KINDS) for (const seed of [1, 2, 3, 4, 5, 6]) for (const variant of [0, 1, 2, 3]) for (const rung of [0, 2] as const) {
      const run = microRunner(microScenario(kind, seed, variant, rung), rung); const d = run.next()!;
      expect(cardWords(d), `${d.prompt} | ${d.options?.map(o => o.label).join(' | ')}`).toBeLessThanOrEqual(CARD_MAX_WORDS);
    }
  }, 60_000);
});

/** Words a player sees: tags, SVG and closed <details> bodies removed; a token counts when it has a letter or a digit. */
const visible = (html: string): string => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>[\s\S]*?<\/details>/g, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const tokens = (t: string): number => t.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;

describe('MOB-050 MOB-052 MOB-054 MOB-059 MOB-061 the phone card', () => {
  it('MOB-050 the chart chip says what its number means', () => {
    expect(chartCellHtml({ kind: 'stopGo', vIn: 35, vOut: 40, seconds: 6.6, meaning: 'sit' }, 2)).toMatch(/>sit 6\.6 s</);
    expect(chartCellHtml({ kind: 'stopGo', vIn: 35, vOut: 40, seconds: 8.4, meaning: 'loss' }, 2)).toMatch(/>loss 8\.4 s</);
    expect(chartCellHtml({ kind: 'lead', vIn: 30, vOut: 40, seconds: 2.3, meaning: 'lead' }, 2)).toMatch(/>lead 2\.3 s</);
  });
  it('MOB-059 at rung 1 the chart cell is on the card behind a Chart button; at rung 0 it is withheld', () => {
    const d = one('pause', 2, 0, 1).d;
    const html = decisionCardHtml(d, 1); expect(html).toMatch(/data-testid="chart-button"><summary class="mob-reveal">Chart<\/summary>/); expect(html).toContain(`sit ${d.context.chart!.seconds.toFixed(1)} s`);
    expect(decisionCardHtml(one('pause', 2, 0, 0).d, 0)).not.toContain('mchart');
  });
  it('MOB-052 the sign bar shrinks to zero at the sign and Mark! is due then; Dad promises the mark', () => {
    const d = one('speedChange', 4).d; const t = d.timing!;
    expect(signState(t, 0)).toMatchObject({ frac: 1, ft: Math.round(t.signFt! / 10) * 10, mark: false });
    expect(signState(t, t.signSeconds! / 2).frac).toBeCloseTo(0.5, 5);
    expect(signState(t, t.signSeconds!)).toMatchObject({ frac: 0, ft: 0, mark: true }); expect(signState(t, t.signSeconds! + 2).mark).toBe(false);
    expect(signBarHtml(d, 2)).toMatch(/data-testid="sign-bar" data-sign-seconds="[\d.]+"/); expect(signBarHtml(d, 2)).toContain('msign-call');
    expect(decisionCardHtml(d, 2)).toContain('sign-bar'); expect(driverLine(d)).toMatch(/mark at the sign/);
    expect(signBarHtml(one('pause', 4).d, 2)).toBe('');
  });
  it('MOB-054 the missed part heads the verdict', () => {
    const ts = one('timedStart', 3); const t = ts.d.timing!; const v = ts.answer({ taps: [t.truthSeconds - 2, t.secondTapSeconds!] });
    expect(verdictParts(v).head).toBe('Not quite: START 2.0 s early'); expect(verdictParts(v).seconds).toBe('−2.0 s');
  });
  it('MOB-061 a decision screen is under 40 words (strip, kind, card, buttons; chips behind "details"); a rule card under 60', () => {
    const strip = (sk: string): number => tokens(`${sk} ★12 12/15`);
    let worst = 0;
    for (const kind of DECISION_KINDS) for (const seed of [1, 2, 3, 4]) for (const variant of [0, 1, 2, 3]) {
      const d = one(kind, seed, variant).d; const html = decisionCardHtml(d, 2);
      expect(html).toMatch(/<details class="mdetails"|^((?!mfacts).)*$/s);
      const face = d.timing ? tokens(`TOD 9:43:12 0:00.00 ${d.timing.tapLabel}${d.timing.secondTapLabel ? ` ${d.timing.secondTapLabel}` : ''}`) : 0;
      const n = strip(SKILL_TITLE[d.skill]) + tokens(visible(html)) + (d.options ?? []).reduce((a, o) => a + tokens(o.label), 0) + face;
      worst = Math.max(worst, n);
      expect(n, `${kind} ${seed} ${variant}: ${visible(html).replace(/\s+/g, ' ')}`).toBeLessThan(40);
    }
    expect(worst).toBeGreaterThan(20);
    for (const c of allRuleCards()) {
      const n = strip(SKILL_TITLE[c.skill]) + tokens(visible(ruleCardHtml(c))) + tokens('Got it');
      expect(n, `${c.id}`).toBeLessThan(60);
    }
    expect(KIND_TITLE.watch).toBe('Stopwatch');
  }, 60_000);
});

describe('MOB-061 CAMEO labels at phone width', () => {
  it('MOB-061 a text sign box holds its text and the face never crosses the bold stem, whichever way the route turns', () => {
    for (const text of ['END ROAD WORK', 'End Transit', 'BRIDGE', 'Grain elevator', 'SPEED LIMIT 45']) {
      const f = signFace('text', text)!; if (!f) continue;
      const lines = [...f.svg.matchAll(/>([^<>]+)<\/text>/g)].map(m => m[1]!);
      for (const l of lines) expect(l.length * 5.1 + 8, `${text}: "${l}"`).toBeLessThanOrEqual(f.w + 0.01);
      for (const angle of [-90, -45, 0, 45, 90]) for (const side of ['L', 'R'] as const) {
        const svg = cameoSvg([{ angle, isRoute: true }, { angle: -angle || 90 }], 'none', null, 64, { sign: { text, shape: 'text', side } });
        const stemX = Number(/class="cameo-route[^"]*" d="M([\d.]+) /.exec(svg)![1]);
        const g = /class="cameo-signface side-[LRO]" transform="translate\(([\d.-]+) [\d.-]+\)(?: scale\(([\d.]+)\))?"/.exec(svg)!;
        const cx = Number(g[1]); const k = g[2] ? Number(g[2]) : 1; const half = f.w * k / 2;
        expect(cx + half <= stemX - 1.5 || cx - half >= stemX + 1.5, `${text} ${angle} ${side}: face ${cx - half}..${cx + half}, stem ${stemX}`).toBe(true);
        expect(cx - half).toBeGreaterThanOrEqual(0); expect(cx + half).toBeLessThanOrEqual(CAMEO_W);
      }
    }
  });
});
