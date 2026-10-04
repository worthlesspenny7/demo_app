/** Drill curriculum D01-D20 (DESIGN §14, DRILL-* specs). V2 drills live in d01/d06/d07/d08b/d15/d16/staged.ts; this file registers them with the older ones. */
import { EXITS, describeInstruction } from '../builder.js';
import { aidsForRung, DRIVER_EXPERT } from '../course.js';
import { rng } from '../rng.js';
import { registerDrill, allDrills } from './registry.js';
import { T0, tiers, tierOf, base } from './common.js';
import { D16 } from './d16.js';
import { D08b } from './d08b.js';
import { D06 } from './d06.js';
import { D15 } from './d15.js';
import { D07, parseDuration } from './d07.js';
import { D01 } from './d01.js';
import { D18, D11, D12, D13, setDayFallback } from './staged.js';
import type { Drill, Rubric } from './types.js';
import type { StageResult } from '../sim.js';
import type { Scenario } from '../course.js';
import { basicRubric, legErrors, meanAbs, callErrors, driverScale, headlineTip, withSkillTip, starsFromMeanAbs } from './rubrics.js';
import { lostProcedure, LOST_GUIDANCE } from './lost.js';
import { formatClock } from '../units.js';

export { setGenerator } from './common.js';
/** EDU-005: Gold on D03/D04/D05 hides the car's numbers (HIDDEN_FORD), so it needs the chart built in D06 first. */
const GOLD_NEEDS_D06: Record<number, { drill: string; stars: number }[]> = { 2: [{ drill: 'D06', stars: 1 }] };
// ---------- D03 pause arithmetic ----------
const D03: Drill = {
  id: 'D03', title: 'Pause arithmetic at the stop sign', objective: 'At each STOP wait only the chart pause time (the printed pause minus your car\'s stop/start loss for this IN/OUT pair), then call go. Bronze hands you the 1936 Packard charts and drives the Packard.', skills: ['P2', 'P12'], minutes: 10, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['pause-arithmetic'], tierUnlock: GOLD_NEEDS_D06,
  scenario(seed, t) { const tier = tierOf(D03, t); const r = rng(seed); const b = base('D03', 'Pause drill', seed, tier, { trafficWaitProbability: t >= 2 ? 0.25 : 0, startProcedure: 'drill' }).start(r.pick([30, 35, 40]));
    for (let i = 0; i < 6; i++) { b.advanceMiles(0.35 + r.next() * 0.4); b.stop(r.pick(['S', 'S', 'L', 'R']), r.pick([30, 35, 40]), { pause: r.pick([15, 15, 15, 20, 30]) }); if (i % 2 === 1) { b.advanceMiles(0.2 + r.next() * 0.3); b.checkpoint(); } }
    return b.advanceMiles(0.3).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) { return basicRubric(r, [1, 3, 6], ['Chart pause time: dwell = printed pause - stop/start loss for the entry/exit speeds on your card (for a 15 s pause it is the stop & go chart value; for any other pause keep the printed pause and scale only the chart loss).'], sc.driver.skill, sc); },
};

