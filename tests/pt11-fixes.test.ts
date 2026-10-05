// Fix sprint PT-11 / realism v4 (2026-10-04): docs/playtest/PT-11-playability-v3-3.md (N-D1..N-D12, top-10) and docs/playtest/REVALIDATION-v4-realism.md
// (sections 3 and 5). One describe per spec id (PLAY-042..PLAY-048, ENG-027..ENG-028, GEN-015..GEN-017 in docs/spec/SPECS.md).
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type StageResult } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { runOracle } from './drill-helpers.js';
import { FORD_1939, type Scenario } from '../src/core/course.js';
import { buildPerfTable, matrixAt, stopLoss, chartLead, rampLead, speedChangeLoss } from '../src/core/perf-table.js';
import { chartPairs } from '../src/core/drills/d06.js';
import { d06Car } from '../src/core/drills/common.js';
import { perfCardFor, instrumentPolicy } from '../src/ui/viewmodels/cockpitinfo.js';
import { simpleChart, leadSource, LEAD_NOTE } from '../src/ui/viewmodels/charts.js';
import { callErrors, longDwells, headlineTip } from '../src/core/drills/rubrics.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';
import { readFileSync } from 'node:fs';

const play = (sc: Scenario, o: ConstructorParameters<typeof OracleBot>[1] = { useWatch: true }, hook?: (s: Simulator) => void): StageResult => { const sim = new Simulator(sc); const bot = new OracleBot(sim, o); let t = 0; while (sim.phase !== 'finished' && t < 12 * 3600) { bot.onTick(); hook?.(sim); sim.step(0.1); t += 0.1; } return sim.result(); };

