// Fix sprint PT-08 / PT-09 (2026-10-04): the playability items of docs/playtest/PT-08-playability-v3-curriculum.md and the engine items of
// docs/playtest/PT-09-engine-bughunt-v3-1.md. One describe per spec id (PLAY-023..PLAY-032, ENG-020..ENG-025 in docs/spec/SPECS.md).
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { allDrills } from '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action, type StageResult } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { Session } from '../src/agent/protocol.js';
import { START_PATH, CURRICULUM, PATH_WHY, FULL_START_FF_LEAD, startPathState, pathNext, pathCompleteText, readFirstOf, unlockBest } from '../src/ui/viewmodels/curriculum.js';
import { LESSONS, LESSON_ORDER, type LessonBlock } from '../content/lessons.js';
import { TRAPS, TRAP_QUIZ } from '../src/core/generator/traps.js';
import { trapCards } from '../src/ui/screens/quiz.js';
import { chartPairs, runMeasurement } from '../src/core/drills/d06.js';
import { isMeasureRun, validateScenario, freeZoneEndS, instructionS, DRIVER_DAD_ROOKIE, aidsForRung } from '../src/core/course.js';
import { ScenarioBuilder, EXITS } from '../src/core/builder.js';
import { perfCardFor, instrumentPolicy, holdCardFor, clockReadPrompt, secondsToReach, alertExpired, ledgerTaHint, MEASURE_TEXT } from '../src/ui/viewmodels/cockpitinfo.js';
import { startLaunchFor } from '../src/ui/viewmodels/v3.js';
import { chartNoteLines, loadChartNotes, saveChartNotes } from '../src/ui/viewmodels/chartnotes.js';
import { headlineTip, longDwells, recoveryCheck, callErrors } from '../src/core/drills/rubrics.js';
import { workedCruise } from '../src/ui/viewmodels/debrief.js';
import { taHelper, ownLappedDelay } from '../src/ui/viewmodels/ta.js';
import { stageDisplayName } from '../src/ui/viewmodels/book.js';
import { speedCandidates, pauseCandidates, idealNotes } from '../src/core/drills/d15.js';
import { lossNumbers, parseCpNotes } from '../src/core/drills/preread.js';
import { parseDuration } from '../src/core/drills/d07.js';
import { elapsedAfterReset } from '../src/core/drills/index.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { championshipTotal } from '../src/core/scoring.js';
import { recordCampaignStage, loadCampaign } from '../src/ui/viewmodels/campaign.js';

const play = (sc: Parameters<typeof runBot>[0]['sc'], mk: (s: Simulator) => Bot, hook?: (s: Simulator) => void): StageResult => {
  const sim = new Simulator(sc, { watch: 'digital' }); const inner = mk(sim);
  return runBot(sim, hook ? { name: 'h', onTick(s) { hook(s); inner.onTick(s); } } : inner);
};
const memStore = (): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } }; };
const words = (t: string): number => t.trim().split(/\s+/).length;

describe('PLAY-023 the Start-here path in the handbook\'s Four S order, each drill after its "Read first" lessons', () => {
  it('PLAY-023 path order: safety, start on time (transits, which timer, ghost car, D16), stay on course (GRIID, protocol, D09, lost, D10), stay on time (pause arithmetic, D01, D03, timed leads, D04, D05, measure, D06, recovery, D08, calibration, D07, D18)', () => {
    expect(START_PATH.map(s => s.id)).toEqual(['four-s', 'transits', 'which-timer', 'ghost-car', 'D16', 'griid-cameo', 'protocol', 'D09', 'lost', 'D10', 'pause-arithmetic', 'D01', 'D03', 'timed-leads', 'D04', 'D05', 'measure-car', 'D06', 'recovery', 'D08', 'calibration', 'D07', 'D18']);
    expect([...new Set(START_PATH.map(s => s.s))]).toEqual(['safety', 'start', 'course', 'time']);
    const ids = START_PATH.map(s => s.id);
    for (const step of START_PATH.filter(s => s.kind === 'drill')) { const d = drillById(step.id)!; for (const l of readFirstOf(d)) if (ids.includes(l.id)) expect(ids.indexOf(l.id), `${l.id} before ${step.id}`).toBeLessThan(ids.indexOf(step.id)); }
    expect(PATH_WHY).toMatch(/Starts and course come before time/); expect(PATH_WHY).toMatch(/minutes/); expect(PATH_WHY).toMatch(/seconds/);
    expect(CURRICULUM[0]).toBe('D16'); expect(LESSON_ORDER.slice(0, 4)).toEqual(['four-s', 'transits', 'which-timer', 'ghost-car']);
    expect(drillById('D16')!.readFirst).toEqual(expect.arrayContaining(['transits', 'which-timer', 'ghost-car']));
  });
  it('PLAY-023 "Next on your path" opens the lesson when one is due (a drill whose Read-first lesson is unread opens that lesson first)', () => {
    const ds = allDrills();
    const steps = startPathState({}, () => true);   // every lesson step ticked, D16 the current step
    expect(steps.find(s => s.current)!.step.id).toBe('D16');
    const due = pathNext(steps, ds, {}, id => id !== 'ghost-car', id => LESSONS.find(l => l.id === id)!.title)!;
    expect(due.kind).toBe('step'); if (due.kind !== 'step') return;
    expect(due.step).toMatchObject({ kind: 'lesson', id: 'ghost-car' }); expect(due.hash).toBe('#/school/ghost-car'); expect(due.label).toMatch(/Read first: The ghost car \(before D16\)/);
    const fresh = pathNext(startPathState({}, () => false), ds, {}, () => false)!; expect(fresh.kind === 'step' && fresh.step.id).toBe('four-s');
  });
});

