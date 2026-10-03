/**
 * Digital lap/split stopwatch view-model (WATCH-008, UI-033). Big 1/100 s display, a CHRONO / TOD mode chip, a lap table of
 * interval-over-cumulative pairs in the shape of the book's calibration box, the split-frozen indicator with its auto-release
 * countdown, and recall cycling. Pure, no DOM.
 */
import type { Observation } from '../../core/sim.js';
import { formatClock } from '../../core/units.js';
import { formatInterval } from '../../core/griid.js';

export interface DigitalLapRow { n: number; interval: string; cumulative: string; /** the lap being recalled */ recalled: boolean }
export interface DigitalWatchVm {
  mode: 'chrono' | 'tod'; modeLabel: 'CHRONO' | 'TOD';
  /** The big display: "7:21.30" in chrono, "10:14:07.35" in TOD. */
  display: string;
  running: boolean;
  frozen: boolean;
  /** Seconds until a frozen split releases by itself; null when not frozen or when the hold is "until recall". */
  holdLeft: number | null;
  /** "SPLIT 4.2 s" / "SPLIT (recall to release)" / "RECALL L3" / "" */
  indicator: string;
  recalled: number | null;
  /** Newest first, at most the 10 laps the watch remembers. */
  laps: DigitalLapRow[];
  /** Reset is offered only while the watch is stopped (Shift+R forces it). */
  canReset: boolean;
}

/** "7:21.30": minutes, seconds, hundredths. */
export function chronoText(sec: number): string {
  const t = Math.max(0, Math.round(sec * 100) / 100);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
/** "10:14:07.35": the rally time of day with hundredths. */
export function todText(tod: number): string {
  const whole = Math.floor(tod); const hh = Math.round((tod - whole) * 100);
  return `${formatClock(hh >= 100 ? whole + 1 : whole)}.${String(hh >= 100 ? 0 : hh).padStart(2, '0')}`;
}

/** Tracks when the split display froze (from the observation) so the countdown to the auto-release can be shown. */
export class SplitTracker {
  private since: number | null = null;
  private lapCount = 0;
  update(frozen: boolean, lapCount: number, tod: number): void {
    if (!frozen) { this.since = null; this.lapCount = lapCount; return; }
    if (this.since === null || lapCount !== this.lapCount) this.since = tod;
    this.lapCount = lapCount;
  }
  /** Seconds left of the hold; null for hold = 0 (until recall) or when not frozen. */
  left(hold: number, tod: number): number | null {
    if (this.since === null || !(hold > 0)) return null;
    return Math.max(0, Math.round((hold - (tod - this.since)) * 10) / 10);
  }
}

export function digitalWatchViewModel(sw: Observation['stopwatch'], opts: { holdSeconds?: number; tod?: number; tracker?: SplitTracker } = {}): DigitalWatchVm {
  const mode = sw.mode === 'tod' ? 'tod' : 'chrono';
  const table = sw.lapTable ?? [];
  const recalled = sw.recalled ?? null;
  const frozen = !!sw.frozen && mode === 'chrono';
  const holdLeft = frozen && opts.tracker && opts.tod !== undefined ? opts.tracker.left(opts.holdSeconds ?? 0, opts.tod) : null;
  const first = Math.max(0, table.length - 10);
  const laps: DigitalLapRow[] = table.map((l, i) => ({ n: i + 1, interval: formatInterval(l.interval, true), cumulative: formatInterval(l.cumulative, true), recalled: recalled === i })).slice(first).reverse();
  let indicator = '';
  if (mode === 'chrono') {
    if (recalled !== null) indicator = `RECALL L${recalled + 1}`;
    else if (frozen) indicator = holdLeft !== null ? `SPLIT frozen, releases in ${holdLeft.toFixed(1)} s` : 'SPLIT frozen (R to release)';
  }
  return {
    mode, modeLabel: mode === 'tod' ? 'TOD' : 'CHRONO', display: mode === 'tod' ? todText(sw.reading) : chronoText(sw.reading),
    running: sw.running, frozen, holdLeft, indicator, recalled, laps, canReset: !sw.running,
  };
}