// ---------- D04 timed speed changes ----------
const D04: Drill = {
  id: 'D04', title: 'Timed speed changes', objective: 'Hold X for N seconds then Y: count from the ghost\'s departure and call half a ramp early.', skills: ['P3'], minutes: 10, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['timed-leads'], tierUnlock: GOLD_NEEDS_D06,
  scenario(seed, t) { const tier = tierOf(D04, t); const r = rng(seed); const b = base('D04', 'Timed changes', seed, tier, { startProcedure: 'drill' }).start(35);
    const specs = [{ hold: 30, sec: 15, then: 40 }, { hold: 25, sec: 18, then: 35 }, { hold: 40, sec: 45, then: 30 }, { hold: 30, sec: 36, then: 40 }];
    for (let i = 0; i < 6; i++) {
      b.advanceMiles(0.4 + r.next() * 0.4);
      if (i === 2 || i === 5) { const sp = specs[r.int(0, 3)]!; b.instruction({ control: 'STOP', exits: EXITS.crossroads('S'), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'S', pause: 15, timed: { holdSpeed: sp.hold, seconds: sp.sec, thenSpeed: sp.then }, speed: sp.hold }); }
      else { const sp = specs[i % 4]!; b.timedAt(r.pick(['bridge', 'RR crossing', 'church on R', 'water tower']), { holdSpeed: sp.hold, seconds: sp.sec, thenSpeed: sp.then }); }
      if (i === 2) { b.advanceMiles(0.5 + r.next() * 0.3); b.checkpoint(); }
    }
    return b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) {
    // PLAY-006: graded on the navigator's call error at each timed change (the Debrief's bias row), not the net bucket where early and late calls cancel
    const errs = callErrors(r, sc, 'timed'); const perChange = meanAbs(errs); const bias = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
    const rb = basicRubric(r, [1, 2.5, 5], ['Compound lines ("STOP P15, 25 for 40 then 45"): the 40 s starts when the ghost leaves, 15 s after arrival, not at your go.'], sc.driver.skill, sc);
    const k = driverScale(sc.driver.skill);
    const changeStars: 0 | 1 | 2 | 3 = perChange <= 0.6 * k ? 3 : perChange <= 1.2 * k ? 2 : perChange <= 2.5 * k ? 1 : 0;
    rb.stars = Math.min(rb.stars, changeStars) as 0 | 1 | 2 | 3; rb.headline += ` · timed-change calls ${perChange.toFixed(1)} s off each (average ${Math.abs(bias).toFixed(1)} s ${bias >= 0 ? 'late' : 'early'})`;
    // EDU-002: the call error is the drill's own skill: it heads "Fix this next" whenever it held the stars down
    const tip = changeStars < 3 ? `Timed-change calls were ${perChange.toFixed(1)} s off each, ${Math.abs(bias).toFixed(1)} s ${bias >= 0 ? 'late' : 'early'} on average: start the count when the ghost leaves the line (the moment you pass it, or arrival plus the printed pause at a STOP, never your own GO) and call the new speed half a ramp before the count ends.` : null;
    return withSkillTip(rb, r, sc, tip);
  },
};

// ---------- D05 landmark speed changes ----------
const D05: Drill = {
  id: 'D05', title: 'Speed changes at landmarks', objective: 'Split the change at the sign: be at the midpoint speed as the bumper passes it, which means calling the change half a ramp early.', skills: ['P4'], minutes: 10, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['timed-leads'], tierUnlock: GOLD_NEEDS_D06,
  scenario(seed, t) { const tier = tierOf(D05, t); const r = rng(seed); const b = base('D05', 'Landmark speed changes', seed, tier, { startProcedure: 'drill' }).start(35); let v = 35;
    for (let i = 0; i < 8; i++) { b.advanceMiles(0.3 + r.next() * 0.4); const nv = r.pick([25, 30, 40, 45, 50].filter(x => Math.abs(x - v) >= 10)); b.speedAtSign(r.pick([`SPEED LIMIT ${nv}`, 'CURVE', 'END ROAD WORK', 'BRIDGE']), nv, { side: r.chance(0.3) ? 'L' : 'R', shape: r.chance(0.5) ? 'rect' : 'diamond' }); v = nv; if (i === 3) { b.advanceMiles(0.4); b.checkpoint(); } }
    return b.advanceMiles(0.4).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) {
    // PLAY-006: graded on the call error at each sign (alternating up and down changes no longer cancel): calling at the sign is late by half a ramp
    const errs = callErrors(r, sc, 'landmark'); const perChange = meanAbs(errs); const bias = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
    const rb = basicRubric(r, [1, 2, 4], ['Split at the sign: lead time = half the ramp time for that pair of speeds (it is on your performance card), so you cross the sign at the midpoint speed.'], sc.driver.skill, sc);
    const k = driverScale(sc.driver.skill);
    const changeStars: 0 | 1 | 2 | 3 = perChange <= 0.8 * k ? 3 : perChange <= 1.3 * k ? 2 : perChange <= 2.0 * k ? 1 : 0;
    rb.stars = Math.min(rb.stars, changeStars) as 0 | 1 | 2 | 3; rb.headline += ` · landmark calls ${perChange.toFixed(1)} s off each (average ${Math.abs(bias).toFixed(1)} s ${bias >= 0 ? 'late' : 'early'})`;
    // EDU-002: name the call error, not the leg error, when the calls held the stars down
    const tip = changeStars < 3 ? (bias >= 0
      ? `Landmark calls were ${perChange.toFixed(1)} s off each, ${bias.toFixed(1)} s late on average: you call at the sign. Call the new speed half a ramp before it (the lead for each pair is on your card) so the bumper crosses the sign at the midpoint speed (HB p.12).`
      : `Landmark calls were ${perChange.toFixed(1)} s off each, ${(-bias).toFixed(1)} s early on average: lead by half the ramp for that pair of speeds, not more, so the bumper crosses the sign at the midpoint speed (HB p.12).`) : null;
    return withSkillTip(rb, r, sc, tip);
  },
};