describe('PLAY-024 the path\'s end is honest: locks shown, Next never opens a locked drill, "Path complete" names the unlocks', () => {
  const ds = allDrills();
  const bronzeAll = { drills: Object.fromEntries(START_PATH.filter(s => s.kind === 'drill' && s.id !== 'D18').map(s => [s.id, { stars: 2, tierStars: [2, 0, 0] }])) };
  it('PLAY-024 after a Bronze path D18 is current and locked; Next replays the first missing prerequisite at Silver, never D18 itself', () => {
    const best = unlockBest(ds, bronzeAll);
    const steps = startPathState(Object.fromEntries(Object.keys(bronzeAll.drills).map(k => [k, 2])), () => true, { drills: ds, best });
    const d18 = steps.find(s => s.step.id === 'D18')!; expect(d18.current).toBe(true); expect(d18.locked).toBe(true); expect(d18.needs).toMatch(/D03 ★★/);
    const nx = pathNext(steps, ds, best, () => true)!;
    expect(nx.kind).toBe('replay'); if (nx.kind !== 'replay') return;
    expect(nx.hash).toBe('#/cockpit/drill/D03/1/1'); expect(nx.hash).not.toMatch(/D18/); expect(nx.label).toMatch(/Replay D03 at Silver \(D18 needs D03 ★★ at Silver or Gold\)/);
    // with the Silver stars in, D18 opens and Next is D18 itself
    const silver = { D03: 2, D04: 2, D05: 2, D08: 2, D10: 2, D16: 1 };
    const s2 = startPathState(Object.fromEntries(Object.keys(bronzeAll.drills).map(k => [k, 2])), () => true, { drills: ds, best: silver });
    const n2 = pathNext(s2, ds, silver, () => true)!; expect(n2.kind === 'step' && n2.step.id).toBe('D18'); expect(s2.find(s => s.step.id === 'D18')!.locked).toBeFalsy();
  });
  it('PLAY-024 "Path complete" names what opens D11 and D12, from their unlock lists', () => {
    const t = pathCompleteText(ds, {});
    expect(t).toMatch(/^Path complete\./); expect(t).toMatch(/D11 \(full leg\) opens with D18 ★, D07 ★★ at Silver or Gold/); expect(t).toMatch(/D12 \(full stage\) opens with D11 ★, D15 ★, D16 ★★/);
    expect(pathCompleteText(ds, { D18: 1, D07: 2 })).toMatch(/D11 \(full leg\) is open/);
  });
});

describe('PLAY-025 D09: no spelling trap (REG VII.D), the 2026 TA procedure, and questions that ask what you do', () => {
  it('PLAY-025 the spelling trap is gone, the RR card names the rails and the 2026 web form, no bezel tip', () => {
    expect(TRAPS.some(t => t.id === 'quoted-sign-mismatch')).toBe(false);
    for (const t of TRAPS) { expect(`${t.tip} ${(t.distractors ?? []).map(d => d.why).join(' ')}`, t.id).not.toMatch(/spelling/i); expect(t.tip, t.id).not.toMatch(/bezel/i); }
    const rr = TRAPS.find(t => t.id === 'rr-crossing')!; expect(rr.name).toMatch(/rails/); expect(rr.tip).toMatch(/web form/); expect(rr.tip).toMatch(/15 minutes/); expect(rr.tip).not.toMatch(/declare the measured wait at the checkpoint/);
  });
  it('PLAY-025 every card asks "which way / what do you do" with action options; the right action is one of four; no doubled quotes', () => {
    for (const t of TRAPS) { const q = TRAP_QUIZ[t.id]; expect(q, t.id).toBeDefined(); expect(new Set([q!.right, ...q!.wrong]).size).toBe(4); }
    for (const seed of [1, 7, 42]) for (const c of trapCards(seed)) {
      expect(c.prompt).toMatch(/(Which way, and what do you do\?|What do you do\?)$/); expect(c.prompt).not.toMatch(/Which statement/); expect(c.prompt).not.toMatch(/""/);
      expect(c.options.length).toBe(4); expect(c.options[c.answer]).toBe(Object.values(TRAP_QUIZ).find(q => q.right === c.options[c.answer])!.right);
    }
    expect(drillById('D09')!.objective).not.toMatch(/pick the exit/);
  });
});

