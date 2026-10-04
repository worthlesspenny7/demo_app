/** UI fix sprint PT-07 (2026-10-04): view-model, rubric and engine regressions for the top ten of docs/playtest/PT-07-playability-v3-fixed.md. Spec ids: docs/spec/SPECS.md "UI FIX SPRINT PT-07". */
import { describe, it, expect } from 'vitest';
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { ScenarioBuilder } from '../src/core/builder.js';
import { Simulator } from '../src/core/sim.js';
import { DRIVER_EXPERT, FORD_1939, aidsForRung } from '../src/core/course.js';
import { hms } from '../src/core/units.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { headlineTip, uncalledSpeeds, timedAnchorTod, stopCauses } from '../src/core/drills/rubrics.js';
import { departuresOf } from '../src/core/drills/departures.js';
import { debriefViewModel, rankTips, workedStops } from '../src/ui/viewmodels/debrief.js';
import { perfCardFor, instrumentPolicy, holdCardFor, clockReadPrompt, lineSpeeds } from '../src/ui/viewmodels/cockpitinfo.js';
import { startDeltaRows, inTransitRun } from '../src/ui/viewmodels/v3.js';
import { drillHint } from '../src/ui/viewmodels/hints.js';
import { sectionArrows, bookRows, stageDisplayName, bookPages } from '../src/ui/viewmodels/book.js';
import { griidRowHtml } from '../src/ui/render/griid.js';
import { chartGrids } from '../src/ui/viewmodels/charts.js';
import { campaignSummary, loadCampaign } from '../src/ui/viewmodels/campaign.js';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';

const T0 = hms(8, 0, 0);
const quiet = { ...DRIVER_EXPERT, inconsistency: 0 };
const until = (sim: Simulator, pred: () => boolean, max = 3600): void => { let t = 0; while (!pred() && t < max && sim.phase !== 'finished') { sim.step(0.1); t += 0.1; } };

