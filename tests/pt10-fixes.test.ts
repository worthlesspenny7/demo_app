// Fix sprint PT-10 (2026-10-04): the top-10 fixes of docs/playtest/PT-10-playability-v3-2.md. One describe per spec id (PLAY-033..PLAY-041, ENG-026 in docs/spec/SPECS.md).
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type StageResult } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { runOracle } from './drill-helpers.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { FORD_1939, PACKARD_1936, DRIVER_EXPERT, aidsForRung, isMeasureRun, type Scenario } from '../src/core/course.js';
import { stopLoss } from '../src/core/perf-table.js';
import { chartPairs, runMeasurement } from '../src/core/drills/d06.js';
import { chartsHidden, perfCardFor, instrumentPolicy, MEASURE_TEXT, MEASURE_COPY_TEXT, HIDDEN_CHARTS_TEXT, lineSpeeds } from '../src/ui/viewmodels/cockpitinfo.js';
import { simpleChart, chartStopLoss } from '../src/ui/viewmodels/charts.js';
import { TRAPS, TRAP_QUIZ } from '../src/core/generator/traps.js';
import { trapCards } from '../src/ui/screens/quiz.js';
import { LESSONS, lessonText, type LessonBlock } from '../content/lessons.js';
import { shuffleCheck } from '../src/ui/viewmodels/lessoncheck.js';
import { headlineTip, turningStopExtras } from '../src/core/drills/rubrics.js';
import { debriefViewModel, showResidualLine } from '../src/ui/viewmodels/debrief.js';
import { START_PATH, pathNext, startPathFromProgress, debriefNext, lockText, startPathState, cardMinutesText, lessonTitleOf } from '../src/ui/viewmodels/curriculum.js';
import { defaultScaleFor, HOLD_FF_MARGIN_S, effectiveScale } from '../src/ui/viewmodels/timescale.js';
import { FULL_START_FF_LEAD } from '../src/ui/viewmodels/curriculum.js';
import { drillHint } from '../src/ui/viewmodels/hints.js';
import { readFileSync } from 'node:fs';

const T0 = 8 * 3600;
const tierName = ['Bronze', 'Silver', 'Gold'];
type Prog = { drills: Record<string, { stars: number; tierStars?: number[] }> };

