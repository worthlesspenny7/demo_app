import { describe, it } from 'vitest';
import { oracleDays } from './gen-v4-oracle.js';
describe('GEN-017 the oracle over 50 generated day stages (seeds 26-50)', () => {
  it('GEN-017 day seeds 26-50: the oracle finishes on course, no DNF, no missed observation, no early restart; legs within 5 s (+ half the TA-recoverable delay) on at least 23 of 25 days, never over 15 s', () => { oracleDays(Array.from({ length: 25 }, (_, i) => i + 26), 2); }, 300_000);
});