describe('PT-07 debrief truth (N2, N3, N4, B16, B7)', () => {
  it('PLAY-013 a Time Allowance credit is counted once: the ta bucket is -credit and the leg buckets sum to the leg error', () => {
    const d = drillById('D08b')!; const sc = d.scenario(2, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const credited = r.score.legs.filter(l => (l.taCredit ?? 0) > 0); expect(credited.length).toBeGreaterThan(0);
    const vm = debriefViewModel(r, sc);
    for (const l of credited) { const leg = vm.legs.find(x => x.legIndex === l.index)!; const ta = leg.segments.find(s => s.bucket === 'ta'); expect(ta, `leg ${l.index}`).toBeDefined(); expect(ta!.seconds).toBeCloseTo(-l.taCredit!, 0); expect(Math.abs(leg.residual), `residual leg ${l.index}`).toBeLessThanOrEqual(1.5); }
  });
  it('PLAY-013 a stop bucket that comes from STOP signs with no printed pause says "make the seconds up", never "go earlier"; stops with a printed pause keep "go earlier"', () => {
    const sc = drillById('D03')!.scenario(2, 1); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim, { ignoreLosses: true }));
    const mk = (stops: { pause: number; actualCost: number }[]) => ({ ...r, offCourseCount: 0, instrumentDiscipline: [], findings: [], observationMissed: false, score: { ...r.score, earlyDeparturePenalty: 0, dnf: false, legs: r.score.legs.map(l => ({ ...l, error: 12, penalty: 12, taCredit: 0 })) }, attribution: [{ legIndex: 1, buckets: { stop: 12, cruise: 0, start: 0, speedChange: 0, timedChange: 0, turn: 0, hazard: 0, offCourse: 0, ta: 0 }, cruiseSeconds: 0, meanSpeedRatio: 1, stops: stops.map(s => ({ nodeId: 'n', line: 3, pause: s.pause, actualCost: s.actualCost, dwell: 0, goDwell: 0, trafficWait: 0, vIn: 35, vOut: 35, turn: null })) }] }) as typeof r;
    const noPause = mk([{ pause: 0, actualCost: 12.2 }, { pause: 15, actualCost: 0.3 }]);
    expect(stopCauses(noPause).noPause).toBeCloseTo(12.2, 1);
    const t1 = headlineTip(noPause, sc, { stars: 1 }); expect(t1).toMatch(/make the seconds up/); expect(t1).toMatch(/no pause printed/); expect(t1).not.toMatch(/go earlier/);
    expect(headlineTip(mk([{ pause: 15, actualCost: 12 }]), sc, { stars: 1 })).toMatch(/go earlier/);
  });
  it('PLAY-013 a STOP that leaves at the speed it came in at needs no new speed call: no "you never called 40"; a different out speed still does', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(3), prereadSeconds: 20 }).start(40).advanceMiles(0.5).stop('S', 40, { pause: 15 }).advanceMiles(0.5).stop('S', 30, { pause: 15 }).advanceMiles(0.5).checkpoint().advanceFt(300).finish().build();
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const noCalls = r.events.filter(e => e.type !== 'call.speed');   // nothing is ever called after the start
    const missed = uncalledSpeeds(noCalls, sc); const stopLines = sc.book.filter(i => i.pause).map(i => i.n);
    expect(missed.map(m => m.line)).toEqual([stopLines[1]]);          // 40 -> 40 at the first stop: nothing to call; 40 -> 30 at the second: the driver cannot guess it
    expect(missed[0]!.mph).toBe(30);
  });
  it('PLAY-013 no worked row says "entry ?"; every worked stop row opens "Stop, line N"', () => {
    const sc = generateStage(1, PROFILES.fullStage); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); const rows = workedStops(r.events, sc, r.attribution);
    expect(rows.length).toBeGreaterThan(0); for (const row of rows) { expect(row.text).toMatch(/^Stop, line \d+:/); expect(row.text).not.toMatch(/entry \?|exit \?/); }
  });
  it('PLAY-014 "Clean run" needs three stars and no finding: never at 0-2 stars, never next to an instrument finding; the Debrief of a 0-2 star drill run leads with the drill tip', () => {
    const sc = drillById('D03')!.scenario(3, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const clean = { ...r, instrumentDiscipline: [], findings: [], observationMissed: false } as typeof r;
    const perfect = { ...clean, score: { ...clean.score, earlyDeparturePenalty: 0, dnf: false, legs: clean.score.legs.map(l => ({ ...l, error: 0, penalty: 0 })) } } as typeof r;
    expect(headlineTip(perfect, sc, { stars: 3 })).toMatch(/^Clean run/);
    for (const stars of [0, 1, 2]) expect(headlineTip(perfect, sc, { stars }), `${stars} stars`).not.toMatch(/^Clean run/);
    const withInst = { ...perfect, instrumentDiscipline: [{ kind: 'clockForInterval' as const, line: 4, text: 'x' }] } as typeof r;
    expect(headlineTip(withInst, sc, { stars: 3 })).toMatch(/^Leg times are clean, but/);
    const d5 = drillById('D05')!; const s5 = d5.scenario(1, 0); const sim5 = new Simulator(s5); const r5 = runBot(sim5, new OracleBot(sim5, { ignoreLosses: true }));
    expect(d5.rubric(r5, s5).stars).toBeLessThan(3); const vm = debriefViewModel(r5, s5); expect(vm.tip).not.toMatch(/^Clean run/); expect(vm.tips[0]).toBe(d5.rubric(r5, s5).tip);
    expect(rankTips(r5, s5, true, 'x', { rows: [], tip: null, topType: null, errors: { stop: [], timed: [], landmark: [], turn: [], cruise: [], restart: [] } }, { cruise: 0, stop: 0, speedChange: 0, timedChange: 0, hazard: 0, offCourse: 0, turn: 0, start: 0, ta: 0 })[0]).not.toMatch(/^Clean run/);
  });
});

