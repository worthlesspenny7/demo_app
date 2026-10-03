/** Drill curriculum D01-D20 (DESIGN §14, DRILL-* specs). Generator-backed drills fall back to the builder when the generator is unavailable. */
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE, STOCK_1939_SPEEDO } from '../builder.js';
import { aidsForRung, DRIVER_EXPERT, DRIVER_DAD_SPORTSMAN, DRIVER_DAD_ROOKIE, FORD_1939, type Scenario, type DriverSpec, type AidsConfig } from '../course.js';
import { hms } from '../units.js';
import { rng } from '../rng.js';
import { annotatePerfectTimes } from '../ghost.js';
import { registerDrill, allDrills } from './registry.js';
import type { Drill, DrillTier, Rubric } from './types.js';
import { basicRubric, headlineTip, legErrors, meanAbs, starsFromMeanAbs } from './rubrics.js';
import type { StageResult } from '../sim.js';

const T0 = hms(8, 0, 0);
type GenHook = { generateLeg?: (seed: number, profile: unknown) => Scenario; generateStage?: (seed: number, profile: unknown) => Scenario; PROFILES?: Record<string, unknown> } | null;
let gen: GenHook = null;
/** The generator module registers itself here (keeps drills free of a hard dependency). */
export function setGenerator(g: GenHook): void { gen = g; }

function tiers(rungs: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3] = [3, 2, 1]): DrillTier[] {
  const drivers: DriverSpec[] = [DRIVER_EXPERT, DRIVER_DAD_SPORTSMAN, DRIVER_DAD_ROOKIE];
  const names = ['Bronze', 'Silver', 'Gold'];
  return names.map((name, i) => ({ name, aids: aidsForRung(rungs[i]!), driver: drivers[i]!, description: `${name}: aids rung ${rungs[i]}, ${drivers[i]!.skill} driver` }));
}
function legalTiers(): DrillTier[] { return [{ name: 'Rookie', aids: aidsForRung(0), driver: DRIVER_DAD_SPORTSMAN, description: 'Great Race legal, sportsman driver' }, { name: 'Sportsman', aids: aidsForRung(0), driver: DRIVER_DAD_SPORTSMAN, description: 'Great Race legal, stock speedometer' }, { name: 'Expert', aids: aidsForRung(0), driver: DRIVER_DAD_ROOKIE, description: 'Great Race legal, rookie driver, stock speedometer' }]; }
function tierOf(d: Pick<Drill, 'tiers'>, t: number): DrillTier { return d.tiers[Math.max(0, Math.min(d.tiers.length - 1, t))]!; }
function base(id: string, name: string, seed: number, tier: DrillTier, extra: Partial<ConstructorParameters<typeof ScenarioBuilder>[0]> = {}): ScenarioBuilder {
  return new ScenarioBuilder({ id: `${id}-${seed}-${tier.name}`, name, seed, startTime: T0, driver: tier.driver, aids: tier.aids, speedo: PERFECT_TIMEWISE, car: FORD_1939, prereadSeconds: 60, ...extra });
}

// ---------- D01 stopwatch reaction ----------
const D01: Drill = {
  id: 'D01', title: 'Stopwatch on the landmark', objective: 'Lap the watch exactly as the front bumper passes each sign; consistency beats bias.', skills: ['P1'], minutes: 3, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D01, t); const r = rng(seed); const b = base('D01', 'Stopwatch reaction', seed, tier).start(35);
    for (let i = 0; i < 8; i++) { b.advanceMiles(0.15 + r.next() * 0.25); b.instruction({ sign: { text: `MARKER ${i + 1}`, shape: 'rect', side: r.chance(0.5) ? 'L' : 'R' }, sightDistance: 400 }, { text: `Lap at "MARKER ${i + 1}"`, speed: 35 }); }
    return b.advanceMiles(0.2).checkpoint().advanceFt(300).finish().build(); },
  rubric(r, sc) {
    // compare each lap time with the moment the car passed each marker node
    const nodeEvents = r.events.filter(e => e.type === 'node' && String(e.detail?.kind) === 'sign');
    const laps = r.actions.filter(a => a.action.type === 'watch.lap').map(a => sc.startTime - sc.prereadSeconds + a.tick * 0.1);
    const errs: number[] = []; for (const ne of nodeEvents) { const nearest = laps.reduce((best, t) => Math.abs(t - ne.tod) < Math.abs(best - ne.tod) ? t : best, Infinity); if (isFinite(nearest)) errs.push(nearest - ne.tod); }
    const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0; const sd = errs.length ? Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / errs.length) : 99;
    const stars = errs.length < nodeEvents.length * 0.75 ? 0 : sd <= 0.3 ? 3 : sd <= 0.6 ? 2 : sd <= 1.0 ? 1 : 0;
    return { score: Math.round(sd * 100) / 100, stars, headline: `${errs.length}/${nodeEvents.length} markers lapped, bias ${mean.toFixed(2)} s, jitter ${sd.toFixed(2)} s`, feedback: [sd > 0.6 ? 'Watch the sign, not the dial: lap by feel as the post passes the A-pillar.' : 'Good hands. A constant bias calibrates out; jitter does not.'] };
  },
};