// ---------- D08 early/late recovery ----------
const D08: Drill = {
  id: 'D08', title: 'Running early or late', objective: 'Absorb a slow truck and a red light: time each loss, then recover with the 10 % rule (10 % faster for 10 x the seconds lost) without overshooting early. A Time Allowance is for the train or accident, never for seconds you also made up.', skills: ['P6'], minutes: 10, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['recovery'],
  scenario(seed, t) { const tier = tierOf(D08, t); const r = rng(seed); const b = base('D08', 'Recovery', seed, tier).start(40);
    b.advanceMiles(0.4); b.hazard({ kind: 'slow', speedMph: 28, lengthFt: 1500 + r.int(0, 1000), passWindowAfterFt: 900 });
    b.advanceMiles(1.6).stop('S', 40);
    b.advanceMiles(0.8).instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 40 });
    b.hazard({ kind: 'signal', redSeconds: 20 + r.int(0, 15), greenSeconds: 40, offset: T0 + r.int(0, 60) });
    b.advanceMiles(2.0).checkpoint().advanceMiles(1.2).checkpoint().advanceFt(300).finish();
    return b.build(); },
  rubric(r, sc) { return basicRubric(r, [2, 5, 10], ['10 % rule (HB p.10): 10 % faster for 10 x the seconds lost (4 s lost at 35: 38.5 mph for 40 s); the same rule burns off time you are ahead. Finish before likely checkpoint spots.'], sc.driver.skill, sc); },
};

// ---------- D09 trap quiz (static) ----------
const D09: Drill = {
  id: 'D09', title: 'Trap quiz: which way?', objective: 'Read the instruction and the CAMEO/road view; pick the exit. 20 cards from the trap library.', skills: ['P8'], minutes: 5, kind: 'quiz',
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: '20 cards' }], unlock: [], readFirst: ['griid-cameo'],
  scenario(seed, t) { return D10.scenario(seed, t); }, rubric(r, sc) { return basicRubric(r, [1, 3, 6], [], sc.driver.skill, sc); },
};

