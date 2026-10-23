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
import { SKILL_OF_KIND } from './types.js';

/** What a DecisionRunner needs to play a micro scenario. */
export interface MicroScenario {
  scenario: Scenario;
  /** Kinds the player answers here (the navigator does the rest). */
  kinds: DecisionKind[];
  maxDecisions: number;
  prereadRows?: number;
  /** Turns the navigator deliberately does not call (the driver drives past them: lost cards). */
  missTurns?: number[];
}

const T0 = 9 * 3600;
const SIGNS = ['SPEED LIMIT', 'CURVE', 'BRIDGE', 'END ROAD WORK'];
const LANDMARKS = ['bridge', 'water tower', 'church on R', 'grain elevator'];

function builder(kind: DecisionKind, seed: number, rung: 0 | 1 | 2 | 3, extra: Partial<ConstructorParameters<typeof ScenarioBuilder>[0]> = {}): ScenarioBuilder {
  return new ScenarioBuilder({ id: `micro-${kind}-${seed}`, name: `Micro: ${kind}`, seed, startTime: T0, driver: DRIVER_EXPERT, aids: aidsForRung(rung), speedo: PERFECT_TIMEWISE, car: FORD_1939, prereadSeconds: 20, startProcedure: 'drill', excursionFt: 1000, ...extra });
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

/** Build the micro scenario for one decision kind. `variant` picks among the shapes a kind has (hazard: truck / train / tractor / light). */
export function microScenario(kind: DecisionKind, seed: number, variant = 0, rung: 0 | 1 | 2 | 3 = 2): MicroScenario {
  const r = rng(`micro:${kind}:${seed}:${variant}`);
  const one = (sc: Scenario, extra: Partial<MicroScenario> = {}): MicroScenario => ({ scenario: { ...sc, tags: [...(sc.tags ?? []), 'micro', `micro:${kind}`] }, kinds: [kind], maxDecisions: 1, ...extra });
  switch (kind) {
    case 'pause': {
      const v = r.pick([30, 35, 40]); const b = builder(kind, seed, rung).start(v);
      b.advanceMiles(0.35 + r.next() * 0.2).stop(r.pick(['S', 'L', 'R'] as const), r.pick([30, 35, 40]), { pause: r.pick([15, 15, 20, 30]) });
      return one(close(b, 0.4 + r.next() * 0.2));
    }
    case 'speedChange': {
      const v = r.pick([30, 35, 40]); const b = builder(kind, seed, rung).start(v);
      const nv = r.pick([v - 10, v + 10]);
      b.advanceMiles(0.45 + r.next() * 0.2).speedAtSign(r.pick(SIGNS) === 'SPEED LIMIT' ? `SPEED LIMIT ${nv}` : r.pick(SIGNS), nv, { side: r.chance(0.3) ? 'L' : 'R' });
      return one(close(b, 0.45 + r.next() * 0.2));
    }
    case 'timedStart': {
      const v = r.pick([30, 35]); const b = builder(kind, seed, rung).start(v);
      const hold = r.pick([v, v - 5, v + 5]); const secs = r.int(10, 25); const then = r.pick([hold + 10, hold - 5, hold + 5]);
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
      else b.speedAtSign(`SPEED LIMIT ${v + 10}`, v + 10);
      return one(close(b, 0.45 + r.next() * 0.2), { prereadRows: 1 });
    }
    case 'checkpoint': {
      const b = builder(kind, seed, rung).start(r.pick([30, 35, 40]));
      b.advanceMiles(0.7 + r.next() * 0.3).checkpoint('timing', 450);
      return one(b.advanceMiles(0.25).finish().build());
    }
    case 'lost': {
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.35 + r.next() * 0.2); const dir = r.pick(['L', 'R'] as const);
      b.instruction({ exits: EXITS.crossroads(dir), sightDistance: 600 }, { turn: dir, speed: 35 });
      const line = b.lineCount;
      return one(close(b, 0.6), { missTurns: [line] });
    }
    case 'makeup': {
      const v = r.pick([30, 35, 40]); const b = builder(kind, seed, rung).start(v);
      b.advanceMiles(0.12);
      const len = r.int(900, 1400); b.hazard({ kind: 'slow', speedMph: v - r.int(10, 14), lengthFt: len });
      b.advanceFt(len);
      return one(close(b, 1.15 + r.next() * 0.3));
    }
    case 'hazard': case 'ta': {
      const shape = kind === 'ta' ? (variant % 2 === 0 ? 1 : 2) : variant % 4;   // 0 truck, 1 train, 2 tractor, 3 light
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.3 + r.next() * 0.1);
      if (shape === 0) { const len = r.int(900, 1300); b.hazard({ kind: 'slow', speedMph: 22, lengthFt: len }); b.advanceFt(len); }
      else if (shape === 1) {
        b.instruction({ control: 'RR', sightDistance: 700, label: 'RR crossing', sign: { text: 'RAILROAD CROSSING', shape: 'rr', side: 'R' } }, { text: 'RR crossing (gates may be down)', speed: 35 });
        const arrival = ghostNow(b); b.hazard({ kind: 'train', startTod: arrival - 15, durationSeconds: r.int(45, 70) });
      } else if (shape === 2) { const len = r.int(900, 1300); b.hazard({ kind: 'tractor', speedMph: 18, lengthFt: len }); b.advanceFt(len); }
      else {
        b.instruction({ control: 'SIGNAL', exits: EXITS.crossroads('S'), sightDistance: 800 }, { turn: 'S', speed: 35 });
        const arrival = ghostNow(b); const red = r.int(25, 35); b.hazard({ kind: 'signal', redSeconds: red, greenSeconds: 45, offset: arrival - r.int(3, 8) });
      }
      b.advanceMiles(1.1 + r.next() * 0.2).checkpoint().advanceFt(300);
      if (shape === 1 || shape === 2) b.endTimedPortion();
      const sc = b.advanceMiles(0.15).finish().build();
      return one(sc);
    }
    case 'restart': case 'clock': {
      // a 2-minute free zone follows every restart and transit end (validateScenario): the checkpoint sits 1.3+ miles on
      const exact = kind === 'restart' && variant % 2 === 1;
      const b = builder(kind, seed, rung).start(35);
      if (exact) {
        b.advanceMiles(0.2); const secs = r.pick([120, 150]);
        b.transit({ exact: true, seconds: secs, miles: 0.3 }); b.advanceMiles(0.3); b.endTransit({ speed: 35 });
      } else {
        b.advanceMiles(0.6 + r.next() * 0.1).checkpoint(); b.advanceFt(200);
        const arrival = ghostNow(b) + 6;
        const base = Math.ceil((arrival + r.int(35, 55)) / 60) * 60;   // a whole minute, 35-115 s after the car arrives
        b.restart(35, base);
      }
      return one(close(b, 1.3 + r.next() * 0.15));
    }
    case 'transitOut': {
      const b = builder(kind, seed, rung).start(35);
      b.advanceMiles(0.3); const secs = r.pick([90, 120, 150]);
      b.transit({ exact: true, seconds: secs, miles: 0.3 }); b.advanceMiles(0.3); b.endTransit({ speed: 35 });
      return one(close(b, 1.3 + r.next() * 0.15));
    }
  }
}

