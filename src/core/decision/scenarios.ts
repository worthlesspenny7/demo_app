/**
 * Micro scenarios (MOB-004 / MOB-005): short legs composed with the existing ScenarioBuilder, each built around one decision point of
 * one kind (a second point of the same leg is handled by the navigator), 60-200 s of ghost time per leg, timed segments 10-25 s.
 * They launch themselves (drill start) except the restart / clock / transit ones, which need a hold to wait at.
 */
import { ScenarioBuilder, EXITS, PERFECT_TIMEWISE } from '../builder.js';
import { aidsForRung, FORD_1939, DRIVER_EXPERT, type Scenario, type TurnDir } from '../course.js';
import { buildGhost, ghostTimeAt } from '../ghost.js';
import { generateLeg, PROFILES } from '../generator/generate.js';
import { rng, type Rng } from '../rng.js';
import type { DecisionKind, MicroSpec } from './types.js';
import { SKILL_OF_KIND, DECISION_KINDS } from './types.js';

/** What the card of a micro scenario adds to the scenario itself (the runner reads it; a boss leg has none). */
export interface MicroHint {
  /** clock: which instrument question the card asks (MOB-057). */
  clock?: 'minute' | 'second' | 'interval';
  /** makeup: a posted limit the card shows (MOB-055). */
  limit?: number;
  /** checkpoint: the red GREAT RACE STOP board, or a rally car ahead pulling off before a green sign (MOB-055). */
  checkpoint?: 'green' | 'red' | 'carAhead';
  /** restart: the card prints the base time and the starting position instead of your own time (RULE-010, MOB-058). */
  base?: boolean;
  /** hazard / ta: a short or a long delay (the scene says which). */
  size?: 'short' | 'long';
  /** lost: seconds after leaving the route that the driver notices (the card's "N s ago", MOB-056). */
  lostAgo?: number;
}

/** What a DecisionRunner needs to play a micro scenario. */
export interface MicroScenario {
  scenario: Scenario;
  /** Kinds the player answers here (the navigator does the rest). */
  kinds: DecisionKind[];
  maxDecisions: number;
  prereadRows?: number;
  /** Turns the navigator deliberately does not call (the driver drives past them: lost cards). */
  missTurns?: number[];
  hint?: MicroHint;
  /** Boss leg: at most this many cards of one kind (the micro slots after it cover every kind). */
  maxPerKind?: number;
}

/** PT-14 N3: the sub-case a micro spec's `variant` picks for its kind (the rule card before the slot is the rule of this sub-case). */
export function microSubcase(kind: DecisionKind, variant: number): string {
  const v = ((variant % 12) + 12) % 12;
  switch (kind) {
    case 'preread': return (['turn', 'pause', 'speed'] as const)[v % 3]!;
    case 'hazard': return (['truck', 'train', 'tractor', 'light'] as const)[v % 4]!;
    case 'ta': return v % 2 === 0 ? 'train' : 'tractor';
    case 'restart': return (['own', 'transitOut', 'base', 'own'] as const)[v % 4]!;
    case 'clock': return (['minute', 'minute', 'second', 'interval'] as const)[v % 4]!;
    case 'checkpoint': return (['green', 'red', 'carAhead'] as const)[v % 3]!;
    case 'lost': return v % 2 === 1 ? 'detour' : 'deadEnd';
    case 'makeup': return (['open', 'limit', 'timed', 'open'] as const)[v % 4]!;
    default: return 'default';
  }
}

const SIGNS = ['SPEED LIMIT', 'CURVE', 'BRIDGE', 'END ROAD WORK'];
const LANDMARKS = ['bridge', 'water tower', 'church on R', 'grain elevator'];
const SPEEDS = [25, 30, 35, 40, 45] as const;

