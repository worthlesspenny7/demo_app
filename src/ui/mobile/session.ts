/** The phone shell's session state: the run in play, what started it, the last result, and a skewable wall clock (tests). */
import type { RunResult } from '../../core/decision/index.js';
import type { RunHandle, RunRequest } from './engine.js';

export const session: {
  handle: RunHandle | null; req: RunRequest | null; dailyIndex: number | null; last: { result: RunResult; req: RunRequest; dailyIndex: number | null; source: 'core' | 'runner' | 'stub' } | null;
  /** Seconds added to the wall clock by window.__rally.decision.advance (tests only). */
  skew: number;
} = { handle: null, req: null, dailyIndex: null, last: null, skew: 0 };

export function wallSeconds(): number { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000 + session.skew; }