describe('PT-07 cards and prompts (N5, N6, N7, N8, N9)', () => {
  it('PLAY-015 the D04 card of a STOP + timed line says the count runs from the ghost\'s departure (arrival + pause - braking), the same anchor the Debrief and the stars use', () => {
    const sc = drillById('D04')!.scenario(1, 0); const ins = sc.book.find(i => i.pause && i.timed)!; expect(ins).toBeDefined();
    const card = perfCardFor(sc, ins.n, instrumentPolicy(sc.aids))!; const fg = card.timed!.fromGhost!; expect(fg.pause).toBe(ins.pause);
    expect(fg.afterStopped).toBeLessThan(ins.pause!); expect(fg.callAfterStopped).toBeCloseTo(fg.afterStopped + card.timed!.call, 1);
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); const ev = r.events; const ci = ev.findIndex(e => e.type === 'node' && e.detail?.nodeId === ins.nodeId);
    const wait = [...ev.slice(0, ci)].reverse().find(e => e.type === 'wait')!; const anchor = timedAnchorTod(ev, sc, ins, ci, lineSpeeds(sc, ins.n).vIn ?? undefined);
    expect(anchor - wait.tod).toBeCloseTo(fg.afterStopped, 0);
    const plain = sc.book.find(i => i.timed && !i.pause); if (plain) expect(perfCardFor(sc, plain.n, instrumentPolicy(sc.aids))!.timed!.fromGhost).toBeUndefined();
  });
  it('PLAY-016 D16 grades the lunch departure like every hold: leave at the out-time minus the standing-start loss (same tolerance); the hold cards print that lead', () => {
    const sc = drillById('D16')!.scenario(1, 0); const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim));
    const lunch = departuresOf(r, sc).find(d => d.kind === 'promoted')!; const outDep = departuresOf(r, sc).find(d => d.kind === 'transitOut')!;
    expect(lunch.lead).toBeGreaterThan(2); expect(Math.abs(lunch.lead - outDep.lead)).toBeLessThan(2.5);   // the same lead rule (the standing-start loss to the speed it leaves at)
    const shift = (to: number) => { const ev = r.events.map(e => ({ ...e })); const i0 = ev.findIndex(e => e.type === 'wait' && e.detail?.nodeId === sc.book.find(i => i.promotedStop)!.nodeId); const rel = ev.slice(i0 + 1).find(e => e.type === 'release')!; rel.tod = to; return departuresOf({ ...r, events: ev } as typeof r, sc).find(d => d.kind === 'promoted')!; };
    expect(shift(lunch.target - lunch.lead + 0.3).err).toBe(0); expect(shift(lunch.target - lunch.lead - 3).err).toBeCloseTo(3, 1);
    const meal = sc.book.find(i => i.promotedStop)!; const card = holdCardFor(sc, { transitIn: {}, transitOutFor: () => null, holdGoTod: () => hms(10, 27, 0) }, meal.n)!; expect(card.lead).toBeGreaterThan(2);
  });
  it('PLAY-016 Bronze asks "Read the clock now (K)" at the exact-transit IN sign and 60 s before an out time, and D16 lists K among its keys', () => {
    const sc = drillById('D16')!.scenario(1, 0); const src = { transitIn: {}, transitOutFor: () => null, holdGoTod: () => hms(10, 27, 0) };
    const begin = sc.book.find(i => i.transit?.exact && !i.transit.end)!; const inCard = holdCardFor(sc, src, begin.n)!; expect(clockReadPrompt(inCard, null)).toMatch(/Read the clock now \(K\)/);
    const meal = holdCardFor(sc, src, sc.book.find(i => i.promotedStop)!.n)!;
    expect(clockReadPrompt(meal, 59)).toMatch(/Read the clock now \(K\)/); expect(clockReadPrompt(meal, 61)).toBeNull(); expect(clockReadPrompt(meal, null)).toBeNull();
    expect(drillHint('D16').keys.some(([k]) => k === 'K')).toBe(true);
  });
  it('PLAY-017 the start line\'s hold card is titled "Start, line 1" (not "Restart") and says nothing about leaving at that second; a restart keeps its title', () => {
    const sc = drillById('D16')!.scenario(1, 0); const start = holdCardFor(sc, null, 1)!;
    expect(start.title).toBe('Start, line 1'); expect(start.start).toBe(true); expect(start.text).not.toMatch(/leave at that second/); expect(clockReadPrompt(start, 30)).toBeNull();
    const rs = sc.book.find(i => i.n > 1 && i.section === 'restart')!; expect(holdCardFor(sc, null, rs.n)!.title).toBe(`Restart, line ${rs.n}`);
  });
  it('PLAY-017 a drill start: no "no warning to the driver" row, and the early-departure finding says the car launches itself', () => {
    const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, prereadSeconds: 60 }).start(35).advanceMiles(1).checkpoint().advanceFt(300).finish().build(); sc.startProcedure = 'drill';
    const sim = new Simulator(sc); sim.step(5); sim.act({ type: 'start' }); const r = runBot(sim, null as never);
    const f = r.findings.find(x => x.kind === 'earlyLaunch')!; expect(f.text).toMatch(/launches itself/); expect(f.text).not.toMatch(/about 30 seconds/);
    const row = { line: 1, kind: 'start', ownTime: 28800, launchTime: 28796, actual: 28796, delta: 0, warned: false, auto: 'drill' };
    expect(startDeltaRows({ startDeltas: [row] })[0]!.text).not.toMatch(/no warning/); expect(startDeltaRows({ startDeltas: [{ ...row, auto: undefined }] }, { drillStart: true })[0]!.text).not.toMatch(/no warning/);
    expect(startDeltaRows({ startDeltas: [{ ...row, auto: undefined }] })[0]!.text).toMatch(/no warning/);
  });
  it('PLAY-018 a transit or warm-up is an untimed state: it opens with the transit box and closes at its end line or a restart', () => {
    const sc = generateStage(1, PROFILES.fullStage); const endIdx = sc.book.findIndex(i => i.transit?.end);
    expect(inTransitRun(sc, null)).toBe(true); expect(inTransitRun(sc, 1)).toBe(true); expect(inTransitRun(sc, endIdx)).toBe(true); expect(inTransitRun(sc, endIdx + 1)).toBe(false);
    expect(inTransitRun(drillById('D03')!.scenario(1, 0), 2)).toBe(false);
  });
});