// ---------- D10 course following in motion ----------
const D10: Drill = {
  id: 'D10', title: 'Course following with distractors', objective: 'Fifteen instructions with driveways, gravel roads and misleading signs: stay on course; time is secondary. If you do go wrong, run the lost doctrine: stopwatch at the turn-around, double it for the lost time, rejoin 30 s behind a car known to be on course.', skills: ['P7', 'P8'], minutes: 12, kind: 'drive',
  tiers: tiers(), unlock: [], readFirst: ['griid-cameo', 'lost'], lessonGate: ['lost'],
  scenario(seed, t) { const tier = tierOf(D10, t); const r = rng(seed); const b = base('D10', 'Course following', seed, tier, { excursionFt: 1500 }).start(35);
    for (let i = 0; i < 12; i++) {
      b.advanceMiles(0.25 + r.next() * 0.35);
      const kind = r.int(0, 5);
      if (kind === 0) { b.advanceFt(-400 + 0).node({ exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'driveway' }); b.advanceFt(400); b.instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 600 }, { turn: 'R', speed: 35, hint: '1st paved road' }); }
      else if (kind === 1) { b.node({ exits: EXITS.sideRoad('L'), sightDistance: 500, label: 'side road L' }); b.advanceFt(500); b.instruction({ exits: EXITS.tee('L'), sightDistance: 600, control: 'STOP', sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'L', pause: 15, speed: 35 }); }
      else if (kind === 2) { b.instruction({ exits: EXITS.wye(r.pick(['BL', 'BR'])), sightDistance: 600 }, { turn: 'BL', speed: 35 }); }
      else if (kind === 3) { b.node({ control: 'YIELD', exits: EXITS.crossroads('S'), sightDistance: 500, sign: { text: 'YIELD', shape: 'triangle', side: 'R' } }); b.advanceFt(700); b.stop(r.pick(['L', 'R']), 35); }
      else if (kind === 4) { b.instruction({ exits: EXITS.sideRoad('L', { surface: 'gravel' }), sightDistance: 500 }, { text: 'Continue (gravel road on L)', speed: 35 }); }
      else { b.instruction({ exits: EXITS.crossroads('S', { sideControl: 'STOP' }), sightDistance: 600 }, { turn: 'S', speed: 35, hint: 'Cross traffic stops, you do not' }); }
    }
    const sc = b.advanceMiles(0.3).checkpoint().advanceFt(300).finish().build();
    // make every turn instruction match its route exit
    for (const ins of sc.book) { const n = sc.course.nodes.find(x => x.id === ins.nodeId)!; if (n.exits && ins.turn) { const route = n.exits.find(e => e.isRoute)!; const nt = Math.abs(route.angle) < 20 ? 'S' : Math.abs(route.angle) < 60 ? (route.angle < 0 ? 'BL' : 'BR') : route.angle < 0 ? 'L' : 'R'; if (nt !== ins.turn) { ins.turn = nt; ins.text = describeInstruction({ turn: nt, speed: ins.speed, pause: ins.pause, hint: ins.hint }, { control: n.control, exits: n.exits, sign: n.sign, label: n.label }); } } }
    return sc; },
  rubric(r, sc) {
    // LOST-001: a wrong turn is scored on the doctrine too: stopwatch at the turn-around, the doubled time written within 2 s
    // EDU-006: on course, the stars are also bounded by the timing (a rookie 52-84 s late no longer earns 2 and opens D18): Stay on course first, then Stay on time
    const lost = lostProcedure(r); const k = driverScale(sc.driver.skill); const mean = meanAbs(legErrors(r));
    const timing: 1 | 2 | 3 = mean <= 10 * k ? 3 : mean <= 20 * k ? 2 : 1;
    const base: 0 | 1 | 2 | 3 = r.offCourseCount === 0 ? timing : r.offCourseCount === 1 ? 1 : 0;
    const proc = lost.length > 0 && lost.every(x => x.watchStarted && x.ok);
    const stars = (r.offCourseCount === 1 && proc ? 2 : base) as 0 | 1 | 2 | 3;
    const feedback = [r.offCourseCount ? 'Confirm the landmark (shape, side, text) before the leading edge; driveways, lots and gravel are not roads.' : timing === 3 ? 'On course all the way. Now add the clock.' : `On course all the way, but the leg ran ${mean.toFixed(1)} s off (three stars need ${(10 * k).toFixed(0)} s or less): stay on course first, then stay on time.`];
    if (r.offCourseCount) {
      for (const x of lost) feedback.push(`Lost (LOST-001): turn-around ${formatClock(x.turnAroundTod)}, back at the junction ${formatClock(x.rejoinTod)}: doubled = ${x.doubled.toFixed(1)} s. ${x.watchStarted ? 'The stopwatch was started at the turn-around.' : 'Start the stopwatch at the turn-around.'} ${x.noted === null ? 'You wrote no lost time ("lost 94").' : x.ok ? `Your ${x.noted} s is within 2 s.` : `Your ${x.noted} s is more than 2 s off.`}`);
      if (!lost.length) feedback.push('You never called the turn-around while off course: when you know you are lost, say "turn around", start the stopwatch, and double it.');
      feedback.push(LOST_GUIDANCE);
    }
    // EDU-003: an off-course run gets the lost doctrine as its tip; an on-course run the leg-error tip for its stars
    const tip = r.offCourseCount ? `Off course ${r.offCourseCount} time(s): confirm the landmark (shape, side, text) before the leading edge of the intersection. Once lost: turn around where it is safe, start the stopwatch at the turn-around, double it for the lost time, rejoin 30 s behind a car known to be on course and write the leg off (lesson "When you are lost").` : headlineTip(r, sc, { stars });
    return { score: r.offCourseCount, stars, tip, headline: `${r.offCourseCount} off-course excursions${lost.length ? `, lost time ${lost.map(x => (x.ok ? 'doubled within 2 s' : 'not doubled')).join(', ')}` : ''}${r.offCourseCount ? '' : `, leg error ${mean.toFixed(1)} s`}`, feedback: [tip, ...feedback] };
  },
};