describe('PLAY-042 N-D1: the Silver card gives a real ramp lead: the simple chart\'s Lead column, graded on the same number', () => {
  it('PLAY-042 the simple chart has a Lead column: half the ramp time from the car model, row = the speed you are at, up and down 10 mph (30 to 40 about 2.3 s)', () => {
    const c = simpleChart(FORD_1939); expect(c.columns).toContain('Lead');
    const r30 = c.rows.find(r => r.speed === 30)!; expect(r30.leadUp).toBe(chartLead(30, 40, FORD_1939)); expect(r30.leadUp!).toBeGreaterThan(2); expect(r30.leadUp!).toBeLessThan(2.7);
    expect(r30.leadDown).toBe(chartLead(30, 20, FORD_1939)); expect(r30.text.Lead).toBe(`↑${r30.leadUp!.toFixed(1)} ↓${r30.leadDown!.toFixed(1)}`);
    for (const r of c.rows) { if (r.leadUp !== null) expect(r.leadUp).toBeCloseTo(rampLead(r.speed, r.speed + 10, FORD_1939), 1); if (r.leadDown !== null) expect(r.leadDown).toBeCloseTo(rampLead(r.speed, r.speed - 10, FORD_1939), 1); }
    // never the chart (a) net loss (30 > 40 is about 0.5 s): that is what sent the PT-11 Josh 2 s late
    expect(Math.abs(r30.leadUp! - speedChangeLoss(30, 40, FORD_1939))).toBeGreaterThan(1);
    expect(LEAD_NOTE).toMatch(/row 30, ↑/); expect(leadSource(30, 40)).toBe('simple chart, Lead column, row 30, ↑'); expect(leadSource(40, 30)).toBe('simple chart, Lead column, row 40, ↓');
  });
  it('PLAY-042 the Silver card points at the Lead column (never chart (a)) and the D04 / D05 Debrief tips name the number; the D05 rubric no longer says the lead is on the card at Silver', () => {
    const src = readFileSync('src/ui/screens/cockpit.ts', 'utf8');
    expect(src).not.toMatch(/ramp lead \(chart \(a\)/); expect(src).not.toMatch(/the chart \(a\) loss for that pair/); expect(src).toMatch(/leadSource\(card\.timed\.hold, card\.timed\.then\)/); expect(src).toMatch(/leadSource\(card\.speedChange\.from, card\.speedChange\.to\)/);
    const d5 = drillById('D05')!; const sc = d5.scenario(1, 1); const r = play(sc, { ignoreLosses: true }); const rb = d5.rubric(r, sc);
    expect(rb.feedback.join(' ')).not.toMatch(/it is on your performance card/); expect(rb.tip).toMatch(/Lead column: row \d+, [↑↓] = \d+\.\d s for \d+ → \d+/);
    const d4 = drillById('D04')!; const s4 = d4.scenario(2, 1); const r4 = play(s4, { ignoreLosses: true, useWatch: true }); expect(d4.rubric(r4, s4).feedback.join(' ')).toMatch(/Lead column: row \d+, [↑↓] = \d+\.\d s/);
    // Bronze and Silver D05 change by 10 mph, the pairs the column prints; the Silver card carries the pair
    for (const seed of [1, 2, 3]) for (const t of [0, 1]) { const s = d5.scenario(seed, t); let v: number | undefined; for (const ins of s.book) { if (ins.speed !== undefined && v !== undefined && ins.section !== 'start' && !ins.pause) expect(Math.abs(ins.speed - v)).toBe(10); v = ins.speed ?? v; } }
  });
  it('PLAY-042 the D04 / D05 grading uses the column figure: a card follower who calls on the Lead column gets three stars on seeds 1-5 at Silver', () => {
    for (const id of ['D04', 'D05']) { const d = drillById(id)!; const stars: number[] = [];
      for (let seed = 1; seed <= 5; seed++) { const sc = d.scenario(seed, 1); expect(instrumentPolicy(sc.aids).printsTimes).toBe(false);
        for (const ins of sc.book) { const c = perfCardFor(sc, ins.n, instrumentPolicy(sc.aids)); if (c?.timed) expect(c.timed.lead).toBe(chartLead(c.timed.hold, c.timed.then, sc.car)); if (c?.speedChange) expect(c.speedChange.lead).toBe(chartLead(c.speedChange.from, c.speedChange.to, sc.car)); }
        const { r } = runOracle(sc, { useWatch: true, chartLeads: true }); stars.push(d.rubric(r, sc).stars);
        for (const e of callErrors(r, sc, id === 'D04' ? 'timed' : 'landmark')) expect(Math.abs(e), `${id} seed ${seed}`).toBeLessThan(1.3); }
      expect(stars.join(''), id).toBe('33333'); }
  });
});

describe('PLAY-043 N-D2: D06 Silver and Gold need a measurement', () => {
  const name = (k: string): string => k === 'stopGo' ? 'stopgo' : k === 'stopMid' ? 'stopmid' : k;
  const fordCell = (p: { kind: string; vIn: number; vOut: number }): number => { const t = buildPerfTable(FORD_1939); return p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, FORD_1939) : matrixAt(p.kind === 'stopGo' ? t.stopGo : p.kind === 'accel' ? t.accel : t.turns, p.vIn, p.vOut); };
  it('PLAY-043 the hidden car differs from the stock Ford by 15 % or more in at least half the cells, and copying the Ford chart earns one star at most (Silver and Gold, seeds 1-6)', () => {
    const d = drillById('D06')!;
    for (const t of [1, 2]) for (let seed = 1; seed <= 6; seed++) {
      const sc = d.scenario(seed, t); const pairs = chartPairs(sc.tags); const perf = buildPerfTable(sc.car);
      const own = (p: typeof pairs[number]): number => p.kind === 'stopMid' ? stopLoss(p.vIn, p.vOut, sc.car) : matrixAt(p.kind === 'stopGo' ? perf.stopGo : p.kind === 'accel' ? perf.accel : perf.turns, p.vIn, p.vOut);
      const differ = pairs.filter(p => Math.abs(own(p) - fordCell(p)) >= 0.15 * Math.max(Math.abs(fordCell(p)), 0.1)).length; expect(differ, `${sc.id}`).toBeGreaterThanOrEqual(pairs.length / 2);
      const notes = pairs.map(p => `${name(p.kind)} ${p.vIn}>${p.vOut} = ${fordCell(p).toFixed(1)}`);
      let done = false; const r = play(sc, { ignoreLosses: true }, s => { if (done) return; done = true; for (const n of notes) s.act({ type: 'note', text: n }); });
      expect(d.rubric(r, sc).stars, `${sc.id} copied the Ford`).toBeLessThanOrEqual(1);
    }
  });
  it('PLAY-043 a run with no notes prints "not measured", never the answer cell; Bronze (copy mode) only says where the printed cell is', () => {
    const d = drillById('D06')!; const sc = d.scenario(1, 1); const rb = d.rubric(play(sc), sc); const lines = rb.feedback.filter(f => /^(stop & go|accel\/decel|turn|stop in the middle) \d+>\d+:/.test(f));
    expect(lines.length).toBe(10); for (const l of lines) { expect(l).toMatch(/not measured/); expect(l).not.toMatch(/chart \d+\.\d s/); expect(l).not.toMatch(/\d+\.\d/); }
    const b = d.scenario(1, 0); const lb = d.rubric(play(b), b).feedback.filter(f => /^(stop & go|accel\/decel|turn|stop in the middle) \d+>\d+:/.test(f)); for (const l of lb) expect(l).toMatch(/Packard chart/);
  });
  it('PLAY-043 a retry on the same seed is a new attempt and a new hidden car (Debrief "Retry" draws it, the hash carries it, the replay rebuilds it); Bronze and other drills retry the same run', async () => {
    const d = drillById('D06')!; const a0 = d.scenario(3, 1, 0), a1 = d.scenario(3, 1, 1), a1b = d.scenario(3, 1, 1);
    expect(a1.car.a0).not.toBeCloseTo(a0.car.a0, 3); expect(a1b.car.a0).toBe(a1.car.a0); expect(a1.tags).toContain('attempt:1'); expect(d06Car(3, 0).a0).not.toBe(d06Car(3, 1).a0);
    expect(d.scenario(3, 0, 0).car.name).toBe(d.scenario(3, 0, 5).car.name);
    const { retrySource, sourceHash, parseSource } = await import('../src/ui/state.js');
    const s1 = retrySource({ kind: 'drill', drillId: 'D06', tier: 1, seed: 3 }); expect(s1).toEqual({ kind: 'drill', drillId: 'D06', tier: 1, seed: 3, attempt: 1 });
    expect(sourceHash(s1)).toBe('#/cockpit/drill/D06/1/3/1'); expect(parseSource(['drill', 'D06', '1', '3', '1'])).toEqual(s1); expect(retrySource(s1)).toMatchObject({ attempt: 2 });
    expect(retrySource({ kind: 'drill', drillId: 'D06', tier: 0, seed: 3 })).toEqual({ kind: 'drill', drillId: 'D06', tier: 0, seed: 3 }); expect(retrySource({ kind: 'drill', drillId: 'D04', tier: 1, seed: 3 })).toEqual({ kind: 'drill', drillId: 'D04', tier: 1, seed: 3 });
    expect(sourceHash({ kind: 'drill', drillId: 'D04', tier: 1, seed: 3 })).toBe('#/cockpit/drill/D04/1/3');
  });
});