describe('PLAY-026 "Fast-forward" on a full start stops 45 s before the launch second and never lands after it', () => {
  it('PLAY-026 a skip of minus + 45 s lands 45 s before the launch; the warning and the count still happen; no skip ever passes the launch second', () => {
    expect(FULL_START_FF_LEAD).toBe(45);
    const sc = drillById('D16')!.scenario(1, 0); const sim = new Simulator(sc, { watch: 'digital' });
    const li0 = sim.launchInfo()!; const minus = Math.round(li0.ownTime - li0.launchTime);
    sim.act({ type: 'skipPreread', secondsBefore: minus + FULL_START_FF_LEAD });
    expect(sim.launchInfo()!.secondsToLaunch).toBeCloseTo(45, 0);
    for (let i = 0; i < 160; i++) sim.step(0.1);
    expect(sim.driverMsgs.some(m => /Give me about 30 seconds/.test(m.text))).toBe(true);   // the driver still asks: nothing was skipped
    const sim2 = new Simulator(sc, { watch: 'digital' }); sim2.act({ type: 'skipPreread' }); expect(sim2.launchInfo()!.secondsToLaunch).toBeGreaterThanOrEqual(0.9);   // the old target (own time) is clamped
    sim2.act({ type: 'skipPreread', secondsBefore: 0 }); expect(sim2.launchInfo()!.secondsToLaunch).toBeGreaterThan(0);
  });
  it('PLAY-026 a car that leaves after its launch second is never "Rolling on time"', () => {
    const sc = drillById('D16')!.scenario(1, 0); const sim = new Simulator(sc, { watch: 'digital' }); const li = sim.launchInfo()!;
    while (sim.tod < li.launchTime + 4) sim.step(0.1);
    sim.act({ type: 'start' }); expect(sim.driverMsgs.map(m => m.text).join(' | ')).toMatch(/after our launch second/); expect(sim.driverMsgs.some(m => m.text === 'Rolling on time')).toBe(false);
  });
});

describe('PLAY-027 D06: measure, do not compensate; notes survive a retry; Bronze copies the Packard', () => {
  it('PLAY-027 a measuring run: no launch lead (the engine and the card), no early speed call, the card says "measure, do not compensate"', () => {
    for (const t of [0, 1, 2]) {
      const sc = drillById('D06')!.scenario(3, t); expect(isMeasureRun(sc)).toBe(true);
      const sim = new Simulator(sc); const li = sim.launchInfo()!; expect(li.launchTime).toBe(li.ownTime);
      const restart = sc.book.find(i => i.section === 'restart')!; expect(restart.text).toMatch(/leave ON the second, no launch lead/); expect(startLaunchFor(sc, restart.n)!.minus).toBe(0);
      const pol = instrumentPolicy(sc.aids);
      for (const ins of sc.book) { const c = perfCardFor(sc, ins.n, pol); if (!c || !pol.computedCard) continue; expect(c.speedChange, `line ${ins.n}`).toBeUndefined(); expect(c.start).toBeUndefined(); expect(c.measure).toBe(MEASURE_TEXT); if (c.restart) expect(c.restart.accel).toBeNull(); }
      expect(holdCardFor(sc, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => null }, restart.n)!.lead).toBeNull();
      const marks = sc.book.filter(i => /^MARK \S+ in\b/.test(i.text ?? '')).map(i => i.text ?? '');
      for (const m of marks) expect(m).toMatch(t === 0 ? /Bronze: copy the Packard chart cell/ : /Measure, do not compensate/);
    }
    expect(drillById('D06')!.objective).toMatch(/^Bronze: copy the Packard charts\./); expect(drillById('D06')!.objective).toMatch(/Silver and Gold: measure the car/);
  });
  it('PLAY-027 chart notes of a run are kept per tier and seed, and only chart notes', () => {
    const st = memStore();
    expect(chartNoteLines(['stopgo 30>40 = 8.4', 'hello', 'const 25 runs 19.8 19.9', 'turn 40>35 = 4.0'])).toEqual(['stopgo 30>40 = 8.4', 'const 25 runs 19.8 19.9', 'turn 40>35 = 4.0']);
    saveChartNotes(1, 7, ['stopgo 30>40 = 8.4', 'nothing'], st); expect(loadChartNotes(1, 7, st)).toEqual(['stopgo 30>40 = 8.4']); expect(loadChartNotes(1, 8, st)).toEqual([]); expect(loadChartNotes(2, 7, st)).toEqual([]);
    saveChartNotes(1, 7, ['stopgo 30>40 = 8.4', 'stopgo 30>40 = 8.6'], st); expect(loadChartNotes(1, 7, st)).toEqual(['stopgo 30>40 = 8.4', 'stopgo 30>40 = 8.6']);
    expect(loadChartNotes(1, 7, { getItem: () => '{not json' })).toEqual([]); expect(loadChartNotes(1, 7, null)).toEqual([]);
  });
});