// ---------- D03 pause arithmetic ----------
const D03: Drill = {
  id: 'D03', title: 'Pause arithmetic at the stop sign', objective: 'At each STOP wait only pause minus your car\'s stop/start loss, then call go.', skills: ['P2', 'P12'], minutes: 6, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D03, t); const r = rng(seed); const b = base('D03', 'Pause drill', seed, tier, { trafficWaitProbability: t >= 2 ? 0.25 : 0 }).start(r.pick([30, 35, 40]));
    for (let i = 0; i < 6; i++) { b.advanceMiles(0.35 + r.next() * 0.4); b.stop(r.pick(['S', 'S', 'L', 'R']), r.pick([30, 35, 40]), { pause: r.pick([15, 15, 15, 20, 30]) }); if (i % 2 === 1) { b.advanceMiles(0.2 + r.next() * 0.3); b.checkpoint(); } }
    return b.advanceMiles(0.3).checkpoint().advanceFt(300).finish().build(); },
  rubric(r) { return basicRubric(r, [1, 3, 6], ['Pause arithmetic: dwell = printed pause - stop/start loss for the entry/exit speeds on your card.']); },
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
  rubric(r) { return basicRubric(r, [1, 2.5, 5], ['Compound lines ("STOP P15, 25 for 40 then 45"): the 40 s starts when the ghost leaves, 15 s after arrival, not at your go.']); },
};

// ---------- D05 landmark speed changes ----------
const D05: Drill = {
  id: 'D05', title: 'Speed changes at landmarks', objective: 'Be mid-ramp as the bumper passes the sign: call the change half a ramp early.', skills: ['P4'], minutes: 6, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D05, t); const r = rng(seed); const b = base('D05', 'Landmark speed changes', seed, tier).start(35); let v = 35;
    for (let i = 0; i < 8; i++) { b.advanceMiles(0.3 + r.next() * 0.4); const nv = r.pick([25, 30, 40, 45, 50].filter(x => x !== v)); b.speedAtSign(r.pick([`SPEED LIMIT ${nv}`, 'CURVE', 'END ROAD WORK', 'BRIDGE']), nv, { side: r.chance(0.3) ? 'L' : 'R', shape: r.chance(0.5) ? 'rect' : 'diamond' }); v = nv; if (i === 3) { b.advanceMiles(0.4); b.checkpoint(); } }
    return b.advanceMiles(0.4).checkpoint().advanceFt(300).finish().build(); },
  rubric(r) { return basicRubric(r, [1, 2.5, 5], ['Lead time = half the ramp time for that pair of speeds; it is on your performance card.']); },
};

// ---------- D06 build your performance table ----------
const D06: Drill = {
  id: 'D06', title: 'Build your performance table', objective: 'Measure the car: stop/start losses and ramp times per speed. Enter them as notes; the debrief compares to truth.', skills: ['P12'], minutes: 8, kind: 'drive',
  tiers: tiers([3, 3, 2]), unlock: [],
  scenario(seed, t) { const tier = tierOf(D06, t); const b = base('D06', 'Performance runs', seed, tier).start(30);
    for (const v of [25, 35, 45]) { b.advanceMiles(0.5).stop('S', v, { pause: 0 }); b.advanceMiles(0.5).speedAtSign('MARKER', v); }
    return b.advanceMiles(0.5).checkpoint().advanceFt(300).finish().build(); },
  rubric(r) { const notes = r.actions.filter(a => a.action.type === 'note').length; return { score: notes, stars: notes >= 3 ? 3 : notes >= 2 ? 2 : notes >= 1 ? 1 : 0, headline: `${notes} measurements noted`, feedback: ['Compare your notes with the true table in the debrief; four runs per speed in the real car.'] }; },
};

