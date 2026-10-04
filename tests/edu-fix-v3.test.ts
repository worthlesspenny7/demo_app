/** Education fix sprint v3 (docs/playtest/REVALIDATION-v3-education.md section 5): EDU-001 .. EDU-011. */
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { drillById, allDrills } from '../src/core/drills/registry.js';
import { isUnlocked, tierNeeds, drillOfScenario, drillTip, elapsedAfterReset } from '../src/core/drills/index.js';
import { Simulator, type Action, type StageResult } from '../src/core/sim.js';
import type { Scenario } from '../src/core/course.js';
import { OracleBot, runBot, makeBot, type Bot } from '../src/agent/bots.js';
import { headlineTip } from '../src/core/drills/rubrics.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';
import { CURRICULUM, START_PATH, startPathState, pathStepHash, readFirstOf, lockText, cardMinutesText, nextDrill } from '../src/ui/viewmodels/curriculum.js';
import { scenarioMinutes } from '../src/ui/viewmodels/estimate.js';
import { LESSONS, LESSON_ORDER, lessonText, FORD_NOTE, type LessonBlock } from '../content/lessons.js';
import { PENALTY_ROWS, CHECKPOINT_FACTS, COLUMN_C_ROWS, TA_STEPS, packardValue } from '../content/reference-data.js';
import { answerSheetOpen } from '../src/ui/screens/reference.js';
import { idealNotes } from '../src/core/drills/d15.js';
import { chartPairs } from '../src/core/drills/d06.js';
import { formatClock } from '../src/core/units.js';
import { runOracle } from './drill-helpers.js';
import { readFileSync } from 'node:fs';