// ---------- D14 mental math (static) ----------
const D14: Drill = {
  id: 'D14', title: 'Mental math without a calculator', objective: 'Seconds arithmetic, recovery factors, pause dwell, seconds per mile. Calculators are banned in the Great Race.', skills: ['P2', 'P6', 'P13'], minutes: 5, kind: 'math',
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: 'question cards' }], unlock: [], readFirst: ['pause-arithmetic', 'recovery'],
  scenario(seed, t) { return D03.scenario(seed, t); }, rubric(r, sc) { return basicRubric(r, [1, 3, 6], [], sc.driver.skill, sc); },
};

// ---------- D17 stopwatch loss recovery ----------
const D17: Drill = {
  id: 'D17', title: 'Lost the watch', objective: 'The calibration run of D07, and the stopwatch falls and resets in the middle of it. Re-establish the elapsed time from the clock: elapsed = time of day now minus the time of day you wrote at the last official point (the calibration asterisk, a restart or the last checkpoint). Write it as a note ("elapsed 12:34.5"), restart the stopwatch and finish.', skills: ['P1', 'P9'], minutes: 45, kind: 'drive',
  tiers: tiers([3, 2, 1]), unlock: [], readFirst: ['which-timer', 'calibration'],
  scenario(seed, t) { const sc = D07.scenario(seed, t); sc.id = `D17-${seed}`; sc.name = 'Watch loss'; sc.tags = [...(sc.tags ?? []), `forceWatchReset:${600 + rng(seed).int(0, 300)}`]; return sc; },
  rubric(r, sc) {
    const rb = basicRubric(r, [3, 8, 15], ['Your time-of-day clock is the source of truth: elapsed = clock - the last official time you wrote down.'], sc.driver.skill, sc);
    // EDU-006: the forced reset is graded: the elapsed time read off the clock after the reset, within 2 s, and the stopwatch running again
    const g = elapsedAfterReset(r, sc);
    if (!g) return rb;
    const elapsedStars: 1 | 2 | 3 = g.noted !== null && g.err !== null && g.err <= 2 && g.restarted ? 3 : g.noted !== null && g.err !== null && g.err <= 5 ? 2 : 1;
    rb.stars = Math.min(rb.stars, elapsedStars) as 0 | 1 | 2 | 3;
    rb.headline += ` · after the reset: ${g.noted === null ? 'no elapsed time written' : `elapsed ${g.noted.toFixed(1)} s written, true ${g.truth.toFixed(1)} s`}${g.restarted ? ', watch restarted' : ', watch not restarted'}`;
    rb.feedback.push(`The watch reset at ${formatClock(g.resetTod)}. The last official point before it was ${g.anchorLabel} at ${formatClock(g.anchorTod)}.${g.noted === null ? ' No "elapsed m:ss" note was written after the reset.' : ` You wrote ${g.noted.toFixed(1)} s at ${formatClock(g.noteTod!)}; the clock said ${g.truth.toFixed(1)} s (${g.err! <= 2 ? 'within 2 s' : `${g.err!.toFixed(1)} s off`}).`}${g.restarted ? '' : ' Restart the stopwatch once you have the elapsed time.'}`);
    const tip = elapsedStars < 3 ? `The stopwatch reset mid-run and the elapsed time was ${g.noted === null ? 'not re-established' : `${g.err!.toFixed(1)} s off`}: read the time of day (stopwatch TOD mode or the clock's second hand), subtract the time of day you wrote at ${g.anchorLabel}, write "elapsed m:ss", restart the stopwatch and carry on. Write the time of day at every official point so this is always possible.` : null;
    return withSkillTip(rb, r, sc, tip);
  },
};