describe('PLAY-044 N-D3: D10 Bronze grades staying on course and the lost procedure', () => {
  it('PLAY-044 an on-course card follower (no make-up yet) gets three stars on at least 9 of 10 Bronze seeds; the tip names the turn losses, not exact calls and pauses', () => {
    const d = drillById('D10')!; let three = 0;
    for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, 0); const r = play(sc, { useWatch: true, noRecovery: true }); expect(r.offCourseCount).toBe(0); const rb = d.rubric(r, sc); if (rb.stars === 3) three++;
      expect([rb.tip, ...rb.feedback].join(' ')).not.toMatch(/keep every call and every pause exact/); if ((r.attribution ?? []).reduce((x, a) => x + Math.max(0, a.buckets.turn ?? 0), 0) >= 1.5) expect(rb.tip).toMatch(/turns? cost \d+ s/); }
    expect(three).toBeGreaterThanOrEqual(9);
  });
  it('PLAY-044 Bronze is never stricter than Silver on the same run, and one excursion never outscores staying on course', () => {
    const d = drillById('D10')!;
    for (const seed of [1, 3, 5, 7]) { const bz = d.scenario(seed, 0), sv = d.scenario(seed, 1); const r = play(bz, { useWatch: true, noRecovery: true });
      const asSilver = d.rubric(r, { ...bz, aids: sv.aids, driver: sv.driver }); expect(d.rubric(r, bz).stars).toBeGreaterThanOrEqual(asSilver.stars);
      // the same run with one excursion booked (the lost doctrine done right) scores no more than on course
      const off = { ...r, offCourseCount: 1 } as StageResult; expect(d.rubric(off, bz).stars).toBeLessThanOrEqual(d.rubric(r, bz).stars); }
    // a rookie 50 s and more late on course still earns one star (EDU-006)
    const sc = d.scenario(1, 0); expect(d.rubric(play(sc, { ignoreLosses: true }), sc).stars).toBe(1);
  });
});