// ---------- D07 calibration run ----------
const D07: Drill = {
  id: 'D07', title: 'Morning calibration run', objective: 'Hold 50 on the speedo; compare your splits with Column C; set the Timewise factor or build a cheat card, then run a leg.', skills: ['P5'], minutes: 12, kind: 'drive',
  tiers: tiers([3, 2, 1]), unlock: [],
  scenario(seed, t) { const tier = tierOf(D07, t); const r = rng(seed); const hiddenGain = 1 + (r.next() - 0.5) * 0.03; // +-1.5%
    const b = base('D07', 'Calibration run', seed, tier, { speedo: t >= 2 ? { ...STOCK_1939_SPEEDO, gain: 1.02 + (r.next() - 0.5) * 0.03 } : { ...PERFECT_TIMEWISE, gain: hiddenGain } }).start(50);
    b.advanceMiles(0.5).instruction({ sign: { text: 'CALIBRATION START', shape: 'rect', side: 'R' }, sightDistance: 500 }, { section: 'calibration', text: 'Begin calibration run. Speed 50', speed: 50 });
    let n = 1; for (let d = 0; d < 15; d += 2.5) { b.advanceMiles(2.5); b.instruction({ sign: { text: `MILE ${n}`, shape: 'rect', side: 'R' }, sightDistance: 500 }, { section: 'calibration', text: `"MILE ${n}" (Column C gives the perfect split)`, speed: 50 }); n++; }
    b.advanceMiles(0.5).stop('S', 35).advanceMiles(1.5).speedAtSign('SPEED LIMIT 45', 45).advanceMiles(2.5).checkpoint().advanceFt(300).finish();
    const sc = b.build(); annotatePerfectTimes(sc); return sc; },
  rubric(r) { return basicRubric(r, [2, 5, 10], ['k = sum(perfect)/sum(actual); indicated to hold = assigned / k. Apply it to every speed all day.']); },
};

// ---------- D08 early/late recovery ----------
const D08: Drill = {
  id: 'D08', title: 'Running early or late', objective: 'Absorb a slow truck and a long light: time the loss, then recover with +5 mph for (speed/5 + 1) x seconds, without overshooting early.', skills: ['P6'], minutes: 8, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D08, t); const r = rng(seed); const b = base('D08', 'Recovery', seed, tier).start(40);
    b.advanceMiles(0.4); b.hazard({ kind: 'slow', speedMph: 25, lengthFt: 2500 + r.int(0, 2000), passWindowAfterFt: 1500 });
    b.advanceMiles(1.6).stop('S', 40);
    b.advanceMiles(0.8).instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 40 });
    b.hazard({ kind: 'signal', redSeconds: 35 + r.int(0, 30), greenSeconds: 40, offset: T0 + r.int(0, 60) });
    b.advanceMiles(1.5).checkpoint().advanceMiles(0.8).checkpoint().advanceFt(300).finish();
    return b.build(); },
  rubric(r) { return basicRubric(r, [2, 5, 10], ['Recovery factor: +5 mph for (v/5 + 1) x the seconds lost; +2 mph for about 2.3x that. Finish the correction before likely checkpoint spots.']); },
};