describe('ENG-020 D06 is fair to an honest measurer (straight stops in section A, speed-ups only in section B)', () => {
  it('ENG-020 section A stops go straight through; section B pairs speed up (or start from rest)', () => {
    for (const t of [0, 1, 2]) for (let seed = 1; seed <= 10; seed++) {
      const sc = drillById('D06')!.scenario(seed, t);
      for (const p of chartPairs(sc.tags).filter(q => q.kind === 'accel')) expect(p.vOut, `${sc.id} ${p.vIn}>${p.vOut}`).toBeGreaterThan(p.vIn);
      const stops = sc.book.filter(i => i.pause === 15 && sc.course.nodes.find(n => n.id === i.nodeId)?.control === 'STOP'); expect(stops.length).toBeGreaterThanOrEqual(3); for (const s of stops) expect(s.turn).toBe('S');
    }
  });
  it('ENG-020 an honest measurer (no lead, full pause, notes = what the run measured between the MARK lines) earns 3 stars on seeds 1-10 at every tier', () => {
    const d = drillById('D06')!; const name = (k: string): string => k === 'stopGo' ? 'stopgo' : k === 'stopMid' ? 'stopmid' : k;
    for (const t of [0, 1, 2]) {
      const stars: number[] = [];
      for (let seed = 1; seed <= 10; seed++) {
        const sc = d.scenario(seed, t); const first = play(sc, s => new OracleBot(s, { ignoreLosses: true }));
        const notes = chartPairs(sc.tags).map(p => { const m = runMeasurement(first, sc, p); return m === null ? null : `${name(p.kind)} ${p.vIn}>${p.vOut} = ${m.toFixed(1)}`; }).filter((x): x is string => !!x);
        expect(notes.length, sc.id).toBe(10);
        let done = false; const r = play(sc, s => new OracleBot(s, { ignoreLosses: true }), s => { if (done) return; done = true; for (const n of notes) s.act({ type: 'note', text: n }); });
        stars.push(d.rubric(r, sc).stars);
      }
      expect(stars.join(''), ['Bronze', 'Silver', 'Gold'][t]).toBe('3333333333');
    }
    // a naive team that notes nothing still earns nothing
    const sc = d.scenario(1, 1); expect(d.rubric(play(sc, s => new OracleBot(s, { useWatch: true })), sc).stars).toBe(0);
  }, 240000);
});

describe('PLAY-028 the "go earlier" stop tip only when a dwell at a printed pause was really long', () => {
  const sc = drillById('D11')!.scenario(1, 1); const base = play(sc, s => new OracleBot(s, { useWatch: true }));
  const mk = (stops: { pause: number; actualCost: number }[]): StageResult => ({ ...base, offCourseCount: 0, findings: [], instrumentDiscipline: [], observationMissed: false, score: { ...base.score, earlyDeparturePenalty: 0, dnf: false, legs: base.score.legs.map(l => ({ ...l, error: 9, penalty: 9 })) },
    attribution: [{ legIndex: 1, cruiseSeconds: 100, meanSpeedRatio: 1, buckets: { stop: stops.reduce((a, s) => a + s.actualCost, 0), cruise: 0, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, offCourse: 0, ta: 0 }, stops: stops.map((s, i) => ({ nodeId: `n${i}`, line: i + 2, pause: s.pause, actualCost: s.actualCost, dwell: 0, goDwell: 0, trafficWait: 0, vIn: 35, vOut: 35, turn: null })) }] }) as unknown as StageResult;
  it('PLAY-028 six dwells within +0.6 s and a no-pause STOP: "make it up", never "go earlier"', () => {
    const r = mk([...Array.from({ length: 6 }, () => ({ pause: 15, actualCost: 0.6 })), { pause: 0, actualCost: 12.2 }]);
    expect(longDwells(r)).toEqual([]); const tip = headlineTip(r, sc, { stars: 0 }); expect(tip).not.toMatch(/go earlier/); expect(tip).toMatch(/your dwells were right/); expect(tip).toMatch(/10 % rule/);
    const small = mk(Array.from({ length: 6 }, () => ({ pause: 15, actualCost: 0.6 }))); expect(headlineTip(small, sc, { stars: 1 })).not.toMatch(/go earlier/);
  });
  it('PLAY-028 a dwell 3 s past the chart pause time does get "go earlier"', () => {
    const r = mk([{ pause: 15, actualCost: 3 }, { pause: 15, actualCost: 0.4 }]); expect(longDwells(r)).toEqual([{ line: 2, seconds: 3 }]); expect(headlineTip(r, sc, { stars: 0 })).toMatch(/go earlier/);
  });
});

describe('PLAY-029 D16: the IN prompt comes with the IN sign, and K pressed then counts', () => {
  it('PLAY-029 the prompt shows within 45 s of the IN sign (and 20 s after), never from the start line', () => {
    const sc = drillById('D16')!.scenario(1, 0); const begin = sc.book.find(i => i.transit?.exact && !i.transit.end)!;
    const card = holdCardFor(sc, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => null }, begin.n)!;
    expect(clockReadPrompt(card, null, null)).toBeNull(); expect(clockReadPrompt(card, null, 138)).toBeNull(); expect(clockReadPrompt(card, null, 40)).toMatch(/Read the clock now \(K\) as you pass this sign \(about 40 s ahead\)/); expect(clockReadPrompt(card, null, -10)).toMatch(/Read the clock now/); expect(clockReadPrompt(card, null, -30)).toBeNull();
    expect(secondsToReach(1000, 50, 2000)).toBe(20); expect(secondsToReach(1000, 0, 2000)).toBeNull();
  });
  it('PLAY-029 a navigator who reads the clock when the prompt appears has no IN finding; one who never reads it does', () => {
    const sc = drillById('D16')!.scenario(1, 0); const begin = sc.book.find(i => i.transit?.exact && !i.transit.end)!; const inS = sc.course.nodes.find(n => n.id === begin.nodeId)!.s;
    const card = holdCardFor(sc, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => null }, begin.n)!;
    let read = false;
    const r = play(sc, s => new OracleBot(s, { useWatch: true, noClockReads: true }), s => { if (read || s.phase !== 'running') return; const t = secondsToReach(s.car.s, s.car.v, inS); if (t !== null && clockReadPrompt(card, null, t)) { read = true; s.act({ type: 'clock.read' }); } });
    expect(read).toBe(true); expect(r.instrumentDiscipline.filter(f => /Exact-transit IN/.test(f.text))).toEqual([]);
    const r0 = play(sc, s => new OracleBot(s, { useWatch: true, noClockReads: true })); expect(r0.instrumentDiscipline.some(f => /Exact-transit IN/.test(f.text))).toBe(true);
  });
});

