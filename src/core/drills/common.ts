/** Shared pieces of the drill definitions: tiers, scenario base, hidden cars, ASP draw, generator hook (DRILL-001, DRILL-010, DRILL-021, DRILL-025). */
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../builder.js';
import { aidsForRung, DRIVER_EXPERT, DRIVER_DAD_SPORTSMAN, DRIVER_DAD_ROOKIE, FORD_1939, PACKARD_1936, type Scenario, type DriverSpec, type AidsConfig } from '../course.js';
import { hms } from '../units.js';
import { bookStyleForRung } from '../griid.js';
import { rng } from '../rng.js';
import * as generator from '../generator/generate.js';
import type { Drill, DrillTier } from './types.js';

export const T0 = hms(8, 0, 0);

type GenHook = { generateLeg?: (seed: number, profile: unknown) => Scenario; generateStage?: (seed: number, profile: unknown) => Scenario; PROFILES?: Record<string, unknown> } | null;
let gen: GenHook = generator as unknown as GenHook;
/** The generator module registers itself here (keeps drills free of a hard dependency). */
export function setGenerator(g: GenHook): void { gen = g; }
export function generatorHook(): GenHook { return gen; }

/** Gold tier: a hidden car variant (ramps +-15%) so the printed Ford table is only approximately right and the player must measure. */
export function goldCar(seed: number, base = FORD_1939): typeof FORD_1939 { const r = rng(seed * 7919 + 13); return { ...base, name: `${base.name} (this one)`, a0: base.a0 * (0.85 + 0.3 * r.next()), aDec: base.aDec * (0.85 + 0.3 * r.next()) }; }

export function tiers(rungs: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3] = [3, 2, 1]): DrillTier[] {
  const drivers: DriverSpec[] = [DRIVER_EXPERT, DRIVER_DAD_SPORTSMAN, DRIVER_DAD_ROOKIE];
  const names = ['Bronze', 'Silver', 'Gold'];
  return names.map((name, i) => ({ name, aids: aidsForRung(rungs[i]!), driver: drivers[i]!, description: `${name}: aids rung ${rungs[i]}, ${drivers[i]!.skill} driver` }));
}
export function legalTiers(): DrillTier[] {
  return [
    { name: 'Rookie', aids: aidsForRung(0), driver: DRIVER_DAD_SPORTSMAN, description: 'Great Race legal, sportsman driver' },
    { name: 'Sportsman', aids: aidsForRung(0), driver: DRIVER_DAD_SPORTSMAN, description: 'Great Race legal, stock speedometer' },
    { name: 'Expert', aids: aidsForRung(0), driver: DRIVER_DAD_ROOKIE, description: 'Great Race legal, rookie driver on a rough road' },
  ];
}
export function tierOf(d: Pick<Drill, 'tiers'>, t: number): DrillTier { return d.tiers[Math.max(0, Math.min(d.tiers.length - 1, t))]!; }

/** GRIID-009: the race-style book (remarks only) from aids rung 1 down, the Example Rally wording above. */
export function bookStyleFor(aids: AidsConfig): 'race' | 'example' { return bookStyleForRung(aids.rung); }

/** Which drills hand the player the Packard (CHART-002) at Bronze, and which hide the Ford's own numbers. */
const PACKARD_BRONZE = new Set(['D03', 'D06']);
const HIDDEN_FORD: Record<string, number> = { D03: 2, D04: 2, D05: 2, D18: 2, D06: 1 };

export function carFor(id: string, seed: number, tier: DrillTier): typeof FORD_1939 {
  if (PACKARD_BRONZE.has(id) && tier.name === 'Bronze') return PACKARD_1936;
  const hiddenFrom = HIDDEN_FORD[id]; const idx = ['Bronze', 'Silver', 'Gold'].indexOf(tier.name);
  if (hiddenFrom !== undefined && idx >= hiddenFrom) return goldCar(seed);
  return FORD_1939;
}

export function base(id: string, name: string, seed: number, tier: DrillTier, extra: Partial<ConstructorParameters<typeof ScenarioBuilder>[0]> = {}): ScenarioBuilder {
  return new ScenarioBuilder({ id: `${id}-${seed}-${tier.name}`, name, seed, startTime: T0, driver: tier.driver, aids: tier.aids, speedo: PERFECT_TIMEWISE, car: carFor(id, seed, tier), prereadSeconds: 60, bookStyle: bookStyleFor(tier.aids), ...extra });
}

/** STAGE-002: the assigned starting position drawn for a drill seed or campaign stage, 1..120 minutes (never 0, so base + ASP always differs from the printed time). */
export function aspForSeed(seed: number, salt = 0): number { return rng(`asp:${salt}:${seed}`).int(1, 120); }