/** MOB-058: every micro starts at its own time of day (07:30 to 11:29, whole minutes) so IN times and restart times vary. */
function startTod(kind: DecisionKind, seed: number): number { const r = rng(`micro-start:${kind}:${seed}`); return 7 * 3600 + 30 * 60 + r.int(0, 239) * 60; }
function builder(kind: DecisionKind, seed: number, rung: 0 | 1 | 2 | 3, extra: Partial<ConstructorParameters<typeof ScenarioBuilder>[0]> = {}): ScenarioBuilder {
  return new ScenarioBuilder({ id: `micro-${kind}-${seed}`, name: `Micro: ${kind}`, seed, startTime: startTod(kind, seed), driver: DRIVER_EXPERT, aids: aidsForRung(rung), speedo: PERFECT_TIMEWISE, car: FORD_1939, prereadSeconds: 20, startProcedure: 'drill', excursionFt: 1000, ...extra });
}
const close = (b: ScenarioBuilder, miles: number): Scenario => b.advanceMiles(miles).checkpoint().advanceFt(300).finish().build();
/** Ghost time of day at the builder's current position (to place trains, lights and restarts). */
function ghostNow(b: ScenarioBuilder): number { return ghostTimeAt(buildGhost(b.build()), b.position); }

function turnRow(b: ScenarioBuilder, r: Rng, speed: number): TurnDir {
  const dir = r.pick(['L', 'R', 'L', 'R', 'BL', 'BR'] as const);
  if (dir === 'BL' || dir === 'BR') b.instruction({ exits: EXITS.wye(dir), sightDistance: 700 }, { turn: dir, speed });
  else if (r.chance(0.5)) b.instruction({ exits: EXITS.crossroads(dir), sightDistance: 700 }, { turn: dir, speed });
  else b.instruction({ exits: EXITS.sideRoad(dir, { route: 'turn' }), sightDistance: 700 }, { turn: dir, speed, hint: r.chance(0.5) ? '1st paved road' : undefined });
  return dir;
}
/** Close a leg that follows a restart or a transit end at `vOut`: past its 2-minute free zone (validateScenario) with a little to spare. */
const closeAfterHold = (b: ScenarioBuilder, r: Rng, vOut: number): Scenario => close(b, vOut * 2 / 60 + 0.12 + r.next() * 0.1);
/** A time-of-day restart at the builder's position, 35-115 s after the car arrives, on a whole minute of the team's own time. */
function restartHere(b: ScenarioBuilder, r: Rng, speed: number, asp: number): void {
  b.advanceMiles(0.6 + r.next() * 0.1).checkpoint(); b.advanceFt(200);
  const arrival = ghostNow(b) + 6;
  const own = Math.ceil((arrival + r.int(35, 55)) / 60) * 60;
  b.restart(speed, own - asp * 60);
}