describe('PT-07 legal rung (N15)', () => {
  it('PLAY-020 at aids rung <= 1 the driver never states the computed time at a restart, an exact-transit OUT or a meal stop; at rung 3 he still does', () => {
    const mk = (rung: 0 | 1 | 3) => {
      const sc = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(rung), prereadSeconds: 30 }).start(40).advanceFt(2000).transit({ exact: false, seconds: 300, miles: 3 }).advanceMiles(3).restart(35, T0 + 600).advanceMiles(1).checkpoint().advanceFt(400).finish().build();
      const sim = new Simulator(sc); sim.act({ type: 'skipPreread', secondsBefore: 5 }); sim.act({ type: 'start' }); until(sim, () => sim.waitingForGo, 900); return sim.driverMsgs[sim.driverMsgs.length - 1]!.text;
    };
    for (const rung of [0, 1] as const) { const t = mk(rung); expect(t, `rung ${rung}`).toMatch(/^Restart line\. What is our time\?/); expect(t).not.toMatch(/\d\d:\d\d:\d\d/); }
    expect(mk(3)).toMatch(/^Restart line\. Our time is \d\d:\d\d:\d\d/);
    const lunch = (rung: 0 | 3) => { const b = new ScenarioBuilder({ startTime: T0, driver: quiet, aids: aidsForRung(rung), prereadSeconds: 30 }).start(40).advanceMiles(0.5); b.transit({ exact: false, seconds: 3600 }).advanceMiles(1).promotedStop('meal', 2700).advanceMiles(3).restart(40, T0 + 3600).advanceMiles(1).checkpoint().advanceFt(400);
      const s = new Simulator(b.finish().build()); s.act({ type: 'skipPreread', secondsBefore: 5 }); s.act({ type: 'start' }); until(s, () => s.waitingForGo, 900); return s.driverMsgs[s.driverMsgs.length - 1]!.text; };
    expect(lunch(0)).toMatch(/^Lunch stop\. When do we leave\?/); expect(lunch(0)).not.toMatch(/\d\d:\d\d:\d\d/); expect(lunch(3)).toMatch(/We leave AT \d\d:\d\d:\d\d/);
  });
});

