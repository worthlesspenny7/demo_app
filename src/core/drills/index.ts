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
import { D07 } from './d07.js';
import { D01 } from './d01.js';
import { D18, D11, D12, D13, setDayFallback } from './staged.js';
import type { Drill, Rubric } from './types.js';
import { basicRubric, legErrors, meanAbs } from './rubrics.js';
import { lostProcedure, LOST_GUIDANCE } from './lost.js';
import { formatClock } from '../units.js';

export { setGenerator } from './common.js';
// ---------- D03 pause arithmetic ----------
const D03: Drill = {
  id: 'D03', title: 'Pause arithmetic at the stop sign', objective: 'At each STOP wait only the chart pause time (the printed pause minus your car\'s stop/start loss for this IN/OUT pair), then call go. Bronze hands you the 1936 Packard charts and drives the Packard.', skills: ['P2', 'P12'], minutes: 6, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D03, t); const r = rng(seed); const b = base('D03', 'Pause drill', seed, tier, { trafficWaitProbability: t >= 2 ? 0.25 : 0 }).start(r.pick([30, 35, 40]));
    for (let i = 0; i < 6; i++) { b.advanceMiles(0.35 + r.next() * 0.4); b.stop(r.pick(['S', 'S', 'L', 'R']), r.pick([30, 35, 40]), { pause: r.pick([15, 15, 15, 20, 30]) }); if (i % 2 === 1) { b.advanceMiles(0.2 + r.next() * 0.3); b.checkpoint(); } }
    return b.advanceMiles(0.3).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) { return basicRubric(r, [1, 3, 6], ['Chart pause time: dwell = printed pause - stop/start loss for the entry/exit speeds on your card (for a 15 s pause it is the stop & go chart value; for any other pause keep the printed pause and scale only the chart loss).'], sc.driver.skill, sc); },
};

// ---------- D04 timed speed changes ----------
const D04: Drill = {
  id: 'D04', title: 'Timed speed changes', objective: 'Hold X for N seconds then Y: count from the ghost\'s departure and call half a ramp early.', skills: ['P3'], minutes: 7, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D04, t); const r = rng(seed); const b = base('D04', 'Timed changes', seed, tier).start(35);
    const specs = [{ hold: 30, sec: 15, then: 40 }, { hold: 25, sec: 18, then: 35 }, { hold: 40, sec: 45, then: 30 }, { hold: 30, sec: 36, then: 40 }];
    for (let i = 0; i < 6; i++) {
      b.advanceMiles(0.4 + r.next() * 0.4);
      if (i === 2 || i === 5) { const sp = specs[r.int(0, 3)]!; b.instruction({ control: 'STOP', exits: EXITS.crossroads('S'), sightDistance: 700, sign: { text: 'STOP', shape: 'octagon', side: 'R' } }, { turn: 'S', pause: 15, timed: { holdSpeed: sp.hold, seconds: sp.sec, thenSpeed: sp.then }, speed: sp.hold }); }
      else { const sp = specs[i % 4]!; b.timedAt(r.pick(['bridge', 'RR crossing', 'church on R', 'water tower']), { holdSpeed: sp.hold, seconds: sp.sec, thenSpeed: sp.then }); }
      if (i === 2) { b.advanceMiles(0.5 + r.next() * 0.3); b.checkpoint(); }
    }
    return b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) {
    const changes = sc.book.filter(i => i.timed).length || 1;
    const perChange = r.attribution.reduce((a, x) => a + Math.abs(x.buckets.timedChange), 0) / changes;
    const rb = basicRubric(r, [1, 2.5, 5], ['Compound lines ("STOP P15, 25 for 40 then 45"): the 40 s starts when the ghost leaves, 15 s after arrival, not at your go.'], sc.driver.skill, sc);
    const changeStars: 0 | 1 | 2 | 3 = perChange <= 0.6 ? 3 : perChange <= 1.2 ? 2 : perChange <= 2.5 ? 1 : 0;
    rb.stars = Math.min(rb.stars, changeStars) as 0 | 1 | 2 | 3; rb.headline += ` · timed changes ${perChange.toFixed(1)} s off each`;
    return rb;
  },
};

// ---------- D05 landmark speed changes ----------
const D05: Drill = {
  id: 'D05', title: 'Speed changes at landmarks', objective: 'Split the change at the sign: be at the midpoint speed as the bumper passes it, which means calling the change half a ramp early.', skills: ['P4'], minutes: 6, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D05, t); const r = rng(seed); const b = base('D05', 'Landmark speed changes', seed, tier).start(35); let v = 35;
    for (let i = 0; i < 8; i++) { b.advanceMiles(0.3 + r.next() * 0.4); const nv = r.pick([25, 30, 40, 45, 50].filter(x => Math.abs(x - v) >= 10)); b.speedAtSign(r.pick([`SPEED LIMIT ${nv}`, 'CURVE', 'END ROAD WORK', 'BRIDGE']), nv, { side: r.chance(0.3) ? 'L' : 'R', shape: r.chance(0.5) ? 'rect' : 'diamond' }); v = nv; if (i === 3) { b.advanceMiles(0.4); b.checkpoint(); } }
    return b.advanceMiles(0.4).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) {
    const changes = sc.book.filter(i => i.speed !== undefined && !i.pause && !i.timed && !i.turn && i.section !== 'start').length || 1;
    const perChange = r.attribution.reduce((a, x) => a + Math.abs(x.buckets.speedChange), 0) / changes;
    const rb = basicRubric(r, [1, 2, 4], ['Split at the sign: lead time = half the ramp time for that pair of speeds (it is on your performance card), so you cross the sign at the midpoint speed.'], sc.driver.skill, sc);
    const changeStars: 0 | 1 | 2 | 3 = perChange <= 0.35 ? 3 : perChange <= 0.7 ? 2 : perChange <= 1.2 ? 1 : 0;
    rb.stars = Math.min(rb.stars, changeStars) as 0 | 1 | 2 | 3; rb.headline += ` · landmark changes ${perChange.toFixed(2)} s off each`;
    return rb;
  },
};