/** Build the micro scenario for one decision kind. `variant` picks among the shapes a kind has (see each case). */
export function microScenario(kind: DecisionKind, seed: number, variant = 0, rung: 0 | 1 | 2 | 3 = 2): MicroScenario {
  const r = rng(`micro:${kind}:${seed}:${variant}`);
  const one = (sc: Scenario, extra: Partial<MicroScenario> = {}): MicroScenario => ({ scenario: { ...sc, tags: [...(sc.tags ?? []), 'micro', `micro:${kind}`] }, kinds: [kind], maxDecisions: 1, ...extra });
  switch (kind) {
    case 'pause': {
      const v = r.pick([25, 30, 35, 40, 45]); const b = builder(kind, seed, rung).start(v);
      // PT-14 N7: 15-20 s rows (a 30 s row sat 25 s on one card)
      b.advanceMiles(0.35 + r.next() * 0.2).stop(r.pick(['S', 'L', 'R'] as const), r.pick([25, 30, 35, 40, 45]), { pause: r.pick([15, 15, 20, 20]) });
      return one(close(b, 0.4 + r.next() * 0.2));
    }
    case 'speedChange': {
      const v = r.pick([30, 35, 40]); const b = builder(kind, seed, rung).start(v);
      const nv = r.pick([v - 10, v + 10]);
      b.advanceMiles(0.45 + r.next() * 0.2).speedAtSign(r.pick(SIGNS) === 'SPEED LIMIT' ? `SPEED LIMIT ${nv}` : r.pick(SIGNS), nv, { side: r.chance(0.3) ? 'L' : 'R' });
      return one(close(b, 0.45 + r.next() * 0.2));
    }
    case 'timedStart': case 'watch': {
      // watch (MOB-053): the same timed line; the card comes after the lap at the sign and asks when the watch says to call
      const v = r.pick([30, 35]); const b = builder(kind, seed, rung).start(v);
      const hold = r.pick([v, v - 5, v + 5]); const secs = kind === 'watch' ? r.int(14, 25) : r.int(10, 15); /* PT-14 N7: 10-15 s holds on the timed-start card */ const then = r.pick([hold + 10, hold - 5, hold + 5]);
      b.advanceMiles(0.45 + r.next() * 0.15).timedAt(r.pick(LANDMARKS), { holdSpeed: hold, seconds: secs, thenSpeed: then });
      b.advanceFt(Math.round(hold * 1.4667 * secs + 500));
      return one(close(b, 0.3));
    }
    case 'turn': {
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.4 + r.next() * 0.2); turnRow(b, r, 35);
      return one(close(b, 0.45 + r.next() * 0.2));
    }
    case 'preread': {
      const v = r.pick([30, 35]); const b = builder(kind, seed, rung).start(v);
      b.advanceMiles(0.4 + r.next() * 0.2);
      const shape = variant % 3;
      if (shape === 0) turnRow(b, r, v);
      else if (shape === 1) b.stop(r.pick(['S', 'L', 'R'] as const), r.pick([30, 35, 40]), { pause: r.pick([15, 20, 30]) });
      else { const nv = r.pick([v + 10, v + 5, v - 5, v - 10]); b.speedAtSign(r.chance(0.5) ? `SPEED LIMIT ${nv}` : r.pick(SIGNS.slice(1)), nv); }
      return one(close(b, 0.45 + r.next() * 0.2), { prereadRows: 1 });
    }
    case 'checkpoint': {
      // MOB-055: 0 green (do nothing), 1 the red GREAT RACE STOP board (stop), 2 green with a rally car ahead pulling off (do not follow it)
      const look = (['green', 'red', 'carAhead'] as const)[variant % 3]!;
      const b = builder(kind, seed, rung).start(r.pick([30, 35, 40]));
      const sight = 50 * r.int(7, 13);   // PT-14 item 10: 350-650 ft, not always "450 ft ahead"
      if (look === 'red') { b.advanceMiles(0.55 + r.next() * 0.2).checkpoint('observation', sight); return one(close(b, 0.45 + r.next() * 0.15), { hint: { checkpoint: look } }); }
      b.advanceMiles(0.7 + r.next() * 0.3).checkpoint('timing', sight);
      return one(b.advanceMiles(0.25).finish().build(), { hint: { checkpoint: look } });
    }
    case 'lost': {
      // MOB-056: 0 / 2 the road dead-ends (turn around), 1 / 3 the road meets the route again. The driver notices 6-24 s after the turn;
      // the detour is either cheaper than turning round (2 x that + 20 s, RULE-034 / RULE-043) or dearer, by 10 s or more, in 5 s steps.
      // (The simulator counts the off-route road on the odometer, so the route after the junction is longer than any trip off it.)
      const loop = variant % 2 === 1; const ago = r.int(6, 16);
      const b = builder(kind, seed, rung, { excursionFt: 2000 }).start(35);
      b.advanceMiles(0.35 + r.next() * 0.2); const dir = r.pick(['L', 'R'] as const);
      let exits = EXITS.crossroads(dir);
      if (loop) {
        const back = 2 * ago + 20; const cheaper = r.chance(0.5);
        const detour = cheaper ? 5 * r.int(1, Math.floor((back - 10) / 5)) : 5 * r.int(Math.ceil((back + 10) / 5), Math.floor((back + 25) / 5));
        const atFt = r.int(900, 1300); const extra = Math.round(detour * 35 * 1.4666666666666666);
        exits = exits.map(e => e.angle === 0 ? { ...e, rejoin: { afterFt: atFt + extra, atFt } } : e);
      }
      b.instruction({ exits, sightDistance: 600 }, { turn: dir, speed: 35 });
      const line = b.lineCount;
      return one(close(b, 1.05), { missTurns: [line], hint: { lostAgo: ago } });
    }
    case 'makeup': {
      // MOB-055: 0 / 3 open road (the room to the checkpoint decides: both rates or only +20 % fit), 1 a posted limit below the +20 %
      // speed (+10 % only, RULE-005), 2 a timed interval about 7 x S seconds ahead (only +20 % finishes before it, RULE-027)
      const shape = variant % 4;
      const v = shape === 2 ? r.pick([35, 40]) : r.pick([30, 35, 40]); const b = builder(kind, seed, rung).start(v);
      b.advanceMiles(0.12);
      const vT = v - (shape === 0 || shape === 3 ? r.int(10, 14) : r.int(10, 12)); const len = shape === 2 ? r.int(800, 1000) : shape === 1 ? r.int(700, 900) : r.int(900, 1400);
      b.hazard({ kind: 'slow', speedMph: vT, lengthFt: len });
      b.advanceFt(len);
      if (shape === 2) {
        const fps = v * 1.4667; const late = len / (vT * 1.4667) - len / fps + 2;
        b.advanceFt(Math.round(600 + fps * 7 * late));
        const secs = r.int(10, 16); b.timedAt(r.pick(LANDMARKS), { holdSpeed: v, seconds: secs, thenSpeed: v + 5 });
        b.advanceFt(Math.round(v * 1.4667 * secs + 500));
        return one(close(b, 0.2));
      }
      const hint: MicroHint = shape === 1 ? { limit: Math.ceil(v * 1.1 / 5) * 5 } : {};
      // the limit card needs room for +10 % (10 x S seconds) before the checkpoint
      return one(close(b, shape === 1 ? 1.25 + r.next() * 0.1 : 1.15 + r.next() * 0.3), { hint });
    }
    case 'hazard': case 'ta': {
      // 0 truck, 1 train, 2 tractor, 3 light; a train or tractor is long or short (the scene says which; MOB-055)
      const shape = kind === 'ta' ? (variant % 2 === 0 ? 1 : 2) : variant % 4;
      const size: 'short' | 'long' = kind === 'ta' || (shape !== 1 && shape !== 2) ? 'long' : r.chance(0.4) ? 'short' : 'long';
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.3 + r.next() * 0.1);
      if (shape === 0) { const len = r.int(700, 1000); b.hazard({ kind: 'slow', speedMph: r.int(21, 25), lengthFt: len }); b.advanceFt(len); }
      else if (shape === 1) {
        b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { text: 'RR crossing (gates may be down)', speed: 35 });
        const arrival = ghostNow(b);
        if (size === 'long') b.hazard({ kind: 'train', startTod: arrival - 15, durationSeconds: r.int(45, 70) });
        else b.hazard({ kind: 'train', startTod: arrival - 40, durationSeconds: r.int(44, 47) });
      } else if (shape === 2) { const len = size === 'long' ? r.int(1700, 2100) : r.int(150, 260); b.hazard({ kind: 'tractor', speedMph: 18, lengthFt: len }); b.advanceFt(len); }
      else {
        b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 });
        const arrival = ghostNow(b); const red = r.int(25, 35); b.hazard({ kind: 'signal', redSeconds: red, greenSeconds: 45, offset: arrival - r.int(3, 8) });
      }
      b.advanceMiles(shape === 2 && size === 'long' ? 0.9 + r.next() * 0.1 : 1.1 + r.next() * 0.2).checkpoint().advanceFt(300);
      if (shape === 1 || shape === 2) b.endTimedPortion();
      const sc = b.advanceMiles(0.15).finish().build();
      return one(sc, { hint: { size } });
    }
    case 'restart': {
      // 0 / 3 a time-of-day restart with your own time printed (speeds vary), 1 an exact-transit OUT, 2 base time + starting position (RULE-010)
      const shape = variant % 4; const vOut = r.pick(SPEEDS);
      const asp = shape === 2 ? r.int(1, 30) : 0;
      const b = builder(kind, seed, rung, asp ? { asp } : {}).start(35);
      if (shape === 1) {
        b.advanceMiles(0.2 + r.next() * 0.2); const secs = r.pick([90, 120, 150]);
        b.transit({ exact: true, seconds: secs, miles: 0.3 }); b.advanceMiles(0.3); b.endTransit({ speed: vOut });
      } else restartHere(b, r, vOut, asp);
      return one(closeAfterHold(b, r, vOut), { hint: shape === 2 ? { base: true } : {} });
    }
    case 'clock': {
      // MOB-057: 0 the minute at a minute change (watch TOD), 1 the minute at an exact-transit OUT (any second: the clock may be fine),
      // 2 the second to count the launch in (clock second hand), 3 the next pause (stopwatch chrono)
      const shape = variant % 4; const question = (['minute', 'minute', 'second', 'interval'] as const)[shape]!;
      const b = builder(kind, seed, rung).start(35);
      const vOut = r.pick(SPEEDS);
      if (shape === 1) {
        b.advanceMiles(0.2 + r.next() * 0.2); const secs = r.int(80, 160);
        b.transit({ exact: true, seconds: secs, miles: 0.3 }); b.advanceMiles(0.3); b.endTransit({ speed: vOut });
      } else restartHere(b, r, vOut, 0);
      return one(closeAfterHold(b, r, vOut), { hint: { clock: question } });
    }
    case 'transitOut': {
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.2 + r.next() * 0.3); const secs = r.pick([60, 90, 105, 120, 135, 150, 180]);
      const vOut = r.pick(SPEEDS); b.transit({ exact: true, seconds: secs, miles: 0.3 }); b.advanceMiles(0.3); b.endTransit({ speed: vOut });
      return one(closeAfterHold(b, r, vOut));
    }
  }
}

