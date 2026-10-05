/** GEN-017: the OracleBot over generated day stages (shared by tests/gen-v4-oracle-1/2.test.ts, split so the two halves run in parallel). */
import { expect } from 'vitest';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';

/**
 * Every day finishes on course with no DNF, no missed observation checkpoint and no early restart. Legs: 5 s plus half the committee-recoverable delay on almost every day;
 * the generator's debt model is an estimate (a red light or two unpaused STOPs before a checkpoint can leave 6-13 s on a leg), so at most `allowOver5` days may carry one leg
 * over that, and no leg is ever over 15 s plus the same allowance.
 */
export function oracleDays(seeds: number[], allowOver5: number): void {
  let over5 = 0; const notes: string[] = [];
  for (const seed of seeds) {
    const sc = generateStage(seed, { ...PROFILES.fullStage, trafficWaitProbability: 0 });
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim), 8 * 3600);
    expect(sim.phase, `seed ${seed}`).toBe('finished'); expect(r.offCourseCount, `seed ${seed}`).toBe(0); expect(r.observationMissed, `seed ${seed}`).toBe(false);
    expect(r.dnf, `seed ${seed}`).toBe(false); expect(r.score.earlyRestartPenalty, `seed ${seed}`).toBe(0);
    const worst = Math.max(...r.score.legs.map(l => Math.abs(l.error!) - 0.5 * (sim.taRecoverable[l.index] ?? 0)));
    expect(worst, `seed ${seed}`).toBeLessThanOrEqual(15);
    if (worst > 5) { over5++; notes.push(`seed ${seed}: ${worst.toFixed(1)} s`); }
  }
  expect(over5, notes.join('; ')).toBeLessThanOrEqual(allowOver5);
}
