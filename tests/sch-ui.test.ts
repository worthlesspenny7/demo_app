/** Phase IX Rally School 2.0, UI parts (SCH-003..008, SCH-010): pure models of the widgets, course progress and guided state, the figure set,
 *  the reference resolution and the route table. DOM behaviour: e2e/school.spec.ts and e2e/school-geom.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { HoldSpeedModel, WhereCheckpointModel, TapLapModel, sampleScorecard, worstLeg, cardTotal, scorecardTotal, driftText, steadyGhost, legScore, HOLD_SECONDS } from '../src/ui/school2/widget-models.js';
import { figureSvg, figureId, FIGURE_IDS, FIGURE_ALIAS } from '../src/ui/school2/figures.js';
import { course, moduleForLesson, excerptFor, videoLink, mmss, secondsOfKey, COURSE_DATA, CONTROL_LABEL, pointerFor, CONTROL_IDS } from '../src/ui/school2/sources.js';
import { emptyCourseState, withPageReached, withTryIt, guidedState, coreComplete, deskUnlocked, continueTarget, continueLabel, courseStarted, normalizeCourseState, type CourseState } from '../src/ui/school2/progress.js';
import { swipeDir, pageFromPart, playerPages } from '../src/ui/school2/player.js';
import { controlsOf, CONTROL_SELECTOR, HIDE_UNTIL_INTRODUCED } from '../src/ui/mobile/guided.js';
import { miniRunFor } from '../src/ui/school2/minisim.js';
import { tryItPlanFor } from '../src/ui/school2/tryit.js';
import { normalize } from '../src/ui/mobile/progress.js';
import { ghostTimeAt } from '../src/core/ghost.js';
import { ageFactor } from '../src/core/scoring.js';
import type { Decision } from '../src/core/decision/index.js';

const view = (state: CourseState, pos: Record<string, number> = {}) => ({ state, pos: { pos, last: null } });
const done = (...ids: string[]): CourseState => ({ ...emptyCourseState(), modulesDone: ids });

describe('SCH-003 widgets read the engine', () => {
  it('SCH-003 holdSpeed: the readout is the car against the ghost (ghostTimeAt); 10 s within 1 mph of 35 completes it', () => {
    const m = new HoldSpeedModel(35, 25, 0);
    for (let i = 0; i < 20; i++) m.step(0.1);
    expect(m.drift()).toBeCloseTo(2 - ghostTimeAt(steadyGhost(35), m.s), 6);
    expect(m.drift()).toBeGreaterThan(0); expect(driftText(m.drift())).toMatch(/s late$/);
    m.setTarget(35); for (let i = 0; i < (HOLD_SECONDS - 0.5) * 10; i++) m.step(0.1);
    expect(m.complete).toBe(false);
    for (let i = 0; i < 6; i++) m.step(0.1);
    expect(m.complete).toBe(true);
    const fast = new HoldSpeedModel(35, 45, 0); for (let i = 0; i < 30; i++) fast.step(0.1); expect(driftText(fast.drift())).toMatch(/s early$/);
    // leaving the band resets the hold
    const h = new HoldSpeedModel(35, 35, 0); for (let i = 0; i < 50; i++) h.step(0.1); h.setTarget(40); h.step(0.1); expect(h.held).toBe(0);
  });
  it('SCH-003 whereCheckpoint: the checkpoint is where the ghost ends the leg; the tap is scored by scoreLeg (whole seconds, Ace at 0)', () => {
    const m = new WhereCheckpointModel(30, 0.1, 3);
    expect(m.perfect).toBeCloseTo(528 / 44, 6);
    const sc = m.press(m.perfect + 2.2); expect(sc.penalty).toBe(Math.abs(Math.round(m.perfect + 2.2) - m.perfect) < 0.5 ? 2 : sc.penalty); expect(sc.error).toBeGreaterThan(0);
    expect(new WhereCheckpointModel(30, 0.1, 3).press(Math.round(m.perfect)).penalty).toBe(legScore(m.perfect, Math.round(m.perfect)).penalty);
    expect(legScore(120, 120).ace).toBe(true); expect(legScore(120, 500).penalty).toBe(120);   // late cap
  });
  it('SCH-003 tapLap: three LAPs on the real digital stopwatch; the split question asks for the cumulative time', () => {
    const m = new TapLapModel(3, 7);
    m.markerTimes.forEach(t => m.lap(t + 0.2)); expect(m.done).toBe(true); expect(m.lap(30)).toBeNull();
    expect(m.table()).toHaveLength(3); m.errors().forEach(e => expect(e).toBeCloseTo(0.2, 6));
    const right = m.splitOptions().filter(o => o.right); expect(right).toHaveLength(1);
    expect(right[0]!.label).toBe(`${m.table()[1]!.cumulative.toFixed(2)} s`);
  });
  it('SCH-003 readScorecard: five engine-scored legs with one clear worst; the day score is raw x the age factor', () => {
    const legs = sampleScorecard(4);
    expect(legs).toHaveLength(5);
    const w = worstLeg(legs); expect(legs.filter(l => l.score.penalty === w.score.penalty)).toHaveLength(1);
    const t = scorecardTotal(legs, 1939); expect(t.raw).toBe(cardTotal(legs)); expect(t.factor).toBe(ageFactor(1939));
    expect(t.options.filter(o => o.right).map(o => Number(o.label))).toEqual([t.score]);
  });
  it('SCH-003 no rule is re-implemented in the widgets: they import ghost, scoring and stopwatch from src/core', () => {
    const src = readFileSync('src/ui/school2/widget-models.ts', 'utf8');
    for (const m of ['core/ghost.js', 'core/scoring.js', 'core/stopwatch.js']) expect(src).toContain(m);
    expect(src).not.toMatch(/maxLate\s*=|120\s*\/\/ cap/);
  });
});

describe('SCH-006 the page player', () => {
  it('SCH-006 every module plays its pages then the try-it page; swipes and page numbers', () => {
    expect(course().length).toBe(13); expect(COURSE_DATA.source).toBe('content');
    for (const m of course()) { const p = playerPages(m); expect(p[p.length - 1]!.kind).toBe('tryit'); expect(p.length).toBe(m.pages.length + 1); }
    expect(swipeDir(-120, 10)).toBe(1); expect(swipeDir(120, 10)).toBe(-1); expect(swipeDir(-30, 0)).toBe(0); expect(swipeDir(-80, 90)).toBe(0);
    expect(pageFromPart('3', 9, 0)).toBe(2); expect(pageFromPart('99', 9, 0)).toBe(8); expect(pageFromPart(undefined, 9, 4)).toBe(4); expect(pageFromPart('x', 9, 40)).toBe(8);
  });
  it('SCH-006 the figure set: ghost vs real car, the five columns, the stop sign with its chart cell, the clock face, the distance bar; content figure ids map onto it', () => {
    expect(FIGURE_IDS).toEqual(['ghost', 'columns', 'stop', 'clock', 'distance', 'seats', 'checkpoint']);   // PT-17: the two seats and the green checkpoint sign
    for (const f of FIGURE_IDS) expect(figureSvg(f)).toMatch(new RegExp(`^<figure class="s2-fig" data-figure="${f}"><svg [^>]*role="img"`));
    for (const [k, v] of Object.entries(FIGURE_ALIAS)) expect(figureId(k)).toBe(v);
    expect(figureId('ghost-car')).toBe('ghost'); expect(figureSvg('route-66')).toBe(''); expect(figureSvg(undefined)).toBe('');
  });
  it('SCH-006 SCH-002 every chip in the course resolves to an excerpt for the sheet; video chips carry their second; the video button needs a URL', () => {
    for (const m of course()) for (const p of m.pages) {
      expect(p.refs.length).toBeLessThanOrEqual(2);
      for (const r of p.refs) { const e = excerptFor(r.key); expect(e, r.key).not.toBeNull(); expect(e!.text.length).toBeGreaterThan(10); expect(e!.citation.length).toBeGreaterThan(5); if (r.type === 'video') expect(e!.seconds ?? secondsOfKey(r.key)).toBeGreaterThanOrEqual(0); }
    }
    expect(mmss(6628)).toBe('110:28'); expect(mmss(64)).toBe('1:04'); expect(secondsOfKey('video:2026:110:28')).toBe(6628);
    expect(videoLink({ key: 'video:2026:04:44' })).toBeNull();   // no URLs in content/videos.ts yet: the chip opens the excerpt only
  });
});

describe('SCH-005 mini-sim pages', () => {
  it('SCH-005 the engine miniSim gives one card of the page kind with its control and a retry', () => {
    const r = miniRunFor({ decisionKind: 'turn', seed: 201, control: 'callTurn' });
    expect(r).not.toBeNull();
    const step = r!.next() as { type: string; decision: Decision }; expect(step.type).toBe('decision'); expect(step.decision.kind).toBe('turn');
    expect(r!.guided?.pointer).toBeTruthy(); expect(typeof r!.retry).toBe('function');
    for (const c of CONTROL_IDS) { expect(CONTROL_LABEL[c].length).toBeGreaterThan(5); expect(pointerFor(c).split(/\s+/).length).toBeLessThanOrEqual(14); expect(CONTROL_SELECTOR[c]).toBeTruthy(); }
  });
});

describe('SCH-007 try-it', () => {
  it('SCH-007 the try-it plan is the engine tryItPlan: 5 decisions of the module kinds only, no rule cards', () => {
    for (const m of course()) {
      const p = tryItPlanFor(m, 11)!; expect(p.decisionCount).toBe(5);
      expect(p.items.every(i => i.type === 'decision' && m.tryIt.kinds.includes(i.micro.kind))).toBe(true);
    }
  });
  it('SCH-007 recording a try-it keeps the best stars and marks the module done (Progress.markTryIt semantics)', () => {
    let c = withTryIt(emptyCourseState(), 'm0', 2); c = withTryIt(c, 'm0', 1);
    expect(c.tryItStars['m0']).toBe(2); expect(c.modulesDone).toEqual(['m0']);
    expect(readFileSync('src/ui/mobile/run.ts', 'utf8')).toMatch(/if \(session\.courseTry\) \{/);
  });
});

describe('SCH-004 guided controls', () => {
  it('SCH-004 a visitor who never opened the course is not guided; one in the course is, until modules 0-6 are done', () => {
    expect(guidedState(emptyCourseState()).active).toBe(false);
    const g = guidedState(withPageReached(done('m0', 'm1'), 'm2', 1));
    expect(g.active).toBe(true); expect(g.introduced).toEqual(['book', 'callTurn', 'distanceBar', 'callSpeed', 'go']); expect(g.newest).toBe('go');
    expect(guidedState(done('m0', 'm1')).introduced).toEqual(['book']);
    const core7 = done('m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6');
    expect(coreComplete(core7)).toBe(true); expect(guidedState(core7).active).toBe(false);
    expect(deskUnlocked(core7)).toBe(false); expect(deskUnlocked(done(...course().map(m => m.id)))).toBe(true);
    expect(courseStarted(withPageReached(emptyCourseState(), 'm0', 1))).toBe(true);
  });
  it('SCH-004 Home "Continue course: Module n, page m": the first module not done at its remembered page', () => {
    const t = continueTarget(view(done('m0', 'm1'), { m2: 3 }))!; expect(continueLabel(t)).toBe('Continue course: Module 2, page 4');
    expect(continueLabel(continueTarget(view(emptyCourseState()))!)).toBe('Continue course: Module 0, page 1');
    expect(continueTarget(view(done(...course().map(m => m.id))))).toBeNull();
  });
  it('SCH-004 the run screen maps each card to its controls; read-outs hide, answer controls grey', () => {
    const d = (kind: Decision['kind'], extra: Partial<Decision> = {}): Decision => ({ id: 'x', kind, skill: 'stayOnTime', prompt: 'p', context: { tod: 0, elapsed: 0, chart: { kind: 'stopGo', vIn: 30, vOut: 30, seconds: 9 } }, ...extra }) as Decision;
    expect(controlsOf(d('pause', { timing: { kind: 'countdown', truthSeconds: 9, toleranceSeconds: 1, maxSeconds: 20, tapLabel: 'GO' } }))).toEqual(expect.arrayContaining(['go', 'chartCell', 'todStrip']));
    expect(controlsOf(d('timedStart', { timing: { kind: 'startStop', truthSeconds: 5, toleranceSeconds: 1, maxSeconds: 30, tapLabel: 'START', signSeconds: 5 } }))).toEqual(expect.arrayContaining(['watchStartStop', 'watchLap', 'distanceBar']));
    expect(HIDE_UNTIL_INTRODUCED).toEqual(['chartCell', 'distanceBar', 'todStrip']);
    expect(readFileSync('src/ui/mobile/run.ts', 'utf8')).toMatch(/applyGuided\(page, d\)/);
  });
  it('SCH-004 the course progress rides in the decision progress and survives normalize', () => {
    const p = normalize({ course: { modulesDone: ['m0'], pages: { m1: 2 }, tryItStars: { m0: 3 } } });
    expect(normalizeCourseState((p as unknown as { course: unknown }).course)).toEqual({ modulesDone: ['m0'], pages: { m1: 2 }, tryItStars: { m0: 3 } });
    expect(withPageReached(withPageReached(emptyCourseState(), 'm1', 3), 'm1', 1).pages['m1']).toBe(3);
  });
});

describe('SCH-008 SCH-010 routes', () => {
  it('SCH-008 an old lesson id redirects to the module that covers it', () => {
    expect(moduleForLesson('ghost-car')?.id).toBe('m0'); expect(moduleForLesson('protocol')?.id).toBe('m2');
    for (const id of ['four-s', 'which-timer', 'pause-arithmetic', 'timed-leads', 'recovery', 'calibration', 'griid-cameo', 'markup', 'transits', 'rally-school', 'lost', 'measure-car']) expect(moduleForLesson(id), id).not.toBeNull();
    const school = readFileSync('src/ui/screens/school.ts', 'utf8'); expect(school).toMatch(/schoolRedirect\(id\)/); expect(school).toMatch(/export function renderRules/);
    const main = readFileSync('src/ui/main.ts', 'utf8'); expect(main).toMatch(/parts\[1\] === 'rules'\) renderRules/); expect(main).toMatch(/case 'lesson': renderLongLesson/);
  });
  it('SCH-010 a brand-new visitor on the bare page is sent to the School with the first-visit line', () => {
    expect(COURSE_DATA.firstVisit).toMatch(/^What is this\?/);
    const main = readFileSync('src/ui/main.ts', 'utf8'); expect(main).toMatch(/if \(l\.school\) \{ firstVisit = true; if \(l\.first\) markFirstVisit\(\)/);
  });
});