describe('PLAY-030 STOP + timed lines: the engine\'s anchor is the card\'s (arrival + pause), so lapping where told is clean', () => {
  it('PLAY-030 a lap at the card\'s "s after Stopped" gives no "count intervals ... not the clock" finding on the compound lines; a lap at the go does', () => {
    const sc = drillById('D04')!.scenario(2, 0); const pol = instrumentPolicy(sc.aids);
    const compound = sc.book.filter(i => i.pause && i.timed); expect(compound.length).toBe(2);
    const runWith = (anchor: 'card' | 'go'): StageResult => {
      const lapped = new Set<number>(); let seen = 0; const due: { tod: number; line: number }[] = [];
      return play(sc, s => new OracleBot(s), s => {
        for (; seen < s.events.length; seen++) { const e = s.events[seen]!; const ins = compound.find(i => i.nodeId === e.detail?.nodeId);
          if (ins && e.type === 'wait' && anchor === 'card') due.push({ tod: e.tod + perfCardFor(sc, ins.n, pol)!.timed!.fromGhost!.afterStopped, line: ins.n });
          if (ins && e.type === 'release' && anchor === 'go') due.push({ tod: e.tod, line: ins.n }); }
        for (const d of due) if (!lapped.has(d.line) && s.tod >= d.tod) { lapped.add(d.line); s.act({ type: s.watch.running ? 'watch.lap' : 'watch.start' }); }
      });
    };
    const ok = runWith('card'); const lines = compound.map(i => i.n);
    expect(ok.instrumentDiscipline.filter(f => lines.includes(f.line))).toEqual([]);
    const bad = runWith('go'); expect(bad.instrumentDiscipline.filter(f => f.kind === 'clockForInterval' && lines.includes(f.line)).length).toBe(2);
  });
});

describe('PLAY-031 Dad\'s card: one printed page, "navigator" / "driver", the instrument rule, short lines', () => {
  it('PLAY-031 every line is under 25 words, uses no pronoun for the team, and the instrument line says the clock has no digital readout while the stopwatch may be digital', () => {
    const lesson = LESSONS.find(l => l.id === 'protocol')!; const card = lesson.body.find((b): b is Extract<LessonBlock, { card: unknown }> => typeof b !== 'string' && 'card' in b)!.card;
    for (const l of card.lines) { expect(words(l), l).toBeLessThan(25); expect(l, l).not.toMatch(/\b(she|he|her|him|his|hers)\b/i); }
    const all = card.lines.join(' '); expect(all).toMatch(/\bnavigator\b/); expect(all).toMatch(/\bdriver\b|Eyes on the road/); expect(all).toMatch(/dash clock is analog with no digital readout; the stopwatch may be digital/); expect(all).not.toMatch(/no digital watch/);
  });
});

