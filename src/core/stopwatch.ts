/** One stopwatch (analog or digital) and an analog TOD clock with a bezel. DESIGN §8. */
export type WatchKind = 'analog' | 'digital';

export class Stopwatch {
  running = false;
  private elapsedAtStop = 0;
  private startedAt: number | null = null;
  laps: number[] = [];
  constructor(readonly kind: WatchKind = 'analog') {}

  /** Raw elapsed seconds at simulator time `now`. */
  elapsed(now: number): number {
    return this.elapsedAtStop + (this.running && this.startedAt !== null ? now - this.startedAt : 0);
  }
  start(now: number): void { if (!this.running) { this.running = true; this.startedAt = now; } }
  stop(now: number): void { if (this.running) { this.elapsedAtStop = this.elapsed(now); this.running = false; this.startedAt = null; } }
  toggle(now: number): void { this.running ? this.stop(now) : this.start(now); }
  lap(now: number): number { const e = this.elapsed(now); this.laps.push(e); return e; }
  /** Analog watches reset only when stopped (the crown); digital anytime. */
  reset(now: number): boolean {
    if (this.kind === 'analog' && this.running) return false;
    this.running = false; this.startedAt = null; this.elapsedAtStop = 0; this.laps = []; void now;
    return true;
  }
  /** Reading at the dial's resolution: analog 1/5 s, digital 1/100 s. */
  reading(now: number): number {
    const e = this.elapsed(now);
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
  bezelRemaining(now: number): number { const sec = now % 60; return ((this.bezel - sec) % 60 + 60) % 60; }
}
