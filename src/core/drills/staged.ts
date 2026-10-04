/** D18 / D11 / D12 / D13 on the STAGE-001 skeleton (DRILL-025, DRILL-006, STAGE-002, REG-006). */
import { EXITS, STOCK_1939_SPEEDO } from '../builder.js';
import type { Scenario } from '../course.js';
import { rng } from '../rng.js';
import type { Drill } from './types.js';
import { tiers, legalTiers, tierOf, base, T0, generatorHook, aspForSeed, bookStyleFor } from './common.js';
import { basicRubric, withRecoveryGate } from './rubrics.js';

/** The ASP of a campaign stage (CAMP-001): drawn once per stage, shown on the card and the campaign table. */
export function campaignAsp(stage: number): number { return aspForSeed(stage, 13); }  // stage 0 is the Trophy Run (played as seed 10)

// ---------- D18: one timed portion only (start at base + ASP, End timed portion, no Time Allowance point) ----------
export const D18: Drill = {
  id: 'D18', title: 'Miniature leg: everything once', objective: 'One timed portion, left at base + ASP: one stop with a printed pause, one timed segment, one landmark speed change, one trap, one hazard (a light or a slow truck: there is no TA point in this drill, so make the time up), one hidden checkpoint, then a recovery straight to the checkpoint and End timed portion. About nine minutes at 1x.', skills: ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8'], minutes: 9, kind: 'drive',
  // EDU-005: D16 (start on time) is graded here too (the start is base + ASP), so it is a gate
  tiers: tiers([2, 1, 0]), unlock: [{ drill: 'D03', stars: 2 }, { drill: 'D04', stars: 2 }, { drill: 'D05', stars: 2 }, { drill: 'D08', stars: 2 }, { drill: 'D10', stars: 2 }, { drill: 'D16', stars: 1 }], readFirst: ['protocol', 'recovery'],
  scenario(seed, t) {
    const tier = tierOf(D18, t); const r = rng(seed); const asp = aspForSeed(seed, 18);
    const b = base('D18', 'Miniature leg', seed, tier, { trafficWaitProbability: 0.2, asp }).start(r.pick([30, 35]));
    const order = r.pick([[4, 0, 1, 2, 3], [4, 1, 0, 3, 2], [4, 2, 3, 0, 1], [4, 3, 2, 1, 0]]);   // EDU-006: the hazard comes first, so the whole leg is there to make it up
    for (const k of order) {
      b.advanceMiles(0.3 + r.next() * 0.3);
      if (k === 0) b.stop(r.pick(['L', 'R', 'S']), r.pick([30, 35, 40]));
      else if (k === 1) { const secs = 20 + r.int(0, 25); b.timedAt(r.pick(['bridge', 'RR crossing', 'water tower']), { holdSpeed: 30, seconds: secs, thenSpeed: 40 }); b.advanceFt(30 * 1.4667 * secs + 300); }
      else if (k === 2) b.speedAtSign(`SPEED LIMIT ${r.pick([35, 45])}`, r.pick([35, 45]));
      else if (k === 3) { b.node({ exits: EXITS.sideRoad('R', { kind: 'driveway' }), sightDistance: 400, label: 'driveway' }); b.advanceFt(450); b.instruction({ exits: EXITS.sideRoad('R', { route: 'turn' }), sightDistance: 600 }, { turn: 'R', speed: 35, hint: '1st paved road' }); }
      else { if (r.chance(0.5)) { b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 }); b.hazard({ kind: 'signal', redSeconds: 15 + r.int(0, 15), greenSeconds: 40, offset: T0 + r.int(0, 55) }); } else { b.hazard({ kind: 'slow', speedMph: 28, lengthFt: 1500, passWindowAfterFt: 900 }); b.advanceMiles(0.4); } }
    }
    // EDU-006: a recovery straight before the checkpoint, so the losses of the leg (a light, a stop, a turn) can be made up with the 10 % rule (D18 residual loss)
    b.advanceMiles(1.3 + r.next() * 0.3).checkpoint().advanceFt(300);
    // the timed portion ends with "End timed portion"; this drill prints no TA point (D11 adds it)
    b.instruction({ sign: { text: 'END TIMED', shape: 'rect', side: 'R' }, sightDistance: 500 }, { endTimed: true });
    const sc = b.advanceMiles(0.25).finish().build();
    sc.tags = [...(sc.tags ?? []), 'd18', `asp:${asp}`, 'timed-portion:1'];
    return sc;
  },
  rubric(r, sc) { return withRecoveryGate(basicRubric(r, [4, 8, 14], ['Left at base + ASP, one timed portion, End timed portion: the shape of every stage in miniature. No TA point here, so a light or a truck is made up with the 10 % rule.'], sc.driver.skill, sc), r, sc); },   // ENG-022: no recovery, at most one star
};