describe('PLAY-046 N-D5 / N-D6: the D11 Debrief tells the truth', () => {
  it('PLAY-046 a run whose dwells were within 1 s of the chart dwell (turning stops included) never hears "go earlier", in the rubric or the Debrief, at every D11 tier', () => {
    const d = drillById('D11')!;
    for (const t of [0, 1, 2]) for (const seed of [1, 2, 3, 4]) { const sc = d.scenario(seed, t); const r = play(sc, { useWatch: true, noRecovery: true }); const rb = d.rubric(r, sc); const vm = debriefViewModel(r, sc);
      expect(longDwells(r, 1, sc), `${sc.id}`).toEqual([]); expect([rb.tip, ...rb.feedback, ...vm.tips, vm.tip].join(' | '), `${sc.id}`).not.toMatch(/go earlier|Go \d+\.\d s earlier/); }
  });
  it('PLAY-046 a long dwell is still "go earlier" (the navigator sat the whole pause), and a logged make-up is never "the driver wandered" in any drill', () => {
    const sc = drillById('D11')!.scenario(2, 1); const r = play(sc, { ignoreLosses: true, useWatch: true }); expect(longDwells(r, 1, sc).length).toBeGreaterThan(0);
    for (const [id, seed, t] of [['D11', 1, 0], ['D18', 2, 0], ['D08', 1, 0], ['D12', 1, 0], ['D11', 3, 1]] as const) {
      const s = drillById(id)!.scenario(seed, t); const rr = play(s, { useWatch: true }); const made = rr.events.some(e => e.type === 'makeUp.begin' || e.type === 'call.over');
      const all = [drillById(id)!.rubric(rr, s).tip, ...drillById(id)!.rubric(rr, s).feedback, ...debriefViewModel(rr, s).tips, ...debriefViewModel(rr, s).bias.rows.map(x => x.fix ?? '')].join(' | ');
      if (made) expect(all, `${id}`).not.toMatch(/wander(ed|s)? over/);
    }
    const fake = { ...r, offCourseCount: 0, findings: [], instrumentDiscipline: [], observationMissed: false, events: [...r.events, { type: 'makeUp.begin', tod: r.events[0]!.tod, detail: { pct: 10 } }], score: { ...r.score, earlyDeparturePenalty: 0, dnf: false, legs: r.score.legs.map(l => ({ ...l, error: -8, penalty: 8 })) }, attribution: r.attribution.map(a => ({ ...a, stops: [], buckets: { ...a.buckets, cruise: -8, stop: 0, start: 0, turn: 0, speedChange: 0, timedChange: 0, hazard: 0 } })) } as StageResult;
    const tip = headlineTip(fake, { ...sc, speedo: { ...sc.speedo, kind: 'timewise', gain: 1, offset: 0 } } as Scenario, { stars: 1 }); expect(tip).not.toMatch(/wandered/); expect(tip).toMatch(/deliberate make-up/);
  });
});