/** Micro spec -> scenario. */
export function buildMicro(m: MicroSpec, rung: 0 | 1 | 2 | 3 = 2): MicroScenario { return microScenario(m.kind, m.seed, m.variant, rung); }

/** The boss run: a full generated leg in decision mode, about 25 cards, every kind (MOB-031). */
export function bossScenario(seed: number, rung: 0 | 1 | 2 | 3 = 1): MicroScenario {
  const sc = generateLeg(seed, { ...PROFILES.fullLeg, bookStyle: rung >= 3 ? 'example' : 'race' });
  return { scenario: { ...sc, aids: aidsForRung(rung), tags: [...(sc.tags ?? []), 'boss'] }, kinds: ['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock'], maxDecisions: 25, prereadRows: 2 };
}

/** The kinds that practise each skill, in the order the Scheduler cycles them. */
export const KINDS_OF_SKILL = {
  safetyCourse: ['turn', 'preread', 'checkpoint'],
  startOnTime: ['restart', 'transitOut'],
  stayOnTime: ['pause', 'speedChange', 'timedStart'],
  recovery: ['makeup', 'hazard', 'ta', 'lost'],
  instruments: ['clock'],
} as const satisfies Record<string, readonly DecisionKind[]>;
export function microSkill(kind: DecisionKind) { return SKILL_OF_KIND[kind]; }
