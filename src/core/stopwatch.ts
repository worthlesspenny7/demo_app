/** One stopwatch (analog or digital) and an analog TOD clock with a bezel. DESIGN §8. */
export type WatchKind = 'analog' | 'digital';
/** WATCH-008: the digital watch shows the stopwatch (chrono) or the rally time of day (tod). */
export type WatchMode = 'chrono' | 'tod';
/** The handbook recommends a digital stopwatch with lap/split and time of day (HB p.5): the engine default. */
export const DEFAULT_WATCH: WatchKind = 'digital';
export const LAP_MEMORY = 10;

export class Stopwatch {
  running = false;
  private elapsedAtStop = 0;
  private startedAt: number | null = null;
  /** Splits (cumulative elapsed at each lap). Interval / cumulative pairs: lapTable(). */
  laps: number[] = [];
  mode: WatchMode = 'chrono';
  /** Countdown bezel index (seconds on the dial). Analog only; dial is `dialSeconds` long. */
  bezel = 0;
  readonly dialSeconds: number;
  /** Seconds a split stays frozen before the display releases by itself; 0 = hold until recall (WATCH-008). */
  holdSeconds: number;
  constructor(readonly kind: WatchKind = 'analog', dialSeconds = 60, holdSeconds = 0) { this.dialSeconds = dialSeconds; this.holdSeconds = holdSeconds; }
  setBezel(seconds: number): void { const d = this.dialSeconds; this.bezel = ((Math.round(seconds * 10) / 10) % d + d) % d; }
  /** Seconds until the sweep hand reaches the bezel index (wraps on the dial). */
  bezelRemaining(now: number): number {
    const d = this.dialSeconds; const pos = this.elapsed(now) % d; const r = ((this.bezel - pos) % d + d) % d;
    // N6: float noise at the index (20.200000000000003 vs 20.2) must read 0.0 at the index, never a wrapped 60.0
    return r < 1e-6 || r > d - 1e-6 ? 0 : r;
  }

  /** Raw elapsed seconds at simulator time `now`. */
  elapsed(now: number): number {
    return this.elapsedAtStop + (this.running && this.startedAt !== null ? now - this.startedAt : 0);
  }
  start(now: number): void { if (!this.running) { this.running = true; this.startedAt = now; } }
  stop(now: number): void { if (this.running) { this.elapsedAtStop = this.elapsed(now); this.running = false; this.startedAt = null; } }
  toggle(now: number): void { this.running ? this.stop(now) : this.start(now); }
  /** Digital only: chrono <-> time of day. */
  setMode(m: WatchMode): void { if (this.kind === 'digital') this.mode = m; }
  toggleMode(): void { this.setMode(this.mode === 'chrono' ? 'tod' : 'chrono'); }

  /** Digital: the display freezes on the split; it releases on recall() or after holdSeconds. Analog: the hand keeps sweeping. */
  frozenAt: number | null = null;
  private frozenSince = 0;
  /** Index into laps of the lap being recalled (cycling back through the last 10), or null for live. */
  recalled: number | null = null;
  /** Is the split display still frozen at `now` (before the auto-release)? */
  isFrozen(now: number): boolean { return this.frozenAt !== null && (this.holdSeconds <= 0 || now - this.frozenSince < this.holdSeconds - 1e-9); }
  lap(now: number): number {
    const e = this.elapsed(now); this.laps.push(e);
    if (this.kind === 'digital') { this.frozenAt = e; this.frozenSince = now; this.recalled = null; }
    return e;
  }
  /** Interval and cumulative time of every lap, the shape of the book's calibration box ("5m32.0s" over "7m21.3s"). */
  lapTable(): { interval: number; cumulative: number }[] {
    return this.laps.map((c, i) => ({ interval: i === 0 ? c : c - this.laps[i - 1]!, cumulative: c }));
  }
  /** Release a frozen split; otherwise step back through the last 10 laps, and back to live after the oldest. */
  recall(now?: number): void {
    if (this.frozenAt !== null) { const live = now === undefined || this.isFrozen(now); this.frozenAt = null; if (live) return; }
    if (!this.laps.length) return;
    const oldest = Math.max(0, this.laps.length - LAP_MEMORY);
    const next = this.recalled === null ? this.laps.length - 1 : this.recalled - 1;
    this.recalled = next < oldest ? null : next;
  }
  /** Stopped-only reset (the crown / button); `force` overrides the guard (WATCH-008). */
  reset(now: number, force = false): boolean {
    if (this.running && !force) return false;
    this.running = false; this.startedAt = null; this.elapsedAtStop = 0; this.laps = []; this.frozenAt = null; this.recalled = null; void now;
    return true;
  }
  /** What the display shows at `now`: the rally time of day in tod mode, a recalled lap, a frozen split, or the live elapsed time. */
  reading(now: number): number {
    const q = this.kind === 'analog' ? 0.2 : 0.01;
    if (this.mode === 'tod') return Math.round((((now % 86400) + 86400) % 86400) / q) * q;
    const e = this.recalled !== null ? this.laps[this.recalled]! : this.isFrozen(now) ? this.frozenAt! : this.elapsed(now);
    return Math.round(e / q) * q;
  }
}

export class RallyClock {
  /** Bezel index position in seconds-of-minute (0..59). */
  bezel = 0;
  tod(now: number): number { return now; }
  setBezel(seconds: number): void { this.bezel = ((Math.round(seconds) % 60) + 60) % 60; }
  /** Seconds until the second hand reaches the bezel index. */
  bezelRemaining(now: number): number { const sec = now % 60; const r = ((this.bezel - sec) % 60 + 60) % 60; return r < 1e-6 || r > 60 - 1e-6 ? 0 : r; }
}