describe('PLAY-033 D06 at Silver and Gold hides the car\'s charts everywhere; Bronze keeps them (copy mode)', () => {
  it('PLAY-033 only Silver and Gold carry charts:hidden, Bronze carries charts:packard and drives the Packard', () => {
    const d = drillById('D06')!;
    for (const seed of [1, 2, 3]) {
      const b = d.scenario(seed, 0), s = d.scenario(seed, 1), g = d.scenario(seed, 2);
      expect(chartsHidden(b)).toBe(false); expect(b.tags).toContain('charts:packard'); expect(b.car.name).toBe(PACKARD_1936.name);
      expect(chartsHidden(s)).toBe(true); expect(chartsHidden(g)).toBe(true); expect(s.tags).not.toContain('charts:packard');
    }
  });
  it('PLAY-033 the perf card of a hidden car carries no stop, turn, ramp, start or timed number on any line, only the "you measure it" flag; Bronze keeps the numbers', () => {
    const d = drillById('D06')!;
    for (const seed of [1, 2]) for (const t of [1, 2]) {
      const sc = d.scenario(seed, t); const pol = instrumentPolicy(sc.aids);
      for (const ins of sc.book) { const c = perfCardFor(sc, ins.n, pol)!; if (c.restart) continue; expect(c.hiddenCar, `line ${ins.n}`).toBe(true); for (const k of ['stop', 'stopNoPause', 'timed', 'speedChange', 'turnLoss', 'start'] as const) expect(c[k], `${k} line ${ins.n}`).toBeUndefined(); }
    }
    const bronze = d.scenario(1, 0); const pol0 = instrumentPolicy(bronze.aids);
    const stops = bronze.book.filter(i => i.pause); expect(stops.length).toBeGreaterThan(0);
    for (const ins of stops) { const c = perfCardFor(bronze, ins.n, pol0)!; expect(c.hiddenCar).toBeUndefined(); expect(c.stop).toBeDefined(); }
    expect(bronze.book.some(i => i.turn && i.turn !== 'S' && perfCardFor(bronze, i.n, pol0)!.turnLoss)).toBe(true);
    expect(HIDDEN_CHARTS_TEXT).toMatch(/Silver and Gold hide the car's numbers/);
  });
  it('PLAY-033 no other drill hides its charts', () => {
    for (const d of allDrills()) { if (d.id === 'D06' || d.kind !== 'drive') continue; for (const t of [0, 1, 2]) expect(chartsHidden(d.scenario(1, t)), `${d.id} ${tierName[t]}`).toBe(false); }
  });
});

describe('PLAY-034 D06 MARK lines give positive cells when followed literally; the Debrief cure for a negative cell is to re-drive the pair; Bronze only copies', () => {
  const marks = (sc: Scenario, re: RegExp): string[] => sc.book.filter(i => re.test(i.text ?? '')).map(i => i.text ?? '');
  it('PLAY-034 Silver and Gold: every MARK out line says net = the reading at MARK out minus the reading at MARK in, with an example; stop & go says 15 s minus that net', () => {
    for (const t of [1, 2]) {
      const sc = drillById('D06')!.scenario(2, t); const outs = marks(sc, /^MARK \S+ out\b/);
      expect(outs.length).toBe(10);
      for (const m of outs) { if (/Accel 0 > \d+: you left ON the second/.test(m)) { expect(m).toMatch(/you left ON the second/); continue; } expect(m).toMatch(/Net = the pace-aid reading at MARK \w+ out minus the reading at MARK \w+ in \(example: \+9\.5 at out and \+3\.0 at in: net 6\.5\)/); }
      for (const m of marks(sc, /^MARK A\d out/)) expect(m).toMatch(/Chart pause time = 15 s minus that net \(15 - 6\.5 = 8\.5\), with the full 15 s sat at the stop/);
      for (const m of marks(sc, /^MARK \S+ out/)) expect(m).not.toMatch(/15 s minus your seconds late/);
    }
  });
  it('PLAY-034 Bronze MARK lines only say "copy the Packard cell": no "measure", "net" or pace-aid sentence', () => {
    const sc = drillById('D06')!.scenario(2, 0);
    for (const m of marks(sc, /^MARK /)) { expect(m).toMatch(/Packard/); expect(m).not.toMatch(/Measure|measure|\bnet\b|pace-aid|late against the ghost/); }
    expect(sc.book.find(i => i.section === 'restart')!.text).not.toMatch(/measuring run/);
    expect(drillById('D06')!.objectiveFor!(0)).not.toMatch(/measure/i); expect(drillById('D06')!.objectiveFor!(1)).toMatch(/Measure the car/); expect(MEASURE_COPY_TEXT).not.toMatch(/measure/i); expect(MEASURE_TEXT).toMatch(/pace-aid reading at MARK out minus the reading at MARK in/);
  });
  it('PLAY-034 following the lines literally (net = out minus in; stop & go = 15 - net) gives only positive cells and three stars on Silver and Gold', () => {
    const d = drillById('D06')!;
    for (const [seed, t] of [[1, 1], [2, 1], [1, 2]] as const) {
      const sc = d.scenario(seed, t); const first = runOracle(sc, { useWatch: true, ignoreLosses: true }).r;   // a measuring run: no lead, no early call, the full pause
      const notes: string[] = [];
      for (const p of chartPairs(sc.tags)) { const v = runMeasurement(first, sc, p); expect(v, `${p.kind} ${p.vIn}>${p.vOut}`).not.toBeNull(); expect(v!, `${p.kind} ${p.vIn}>${p.vOut} seed ${seed} tier ${t}`).toBeGreaterThan(0); notes.push(`${p.kind === 'stopGo' ? 'stopgo' : p.kind === 'stopMid' ? 'stopmid' : p.kind} ${p.vIn}>${p.vOut} = ${v!.toFixed(1)}`); }
      const sim = new Simulator(sc); for (const n of notes) sim.act({ type: 'note', text: n });
      const rb = d.rubric(runBot(sim, new OracleBot(sim, { useWatch: true, ignoreLosses: true })), sc); expect(rb.stars, `seed ${seed} tier ${t}: ${rb.feedback.join(' | ')}`).toBe(3);
    }
  });
  it('PLAY-034 a negative cell tells him to re-drive the pair and subtract the reading at MARK in (not "delete it or re-run")', () => {
    const d = drillById('D06')!; const sc = d.scenario(1, 1); const p = chartPairs(sc.tags).find(q => q.kind === 'stopGo')!;
    const sim = new Simulator(sc); sim.act({ type: 'note', text: `stopgo ${p.vIn}>${p.vOut} = -2.1` });
    const rb = d.rubric(runBot(sim, new OracleBot(sim, { useWatch: true })), sc); const fb = rb.feedback.join(' ');
    expect(fb).toMatch(/-2\.1 s is a negative cell\. Re-drive this pair \(retry the seed: your notes are kept\) and take net = the pace-aid reading at MARK out minus the reading at MARK in/);
    expect(fb).not.toMatch(/delete it or re-run/); expect(rb.tip).toMatch(/first to fix: .*negative cell/);
  });
  it('PLAY-034 the pre-read of a measuring run has ONE launch statement (ON your second, no lead); the generic "launch your standing-start loss early" is for other drills', () => {
    const src = readFileSync('src/ui/screens/cockpit.ts', 'utf8');
    expect(src).toMatch(/\$\{measureRun \? 'launch ON your second\.' : 'launch your standing-start loss early\.'\}/);
    expect(src).toMatch(/Copy mode: leave ON your second \(no launch lead\)/); expect(src).toMatch(/A measuring run: leave ON your second \(no launch lead\)/);
    for (const t of [0, 1, 2]) expect(isMeasureRun(drillById('D06')!.scenario(1, t))).toBe(true);
  });
});

describe('PLAY-035 the D09 red-light card says a red light is not a Time Allowance by default (REG V.H.1)', () => {
  it('PLAY-035 speed-at-signal: the tip and the right answer teach the 10 % rule; only a train or an accident scene qualifies; no card says a red light IS a Time Allowance', () => {
    const t = TRAPS.find(x => x.id === 'speed-at-signal')!; const q = TRAP_QUIZ['speed-at-signal']!;
    expect(t.tip).toMatch(/A red light is not a Time Allowance by default: make it up with the 10 % rule; only a train or an accident scene qualifies \(REG V\.H\.1\)/);
    expect(q.right).toMatch(/make up a red with the 10 % rule/); expect(q.right).not.toMatch(/Time Allowance/); expect(q.wrong.join(' | ')).toMatch(/File a Time Allowance for any red light/);
    for (const c of TRAPS) expect(`${c.tip} ${TRAP_QUIZ[c.id]?.right ?? ''}`, c.id).not.toMatch(/red light is a Time Allowance/i);
  });
});

describe('PLAY-036 no answer tells: D09 options balanced in length, lesson check options shuffled with the answer tracked', () => {
  it('PLAY-036 every D09 card has four options within 1.4x the length of the shortest, and the right one is the longest on at most half of the cards', () => {
    let longest = 0;
    for (const t of TRAPS) { const q = TRAP_QUIZ[t.id]!; const L = [q.right, ...q.wrong].map(x => x.length); expect(Math.max(...L) / Math.min(...L), `${t.id}: ${L.join(',')}`).toBeLessThanOrEqual(1.4); if (q.right.length === Math.max(...L)) longest++; }
    expect(longest).toBeLessThanOrEqual(Math.floor(TRAPS.length / 2));
    // and in the dealt decks: a test-wise "pick the longest" scores about the chance rate, not 19/20
    let hits = 0, n = 0; for (const seed of [1, 7, 42, 123, 500]) for (const c of trapCards(seed)) { const L = c.options.map(o => o.length); if (c.options[c.answer]!.length === Math.max(...L)) hits++; n++; }
    expect(hits / n).toBeLessThan(0.5);
    for (const seed of [1, 7, 42]) for (const c of trapCards(seed)) { const L = c.options.map(o => o.length); expect(Math.max(...L) / Math.min(...L)).toBeLessThanOrEqual(1.4); }
  });
  it('PLAY-036 a lesson check is shuffled per render and options[answer] is always the lesson\'s right option', () => {
    const positions = new Map<string, Set<number>>();
    for (const l of LESSONS) {
      const right = l.check.options[l.check.answer]!; const seen = new Set<number>();
      for (let seed = 1; seed <= 60; seed++) { const s = shuffleCheck(l.check, seed); expect([...s.options].sort()).toEqual([...l.check.options].sort()); expect(s.options[s.answer], `${l.id} seed ${seed}`).toBe(right); seen.add(s.answer); }
      positions.set(l.id, seen); expect(seen.size, l.id).toBeGreaterThanOrEqual(l.check.options.length - 1);   // the right option lands in (nearly) every position
      expect(shuffleCheck(l.check, 5)).toEqual(shuffleCheck(l.check, 5));   // seeded: one render is stable
    }
    // the old unshuffled pattern (the answer was option 2 on 10 of 12) is gone: across seeds no position holds the answer on more than 45 % of the draws for any lesson
    for (const l of LESSONS) { let at = 0; for (let seed = 1; seed <= 200; seed++) if (shuffleCheck(l.check, seed).answer === 1) at++; expect(at / 200, l.id).toBeLessThan(0.45); }
    expect(readFileSync('src/ui/screens/school.ts', 'utf8')).toMatch(/shuffleCheck\(lesson\.check, Math\.floor\(Math\.random\(\)/);
  });
});

describe('PLAY-037 turning stops are on the simple chart, in the lesson, and in the "go earlier" tip', () => {
  it('PLAY-037 the simple chart of a model car has a TS/G column = a stop and go through a 90 degree turn (more than S/G); the Packard (a table car) has none', () => {
    const c = simpleChart(FORD_1939);
    expect(c.hasTS).toBe(true); expect(c.columns).toContain('TS/G');
    for (const r of c.rows) { expect(r.tsg).not.toBeNull(); expect(r.tsg!).toBeCloseTo(Math.round(stopLoss(r.speed, r.speed, FORD_1939, FORD_1939.turnSpeedMph.turn) * 10) / 10, 9); expect(r.tsg!).toBeGreaterThanOrEqual(r.sg - 1e-9); expect(r.text['TS/G']).not.toBe(''); if (r.speed >= 25) expect(r.tsg!).toBeGreaterThan(r.sg + 0.3); expect(r.tsg!).toBeCloseTo(chartStopLoss(FORD_1939, r.speed, r.speed, FORD_1939.turnSpeedMph.turn), 9); }
    const p = simpleChart(PACKARD_1936); expect(p.hasTS).toBe(false); expect(p.columns).not.toContain('TS/G'); expect(p.rows[0]!.tsg).toBeNull();
  });
  it('PLAY-037 the pause-arithmetic lesson explains the turning stop in two sentences with the car\'s numbers and the Dec / Acc arithmetic', () => {
    const l = LESSONS.find(x => x.id === 'pause-arithmetic')!; const paras = l.body.filter((b): b is string => typeof b === 'string');
    const para = paras.find(x => /^A stop that turns is not a straight stop/.test(x))!; expect(para).toBeDefined();
    expect(para.split(/(?<=[.)])\s+(?=[A-Z])/).length).toBe(2);
    expect(para).toMatch(/TS\/G column of the simple chart is the stop and go through a 90 degree turn/); expect(para).toMatch(/the turn adds \d+\.\d s, and you go \d+\.\d s earlier than the straight-stop dwell/);
    expect(lessonText(l)).toMatch(/dwell = pause - Dec\(IN\) - Acc\(OUT\)/);
  });
  it('PLAY-037 the "go earlier" tip on a turning stop that ran long says the turn adds N s (and names the column); a straight stop gets no turn sentence', () => {
    const mk = (turn: 'L' | 'S'): Scenario => new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT, seed: 4, aids: aidsForRung(0) }).start(35).advanceMiles(0.5).stop(turn, 35, { pause: 15 }).advanceMiles(0.9).checkpoint().advanceFt(300).finish().build();
    for (const turn of ['L', 'S'] as const) {
      const sc = mk(turn); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true, useWatch: true }));   // sits the whole 15 s: a long dwell
      const tip = headlineTip(r, sc); expect(tip).toMatch(/go earlier/);
      if (turn === 'L') { expect(turningStopExtras(r, sc).length).toBe(1); expect(tip).toMatch(/Line \d+ is a stop that turns: the turn adds \d+\.\d s to the stop and go/); expect(tip).toMatch(/turning-stop column/); const extra = turningStopExtras(r, sc)[0]!.extra; expect(extra).toBeGreaterThan(0.5); expect(tip).toContain(`the turn adds ${extra.toFixed(1)} s`); }
      else { expect(turningStopExtras(r, sc)).toEqual([]); expect(tip).not.toMatch(/the turn adds/); }
    }
    expect(turningStopExtras({ attribution: [{ stops: [{ pause: 15, actualCost: 9, trafficWait: 0, turn: 'L', vIn: 35, vOut: 35, line: 2 }] }] } as unknown as StageResult, { car: PACKARD_1936 } as Scenario)).toEqual([]);   // a table car prints no turning stops
  });
});