// ---------- D08b time allowance ----------
const D08b: Drill = {
  id: 'D08b', title: 'Time Allowance: the train', objective: 'Gates down. Time the stop, keep the ledger, and declare a Time Allowance at the checkpoint for the train (lights only if the rules allow). Never TA and make up the same seconds.', skills: ['P6'], minutes: 9, kind: 'drive',
  tiers: tiers(), unlock: [],
  scenario(seed, t) { const tier = tierOf(D08b, t); const r = rng(seed); const b = base('D08b', 'Time allowance', seed, tier).start(35);
    b.advanceMiles(0.6).instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 30, greenSeconds: 45, offset: T0 + 20 });
    b.advanceMiles(0.7).instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { text: 'RR crossing (gates may be down)', speed: 35 });
    const arrival = T0 + (0.6 + 0.7) * 5280 / (35 * 1.4667); b.hazard({ kind: 'train', startTod: arrival - 25, durationSeconds: 60 + r.int(0, 60) });
    b.advanceMiles(0.9).instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 25, greenSeconds: 60, offset: T0 + 5 });
    b.advanceMiles(0.8).checkpoint().advanceFt(300).finish();
    return b.build(); },
  rubric(r) { const leg = r.score.legs[0]; const declared = r.actions.filter(a => a.action.type === 'ta.declare').length;
    const credit = leg?.taCredit ?? 0; const qualifying = r.events.filter(e => e.type === 'wait' && (e.detail?.reason === 'train' || e.detail?.reason === 'signal')).length;
    const declaredSeconds = (() => { const a = r.actions.filter(x => x.action.type === 'ta.declare').pop(); return a && a.action.type === 'ta.declare' ? a.action.seconds : 0; })();
    const trueQualifying = r.attribution[0] ? Math.max(0, r.attribution[0].buckets.hazard) : 0; const diff = Math.abs(declaredSeconds - trueQualifying);
    const stars: 0 | 1 | 2 | 3 = declared === 0 ? 0 : (diff <= 5 && !leg?.taOverDeclared && Math.abs(leg?.error ?? 99) <= 5) ? 3 : diff <= 15 ? 2 : 1;
    return { score: Math.round(diff), stars, headline: `declared ${declaredSeconds} s, qualifying delay ~${Math.round(trueQualifying)} s, credited ${credit} s, leg error ${leg?.error ?? 'missed'} s (${qualifying} stops)`, feedback: [headlineTip(r), 'Time every forced stop on the watch; declare the sum, or make it up, never both.'] }; },
};

// ---------- D09 trap quiz (static) ----------
const D09: Drill = {
  id: 'D09', title: 'Trap quiz: which way?', objective: 'Read the instruction and the CAMEO/road view; pick the exit. 20 cards from the trap library.', skills: ['P8'], minutes: 5, kind: 'quiz',
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: '20 cards' }], unlock: [],
  scenario(seed, t) { return D10.scenario(seed, t); }, rubric(r) { return basicRubric(r, [1, 3, 6]); },
};

// ---------- D10 course following in motion ----------
const D10: Drill = {
  id: 'D10', title: 'Course following with distractors', objective: 'Fifteen instructions with driveways, gravel roads and misleading signs: stay on course; time is secondary.', skills: ['P7', 'P8'], minutes: 8, kind: 'drive',
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
    for (const ins of sc.book) { const n = sc.course.nodes.find(x => x.id === ins.nodeId)!; if (n.exits && ins.turn) { const route = n.exits.find(e => e.isRoute)!; ins.turn = Math.abs(route.angle) < 20 ? 'S' : Math.abs(route.angle) < 60 ? (route.angle < 0 ? 'BL' : 'BR') : route.angle < 0 ? 'L' : 'R'; } }
    return sc; },
  rubric(r) { const stars: 0 | 1 | 2 | 3 = r.offCourseCount === 0 ? (meanAbs(legErrors(r)) <= 10 ? 3 : 2) : r.offCourseCount === 1 ? 1 : 0; return { score: r.offCourseCount, stars, headline: `${r.offCourseCount} off-course excursions`, feedback: [r.offCourseCount ? 'Confirm the landmark (shape, side, text) before the leading edge; driveways, lots and gravel are not roads.' : 'On course all the way. Now add the clock.'] }; },
};

// ---------- D14 mental math (static) ----------
const D14: Drill = {
  id: 'D14', title: 'Mental math without a calculator', objective: 'Seconds arithmetic, recovery factors, pause dwell, seconds per mile. Calculators are banned in the Great Race.', skills: ['P2', 'P6', 'P13'], minutes: 5, kind: 'math',
  tiers: [{ name: 'Cards', aids: aidsForRung(3), driver: DRIVER_EXPERT, description: 'question cards' }], unlock: [],
  scenario(seed, t) { return D03.scenario(seed, t); }, rubric(r) { return basicRubric(r, [1, 3, 6]); },
};