describe('PLAY-032 cockpit text hygiene', () => {
  it('PLAY-032 alerts expire in sim time too; the stage is never "fullStage #1"; the lesson 1 check tests the S priority', () => {
    expect(alertExpired(1000, 5000, 100, 95)).toBe(false); expect(alertExpired(1000, 5000, 110, 95)).toBe(true); expect(alertExpired(6000, 5000, 95, 95)).toBe(true);
    expect(stageDisplayName('fullStage #1')).toBe('Day stage 1');
    const l1 = LESSONS.find(l => l.id === 'four-s')!; expect(l1.check.question).toMatch(/Which comes first/); expect(l1.check.options[l1.check.answer]).toMatch(/stay on course/); expect(l1.check.explain).toMatch(/Safety, Start on time, Stay on course, Stay on time/);
  });
  it('PLAY-032 a logged 10 %-rule make-up is never blamed on the driver', () => {
    const sc = drillById('D08')!.scenario(1, 0);
    const att = [{ legIndex: 1, buckets: { cruise: -4.1, stop: 0, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, offCourse: 0, ta: 0 }, cruiseSeconds: 200, meanSpeedRatio: 1.022, stops: [] }];
    const plain = workedCruise(att as never, sc, []); expect(plain[0]!.text).toMatch(/wandered over/);
    const madeUp = workedCruise(att as never, sc, [{ tod: sc.startTime + 100, s: 0, type: 'makeUp.begin', detail: { pct: 10, assigned: 35 } }] as never);
    expect(madeUp[0]!.text).toMatch(/deliberate make-up \(\+10 %/); expect(madeUp[0]!.text).not.toMatch(/wandered/);
  });
  it('PLAY-032 D10: a wrong turn is booked once (buckets sum to the leg error, no "rounding residual")', () => {
    const sc = drillById('D10')!.scenario(2, 0); const flip: Record<string, string> = { L: 'R', R: 'L' };
    let flipped = false; let offSince: number | null = null; let uturned = false;
    const r = play(sc, s => { const o = new OracleBot(s, { useWatch: true }); const act0 = s.act.bind(s); (s as { act: (a: Action) => void }).act = (a: Action) => { if (!flipped && a.type === 'call.turn' && flip[a.dir]) { flipped = true; return act0({ ...a, dir: flip[a.dir] } as Action); } return act0(a); }; return o; },
      s => { const st = s.observe({ peek: true }).driver.state; if (!uturned && st === 'offcourse') { offSince ??= s.tod; if (s.tod - offSince >= 20) { uturned = true; s.act({ type: 'call.uturn' }); } } });
    expect(r.offCourseCount).toBe(1);
    const a = r.attribution.find(x => x.legIndex === 1)!; const sum = Object.values(a.buckets).reduce((x, y) => x + y, 0);
    expect(Math.abs(sum - r.score.legs[0]!.error!)).toBeLessThan(1.5); expect(a.buckets.offCourse).toBeGreaterThan(20);
  });
  it('PLAY-032 the ledger never suggests a Time Allowance for a slow truck, a drill without TA point or a wrong turn; the Bronze worksheet shows the navigator\'s own lap', () => {
    expect(ledgerTaHint({ hasTaPoints: false, windowOpen: false }, false)).toMatch(/No TA point in this drill: .*10 % rule/); expect(ledgerTaHint({ hasTaPoints: false, windowOpen: false }, false)).not.toMatch(/press T/);
    expect(ledgerTaHint({ hasTaPoints: true, windowOpen: false }, true)).toMatch(/a wrong turn is never a Time Allowance/);
    expect(ledgerTaHint({ hasTaPoints: true, windowOpen: false }, false)).toMatch(/A slow truck, a light or traffic is made up with the 10 % rule/);
    expect(ownLappedDelay({ running: false, reading: 58.4, laps: [] })).toBeCloseTo(58.4, 5); expect(ownLappedDelay({ running: true, reading: 70, laps: [10, 68] })).toBe(58); expect(ownLappedDelay(null)).toBeNull();
    const h = taHelper({ measuredDelay: 59, stoppedSeconds: 51, chartLoss: 7.8 }, 58); expect(h.text).toMatch(/^Your watch 0m58s beside the engine's 0m59s \(agrees\)\. measured 0m59s = stopped 0m51s \+ chart loss 7\.8 s/);
    expect(taHelper({ measuredDelay: 59 }, 50).text).toMatch(/off by 9 s/); expect(taHelper({ measuredDelay: 59 }).text).not.toMatch(/Your watch/);
  });
});

describe('ENG-021 launchInfo and advance {untilEvent} stop at an exact-transit OUT and a promoted-stop departure', () => {
  it('ENG-021 at both holds of D16 the untilEvent advance wakes on "launch" before the departure, never past it', () => {
    const sc = drillById('D16')!.scenario(2, 1); const s = new Session(sc, { watch: 'digital' }); const sim = s.sim; const bot = new OracleBot(sim, { useWatch: true });
    let prev = false; const kinds: string[] = []; let guard = 0;
    while (sim.phase !== 'finished' && guard++ < 200000 && kinds.length < 3) {
      bot.onTick(); sim.step(0.1);
      const w = sim.waitingForGo && sim.waitReason === 'hold';
      if (w && !prev) {
        const li = sim.launchInfo(); expect(li).not.toBeNull(); kinds.push(li!.kind);
        const node = sc.course.nodes.filter(x => x.s <= sim.car.s + 5).pop()!; const go = sim.holdGoTod(node)!; expect(li!.ownTime).toBe(go);
        let stopped: string | null = null; for (let k = 0; k < 12 && stopped !== 'launch'; k++) { const r = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 3000 }); if (r.type === 'advanced') stopped = r.stoppedOn; }
        expect(stopped).toBe('launch'); expect(sim.tod).toBeLessThan(go); expect(sim.launchInfo()!.secondsToLaunch).toBeLessThanOrEqual(30.05);
        sim.act({ type: 'call.go' });
      }
      prev = w;
    }
    expect(kinds).toEqual(expect.arrayContaining(['transitOut', 'lunch']));
  }, 60000);
});