describe('ENG-026 N-B14: a turn called in time is kept for its own intersection; the prompt waits for the distractor; the T check-off says what he did', () => {
  const human = (sc: Scenario, lead: number): { sim: Simulator; r: StageResult } => {
    const called = new Set<number>();
    return runOracle(sc, { useWatch: true }, { hook: s => { for (const ins of sc.book) if (ins.turn && ins.turn !== 'S' && !called.has(ins.n)) { const n = sc.course.nodes.find(x => x.id === ins.nodeId)!; const d = n.s - s.car.s; if (d <= lead && d > 0) { called.add(ins.n); s.act({ type: 'call.turn', dir: ins.turn }); } } } });
  };
  it('ENG-026 D10 seeds 1-10 at Bronze and Silver: a left called 520 ft or 900 ft out is never spent on the side road: no "too late", no "you did not call a turn", no wrong turn, and the T check-off says "the left at the T"', () => {
    const d = drillById('D10')!; let tChecks = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) for (const t of [0, 1]) for (const lead of [520, 900]) {
      const sc = d.scenario(seed, t); const { sim, r } = human(sc, lead); const msgs = sim.driverMsgs.map(m => m.text);
      expect(msgs.filter(m => /Too late|you did not call a turn/.test(m)), `seed ${seed} ${tierName[t]} lead ${lead}`).toEqual([]);
      expect(r.offCourseCount, `seed ${seed} ${tierName[t]}`).toBe(0); expect(sim.events.some(e => e.type === 'turnMissed')).toBe(false);
      const tStops = sc.book.filter(i => { const n = sc.course.nodes.find(x => x.id === i.nodeId)!; return i.turn === 'L' && i.pause && n.control === 'STOP' && !(n.exits ?? []).some(e => Math.abs(e.angle) < 20 && e.kind === 'road'); });
      for (const ins of tStops) expect(msgs.some(m => m === `Did the left at the T, line ${ins.n}`), `seed ${seed} line ${ins.n}: ${msgs.filter(m => /^Did /.test(m)).join(' / ')}`).toBe(true);
      tChecks += tStops.length;
    }
    expect(tChecks).toBeGreaterThanOrEqual(20);
  });
  it('ENG-026 the Bronze "call the left" prompt comes after the distractor side road (unless the turn is within 350 ft), and an exact call still works at a plain turn', () => {
    const d = drillById('D10')!; let checked = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const sc = d.scenario(seed, 0); const { sim } = human(sc, 520);
      for (const e of sim.events.filter(x => x.type === 'nextCall' && /^call\.turn/.test(String(x.detail?.call)))) {
        const ins = sc.book[Number(e.detail!.line) - 1]!; const target = sc.course.nodes.find(n => n.id === ins.nodeId)!; if (target.s - e.s <= 350) continue;
        const band = ins.turn === 'L' ? [-120, -60] : ins.turn === 'R' ? [60, 120] : null; if (!band) continue;
        const side = sc.course.nodes.filter(n => n.s > e.s && n.s < target.s && !sc.book.some(i => i.nodeId === n.id && i.turn !== undefined) && (n.exits ?? []).some(x => !x.isRoute && x.kind !== 'driveway' && x.kind !== 'lot' && x.kind !== 'private' && x.angle >= band[0]! && x.angle <= band[1]!));
        expect(side.map(n => n.id), `seed ${seed} line ${ins.n} prompted at ${Math.round(e.s)} ft`).toEqual([]); checked++;
      }
    }
    expect(checked).toBeGreaterThan(3);
    // an ordinary turn (no side road in between) is made as before, and a call for the wrong direction is still a wrong turn
    const sc = new ScenarioBuilder({ startTime: T0, driver: DRIVER_EXPERT }).start(35).advanceMiles(0.4).instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 500 }, { turn: 'R', speed: 35 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const { sim, r } = runOracle(sc, { useWatch: true }); expect(r.offCourseCount).toBe(0); expect(sim.driverMsgs.some(m => /^Did the turn, line 2/.test(m.text))).toBe(true);
  });
});

