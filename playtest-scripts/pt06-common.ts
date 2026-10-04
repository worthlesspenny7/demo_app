/** PT-06 shared helpers: small scenarios and a step loop (no UI). */
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../src/core/builder.js';
import { DRIVER_EXPERT, LEGAL_AIDS, TRAINING_AIDS, type Scenario, type AidsConfig } from '../src/core/course.js';
import { Simulator } from '../src/core/sim.js';
import { hms } from '../src/core/units.js';

export { hms, Simulator, ScenarioBuilder, DRIVER_EXPERT, LEGAL_AIDS, TRAINING_AIDS };
export const T0 = hms(8, 0, 0);
export function adv(sim: Simulator, sec: number): void { for (let t = 0; t < sec - 1e-9; t += 0.1) sim.step(0.1); }
export function until(sim: Simulator, pred: () => boolean, max = 3600): number { let t = 0; while (!pred() && t < max && sim.phase !== 'finished') { sim.step(0.1); t += 0.1; } return t; }
export function aidsRung(r: number): AidsConfig { return r <= 1 ? { ...LEGAL_AIDS, rung: r } : { ...TRAINING_AIDS, rung: r }; }
/** straight 1-leg course with an asp start; 40 mph */
export function simpleStart(asp: number, rung = 0, seed = 1, preread = 120): Scenario {
  return new ScenarioBuilder({ id: 'pt06', name: 'pt06', startTime: T0, asp, seed, driver: DRIVER_EXPERT, speedo: PERFECT_TIMEWISE, aids: aidsRung(rung), prereadSeconds: preread })
    .start(40).advanceMiles(4).checkpoint().advanceFt(300).finish().build();
}
export function log(...a: unknown[]): void { console.log(...a); }