describe('ENG-022 the gates stop the team each drill is meant to stop', () => {
  it('ENG-022 D04: goCount (counting from its own go) earns at most one star at every tier; the oracle three on most seeds', () => {
    const d = drillById('D04')!;
    for (const t of [0, 1, 2]) for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, t); const r = play(sc, s => new OracleBot(s, { goCount: true })); expect(d.rubric(r, sc).stars, `${sc.id}`).toBeLessThanOrEqual(1); expect(callErrors(r, sc, 'timed', 5, i => !!i.pause).length).toBe(2); }
    let three = 0; for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, 1); if (d.rubric(play(sc, s => new OracleBot(s, { useWatch: true })), sc).stars === 3) three++; } expect(three).toBeGreaterThanOrEqual(9);
  }, 120000);
  it('ENG-022 D08 and D18: a team that never recovers earns at most one star; the oracle recovers and keeps its stars', () => {
    for (const id of ['D08', 'D18']) { const d = drillById(id)!;
      for (const t of [0, 1, 2]) for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, t); for (const o of [{ forgetPauses: true }, { ignoreLosses: true }]) expect(d.rubric(play(sc, s => new OracleBot(s, o)), sc).stars, `${sc.id} ${JSON.stringify(o)}`).toBeLessThanOrEqual(1); }
      let ok = 0; for (let seed = 1; seed <= 10; seed++) { const sc = d.scenario(seed, 1); const r = play(sc, s => new OracleBot(s, { useWatch: true })); expect(recoveryCheck(r).shown, sc.id).toBe(true); if (d.rubric(r, sc).stars >= 2) ok++; } expect(ok, id).toBe(10);
    }
  }, 240000);
  it('ENG-022 D15: a number spray earns nothing; a note counts only for the number it states for that notation', () => {
    expect(speedCandidates('35 mph; pause 10.2 s')).toEqual([35]); expect(pauseCandidates('35 mph; pause 10.2 s')).toEqual([10.2]); expect(speedCandidates('30; P10.2')).toEqual([30]); expect(pauseCandidates('30; P10.2')).toEqual([10.2]);
    expect(pauseCandidates('-2.9')).toEqual([]); expect(speedCandidates(Array.from({ length: 121 }, (_, i) => i * 0.5).join(' '))).toEqual([]); expect(pauseCandidates(Array.from({ length: 121 }, (_, i) => `P${i * 0.5}`).join('; '))).toEqual([]);
    const d = drillById('D15')!; const sc = d.scenario(1, 1); const spray = Array.from({ length: 121 }, (_, i) => i * 0.5).join(' ');
    let done = false; const r = play(sc, s => new OracleBot(s, { useWatch: true }), s => { if (done) return; done = true; for (const ins of sc.book) s.act({ type: 'line.annotate', n: ins.n, text: `${spray} comes quick` } as Action); });
    expect(d.rubric(r, sc).stars).toBe(0);
    let done2 = false; const r2 = play(sc, s => new OracleBot(s, { useWatch: true }), s => { if (done2) return; done2 = true; for (const x of idealNotes(sc)) s.act({ type: 'line.annotate', n: x.n, text: x.text } as Action); });
    expect(d.rubric(r2, sc).stars).toBeGreaterThanOrEqual(2);   // the honest marks still count (the OUT time needs the run)
  }, 60000);
});

describe('ENG-023 D17 grades the first "elapsed" note after the reset; parseDuration reads the forms people write', () => {
  it('ENG-023 parseDuration: "4:05.", "12 min 25 s", "elapsed 4:05", "4m05.0s", "0:04:05", "245.3 s"', () => {
    expect(parseDuration('4:05.')).toBe(245); expect(parseDuration('12 min 25 s')).toBe(745); expect(parseDuration('elapsed 4:05')).toBe(245); expect(parseDuration('4m05.0s')).toBeCloseTo(245, 5);
    expect(parseDuration('0:04:05')).toBe(245); expect(parseDuration('245.3 s')).toBeCloseTo(245.3, 5); expect(parseDuration('5m32.0s')).toBeCloseTo(332, 5); expect(parseDuration('abc')).toBeNull();
  });
  it('ENG-023 a pile of guessed "elapsed" notes earns one star: only the first after the reset counts', () => {
    const d = drillById('D17')!; const sc = d.scenario(1, 0); const cal = sc.book.find(i => i.calibrationStart)!;
    const mmss = (x: number): string => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
    let sprayed = false; const r = play(sc, s => new OracleBot(s, { useWatch: true }), s => { if (sprayed || !s.events.some(e => e.type === 'watchLost')) return; sprayed = true; for (let x = 0; x <= 2400; x += 2) s.act({ type: 'note', text: `elapsed ${mmss(x)}` }); s.act({ type: 'watch.start' }); });
    expect(d.rubric(r, sc).stars).toBeLessThanOrEqual(1); expect(elapsedAfterReset(r, sc)!.noted).toBe(0);
    let wrote = false; const r2 = play(sc, s => new OracleBot(s, { useWatch: true }), s => { if (wrote || !s.events.some(e => e.type === 'watchLost')) return; wrote = true; const t0 = s.events.find(e => e.type === 'node' && e.detail?.nodeId === cal.nodeId)!.tod; s.act({ type: 'note', text: `elapsed ${(s.tod - t0) / 60 | 0} min ${Math.round((s.tod - t0) % 60)} s` }); s.act({ type: 'watch.start' }); });
    expect(d.rubric(r2, sc).stars).toBe(3);
  }, 60000);
});

describe('ENG-024 the driver makes a turn called in time from 50-55 mph; the oracle leads turns by speed', () => {
  it('ENG-024 no "too late" for the oracle on the PT-09 seeds (D12 Gold 2, D06 Gold 7) and a turn called 900 ft out at 55 mph is made; one called 150 ft out is missed', () => {
    for (const [id, seed] of [['D06', 7], ['D12', 2]] as const) { const sc = drillById(id)!.scenario(seed, 2); const r = play(sc, s => new OracleBot(s, { useWatch: true })); expect(r.events.filter(e => e.type === 'turnMissed'), `${id} ${seed}`).toEqual([]); expect(r.offCourseCount).toBe(0); }
    const mk = () => new ScenarioBuilder({ startTime: 8 * 3600, driver: DRIVER_DAD_ROOKIE, aids: aidsForRung(3), prereadSeconds: 5 }).start(55).advanceMiles(1.2).instruction({ exits: EXITS.crossroads('L'), sightDistance: 1500 }, { turn: 'L', speed: 30 }).advanceMiles(0.6).checkpoint().advanceFt(300).finish().build();
    const at = (lead: number): StageResult => { const sc = mk(); const sim = new Simulator(sc); const ts = instructionS(sc.course, sc.book[1]!); let called = false; sim.act({ type: 'skipPreread' }); sim.act({ type: 'start' });
      for (let i = 0; i < 6000 && sim.phase !== 'finished'; i++) { if (!called && ts - sim.car.s <= lead) { called = true; sim.act({ type: 'call.turn', dir: 'L' }); } sim.step(0.1); } return sim.result(); };
    const ok = at(900); expect(ok.events.filter(e => e.type === 'turnMissed')).toEqual([]); expect(ok.offCourseCount).toBe(0);
    expect(at(150).events.some(e => e.type === 'turnMissed')).toBe(true);
  }, 120000);
});

