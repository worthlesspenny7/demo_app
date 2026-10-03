/** One stopwatch (analog or digital) and an analog TOD clock with a bezel. DESIGN §8. */
export type WatchKind = 'analog' | 'digital';

export class Stopwatch {
  running = false;
  private elapsedAtStop = 0;
  private startedAt: number | null = null;
  laps: number[] = [];
  /** Countdown bezel index (seconds on the dial). Analog only; dial is `dialSeconds` long. */
  bezel = 0;
  readonly dialSeconds: number;
  constructor(readonly kind: WatchKind = 'analog', dialSeconds = 60) { this.dialSeconds = dialSeconds; }
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
  /** Digital: display freezes on the split until recall(); analog: the hand keeps sweeping. */
  frozenAt: number | null = null;
  lap(now: number): number { const e = this.elapsed(now); this.laps.push(e); if (this.kind === 'digital') this.frozenAt = e; return e; }
  recall(): void { this.frozenAt = null; }
  /** Analog watches reset only when stopped (the crown); digital anytime. */
  reset(now: number): boolean {
    if (this.kind === 'analog' && this.running) return false;
    this.running = false; this.startedAt = null; this.elapsedAtStop = 0; this.laps = []; this.frozenAt = null; void now;
    return true;
  }
  /** Reading at the dial's resolution: analog 1/5 s, digital 1/100 s. */
  reading(now: number): number {
    const e = this.frozenAt !== null ? this.frozenAt : this.elapsed(now);
    const q = this.kind === 'analog' ? 0.2 : 0.01;
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