describe('PLAY-047 N-D7..N-D11: Silver leftovers, the D06 card, path seams, the start bucket and Dad\'s card', () => {
  it('PLAY-047 N-D7 / N-D8: Silver prints no launch second (pre-read, start card, card, warning) and no "card dwell" hint; no "(minus 0 s)" anywhere', async () => {
    const { launchPlan, withheldLaunchText, startCount } = await import('../src/ui/viewmodels/v3.js');
    const p = launchPlan(8 * 3600, 4.6); expect(p.text).toMatch(/launch at 07:59:55 \(minus 5 s\)/);
    expect(withheldLaunchText(p, 30)).not.toMatch(/07:59:5\d|minus \d/); expect(withheldLaunchText(p, 30)).toMatch(/simple chart, Acc at 30/);
    expect(launchPlan(8 * 3600, 0).text).not.toMatch(/minus 0 s/); expect(withheldLaunchText(launchPlan(8 * 3600, 0), 30)).toMatch(/launch ON that second/);
    expect(startCount(8 * 3600 - 20, 8 * 3600, true).banner).not.toMatch(/\d\d:\d\d:\d\d/); expect(startCount(8 * 3600 - 20, 8 * 3600).banner).toMatch(/Launch at 08:00:00/);
    const src = readFileSync('src/ui/screens/cockpit.ts', 'utf8');
    expect(src).toMatch(/const withheldTimes = policy\.computedCard && !policy\.printsTimes/); expect(src).toMatch(/withheldTimes \? \(drillStart \? ` Drill start: no queue and no count\. The car launches itself on your launch second/);
    expect(src).toMatch(/withheldTimes \? withheldLaunchText\(lp,/); expect(src).toMatch(/withheldTimes \? withheldLaunchText\(al\.plan,/);
    const { drillHint } = await import('../src/ui/viewmodels/hints.js'); for (const w of ['digital', 'analog'] as const) expect(drillHint('D03', w).keys.map(k => k[1]).join(' ')).not.toMatch(/card dwell/);
    for (const id of ['D03', 'D04', 'D05', 'D08']) expect(instrumentPolicy(drillById(id)!.scenario(1, 1).aids).printsTimes, id).toBe(false);
    // N-D7: the D18 Silver turn tip names the Ford's own chart, not the handbook's Packard
    const sc = drillById('D18')!.scenario(1, 1); const fake = { ...play(sc, { ignoreLosses: true }) } as StageResult;
    fake.attribution = fake.attribution.map(a => ({ ...a, buckets: { ...a.buckets, turn: 30, cruise: 0, stop: 0, start: 0 } }));
    expect(headlineTip(fake, sc, { stars: 1 })).not.toMatch(/Packard/);
  });
  it('PLAY-047 N-D8: the D06 Silver card prints the hidden-car sentence once (the chart box); the line card only points at the MARK readings', async () => {
    const { HIDDEN_CHARTS_TEXT, HIDDEN_CAR_LINE_TEXT } = await import('../src/ui/viewmodels/cockpitinfo.js');
    expect(HIDDEN_CAR_LINE_TEXT).not.toContain("Your car's chart is what you measure today"); expect(HIDDEN_CAR_LINE_TEXT).not.toMatch(/\d/);
    const src = readFileSync('src/ui/screens/cockpit.ts', 'utf8'); expect(src).toMatch(/id="hidden-car-card">\$\{escapeHtml\(HIDDEN_CAR_LINE_TEXT\)\}/); expect(src.split('escapeHtml(HIDDEN_CHARTS_TEXT)').length - 1).toBe(0);
    expect(HIDDEN_CHARTS_TEXT).toMatch(/Your car's chart is what you measure today/);
  });
  it('PLAY-047 N-D9: every lesson (the markup lesson the path sends to before D11 included) offers the path\'s Next; "Path complete" keeps a button toward D12, and D11\'s Debrief offers it', async () => {
    const { allDrills } = await import('../src/core/drills/registry.js');
    const { pathNext, beyondPathNext, startPathFromProgress, unlockBest, pathStars, debriefNext, START_PATH } = await import('../src/ui/viewmodels/curriculum.js');
    const ds = allDrills(); const all = (): boolean => true;
    type Prog = { drills: Record<string, { stars: number; tierStars?: number[] }> };
    const done = (extra: Record<string, number[]>): Prog => { const d: Prog['drills'] = {}; for (const s of START_PATH) if (s.kind === 'drill') d[s.id] = { stars: 2, tierStars: s.id === 'D09' ? [2] : [2, 2, 0] }; for (const [k, v] of Object.entries(extra)) d[k] = { stars: Math.max(...v), tierStars: v }; return { drills: d }; };
    const prog = done({ D18: [1, 1, 0], D07: [2, 2, 0], D11: [1, 0, 0] });
    expect(pathNext(startPathFromProgress(ds, prog, all), ds, unlockBest(ds, prog), all, undefined, pathStars(prog))).toBeNull();   // the Start-here path is complete
    const bx = beyondPathNext(ds, unlockBest(ds, prog), all, undefined, pathStars(prog))!;
    expect(bx).not.toBeNull(); expect(bx.label).toMatch(/D12 needs .* at Silver or Gold/); expect(bx.hash).toMatch(/^#\/(cockpit\/drill\/D\d+\/1\/1|school\/[a-z-]+)$/);
    expect(debriefNext('D11', ds, prog, all).path?.label).toBe(bx.label);
    const prog2 = done({ D18: [1, 1, 0], D07: [2, 2, 0], D11: [1, 1, 0], D15: [1, 1, 0], D16: [3, 2, 0] }); const b2 = beyondPathNext(ds, unlockBest(ds, prog2), all, undefined, pathStars(prog2))!;
    expect(b2.kind).toBe('step'); expect(b2.hash).toBe('#/cockpit/drill/D12/0/1');
    expect(beyondPathNext(ds, unlockBest(ds, prog2), all, undefined, { ...pathStars(prog2), D12: 1 })).toBeNull();
    const school = readFileSync('src/ui/screens/school.ts', 'utf8'); expect(school).not.toMatch(/START_PATH\.some\(s => s\.kind === 'lesson' && s\.id === lesson\.id\)/); expect(school).toMatch(/beyondPathNext\(/);
    const home = readFileSync('src/ui/screens/home.ts', 'utf8'); expect(home).toMatch(/id: 'beyond-path'/);
  });
  it('PLAY-047 N-D11: a launch on its second books about 0 in "Start / restart" (D16 and D11), and the ideal go is the card\'s whole-second launch', async () => {
    for (const [id, seed, t] of [['D16', 1, 0], ['D16', 2, 1], ['D11', 1, 0], ['D11', 2, 0]] as const) {
      const sc = drillById(id)!.scenario(seed, t); const r = play(sc, { useWatch: true });
      for (const a of r.attribution) expect(Math.abs(a.buckets.start), `${id} seed ${seed} leg`).toBeLessThan(1.5);
      expect(Math.abs(debriefViewModel(r, sc).totals?.start ?? 0)).toBeLessThan(2);
      const { workedRestarts } = await import('../src/ui/viewmodels/debrief.js');
      for (const w of workedRestarts(r.events, sc)) { expect(w.idealGoTod % 1).toBe(0); expect(w.idealGoTod).toBe(Math.floor(w.outTod) - Math.round(w.accelLoss)); }
    }
  });
  it('PLAY-047 N-D10: Dad\'s card prints on a white page (no dark frame with background graphics), spells ICE out once, and line 20 reads plainly', async () => {
    const css = readFileSync('src/ui/styles.css', 'utf8'); expect(css).toMatch(/html\.print-card-only \{ color-scheme: light !important;[^}]*background-color: #fff !important; \}/);
    const { LESSONS } = await import('../content/lessons.js');
    const card = LESSONS.find(l => l.id === 'protocol')!.body.find((b): b is { card: { title: string; lines: string[] } } => typeof b === 'object' && 'card' in b)!.card.lines;
    const t = card.join('\n'); expect(t.match(/ICE \(identify, confirm, execute\)/g)?.length).toBe(1); expect(t.match(/\bICE\b/g)?.length).toBe(1);
    expect(card[19]).toBe('Phones off and out of reach from start to finish. First use: a warning. Second use: 10 seconds. Third use: 1 minute.');
  });
});

describe('PLAY-045 N-D4: no answer tells in the D09 decks or the lesson checks', () => {
  it('PLAY-045 options are parallel sentences: no option carries a ";" or ":" (clock times aside), D09 options stay within 1.4x of each other, and no length or punctuation predictor beats chance + 15 % on any D09 deck or on the lesson checks', async () => {
    const { tellReport } = await import('./answer-tells.js');
    const { trapCards } = await import('../src/ui/screens/quiz.js');
    const { TRAPS, TRAP_QUIZ } = await import('../src/core/generator/traps.js');
    const { LESSONS } = await import('../content/lessons.js');
    const punct = (o: string): boolean => /[;:]/.test(o.replace(/\d+:\d+(:\d+)?/g, ''));
    for (const t of TRAPS) { const q = TRAP_QUIZ[t.id]!; for (const o of [q.right, ...q.wrong]) expect(punct(o), `${t.id}: ${o}`).toBe(false); }
    for (const l of LESSONS) for (const o of l.check.options) expect(punct(o), `${l.id}: ${o}`).toBe(false);
    const decks = [123, 457, 801, 1, 2, 3, 4, 5];
    for (const seed of decks) {
      const cards = trapCards(seed); const rep = tellReport(cards.map(c => ({ options: c.options, answer: c.answer })));
      for (const [k, v] of Object.entries(rep.rates)) expect(v, `deck ${seed} ${k}`).toBeLessThanOrEqual(rep.chance + 0.15);
    }
    const all = TRAPS.filter(t => TRAP_QUIZ[t.id]).map(t => ({ options: [TRAP_QUIZ[t.id]!.right, ...TRAP_QUIZ[t.id]!.wrong], answer: 0 }));
    const deckRep = tellReport(all); for (const [k, v] of Object.entries(deckRep.rates)) expect(v, `D09 library ${k}`).toBeLessThanOrEqual(deckRep.chance + 0.15);
    const checks = tellReport(LESSONS.map(l => ({ options: l.check.options, answer: l.check.answer })));
    for (const [k, v] of Object.entries(checks.rates)) expect(v, `lesson checks ${k}`).toBeLessThanOrEqual(checks.chance + 0.15);
    // the right answer's length rank is spread: each rank holds the right option on at least 4 of the 23 cards
    const ranks = [0, 0, 0, 0]; for (const q of all) { const L = q.options.map(o => o.length); ranks[[...L].sort((a, b) => b - a).indexOf(L[0]!)]!++; } for (const n of ranks) expect(n).toBeGreaterThanOrEqual(4);
  });
});

describe('PLAY-048 evening one reads less: tables and lists move to the Reference page, every rule kept', () => {
  it('PLAY-048 the lessons before the first drive total well under 5,500 words, and so do the eight lessons evening one reads before its first timing drill (D01); every moved block is on the Reference page, linked from its lesson', async () => {
    const { LESSONS, LESSON_REFERENCE, lessonText, lessonWithReferenceText } = await import('../content/lessons.js');
    const { START_PATH } = await import('../src/ui/viewmodels/curriculum.js');
    const words = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;
    const before = (drill: string): string[] => { const out: string[] = []; for (const s of START_PATH) { if (s.kind === 'drill' && s.id === drill) break; if (s.kind === 'lesson') out.push(s.id); } return out; };
    const total = (ids: string[]): number => ids.reduce((a, id) => a + words(lessonText(LESSONS.find(l => l.id === id)!)), 0);
    expect(before('D16')).toEqual(['four-s', 'transits', 'which-timer', 'ghost-car']); expect(before('D01')).toHaveLength(8);
    expect(total(before('D16'))).toBeLessThan(3000);   // PT-11: 3,644
    expect(total(before('D01'))).toBeLessThan(5500);   // PT-11: 7,632
    // every link resolves; every moved section names its lesson and is linked from it; the rules stay findable (lessonWithReferenceText)
    for (const l of LESSONS) for (const b of l.body) if (typeof b === 'object' && 'ref' in b) { const r = LESSON_REFERENCE.find(x => x.id === b.ref.id); expect(r, b.ref.id).toBeDefined(); expect(r!.lesson).toBe(l.id); }
    for (const r of LESSON_REFERENCE) expect(LESSONS.find(l => l.id === r.lesson)!.body.some(b => typeof b === 'object' && 'ref' in b && b.ref.id === r.id), r.id).toBe(true);
    expect(LESSON_REFERENCE.map(r => r.id)).toEqual(expect.arrayContaining(['penalties', 'restart-steps', 'first-morning', 'which-timer', 'sign-vocabulary', 'protocol-rules', 'lost-doctrine', 'column-b']));
    const has = (id: string, phrases: string[]): void => { const t = lessonWithReferenceText(LESSONS.find(l => l.id === id)!); for (const p of phrases) expect(t, `${id}: ${p}`).toContain(p); };
    has('four-s', ['1 s per second']); has('transits', ['Position 1 leaves at base + 1 minute', '30 minutes before your start time (REG VII.B.2.a)']); has('which-timer', ['Restart time = base + ASP', 'box cumulative']);
    has('protocol', ['Next: STOP sign, crossroad, turn right, 35 after.', 'Rule 10 (simulator convention, not in the documents)', '"Mark."']); has('lost', ['double it ("lost 94")', 'Rejoin about 30 seconds behind']); has('griid-cameo', ['hourglass']);
    // the lost lesson keeps the doctrine in six short steps; Dad's card stays in the protocol lesson
    const lost = LESSONS.find(l => l.id === 'lost')!; const steps = lost.body.find((b): b is { list: string[]; ordered?: boolean } => typeof b === 'object' && 'list' in b)!; expect(steps.list).toHaveLength(6);
    expect(LESSONS.find(l => l.id === 'protocol')!.body.some(b => typeof b === 'object' && 'card' in b)).toBe(true);
    // the screens: the lesson renders the link, the Reference page renders the sections and opens at #/reference/<id>
    expect(readFileSync('src/ui/screens/school.ts', 'utf8')).toMatch(/'On the Reference page: ', el\('a', \{ href: `#\/reference\/\$\{b\.ref\.id\}` \}/);
    const ref = readFileSync('src/ui/screens/reference.ts', 'utf8'); expect(ref).toMatch(/for \(const r of LESSON_REFERENCE\)/); expect(ref).toMatch(/id: `ref-lesson-\$\{r\.id\}`/); expect(readFileSync('src/ui/main.ts', 'utf8')).toMatch(/renderReference\(view, parts\[1\]\)/);
  });
});