/** EDU-006 (D17): the elapsed-time note after the forced watch reset against the clock: now minus the last official point (calibration asterisk crossing, start, restart time, timing checkpoint crossing). */
export function elapsedAfterReset(r: StageResult, sc: Scenario): { resetTod: number; anchorTod: number; anchorLabel: string; noted: number | null; noteTod: number | null; truth: number; err: number | null; restarted: boolean } | null {
  const lost = r.events.find(e => e.type === 'watchLost'); if (!lost) return null;
  const anchors: { tod: number; label: string }[] = [{ tod: sc.startTime, label: 'the start' }];
  const cal = sc.book.find(i => i.calibrationStart); if (cal) { const e = r.events.find(x => x.type === 'node' && x.detail?.nodeId === cal.nodeId); if (e) anchors.push({ tod: e.tod, label: `the calibration asterisk (line ${cal.n})` }); }
  for (const i of sc.book) if (i.section === 'restart' && i.restartTime !== undefined && i.n > 1) anchors.push({ tod: i.restartTime, label: `the restart (line ${i.n})` });
  let cp = 0; for (const e of r.events) if (e.type === 'checkpoint' && e.detail?.kind === 'timing') anchors.push({ tod: e.tod, label: `checkpoint ${++cp}` });
  const before = anchors.filter(a => a.tod <= lost.tod).sort((a, b) => b.tod - a.tod)[0] ?? anchors[0]!;
  const t0 = sc.startTime - sc.prereadSeconds;   // the action log is in ticks of 0.1 s from the start of the pre-read (SIM-025)
  const notes = r.actions.filter(a => a.action.type === 'note').map(a => ({ tod: t0 + a.tick * 0.1, text: (a.action as { text: string }).text })).filter(n => n.tod >= lost.tod);
  let best: { v: number; tod: number; err: number } | null = null;
  for (const n of notes) { const m = /elapsed\s*[=:]?\s*([0-9][0-9ms:.]*)/i.exec(n.text); const v = m ? parseDuration(m[1]!) : null; if (v === null) continue; const err = Math.abs(v - (n.tod - before.tod)); if (!best || err < best.err) best = { v, tod: n.tod, err }; }
  const restarted = r.instrumentLog.some(e => e.kind === 'watch.start' && e.tod >= lost.tod);
  return { resetTod: lost.tod, anchorTod: before.tod, anchorLabel: before.label, noted: best?.v ?? null, noteTod: best?.tod ?? null, truth: best ? best.tod - before.tod : (r.events[r.events.length - 1]?.tod ?? lost.tod) - before.tod, err: best?.err ?? null, restarted };
}

setDayFallback(seed => D07.scenario(seed, 2));
for (const d of [D01, D03, D04, D05, D06, D07, D08, D08b, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18]) registerDrill(d);

/**
 * Unlock check against a progress map of best stars per drill. EDU-005: with `lessonDone` the drill's lesson gates count too (D10 needs the lost
 * lesson, D15 the transits-and-restarts lesson); without it only the drill stars are checked.
 */
export function isUnlocked(d: Drill, bestStars: Record<string, number>, lessonDone?: (id: string) => boolean): boolean {
  return d.unlock.every(u => (bestStars[u.drill] ?? 0) >= u.stars) && (!lessonDone || (d.lessonGate ?? []).every(l => lessonDone(l)));
}
/** EDU-005: what a tier still needs (empty when the tier is open): Gold D03/D04/D05 need D06. */
export function tierNeeds(d: Drill, tier: number, bestStars: Record<string, number>): { drill: string; stars: number }[] {
  return (d.tierUnlock?.[tier] ?? []).filter(u => (bestStars[u.drill] ?? 0) < u.stars);
}
export { allDrills };

/** EDU-002: the drill a scenario belongs to ("D08b-3-Bronze" -> D08b), or undefined for built-in scenarios. */
export function drillOfScenario(sc: Pick<Scenario, 'id'> | null | undefined): Drill | undefined {
  const id = /^(D\d{2}b?)(?:-|$)/.exec(sc?.id ?? '')?.[1]; return id ? allDrills().find(d => d.id === id) : undefined;
}
/** EDU-002: the drill's own "Fix this next" for a finished run (its rubric's tip), or null when the scenario is not a drill or the rubric fails. */
export function drillTip(r: StageResult, sc: Scenario): string | null {
  const d = drillOfScenario(sc); if (!d || d.kind !== 'drive') return null;
  try { const rb = d.rubric(r, sc); return rb.tip ?? rb.feedback[0] ?? null; } catch { return null; }
}
/** B7: the drill's rubric for a finished run (stars included), or null when the scenario is not a drill or the rubric fails. */
export function drillRubric(r: StageResult, sc: Scenario): Rubric | null {
  const d = drillOfScenario(sc); if (!d || d.kind !== 'drive') return null;
  try { return d.rubric(r, sc); } catch { return null; }
}
export type { Drill, Rubric };