// ---------- D15 pre-read triage (reading) ----------
const D15: Drill = {
  id: 'D15', title: 'Pre-read triage', objective: 'You get the book 30 minutes before the start. Annotate every pause with its dwell and mark the speed changes, then run the first 40 lines cold.', skills: ['P7'], minutes: 12, kind: 'drive',
  tiers: tiers([2, 1, 0]), unlock: [],
  scenario(seed, t) { const sc = D18.scenario(seed, t); sc.prereadSeconds = 10 * 60; sc.id = `D15-${seed}`; sc.name = 'Pre-read triage'; return sc; },
  rubric(r) { const cov = r.prereadCoverage; const stars: 0 | 1 | 2 | 3 = cov >= 1 && meanAbs(legErrors(r)) <= 3 ? 3 : cov >= 0.75 ? 2 : cov >= 0.5 ? 1 : 0; return { score: Math.round(cov * 100), stars, headline: `${Math.round(cov * 100)}% of pauses annotated before the start`, feedback: ['Triage order: pauses and stops first, speed changes second, hints third.', headlineTip(r)] }; },
};

// ---------- D16 time-of-day discipline ----------
const D16: Drill = {
  id: 'D16', title: 'Start on the second', objective: 'Depart exactly on your out-time (minute rollover, hour rollover, lunch restart). A whole-minute error fails the drill.', skills: ['P9'], minutes: 8, kind: 'drive',
  tiers: tiers([2, 1, 0]), unlock: [],
  scenario(seed, t) { const tier = tierOf(D16, t); const r = rng(seed); const start = hms(8, 58, 40) + r.int(0, 50); const b = new ScenarioBuilder({ id: `D16-${seed}`, name: 'Time of day', seed, startTime: start, driver: tier.driver, aids: tier.aids, prereadSeconds: 120 }).start(35);
    const arrival = start + 1.2 * 5280 / (35 * 1.4667); const restartAt = Math.ceil((arrival + 180) / 60) * 60 + r.int(5, 55); // a few minutes at the lunch stop, odd seconds
    b.advanceMiles(0.8).checkpoint().advanceMiles(0.4).restart(35, restartAt);
    b.advanceMiles(0.8).checkpoint().advanceFt(300).finish(); return b.build(); },
  rubric(r) { const errs = legErrors(r); const minuteFail = errs.some(e => Math.abs(e) >= 55); const mean = meanAbs(errs); const stars: 0 | 1 | 2 | 3 = minuteFail ? 0 : starsFromMeanAbs(mean, [1.5, 4, 10]); return { score: Math.round(mean), stars, headline: minuteFail ? 'Whole-minute error at a start or restart' : `${errs.map(e => `${e > 0 ? '+' : ''}${e}`).join(', ')} s`, feedback: [minuteFail ? 'Read the minute hand twice; use the stopwatch started on the official minute as your time-of-day.' : 'Lead each departure by the acceleration loss only.'] }; },
};

// ---------- D17 stopwatch loss recovery ----------
const D17: Drill = {
  id: 'D17', title: 'Lost the watch', objective: 'The watch gets reset mid-leg. Re-establish elapsed time from the clock and Column C and finish the leg.', skills: ['P1', 'P9'], minutes: 8, kind: 'drive',
  tiers: tiers([3, 2, 1]), unlock: [],
  scenario(seed, t) { const sc = D07.scenario(seed, t); sc.id = `D17-${seed}`; sc.name = 'Watch loss'; sc.tags = [...(sc.tags ?? []), `forceWatchReset:${600 + rng(seed).int(0, 300)}`]; return sc; },
  rubric(r) { return basicRubric(r, [3, 8, 15], ['Your time-of-day clock is the source of truth: elapsed = clock - official start.']); },
};