describe('PLAY-038 a finished Start-here path still leads on (D18 at Silver, D07 at Silver, D11); D18\'s Debrief never offers a locked drill', () => {
  const ds = allDrills(); const lessonsAll = (): boolean => true;
  const pathDone = (extra: Record<string, number[]> = {}): Prog => { const drills: Prog['drills'] = {}; for (const s of START_PATH) if (s.kind === 'drill') drills[s.id] = { stars: 2, tierStars: s.id === 'D09' ? [2] : [2, 2, 0] }; Object.assign(drills, Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, { stars: Math.max(...v), tierStars: v }]))); return { drills }; };
  it('PLAY-038 Next offers "Replay D18 at Silver (D11 needs D18 ★ ...)", then "Replay D07 at Silver", then D11, then nothing', () => {
    const next = (prog: Prog) => pathNext(startPathFromProgress(ds, prog, lessonsAll), ds, Object.fromEntries(Object.entries(prog.drills).map(([id, p]) => [id, Math.max(p.tierStars?.[1] ?? 0, p.tierStars?.[2] ?? 0)])), lessonsAll, lessonTitleOf, Object.fromEntries(Object.entries(prog.drills).map(([id, p]) => [id, p.stars])));
    const a = next(pathDone({ D18: [1, 0, 0], D07: [2, 0, 0] }))!;
    expect(a.kind).toBe('replay'); expect(a.label).toMatch(/^Replay D18 at Silver \(D11 needs D18 ★ at Silver or Gold\)$/); expect(a.kind === 'replay' && a.hash).toBe('#/cockpit/drill/D18/1/1');
    const b = next(pathDone({ D18: [1, 1, 0], D07: [2, 0, 0] }))!;
    expect(b.kind).toBe('replay'); expect(b.label).toMatch(/^Replay D07 at Silver \(D11 needs D07 ★★ at Silver or Gold\)$/); expect(b.kind === 'replay' && b.hash).toBe('#/cockpit/drill/D07/1/1');
    const c = next(pathDone({ D18: [1, 1, 0], D07: [2, 2, 0] }))!;
    expect(c.kind).toBe('step'); expect(c.kind === 'step' && c.step.id).toBe('D11'); expect(c.kind !== 'blocked' && c.hash).toBe('#/cockpit/drill/D11/0/1');
    expect(next(pathDone({ D18: [1, 1, 0], D07: [2, 2, 0], D11: [1, 0, 0] }))).toBeNull();   // D11 played: the path is complete
  });
  it('PLAY-038 D18\'s Debrief: Next is the path\'s replay while the path leads on; across many progress states a Debrief never offers a locked drill', () => {
    const lessonsOnly = (ids: string[]) => (id: string) => ids.includes(id);
    const nx = debriefNext('D18', ds, pathDone({ D18: [1, 0, 0], D07: [2, 0, 0] }), lessonsAll);
    expect(nx.path?.label).toMatch(/^Replay D18 at Silver/); expect(nx.drill).toBeNull(); expect(nx.blocked).toBeNull();
    const states: Prog[] = [{ drills: {} }, pathDone(), pathDone({ D18: [1, 1, 0], D07: [2, 2, 0] }), pathDone({ D18: [3, 3, 3], D07: [3, 3, 3], D11: [3, 3, 3] }), { drills: { D16: { stars: 3, tierStars: [3, 0, 0] } } }];
    for (const prog of states) for (const done of [lessonsAll, lessonsOnly([]), lessonsOnly(['four-s', 'transits'])]) for (const d of ds) {
      if (d.kind !== 'drive') continue;
      const n = debriefNext(d.id, ds, prog, done);
      if (n.drill) { const best = Object.fromEntries(Object.entries(prog.drills).map(([id, p]) => [id, Math.max(p.tierStars?.[1] ?? 0, p.tierStars?.[2] ?? 0)])); expect(d.id && n.drill.unlock.filter(u => (best[u.drill] ?? 0) < u.stars), `${d.id} -> ${n.drill.id}`).toEqual([]); expect((n.drill.lessonGate ?? []).filter(l => !done(l))).toEqual([]); }
    }
    const src = readFileSync('src/ui/screens/debrief.ts', 'utf8'); expect(src).not.toMatch(/🔒 Next drill/); expect(src).toMatch(/debriefNext\(/);
  });
});