/** Micro spec -> scenario. */
export function buildMicro(m: MicroSpec, rung: 0 | 1 | 2 | 3 = 2): MicroScenario { return microScenario(m.kind, m.seed, m.variant, rung); }

/** The boss run's leg: a full generated leg in decision mode, at most one card of each kind (MOB-059: the micro slots after it cover every
 *  kind; the Scheduler fills the plan to its fixed card count). */
export function bossScenario(seed: number, rung: 0 | 1 | 2 | 3 = 2, maxDecisions = BOSS_LEG_DECISIONS): MicroScenario {
  const sc = generateLeg(seed, { ...PROFILES.fullLeg, bookStyle: rung >= 3 ? 'example' : 'race' });
  return { scenario: { ...sc, aids: aidsForRung(rung), tags: [...(sc.tags ?? []), 'boss'] }, kinds: [...DECISION_KINDS], maxDecisions, prereadRows: 1, maxPerKind: 1 };
}
/** Cards the boss leg may give before the micro slots. */
export const BOSS_LEG_DECISIONS = 11;

/** The kinds that practise each skill, in the order the Scheduler cycles them. */
export const KINDS_OF_SKILL = {
  safetyCourse: ['turn', 'preread', 'checkpoint'],
  startOnTime: ['restart', 'transitOut'],
  stayOnTime: ['pause', 'speedChange', 'timedStart'],
  recovery: ['makeup', 'hazard', 'ta', 'lost'],
  instruments: ['clock', 'watch'],
} as const satisfies Record<string, readonly DecisionKind[]>;
export function microSkill(kind: DecisionKind) { return SKILL_OF_KIND[kind]; }