// ---------- D18 miniature combo leg (gate for D11) ----------
const D18: Drill = {
  id: 'D18', title: 'Miniature leg: everything once', objective: 'One stop with pause, one timed segment, one landmark speed change, one trap, one hazard, one hidden checkpoint, in about five minutes.', skills: ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8'], minutes: 6, kind: 'drive',
  tiers: tiers([1, 1, 0]), unlock: [{ drill: 'D03', stars: 2 }, { drill: 'D04', stars: 2 }, { drill: 'D05', stars: 2 }, { drill: 'D08', stars: 2 }, { drill: 'D10', stars: 2 }],
  scenario(seed, t) { const tier = tierOf(D18, t); const r = rng(seed); const b = base('D18', 'Miniature leg', seed, tier, { trafficWaitProbability: 0.2 }).start(r.pick([30, 35]));
    const order = r.pick([[0, 1, 2, 3, 4], [1, 0, 3, 2, 4], [2, 3, 0, 1, 4], [3, 2, 1, 0, 4]]);
    for (const k of order) {
      b.advanceMiles(0.3 + r.next() * 0.3);
      if (k === 0) b.stop(r.pick(['L', 'R', 'S']), r.pick([30, 35, 40]));
      else if (k === 1) b.timedAt(r.pick(['bridge', 'RR crossing', 'water tower']), { holdSpeed: 30, seconds: 20 + r.int(0, 25), thenSpeed: 40 });
      else if (k === 2) b.speedAtSign(`SPEED LIMIT ${r.pick([35, 45])}`, r.pick([35, 45]));
      else if (k === 3) { b.node({ exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'driveway' }); b.advanceFt(450); b.instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 600 }, { turn: 'R', speed: 35, hint: '1st paved road' }); }
      else { if (r.chance(0.5)) { b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 30, greenSeconds: 40, offset: T0 + r.int(0, 70) }); } else { b.hazard({ kind: 'slow', speedMph: 25, lengthFt: 2000, passWindowAfterFt: 1200 }); b.advanceMiles(0.5); } }
    }
    return b.advanceMiles(0.25 + r.next() * 0.3).checkpoint().advanceFt(300).finish().build(); },
  rubric(r) { return basicRubric(r, [2, 5, 10]); },
};

// ---------- D11 / D12 / D13 generator-backed ----------
function genOr(profileKey: string, fallback: () => Scenario, seed: number, stage = false): Scenario {
  const p = gen?.PROFILES?.[profileKey];
  if (gen && p) { const fn = stage ? gen.generateStage : (gen.generateLeg ?? gen.generateStage); if (fn) return fn(seed, p); }
  return fallback();
}
const D11: Drill = {
  id: 'D11', title: 'Full leg', objective: 'A real leg: 25-40 instructions, one hidden checkpoint, Great Race legal aids. Stay on course, stay on time.', skills: ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8', 'P10'], minutes: 15, kind: 'drive',
  tiers: tiers([1, 0, 0]), unlock: [{ drill: 'D18', stars: 1 }, { drill: 'D07', stars: 2 }],
  scenario(seed, t) { const tier = tierOf(D11, t); const sc = genOr('fullLeg', () => { const s = D18.scenario(seed, t); s.id = `D11-${seed}`; s.name = 'Full leg (fallback)'; return s; }, seed); return { ...sc, driver: tier.driver, aids: tier.aids, id: `D11-${seed}-${tier.name}` }; },
  rubric(r) { return basicRubric(r, [2, 6, 13]); },
};
const D12: Drill = {
  id: 'D12', title: 'Full stage', objective: 'Calibration run, 4-7 hidden checkpoints, lunch restart, observation checkpoint. 150-250 instructions.', skills: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P11'], minutes: 150, kind: 'drive',
  tiers: legalTiers(), unlock: [{ drill: 'D11', stars: 1 }, { drill: 'D15', stars: 1 }, { drill: 'D16', stars: 1 }],
  scenario(seed, t) { const tier = tierOf(D12, t); const sc = genOr('fullStage', () => D07.scenario(seed, 2), seed, true); return { ...sc, driver: tier.driver, aids: tier.aids, speedo: t >= 1 ? STOCK_1939_SPEEDO : sc.speedo, id: `D12-${seed}-${tier.name}` }; },
  rubric(r) { return basicRubric(r, [3, 13, 25], [`Benchmark: ${r.score.benchmark}. Champions ~1 s per leg; a good rookie day is 13-21 s.`]); },
};
const D13: Drill = {
  id: 'D13', title: 'Campaign: the Great Race', objective: 'Trophy Run plus nine stages in the 1939 Ford with age factor 0.845. Division ladder by cumulative score.', skills: ['P11'], minutes: 1500, kind: 'drive',
  tiers: legalTiers(), unlock: [{ drill: 'D12', stars: 1 }],
  scenario(seed, t) { return D12.scenario(seed * 100 + 1, t); },
  rubric(r) { return basicRubric(r, [3, 13, 25]); },
};

for (const d of [D01, D03, D04, D05, D06, D07, D08, D08b, D09, D10, D11, D12, D13, D14, D15, D16, D17, D18]) registerDrill(d);

/** Unlock check against a progress map of best stars per drill (any tier). */
export function isUnlocked(d: Drill, bestStars: Record<string, number>): boolean { return d.unlock.every(u => (bestStars[u.drill] ?? 0) >= u.stars); }
export { allDrills };
export type { Drill, Rubric };
