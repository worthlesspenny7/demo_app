/** Stopwatch dial view-model (UI-001). Heuer Monte Carlo style: central 1/5-s sweep hand, central minute register. */
import type { WatchKind } from '../../core/stopwatch.js';
import { formatElapsed } from '../../core/units.js';

export interface StopwatchVmOptions {
  /** Seconds for one revolution of the sweep hand: 30 (McKelvie) or 60. */
  dialSeconds?: 30 | 60;
  /** Minutes for one revolution of the central register: 30 or 60. */
  registerMinutes?: 30 | 60;
  /** Countdown bezel index in seconds on the dial. */
  bezel?: number;
  running?: boolean;
  laps?: number[];
}

export interface StopwatchVm {
  kind: WatchKind;
  /** Quantized reading (1/5 s analog, 1/100 s digital). */
  reading: number;
  dialSeconds: number;
  registerMinutes: number;
  /** Degrees clockwise from 12 o'clock. */
  sweepDeg: number;
  registerDeg: number;
  bezelDeg: number;
  /** Seconds until the sweep hand reaches the bezel index (wraps on the dial). */
  bezelRemaining: number;
  /** Count of 1/5 s ticks around the dial. */
  tickCount: number;
  /** Whole minutes elapsed (for the hour/minute aperture). */
  minutes: number;
  digital: string;
  running: boolean;
  /** Last three laps, newest first, formatted. */
  lapRows: { n: number; text: string; split: string }[];
}

const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

export function stopwatchViewModel(elapsed: number, kind: WatchKind = 'analog', opts: StopwatchVmOptions = {}): StopwatchVm {
  const dialSeconds = opts.dialSeconds === 60 ? 60 : 30;
  const registerMinutes = opts.registerMinutes === 60 ? 60 : 30;
  const e = Math.max(0, num(elapsed));
  const q = kind === 'digital' ? 0.01 : 0.2;
  const reading = Math.round(e / q) * q;
  const pos = reading % dialSeconds;
  const sweepDeg = round3((pos / dialSeconds) * 360);
  const registerDeg = round3((((reading / 60) % registerMinutes) / registerMinutes) * 360);
  const bezel = ((num(opts.bezel) % dialSeconds) + dialSeconds) % dialSeconds;
  const bezelDeg = round3((bezel / dialSeconds) * 360);
  const bezelRemaining = round3((((bezel - pos) % dialSeconds) + dialSeconds) % dialSeconds);
  const laps = Array.isArray(opts.laps) ? opts.laps.filter(x => typeof x === 'number') : [];
  const lapRows = laps.slice(-3).reverse().map((l, i, arr) => {
    const idx = laps.length - i;
    const prev = idx >= 2 ? laps[idx - 2]! : 0;
    void arr;
    return { n: idx, text: formatElapsed(l, 1), split: formatElapsed(l - prev, 1) };
  });
  return {
    kind, reading: Math.round(reading * 100) / 100, dialSeconds, registerMinutes, sweepDeg, registerDeg, bezelDeg, bezelRemaining,
    tickCount: dialSeconds * 5, minutes: Math.floor(reading / 60), digital: formatElapsed(reading, kind === 'digital' ? 2 : 1),
    running: !!opts.running, lapRows,
  };
}

function round3(x: number): number { return Math.round(x * 1000) / 1000; }