// ---------- D08 early/late recovery ----------
const D08: Drill = {
  id: 'D08', title: 'Running early or late', objective: 'Absorb a slow truck and a red light: time each loss, then recover with the 10 % rule (10 % faster for 10 x the seconds lost) without overshooting early. A Time Allowance is for the train or accident, never for seconds you also made up.', skills: ['P6'], minutes: 8, kind: 'drive',
  tiers: tiers(), unlock: [],
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
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: '20 cards' }], unlock: [],
  scenario(seed, t) { return D10.scenario(seed, t); }, rubric(r, sc) { return basicRubric(r, [1, 3, 6], [], sc.driver.skill, sc); },
};

// ---------- D10 course following in motion ----------
const D10: Drill = {
  id: 'D10', title: 'Course following with distractors', objective: 'Fifteen instructions with driveways, gravel roads and misleading signs: stay on course; time is secondary. If you do go wrong, run the lost doctrine: stopwatch at the turn-around, double it for the lost time, rejoin 30 s behind a car known to be on course.', skills: ['P7', 'P8'], minutes: 8, kind: 'drive',
  tiers: tiers(), unlock: [],
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
  rubric(r) {
    // LOST-001: a wrong turn is scored on the doctrine too: stopwatch at the turn-around, the doubled time written within 2 s
    const lost = lostProcedure(r);
    const base: 0 | 1 | 2 | 3 = r.offCourseCount === 0 ? (meanAbs(legErrors(r)) <= 10 ? 3 : 2) : r.offCourseCount === 1 ? 1 : 0;
    const proc = lost.length > 0 && lost.every(x => x.watchStarted && x.ok);
    const stars = (r.offCourseCount === 1 && proc ? 2 : base) as 0 | 1 | 2 | 3;
    const feedback = [r.offCourseCount ? 'Confirm the landmark (shape, side, text) before the leading edge; driveways, lots and gravel are not roads.' : 'On course all the way. Now add the clock.'];
    if (r.offCourseCount) {
      for (const x of lost) feedback.push(`Lost (LOST-001): turn-around ${formatClock(x.turnAroundTod)}, back at the junction ${formatClock(x.rejoinTod)}: doubled = ${x.doubled.toFixed(1)} s. ${x.watchStarted ? 'The stopwatch was started at the turn-around.' : 'Start the stopwatch at the turn-around.'} ${x.noted === null ? 'You wrote no lost time ("lost 94").' : x.ok ? `Your ${x.noted} s is within 2 s.` : `Your ${x.noted} s is more than 2 s off.`}`);
      if (!lost.length) feedback.push('You never called the turn-around while off course: when you know you are lost, say "turn around", start the stopwatch, and double it.');
      feedback.push(LOST_GUIDANCE);
    }
    return { score: r.offCourseCount, stars, headline: `${r.offCourseCount} off-course excursions${lost.length ? `, lost time ${lost.map(x => (x.ok ? 'doubled within 2 s' : 'not doubled')).join(', ')}` : ''}`, feedback };
  },
};

// ---------- D14 mental math (static) ----------
const D14: Drill = {
  id: 'D14', title: 'Mental math without a calculator', objective: 'Seconds arithmetic, recovery factors, pause dwell, seconds per mile. Calculators are banned in the Great Race.', skills: ['P2', 'P6', 'P13'], minutes: 5, kind: 'math',
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: 'question cards' }], unlock: [],
  scenario(seed, t) { return D03.scenario(seed, t); }, rubric(r, sc) { return basicRubric(r, [1, 3, 6], [], sc.driver.skill, sc); },
};

// ---------- D17 stopwatch loss recovery ----------
const D17: Drill = {
  id: 'D17', title: 'Lost the watch', objective: 'The watch gets reset mid-leg. Re-establish elapsed time from the clock and Column C and finish the leg.', skills: ['P1', 'P9'], minutes: 8, kind: 'drive',
  tiers: tiers([3, 2, 1]), unlock: [],
  scenario(seed, t) { const sc = D07.scenario(seed, t); sc.id = `D17-${seed}`; sc.name = 'Watch loss'; sc.tags = [...(sc.tags ?? []), `forceWatchReset:${600 + rng(seed).int(0, 300)}`]; return sc; },
  rubric(r, sc) { return basicRubric(r, [3, 8, 15], ['Your time-of-day clock is the source of truth: elapsed = clock - official start.'], sc.driver.skill, sc); },
};

setDayFallback(seed => D07.scenario(seed, 2));
for (const d of [D01, D03, D04, D05, D06, D07, D08, D08b, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18]) registerDrill(d);

/** Unlock check against a progress map of best stars per drill (any tier). */
export function isUnlocked(d: Drill, bestStars: Record<string, number>): boolean { return d.unlock.every(u => (bestStars[u.drill] ?? 0) >= u.stars); }
export { allDrills };
export type { Drill, Rubric };