describe('PLAY-039 Silver replays are a real step: the card prints no dwell and no call times at Silver; Bronze keeps them', () => {
  it('PLAY-039 the policy prints times at Bronze only (rung 3, or a rung-2 Bronze: D16, D18, D11); D03, D04, D05 and D08 at Silver withhold them', () => {
    expect(instrumentPolicy(aidsForRung(3)).printsTimes).toBe(true); expect(instrumentPolicy(aidsForRung(2)).printsTimes).toBe(false); expect(instrumentPolicy(aidsForRung(1)).printsTimes).toBe(false);
    for (const id of ['D16', 'D18', 'D11']) { const d = drillById(id)!; expect(instrumentPolicy(d.scenario(1, 0).aids).printsTimes, `${id} Bronze`).toBe(true); expect(instrumentPolicy(d.scenario(1, 1).aids).printsTimes, `${id} Silver`).toBe(false); }
    for (const id of ['D03', 'D04', 'D05', 'D08']) { const d = drillById(id)!; expect(instrumentPolicy(d.scenario(1, 0).aids).printsTimes, `${id} Bronze`).toBe(true); expect(instrumentPolicy(d.scenario(1, 1).aids).printsTimes, `${id} Silver`).toBe(false); }
  });
  it('PLAY-039 the Silver card flags every stop / timed / speed-change line as withheld (the arithmetic is the player\'s); the Bronze card is unchanged', () => {
    let stops = 0, timed = 0;
    for (const id of ['D03', 'D04', 'D05', 'D08']) for (const seed of [1, 2]) {
      const bz = drillById(id)!.scenario(seed, 0), sv = drillById(id)!.scenario(seed, 1);
      for (const ins of sv.book) { const cs = perfCardFor(sv, ins.n, instrumentPolicy(sv.aids))!; const cb = perfCardFor(bz, ins.n, instrumentPolicy(bz.aids));
        if (cs.mode === 'answers') expect(cs.withheld, `${id} Silver line ${ins.n}`).toBe(true); if (cb) expect(cb.withheld, `${id} Bronze line ${ins.n}`).toBeUndefined();
        if (cs.stop) stops++; if (cs.timed) timed++; }
    }
    expect(stops).toBeGreaterThan(3); expect(timed).toBeGreaterThan(2);
    const src = readFileSync('src/ui/screens/cockpit.ts', 'utf8'); expect(src).toMatch(/work the dwell out from the simple chart \(pause - Dec at/); expect(src).toMatch(/call \$\{card\.timed\.then\} at \$\{card\.timed\.seconds\} s minus the ramp lead/); expect(src).toMatch(/showTimes/);
  });
});

describe('PLAY-040 lighter evening one: the TA procedure leaves lesson 1, long lessons are two pages, D16 runs at 8x with the 45 s stop before the launch', () => {
  const bodyWords = (b: LessonBlock): number => (typeof b === 'string' ? b : 'heading' in b ? b.heading : 'list' in b ? b.list.join(' ') : 'pre' in b ? b.pre.join(' ') : 'table' in b ? [...b.table.head, ...b.table.rows.flat()].join(' ') : [b.card.title, ...b.card.lines].join(' ')).split(/\s+/).length;
  it('PLAY-040 lesson 1 keeps a one-line pointer; the TA list lives in the recovery lesson (qualifies, never, multiples of 10 s, the method, the pattern)', () => {
    const f = lessonText(LESSONS.find(l => l.id === 'four-s')!); const r = lessonText(LESSONS.find(l => l.id === 'recovery')!);
    expect(f).toMatch(/Time allowances \(TA\): only a train blocking the route or an accident scene qualifies \(REG V\.H\.1\), never a red light or a wrong turn/);
    for (const p of ['What qualifies', 'What never does', 'multiples of 10 s', 'Delayed 0m45s by a farm tractor']) { expect(f, p).not.toContain(p); expect(r, p).toContain(p); }
    expect(f.split('\n').filter(x => /Time allowance|TA\b/.test(x) && !/^docs/.test(x)).length).toBeLessThanOrEqual(3);
    expect(LESSONS.find(l => l.id === 'four-s')!.body.reduce((a, b) => a + bodyWords(b), 0)).toBeLessThan(800);
  });
  it('PLAY-040 a lesson over 1,200 words is read as two pages, each at most about 1,250 words; the screen renders page 1, a Next page button and the check after page 2', () => {
    for (const l of LESSONS) {
      const total = l.body.reduce((a, b) => a + bodyWords(b), 0);
      if (total <= 1200) { expect(l.splitAt, l.id).toBeUndefined(); continue; }
      expect(l.splitAt, l.id).toBeGreaterThan(0); expect(l.splitAt!).toBeLessThan(l.body.length);
      const p1 = l.body.slice(0, l.splitAt).reduce((a, b) => a + bodyWords(b), 0), p2 = total - p1; expect(p1, `${l.id} page 1`).toBeLessThanOrEqual(1250); expect(p2, `${l.id} page 2`).toBeLessThanOrEqual(1250);
    }
    expect(['four-s', 'transits', 'protocol', 'recovery', 'rally-school'].filter(id => LESSONS.find(l => l.id === id)!.splitAt !== undefined)).toEqual(['transits', 'protocol', 'recovery', 'rally-school']);
    const src = readFileSync('src/ui/screens/school.ts', 'utf8'); expect(src).toMatch(/lesson-next-page/); expect(src).toMatch(/Page 1 of 2/); expect(src).toMatch(/rest\.append\(quiz\)/);
  });
  it('PLAY-040 D16 starts at 8x (its own default; other drills keep the setting, D01 / D03 stay at 1x) and a hold fast-forward stops 45 s before the launch, the same 45 s as the pre-read', () => {
    expect(defaultScaleFor('D16', 4)).toBe(8); expect(defaultScaleFor('D16', 1)).toBe(8); expect(defaultScaleFor('D08', 4)).toBe(4); expect(defaultScaleFor(null, undefined)).toBe(1); expect(defaultScaleFor('D01', 4, true)).toBe(1);
    expect(HOLD_FF_MARGIN_S).toBe(45); expect(HOLD_FF_MARGIN_S).toBe(FULL_START_FF_LEAD);
    const base = { requested: 8, paused: false, phase: 'running', carStopped: true, waitingForGo: true, nearestFeatureFt: null, hazardActive: false, countdownSeconds: null, bezelRemaining: null };
    expect(effectiveScale({ ...base, holdSecondsLeft: 600 })).toBe(8); expect(effectiveScale({ ...base, holdSecondsLeft: 46 })).toBe(8); expect(effectiveScale({ ...base, holdSecondsLeft: 44 })).toBe(1);
    expect(cardMinutesText(drillById('D16')!)).toMatch(/at 8x$/); expect(cardMinutesText(drillById('D08')!)).toMatch(/at 4x$/);
  });
});

describe('PLAY-041 text hygiene: D10, residual lines, lock chips, D03 keys, the pre-read button, the driver\'s name, Dad\'s card', () => {
  it('PLAY-041 D10 never advises the 10 % rule before its lesson: the rubric, the Debrief tips and the feedback on a slow on-course leg', () => {
    const d = drillById('D10')!; let slow = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const t of [0, 1, 2]) {
      const sc = d.scenario(seed, t); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { useWatch: true, noRecovery: true, ignoreLosses: true }));
      const rb = d.rubric(r, sc); expect([rb.tip, ...rb.feedback].join(' | '), `seed ${seed} ${tierName[t]}`).not.toMatch(/10 ?%/);
      const vm = debriefViewModel(r, sc); expect(vm.tips.join(' | '), `vm seed ${seed} ${tierName[t]}`).not.toMatch(/10 ?%/);
      if (/time is secondary here/.test(rb.tip ?? '')) slow++;
    }
    expect(slow).toBeGreaterThan(0);
  });
  it('PLAY-041 no "rounding residual" line on a leg within 1 s (and none under 1.5 s of residual)', () => {
    expect(showResidualLine({ error: 0, residual: -4 })).toBe(false); expect(showResidualLine({ error: -0.8, residual: 5 })).toBe(false);
    expect(showResidualLine({ error: 3, residual: -4 })).toBe(true); expect(showResidualLine({ error: null, residual: 0 })).toBe(false); expect(showResidualLine({ error: 6, residual: 1 })).toBe(false); expect(showResidualLine({ error: null, residual: 3 })).toBe(true);
  });
  it('PLAY-041 the lock chip names the lesson by its title, never its id; the start path\'s D10 chip reads the title', () => {
    expect(lockText([], ['lost'])).toBe('pass the lesson "When you are lost"'); expect(lessonTitleOf('lost')).toBe('When you are lost');
    const d10 = allDrills().filter(d => d.id === 'D10');
    const st = startPathState({}, () => false, { drills: d10.map(d => ({ id: d.id, unlock: d.unlock, lessonGate: d.lessonGate })), best: {} }).find(s => s.step.id === 'D10')!;
    expect(st.locked).toBe(true); expect(st.needs).toContain('pass the lesson "When you are lost"'); expect(st.needs).not.toContain('"lost"');
  });
  it('PLAY-041 the D03 keys say "digital watch: lap L" (the digital watch is the default), the bezel keys stay for the analog watch only', () => {
    const dig = drillHint('D03'); expect(dig.keys.map(k => k.join(' ')).join(' | ')).toMatch(/digital watch: lap L/); expect(JSON.stringify(dig)).not.toMatch(/bezel/);
    const an = drillHint('D03', 'analog'); expect(JSON.stringify(an)).toMatch(/bezel/); expect(JSON.stringify(drillHint('D04'))).not.toMatch(/bezel/);
  });
  it('PLAY-041 the status line names the driver "Dad" for every tier of every drill (no "Pro")', () => {
    for (const d of allDrills()) { if (d.kind !== 'drive') continue; for (const t of [0, 1, 2]) expect(d.scenario(1, t).driver.name, `${d.id} ${tierName[t]}`).toBe('Dad'); }
    expect(readFileSync('src/ui/screens/cockpit.ts', 'utf8')).toMatch(/\$\{scenario\.driver\.name\} \(\$\{scenario\.driver\.skill\}\)/);
  });
  it('PLAY-041 Dad\'s card: 0.6 in page margins, 13 pt, 21 lines under 25 words; lines 8, 11, 17 and 20 are plain', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8'); expect(css).toMatch(/@page \{ margin: 0\.6in; \}/); expect(css).toMatch(/#print-root \.printcard ol \{ font-size: 13pt;/);
    const card = LESSONS.find(l => l.id === 'protocol')!.body.find((b): b is { card: { title: string; lines: string[] } } => typeof b === 'object' && 'card' in b)!.card.lines;
    expect(card.length).toBe(21); for (const l of card) expect(l.trim().split(/\s+/).length, l).toBeLessThan(25);
    expect(card[7]).toBe('Do not move until the navigator says GO. If traffic blocks the car, say "keep counting" and the navigator counts on.'); expect(card[7]).not.toMatch(/0, 1, 2/);
    expect(card[10]).toBe('Green sign = timing checkpoint: just drive on. Never stop or slow to 5 mph or less in sight of it: 30 second penalty.'); expect(card[10]).not.toMatch(/\(30 s\)/);
    expect(card[16]).toBe('A Day-Glo "GR" sign overrides the book. A sign marked "I" means ignore it. "End Leg" means the leg is cancelled; drive on.'); expect(card[16]).not.toMatch(/"I" = ignore that sign/);
    expect(card[19]).toBe('Phones off and out of reach from start to finish. The first use gets a warning, the next 10 seconds, then 1 minute.'); expect(card[19]).not.toMatch(/warning, then 10 s, then 1 min/);
  });
  it('PLAY-041 the folded pre-read strip sits below the toolbar and its button cannot overlap the title (CSS)', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8'); expect(css).toMatch(/\.preread\.collapsed \.preread-top \{[^}]*flex-wrap: nowrap/); expect(css).toMatch(/\.preread\.collapsed \.preread-top h2 \{[^}]*text-overflow: ellipsis/);
  });
});

void lineSpeeds;