// ---------- generator-backed drills ----------
function genOr(profileKey: string, overrides: Record<string, unknown>, fallback: () => Scenario, seed: number, stage = false): Scenario {
  const gen = generatorHook(); const p = gen?.PROFILES?.[profileKey];
  if (gen && p) { const fn = stage ? gen.generateStage : (gen.generateLeg ?? gen.generateStage); if (fn) return fn(seed, { ...(p as object), ...overrides }); }
  return fallback();
}

// ---------- D11: one timed portion with its TA point and an advisory transit in ----------
export const D11: Drill = {
  id: 'D11', title: 'Full leg', objective: 'A real timed portion: an advisory transit in, the restart at base + ASP, 25-40 instructions, one hidden checkpoint, End timed portion and its TA point. Great Race legal aids. Stay on course, stay on time, file what you are owed.', skills: ['P1', 'P2', 'P3', 'P4', 'P6', 'P7', 'P8', 'P10'], minutes: 55, kind: 'drive',
  tiers: tiers([2, 1, 0]), unlock: [{ drill: 'D18', stars: 1 }, { drill: 'D07', stars: 2 }], readFirst: ['markup', 'four-s'],
  scenario(seed, t) {
    const tier = tierOf(D11, t);
    const sc = genOr('fullLeg', { transitIn: true, asp: aspForSeed(seed, 11), bookStyle: bookStyleFor(tier.aids), aids: tier.aids, driver: tier.driver }, () => { const s = D18.scenario(seed, t); s.name = 'Full leg (fallback)'; return s; }, seed);
    return { ...sc, driver: tier.driver, aids: tier.aids, bookStyle: bookStyleFor(tier.aids), id: `D11-${seed}-${tier.name}` };
  },
  rubric(r, sc) { return basicRubric(r, [2, 6, 13], [], sc.driver.skill, sc); },
};

// ---------- D12 / D13: the day skeleton ----------
function dayScenario(seed: number, t: number, idPrefix: string, asp: number): Scenario {
  const tier = tierOf(D12, t);
  const sc = genOr('fullStage', { asp, bookStyle: bookStyleFor(tier.aids), aids: tier.aids, driver: tier.driver, ...(t >= 1 ? { speedo: STOCK_1939_SPEEDO } : {}) }, () => { const s = D07fallback(seed); return s; }, seed, true);
  return { ...sc, driver: tier.driver, aids: tier.aids, bookStyle: bookStyleFor(tier.aids), speedo: t >= 1 ? STOCK_1939_SPEEDO : sc.speedo, id: `${idPrefix}-${seed}-${tier.name}`, prereadSeconds: 30 * 60 };
}
let D07fallback: (seed: number) => Scenario = () => { throw new Error('generator unavailable'); };
export function setDayFallback(f: (seed: number) => Scenario): void { D07fallback = f; }

export const D12: Drill = {
  id: 'D12', title: 'Full stage', objective: 'The whole day: tire warm-up, calibration run, transit, restart at base + ASP, timed portions with hidden checkpoints and free zones, End timed portion and TA points, lunch transit, restart, transit to the Observation Checkpoint. 150-250 instructions.', skills: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P11'], minutes: 320, kind: 'drive',
  // EDU-006: D16 >= 2 stars (a launch with no lead caps D16 at 1)
  tiers: legalTiers(), unlock: [{ drill: 'D11', stars: 1 }, { drill: 'D15', stars: 1 }, { drill: 'D16', stars: 2 }], readFirst: ['calibration', 'transits'],
  scenario(seed, t) { return dayScenario(seed, t, 'D12', aspForSeed(seed, 12)); },
  rubric(r, sc) { const rb = basicRubric(r, [13, 25, 46], [`Benchmark: ${r.score.benchmark}. Champions ~1 s per leg; a good rookie day is 13-21 s; 20-46 s is a normal rookie day.`], undefined, sc); const raw = r.score.raw; rb.stars = r.offCourseCount > 1 ? 0 : raw <= 13 ? 3 : raw <= 25 ? 2 : raw <= 46 ? 1 : 0; return rb; },
};
export const D13: Drill = {
  id: 'D13', title: 'Campaign: the Great Race', objective: 'Trophy Run plus nine stages in the 1939 Ford with age factor 0.845. Each stage draws its own starting position (ASP); the division discards its worst legs of stages 1-7 and the Trophy Run is only a tie-break.', skills: ['P11'], minutes: 320, kind: 'drive',
  tiers: legalTiers(), unlock: [{ drill: 'D12', stars: 1 }], readFirst: ['four-s'],
  scenario(seed, t) { return dayScenario(seed * 100 + 1, t, 'D13', campaignAsp(seed === 10 ? 0 : seed)); },
  rubric(r, sc) { return D12.rubric(r, sc); },
};