const lesson = (id: string) => LESSONS.find(l => l.id === id)!;
const sim = (sc: Scenario): Simulator => new Simulator(sc, (sc.tags ?? []).includes('watch:digital') ? { watch: 'digital' } : {});
const play = (sc: Scenario, mk: (s: Simulator) => Bot | null): StageResult => { const s = sim(sc); return runBot(s, mk(s)); };
const rookie = (s: Simulator) => new OracleBot(s, { ignoreLosses: true });
const oracle = (s: Simulator) => new OracleBot(s, { useWatch: true });
const card = (): string[] => (lesson('protocol').body.find((b): b is Extract<LessonBlock, { card: unknown }> => typeof b !== 'string' && 'card' in b)!).card.lines;
const mmss = (x: number): string => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, '0')}`;
/** Wraps a bot so `before` runs first on every tick (notes, annotations). */
const withHook = (inner: Bot, before: (s: Simulator) => void): Bot => ({ name: 'hooked', onTick(s) { before(s); inner.onTick(s); } });

describe('EDU-001 D16: the headline names the departure finding', () => {
  it('EDU-001 a wrong minute at the restart heads "Fix this next" with the oneMinuteMistake finding; a launch with no lead names the late launch', () => {
    const d = drillById('D16')!; const sc = d.scenario(1, 0);
    const wm = play(sc, s => makeBot('wrongMinute', s));
    expect(wm.findings.some(f => f.kind === 'oneMinuteMistake')).toBe(true);
    const vm = debriefViewModel(wm, sc); expect(vm.tip).toMatch(/^Start on time \(the second S\): .*minute was misread/); expect(vm.tip).not.toMatch(/wandered/);
    expect(headlineTip(wm, sc)).toMatch(/^Start on time/);                       // the engine headline too, whatever the leg error
    const rk = play(sc, rookie); expect(rk.findings.some(f => f.kind === 'lateLaunch')).toBe(true);
    const rb = d.rubric(rk, sc); expect(rb.tip).toMatch(/after the launch time.*GO lands on the launch second/); expect(debriefViewModel(rk, sc).tip).toBe(rb.tip);
  });
});

describe('EDU-002 never "Clean run" under three stars', () => {
  it('EDU-002 D05, D04 (goCount), D06, D15, D01 and D16 name the drill\'s own failing skill in "Fix this next"', () => {
    const check = (id: string, sc: Scenario, r: StageResult, re: RegExp) => {
      const rb = drillById(id)!.rubric(r, sc); const vm = debriefViewModel(r, sc);
      expect(rb.stars, `${id} stars`).toBeLessThan(3); expect(rb.tip, id).not.toMatch(/^Clean run/); expect(rb.feedback[0], id).not.toMatch(/^Clean run/);
      expect(vm.tip, id).toBe(rb.tip); expect(vm.tip, id).toMatch(re);
    };
    { const sc = drillById('D05')!.scenario(1, 0); check('D05', sc, play(sc, rookie), /Landmark calls were .* late on average: you call at the sign/); }
    { const sc = drillById('D04')!.scenario(2, 0); check('D04', sc, play(sc, s => new OracleBot(s, { goCount: true })), /Timed-change calls were|At the STOP \+ timed lines your calls/); }   // ENG-022 (fix sprint PT-09): the STOP + timed lines are graded on their own and name goCount's error
    { const sc = drillById('D06')!.scenario(1, 0); check('D06', sc, play(sc, oracle), /No chart cells were noted/); }
    { const sc = drillById('D15')!.scenario(1, 0); const r = play(sc, s => { let done = false; return withHook(oracle(s), ss => { if (done) return; done = true; for (const x of idealNotes(sc)) { const ins = sc.book.find(b => b.n === x.n)!; ss.act({ type: 'line.annotate', n: x.n, text: ins.pause ? x.text.replace(/pause [\d.]+ s/, `pause ${ins.pause} s`) : x.text } as Action); } }); });
      check('D15', sc, r, /^Pre-read notation "chart pause time next to each pause" 0\/\d+/); }
    { const sc = drillById('D16')!.scenario(2, 0); check('D16', sc, play(sc, rookie), /launch time/); }
    // D01: laps 0.9 s late, every one (off the display): one star and the tip says why
    { const d = drillById('D01')!; const sc = d.scenario(1, 0); const marks = sc.book.filter(i => /Lap at/.test(i.text ?? '')).map(i => i.n);
      const s = sim(sc); const q: number[] = []; let seen = 0; let started = false;
      const r = runBot(s, { name: 'dial', onTick(ss) { if (ss.phase === 'preread' && !started && ss.tod >= sc.startTime - 4.5) { started = true; ss.act({ type: 'start' }); ss.act({ type: 'watch.start' }); }
        const crossed = ss.events.filter(e => e.type === 'node' && String(e.detail?.kind) === 'sign').length; while (seen < crossed) { seen++; q.push(ss.tod + 0.9); }
        while (q.length && q[0]! <= ss.tod) { q.shift(); ss.act({ type: 'watch.lap' }); } } });
      expect(marks.length).toBe(8); check('D01', sc, r, /late on average: that is the look down at the watch/); }
  });
  it('EDU-002 the engine headline with stars < 3 never says "Clean run"; with no stars given it still may', () => {
    const d = drillById('D03')!; const sc = d.scenario(3, 0); const r = play(sc, oracle);
    expect(headlineTip(r, sc)).toMatch(/^Clean run/); expect(headlineTip(r, sc, { stars: 2 })).not.toMatch(/^Clean run/);
    expect(drillOfScenario(sc)!.id).toBe('D03'); expect(drillOfScenario({ id: 'D08b-3-Bronze' })!.id).toBe('D08b'); expect(drillOfScenario({ id: 'stage-1' })).toBeUndefined();
    expect(drillTip(r, sc)).toBe(d.rubric(r, sc).tip);
  });
});

describe('EDU-003 the "recover more" lecture', () => {
  it('EDU-003 a Time Allowance that covers the train, a three-star run and an off-course run get no "recover a little more" lecture', () => {
    const b = drillById('D08b')!; const sc = b.scenario(1, 0); const r = play(sc, oracle); const rb = b.rubric(r, sc);
    expect(rb.stars).toBe(3); const tip = debriefViewModel(r, sc).tip; expect(tip).not.toMatch(/recover a little more/); expect(tip).toMatch(/committee credited \d+ s/); expect(tip).toMatch(/^Clean run: three stars/);
    // a synthetic recovery shortfall: lecture at 2 stars, none at 3
    const d = drillById('D03')!; const s3 = d.scenario(3, 0); const r3 = play(s3, oracle);
    const fake = { ...r3, offCourseCount: 0, score: { ...r3.score, legs: r3.score.legs.map(l => ({ ...l, error: 9, penalty: 9 })) }, attribution: [{ legIndex: 0, buckets: { stop: 14, cruise: -5, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, ta: 0 } }] } as unknown as StageResult;
    expect(headlineTip(fake, s3, { stars: 2 })).toMatch(/recover a little more/); expect(headlineTip(fake, s3, { stars: 3 })).toMatch(/^Clean run: three stars\. You lost 14 s in stops and made up 5 s/);
    // off course: the lost doctrine, never the 10 % rule
    const off = { ...fake, offCourseCount: 1, attribution: [{ legIndex: 0, buckets: { stop: 0, cruise: -5, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, ta: 0, offCourse: 300 } }] } as unknown as StageResult;
    const t = headlineTip(off, s3); expect(t).not.toMatch(/recover a little more|10 % rule/); expect(t).toMatch(/double it .*rejoin 30 s behind/);
    const d10 = drillById('D10')!; const s10 = d10.scenario(1, 0); const r10 = play(s10, oracle); const rb10 = d10.rubric(r10, s10);
    if (rb10.stars === 3) expect(rb10.tip).not.toMatch(/recover a little more/);
  });
});

describe('EDU-004 the tractor and the stop-and-go loss', () => {
  it('EDU-004 D08b no longer says a tractor is never a Time Allowance; the recovery lesson adds the chart loss to the measured delay, as the director and the engine do', () => {
    const d = drillById('D08b')!; expect(d.objective).not.toMatch(/A tractor is not a Time Allowance/); expect(d.objective).toMatch(/REG V\.H\.5 uses a farm tractor/); expect(d.objective).toMatch(/slow truck .* can be passed/);
    expect(d.scenario(1, 0).tags).toContain('ta:slowTruckLeg:2');
    const rec = lessonText(lesson('recovery')); expect(rec).not.toMatch(/only the wait itself is creditable/); expect(rec).toMatch(/stopped .* plus the stop-and-go loss for your speeds from your chart \(Time Delay Form \[01:38\], \[04:44\]/);
    expect(lessonText(lesson('four-s'))).toMatch(/own worked example is a farm tractor \(V\.H\.5\)/);
    const src = readFileSync('src/ui/screens/reference.ts', 'utf8'); expect(src).not.toMatch(/Only the wait is creditable/);
  });
});

describe('EDU-005 the Four S\'s order: lessons, path, links and gates', () => {
  it('EDU-005 lessons run safety and course first, then start on time, then stay on time; the path follows and every drive drill links its lesson', () => {
    expect([...LESSON_ORDER]).toEqual(LESSONS.map(l => l.id));
    const at = (id: string) => LESSONS.findIndex(l => l.id === id);
    // PLAY-023 (fix sprint PT-08): the handbook's own order: safety, start on time, stay on course, stay on time
    expect(at('four-s')).toBe(0); expect(at('griid-cameo')).toBeLessThan(at('pause-arithmetic')); expect(at('transits')).toBeLessThan(at('griid-cameo')); expect(at('ghost-car')).toBeLessThan(at('protocol')); expect(at('lost')).toBeLessThan(at('pause-arithmetic'));
    expect(at('transits')).toBeLessThan(at('which-timer')); expect(at('which-timer')).toBeLessThan(at('pause-arithmetic')); expect(at('measure-car')).toBeLessThan(at('calibration'));
    const p = START_PATH.map(s => s.id); const pi = (id: string) => p.indexOf(id);
    expect(p[0]).toBe('four-s'); for (const early of ['griid-cameo', 'protocol', 'D09', 'lost', 'D10', 'transits', 'D16']) expect(pi(early), early).toBeLessThan(pi('D01'));
    expect(pi('D16')).toBeLessThan(pi('D09'));   // PLAY-023: start on time before stay on course
    expect(pi('lost')).toBeLessThan(pi('D10')); expect(pi('transits')).toBeLessThan(pi('D16')); expect(pi('D06')).toBeGreaterThan(pi('D05')); expect(p[p.length - 1]).toBe('D18');
    for (const s of START_PATH) if (s.kind === 'lesson') expect(LESSONS.some(l => l.id === s.id), s.id).toBe(true);
    expect(pathStepHash({ kind: 'drill', id: 'D09', label: '' })).toBe('#/quiz/D09'); expect(pathStepHash({ kind: 'drill', id: 'D10', label: '' })).toBe('#/cockpit/drill/D10/0/1');
    expect(startPathState({}, () => false).find(x => x.current)!.step.id).toBe('four-s');
    for (const d of allDrills()) { const links = readFirstOf(d); expect(links.length, `${d.id} links a lesson`).toBeGreaterThan(0); for (const l of links) expect(LESSONS.some(x => x.id === l.id), `${d.id} -> ${l.id}`).toBe(true); }
    expect(CURRICULUM.indexOf('D10')).toBeLessThan(CURRICULUM.indexOf('D01')); expect(CURRICULUM.indexOf('D16')).toBeLessThan(CURRICULUM.indexOf('D03')); expect(CURRICULUM.indexOf('D16')).toBeLessThan(CURRICULUM.indexOf('D09'));
  });
  it('EDU-005 gates: D10 needs the lost lesson, D15 the transits lesson, Gold D03/D04/D05 need D06, D18 needs D16', () => {
    const none = () => false, all = () => true;
    expect(isUnlocked(drillById('D10')!, {}, none)).toBe(false); expect(isUnlocked(drillById('D10')!, {}, id => id === 'lost')).toBe(true); expect(isUnlocked(drillById('D10')!, {})).toBe(true);
    expect(isUnlocked(drillById('D15')!, {}, none)).toBe(false); expect(isUnlocked(drillById('D15')!, {}, all)).toBe(true);
    for (const id of ['D03', 'D04', 'D05']) { const d = drillById(id)!; expect(tierNeeds(d, 2, {})).toEqual([{ drill: 'D06', stars: 1 }]); expect(tierNeeds(d, 2, { D06: 1 })).toEqual([]); expect(tierNeeds(d, 0, {})).toEqual([]); expect(tierNeeds(d, 1, {})).toEqual([]); }
    expect(drillById('D18')!.unlock).toContainEqual({ drill: 'D16', stars: 1 }); expect(drillById('D12')!.unlock).toContainEqual({ drill: 'D16', stars: 2 });
    expect(lockText([{ drill: 'D16', stars: 1 }], ['lost'], id => (id === 'lost' ? 'When you are lost' : id))).toBe('D16 ★ at Silver or Gold; pass the lesson "When you are lost"');
    expect(nextDrill('D09', allDrills(), {}, none)!.drill.id).toBe('D10'); expect(nextDrill('D09', allDrills(), {}, none)!.locked).toBe(true); expect(nextDrill('D09', allDrills(), {}, all)!.locked).toBe(false);
  });
});

describe('EDU-006 the soft gates', () => {
  it('EDU-006 D10: a rookie on course but 50 s and more late is one star (no longer opens D18); the oracle keeps three on most seeds', () => {
    const d = drillById('D10')!; let three = 0;
    for (const seed of [1, 3]) { const sc = d.scenario(seed, 0); const rk = d.rubric(play(sc, rookie), sc); expect(rk.stars, `seed ${seed}`).toBe(1); expect(rk.feedback.join(' ')).toMatch(/stay on course first, then stay on time/); const or = d.rubric(play(sc, oracle), sc); if (or.stars === 3) three++; }
    expect(three).toBeGreaterThanOrEqual(1);
  });
  it('EDU-006 D16: a start with no launch lead is held at one star (the D12 gate reads two)', () => {
    const d = drillById('D16')!; const sc = d.scenario(3, 0);
    expect(d.rubric(play(sc, rookie), sc).stars).toBe(1); expect(d.rubric(play(sc, oracle), sc).stars).toBe(3);
  });
  it('EDU-006 D17: after the forced reset the elapsed time from the clock is graded (no note: one star at most; "elapsed m:ss" within 2 s and the watch restarted: three)', () => {
    const d = drillById('D17')!;
    for (const seed of [1, 2]) {
      const sc = d.scenario(seed, 0);
      const naive = play(sc, s => new OracleBot(s, { useWatch: true })); expect(naive.events.some(e => e.type === 'watchLost')).toBe(true);
      const rn = d.rubric(naive, sc); expect(rn.stars, `seed ${seed} naive`).toBeLessThanOrEqual(1); expect(rn.tip).toMatch(/elapsed time was not re-established/);
      const cal = sc.book.find(i => i.calibrationStart)!; let doneAfter = false;
      const good = play(sc, s => withHook(new OracleBot(s, { useWatch: true }), ss => {
        if (doneAfter || !ss.events.some(e => e.type === 'watchLost')) return; doneAfter = true;
        const t0 = ss.events.find(e => e.type === 'node' && e.detail?.nodeId === cal.nodeId)!.tod;
        ss.act({ type: 'clock.read' }); ss.act({ type: 'note', text: `elapsed ${mmss(ss.tod - t0)}` }); ss.act({ type: 'watch.start' });
      }));
      const g = elapsedAfterReset(good, sc)!; expect(g.err!).toBeLessThanOrEqual(0.2); expect(g.restarted).toBe(true); expect(g.anchorLabel).toMatch(/calibration asterisk/);
      expect(d.rubric(good, sc).stars, `seed ${seed} by the lesson`).toBe(3);
    }
  });
  it('EDU-006 D18: the hazard comes first and a recovery straight ends the leg, so the lesson earns three stars and the rookie none', () => {
    const d = drillById('D18')!;
    for (const seed of [4, 20]) { const sc = d.scenario(seed, 0); expect(d.rubric(play(sc, oracle), sc).stars, `oracle seed ${seed}`).toBe(3); expect(d.rubric(play(sc, rookie), sc).stars, `rookie seed ${seed}`).toBe(0); }
  });
});

describe('EDU-007 Dad\'s card and the first morning', () => {
  it('EDU-007 the twelve-line card carries safety, the full stop, the checkpoint signs, calibration conduct, the restart queue, lost, the phone and the emergency signs; no "stop short of the intersection"', () => {
    const c = card(); expect(c.length).toBe(21); const t = c.join('\n');   // PLAY-031 (fix sprint PT-08): one rule per line, so 21 short lines
    for (const phrase of ['Safety beats seconds', 'Every STOP sign is a full stop, even with no pause in the book', 'DNF', 'Never speed', 'Green sign = timing checkpoint: do nothing', 'never 5 mph or slower in sight of it (30 s)', 'Red GREAT RACE STOP board: stop', 'Calibration run: hold the indicated speed exactly, say nothing about early or late', 'Never guess a speed', 'train, tractor, school bus', 'wait back among the cars; pull up only after the car ahead has left', 'go around it', 'Not sure where we are: say so', 'never in sight of a green sign', 'no U-turn in traffic', 'No score is worth an accident', 'Day-Glo "GR" sign', '"End Leg"', 'Off the clock', 'Phones off and out of reach', 'warning, then 10 s, then 1 min'])
      expect(t, phrase).toContain(phrase);
    expect(lessonText(lesson('protocol'))).not.toMatch(/stop short of the intersection/i); expect(lessonText(lesson('protocol'))).toMatch(/Rule 10 .*never in sight of a green checkpoint sign/);
    expect(Math.max(...c.map(x => x.length))).toBeLessThan(330);   // printable: one short paragraph per line
  });
  it('EDU-007 LESSON-004 has the first morning in order; LESSON-006 the one-time-zone rule; the Four S\'s the full stop at every STOP and the phone rule', () => {
    const t = lessonText(lesson('transits'));
    for (const phrase of ['Your first morning, in order', '30 minutes before your start time (REG VII.B.2.a)', 'WWV clock', 'trust but verify', 'page 1 of 26', 'Tire warm-up: any safe speed, no timing checkpoint', 'at least 15 miles, 20-40 minutes in practice', 'adjust parked at the end of the run, never on the road', 'One time zone all day', 'If you reach a restart after your minute, go at once', 'within 15 minutes on the web form', 'red GREAT RACE STOP board'])
      expect(t, phrase).toContain(phrase);
    expect(lessonText(lesson('which-timer'))).toMatch(/One time zone all day.*REG V\.C\.1\.c/);
    const f = lessonText(lesson('four-s')); expect(f).toMatch(/Every STOP sign is a full stop, even when the book prints no pause/); expect(f).toMatch(/II\.H\.1\.i/); expect(f).toMatch(/V\.F\.1\.c/);
    expect(lessonText(lesson('rally-school'))).toMatch(/Day-Glo sign with the letters GR .*REG VII\.D\.3/s);
  });
});

describe('EDU-008 the slips', () => {
  it('EDU-008 the sixteen slips of the fact check are corrected and every Ford number is labelled a simulator default', () => {
    const L = (id: string) => lessonText(lesson(id));
    // 1, 2 (EDU-004); 3 exact transit (LESSON-007); 4, 5 checkpoint facts
    const wave = CHECKPOINT_FACTS.find(f => /^Wave, smile, honk/.test(f.fact))!; expect(wave.doc).toBeNull(); expect(wave.cite).toMatch(/\[64:10\]/);
    expect(CHECKPOINT_FACTS.map(f => f.fact).join(' ')).not.toMatch(/slower than 5 mph/); expect(CHECKPOINT_FACTS.map(f => f.fact).join(' ')).toMatch(/5 mph or slower/);
    expect(L('rally-school')).not.toMatch(/never go slower than 5 mph/); expect(L('rally-school')).toMatch(/Wave, smile, honk, run your headlights if you like, but do not talk to the crew \(.*\) \(video, not in the documents\)/);
    // 6 calibration length; 7 champions; 8 odometer
    expect(L('calibration')).not.toMatch(/18-20 minutes/); expect(L('calibration')).toMatch(/20-40 minutes/);
    expect(L('ghost-car')).toMatch(/our estimate from docs\/research\/06/); expect(lesson('ghost-car').source).toMatch(/06/); expect(L('ghost-car')).not.toMatch(/gives you no distances and no odometer/); expect(L('ghost-car')).toMatch(/approximately N miles/);
    // 9 Ford labels
    expect(FORD_NOTE).toBe('simulator default, measure your car');
    for (const id of ['pause-arithmetic', 'timed-leads', 'protocol', 'transits']) expect(L(id), id).toMatch(/simulator default, measure your car|a simulator default/);
    expect(L('protocol')).not.toMatch(/about 4 s for the Ford\) and go on GO, so the car is at speed exactly on your minute \(Starting on Time \[03:41\]; HB p\.7\)/);
    // 10 Column D sentence; 11 stop shortening; 12 TA method; 13 glossary; 14 director; 15 exact transit stopwatch
    expect(L('griid-cameo')).toMatch(/on the race sheets shown in the 2024 and 2026 schools no sentence appears/);
    expect(L('recovery')).not.toMatch(/legal only on a pause that is printed/); expect(L('recovery')).toMatch(/5 MPH or faster near a checkpoint/);
    expect(L('four-s')).toMatch(/in 2026 that is the web form on your phone/);
    expect(L('protocol')).toMatch(/crossroad, sideroad, T, Y and jog are simulator convention/);
    expect(L('rally-school')).not.toMatch(/the director no longer uses a watch for time of day/);
    expect(L('which-timer')).toMatch(/The sources differ .*Classen starts the stopwatch at the IN line \(Rally School Part 1 \[46:31\]\)/);
    // 16 penalty rows
    for (const rule of ['V.E.3.c, II.D.4', 'V.E.3.d, II.E.8', 'V.E.3.f', 'II.H.1.i', 'V.F.1.c']) expect(PENALTY_ROWS.some(r => r.rule === rule), rule).toBe(true);
    expect(PENALTY_ROWS.find(r => r.rule === 'II.H.1.i')!.penalty).toBe('warning, then 10 seconds, then 1 minute'); expect(PENALTY_ROWS.find(r => r.rule === 'V.E.3.f')!.penalty).toBe('DNF');
    expect(COLUMN_C_ROWS.find(r => r.shows === '26m00s')!.means).toMatch(/2026 Example Rally #31/); expect(TA_STEPS.find(r => r.rule === 'V.H.1')!.text).toMatch(/farm tractor/);
  });
});

describe('EDU-009 D06: a copier can earn three stars; measuring is taught; the answer sheet waits', () => {
  it('EDU-009 Bronze pairs sit inside the printed 15-50 mph, so the copied Packard charts earn three stars; the "Measure your car" lesson teaches HB Appendix B, the two poles and the chart tool', () => {
    const d = drillById('D06')!;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sc = d.scenario(seed, 0); const pairs = chartPairs(sc.tags); expect(pairs.every(p => p.vIn <= 50 && p.vOut <= 50), `seed ${seed}`).toBe(true);
      if (seed > 2) continue;
      const notes = pairs.map(p => { const id = p.kind === 'accel' ? 'accel' : p.kind === 'turn' ? 'turn' : 'stopgo'; const v = packardValue(id, p.vIn, p.vOut)!; const w = p.kind === 'stopGo' ? 'stopgo' : p.kind === 'stopMid' ? 'stopmid' : p.kind; return `${w} ${p.vIn}>${p.vOut} = ${(p.kind === 'stopMid' ? 15 - v : v).toFixed(1)}`; });
      const r = play(sc, s => { let done = false; return withHook(oracle(s), ss => { if (!done) { done = true; for (const t of notes) ss.act({ type: 'note', text: t }); } }); });
      expect(d.rubric(r, sc).stars, `copier seed ${seed}`).toBe(3);
    }
    expect(d.readFirst).toContain('measure-car');
    const t = lessonText(lesson('measure-car'));
    for (const phrase of ['HB Appendix B', 'At least four runs at each speed, in both directions', '"3, 2, 1, GO"', 'It is NOT the time it takes to reach the speed', 'front wheels at the end marker', 'Stop & Go pause times', 'two telephone poles', 'stop completely about 50 yards on', 'seconds only', 'Four runs per speed, per driver', 'A negative net loss is impossible', '(video, not in the documents)', '1936 Packard charts are better than nothing'])
      expect(t, phrase).toContain(phrase);
    expect(lesson('measure-car').check.options[lesson('measure-car').check.answer]).toBe('3.2 s');
  });
  it('EDU-009 the Reference answer sheet is closed until D06 is passed', () => {
    expect(answerSheetOpen(undefined)).toBe(false); expect(answerSheetOpen({ stars: 0 })).toBe(false); expect(answerSheetOpen({ stars: 1 })).toBe(true);
    const src = readFileSync('src/ui/screens/reference.ts', 'utf8'); expect(src).toMatch(/if \(d06\) answerSheet\.setAttribute\('open', ''\)/); expect(src).not.toMatch(/if \(!d06\) answerSheet\.setAttribute/);
  });
});

describe('EDU-010 card budgets, D02 and the D15 cliff', () => {
  it('EDU-010 every drive drill\'s minutes field is within 25 % of the measured 1x ghost time; the card shows 1x and 4x; D02 is gone', () => {
    for (const d of allDrills().filter(x => x.kind === 'drive' && x.id !== 'D13')) { const m = scenarioMinutes(d.scenario(1, 0)); expect(Math.abs(d.minutes - m) / m, `${d.id}: field ${d.minutes}, ghost ${m}`).toBeLessThanOrEqual(0.25); }
    for (const id of ['D08b', 'D11', 'D12', 'D17']) { const d = drillById(id)!; const m = scenarioMinutes(d.scenario(1, 0)); const text = cardMinutesText(d); expect(text, id).toMatch(/at 1x · ~.* at 4x$/); expect(Number(/~(\d+)/.exec(text.split('·')[1]!)?.[1] ?? 0) || 60 * Number(/~(\d+) h/.exec(text.split('·')[1]!)?.[1] ?? 0), id).toBeGreaterThan(0); expect(text).toContain(m < 60 ? `~${m} min at 1x` : 'h'); }
    expect(cardMinutesText(drillById('D01')!)).not.toMatch(/4x/);
    expect(drillById('D02')).toBeUndefined(); expect(CURRICULUM).not.toContain('D02'); expect(readFileSync('src/ui/screens/home.ts', 'utf8')).not.toMatch(/'D02'/);
  });
  it('EDU-010 D15: five of six notations (a missed restart line) is two stars; missing the chart pause times is still zero', () => {
    const d = drillById('D15')!; const sc = d.scenario(1, 0); const notes = idealNotes(sc);
    const run = (ns: { n: number; text: string }[]) => play(sc, s => { let done = false; const outDone = new Set<number>(); return withHook(oracle(s), ss => {
      if (!done) { done = true; for (const x of ns) ss.act({ type: 'line.annotate', n: x.n, text: x.text } as Action); }
      for (const ev of ss.events) if (ev.type === 'transit.in' && !outDone.has(Number(ev.detail?.n))) { outDone.add(Number(ev.detail?.n)); const begin = sc.book.find(b => b.n === Number(ev.detail?.n))!; const end = sc.book.find(b => b.transit?.end && b.transit.exact && b.restartTime === undefined && b.n > begin.n); if (begin.transit && end) ss.act({ type: 'line.annotate', n: end.n, text: `OUT ${formatClock(Number(ev.detail!.tod) + begin.transit.seconds)}` } as Action); }
    }); });
    const noRestart = d.rubric(run(notes.map(a => ({ ...a, text: a.text.replace(/restart [\d:]+/, 'restart') }))), sc); expect(noRestart.stars).toBe(2); expect(noRestart.tip).toMatch(/restart time/);
    const printed = d.rubric(run(notes.map(a => { const ins = sc.book.find(b => b.n === a.n)!; return ins.pause ? { ...a, text: a.text.replace(/pause [\d.]+ s/, `pause ${ins.pause} s`) } : a; })), sc); expect(printed.stars).toBe(0);
  });
});

describe('EDU-011 the rookie bot starts the stopwatch', () => {
  it('EDU-011 a rookie run carries no "no stopwatch start or lap" finding, so its tip has no bot-artifact discipline clause', () => {
    for (const id of ['D03', 'D04']) { const sc = drillById(id)!.scenario(1, 0); const r = play(sc, rookie);
      expect(r.instrumentDiscipline.filter(f => f.kind === 'clockForInterval'), id).toEqual([]); expect(debriefViewModel(r, sc).tip, id).not.toMatch(/Instrument discipline/);
      expect(r.instrumentLog.some(e => e.kind === 'watch.start')).toBe(true); }
    const s = sim(drillById('D03')!.scenario(1, 0)); const noWatch = runBot(s, new OracleBot(s, { ignoreLosses: true, useWatch: false })); expect(noWatch.instrumentLog.some(e => e.kind === 'watch.start')).toBe(false);
  });
});