describe('PT-07 book realism and leftovers (items 10)', () => {
  it('PLAY-021 a vertical arrow runs down Columns B and C from the row that opens a transit or the calibration run to the row that ends it', () => {
    const sc = generateStage(1, PROFILES.fullStage); const arrows = sectionArrows(sc.book); expect(arrows.length).toBe(sc.book.length);
    const open = sc.book.findIndex(i => i.transit && !i.transit.end); const end = sc.book.findIndex((x, k) => k > open && !!x.transit?.end);
    expect(arrows[open]!.vout).toBe(true); expect(arrows[open]!.vin).toBe(false); expect(arrows[end]!.vin).toBe(true);
    for (let i = open + 1; i < end; i++) { expect(arrows[i]!.vcont, `row ${i + 1}`).toBe(true); expect(arrows[i]!.vin && arrows[i]!.vout).toBe(true); }
    const cal = sc.book.findIndex(i => i.section === 'calibration'); expect(arrows[cal]!.vout).toBe(true);
    const rows = bookRows(sc.book, 1); const html = griidRowHtml(rows[open + 1]!, { svg: '' }); expect(html).toMatch(/class="gb vin vout vcont"/); expect(html).toMatch(/class="gc vin vout vcont"/); expect(html).toContain('class="vseg cont"');
    const plain = drillById('D03')!.scenario(1, 0); expect(sectionArrows(plain.book).some(a => a.vin || a.vout)).toBe(false);
  });
  it('PLAY-021 the printed footer names the stage ("Day stage 1"), not the generator\'s "fullStage #1"', () => {
    expect(stageDisplayName('fullStage #1')).toBe('Day stage 1'); expect(stageDisplayName('Pause drill')).toBe('Pause drill');
    const sc = generateStage(1, PROFILES.fullStage); const pages = bookPages(sc.book, stageDisplayName(sc.name), { scenario: sc }); expect(pages[0]!.foot.right[0]).toBe('Day stage 1');
  });
  it('PLAY-022 chart (c) has no cliff between the 12 and 15 mph rows: 15 -> 15 and 15 -> 20 sit between the 12 row and the 20 row', () => {
    const t = chartGrids(FORD_1939).find(g => g.id === 'turns')!; const cell = (i: number, o: number): number => t.rows.find(r => r.in === i)!.cells.find(c => c.out === o)!.value;
    expect(cell(15, 15)).toBeLessThan(cell(20, 20) - 1); expect(cell(15, 15) - cell(12, 15)).toBeLessThan(0.7); expect(cell(15, 20)).toBeGreaterThan(cell(12, 20)); expect(cell(15, 20)).toBeLessThan(cell(20, 20));
  });
  it('PLAY-022 the campaign names its tiers Bronze / Silver / Gold and ranks you only after a stage is played', () => {
    expect(drillById('D13')!.tiers.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold']);
    const store = { getItem: () => null, setItem: () => undefined }; const sum = campaignSummary(loadCampaign(store), 0);
    expect(sum.played).toBe(0); expect(sum.standings[sum.standings.length - 1]!.you).toBe(true);
  });
});