describe('ENG-025 PT-09 LOWs: note parsing, free zone, campaign input, long notes, truth/result redaction', () => {
  it('ENG-025 bare "10.2" and "CP1 arrived 9:14:22" parse; stray and doubled numbers do not', () => {
    expect(lossNumbers('10.2')).toEqual([10.2]); expect(lossNumbers('30')).toEqual([]); expect(lossNumbers('restart 9:41:00 -2')).toEqual([]); expect(lossNumbers('loss: -2.3')).toEqual([2.3]); expect(lossNumbers('-2.3')).toEqual([2.3]);
    expect(parseCpNotes(['CP1 arrived 9:14:22'])).toEqual([{ cp: 1, tod: 9 * 3600 + 14 * 60 + 22 }]); expect(parseCpNotes(['Checkpoint 1 9:14:22'])).toEqual([{ cp: 1, tod: 9 * 3600 + 14 * 60 + 22 }]);
  });
  it('ENG-025 the 2-minute free zone after a transit or restart is 120 s of ghost time at the following rows\' speeds (day 43)', () => {
    const sc = generateStage(43, PROFILES.fullStage); expect(validateScenario(sc)).toEqual([]);
    const g = buildGhost(sc);
    for (const ins of sc.book.filter(i => i.transit?.end || (i.section === 'restart' && i.restartTime !== undefined))) {
      const s0 = instructionS(sc.course, ins); const cp = sc.checkpoints.filter(c => c.kind === 'timing').find(c => c.s > s0);
      if (cp) expect(ghostTimeAt(g, cp.s) - ghostTimeAt(g, s0), `line ${ins.n}`).toBeGreaterThanOrEqual(119.5);
      const end = freeZoneEndS(sc, ins, ins.speed ?? 30); expect(ghostTimeAt(g, end) - ghostTimeAt(g, s0)).toBeGreaterThanOrEqual(110);
    }
  });
  it('ENG-025 the campaign ignores a fractional stage and non-finite items, and never stores a NaN, negative or infinite score', () => {
    const score = (legs: number[]) => ({ legs: legs.map((p, i) => ({ index: i + 1, penalty: p })), ageFactor: 1 }) as never;
    const t = championshipTotal([{ stage: 1, score: score([5]) }, { stage: 1.5, score: score([100]) }, { stage: 2, score: score([3, NaN as unknown as number]) }] as never);
    expect(t.stagesCounted).toEqual([1, 2]); expect(Number.isFinite(t.afterDiscards)).toBe(true);
    const st = memStore();
    recordCampaignStage({ stage: 2, tier: 1, raw: NaN, score: NaN, aces: 0 } as never, st); expect(loadCampaign(st).tiers['1']?.['2']).toBeUndefined();
    recordCampaignStage({ stage: 2, tier: 1, raw: -5, score: -5, aces: 0 } as never, st); expect(loadCampaign(st).tiers['1']?.['2']).toBeUndefined();
    recordCampaignStage({ stage: 2, tier: 1, raw: Infinity, score: Infinity, aces: 0 } as never, st); expect(loadCampaign(st).tiers['1']?.['2']).toBeUndefined();
    recordCampaignStage({ stage: 2, tier: 1, raw: 40, score: 33.8, aces: 0 } as never, st); expect(loadCampaign(st).tiers['1']!['2']!.score).toBe(33.8);
  });
  it('ENG-025 a note over 2 000 characters is cut to 2 000, never refused; truth and result are refused mid-run at aids rung <= 1', () => {
    const sc = drillById('D03')!.scenario(1, 0); const sim = new Simulator(sc); expect(() => sim.act({ type: 'note', text: 'x'.repeat(2500) })).not.toThrow();
    const last = sim.actions[sim.actions.length - 1]!.action as { text: string }; expect(last.text.length).toBe(2000);
    const legal = drillById('D16')!.scenario(1, 2); expect(legal.aids.rung).toBeLessThanOrEqual(1);
    const s = new Session(legal); expect(s.handle({ type: 'truth' }).type).toBe('error'); expect(s.handle({ type: 'result' }).type).toBe('error');
    runBot(s.sim, new OracleBot(s.sim, { useWatch: true })); expect(s.handle({ type: 'result' }).type).toBe('result'); expect(s.handle({ type: 'truth' }).type).toBe('truth');
    const aided = new Session(drillById('D16')!.scenario(1, 0)); expect(aided.handle({ type: 'truth' }).type).toBe('truth');
  }, 60000);
});
