/** Physical car. DESIGN §5. Speeds ft/s internally. */
import type { CarSpec } from './course.js';
import { clamp, mphToFps } from './units.js';

export type CarMode = 'cruise' | 'stopping' | 'stopped' | 'turning';

export class Car {
  s = 0;
  v = 0;          // ft/s
  a = 0;
  mode: CarMode = 'stopped';
  /** Per-maneuver perturbation factors applied to ramps (set by the driver model). */
  accelFactor = 1;
  decelFactor = 1;
  constructor(readonly spec: CarSpec) {}

  /** Max acceleration available at speed v (ft/s^2). */
  aAcc(v: number): number { return this.spec.a0 * Math.max(0.15, 1 - v / this.spec.vMax) * this.accelFactor; }
  aDec(): number { return this.spec.aDec * this.decelFactor; }

  /** Distance needed to stop from current speed at comfortable deceleration. */
  stoppingDistance(): number { return (this.v * this.v) / (2 * this.aDec()); }

  /**
   * Advance one step toward a target speed (ft/s). If `stopAt` (absolute s) is given and
   * reachable, the car brakes to stop exactly there and holds.
   */
  step(dt: number, targetV: number, stopAt: number | null): void {
    const kP = this.spec.a0 >= 1e4 ? 1e6 : 2.0; // the instant (ghost) preset snaps to target
    let aCmd = clamp(kP * (targetV - this.v), -this.aDec(), this.aAcc(this.v));
    // Snap small differences to avoid dithering.
    if (Math.abs(targetV - this.v) < 0.02) { this.v = targetV; aCmd = 0; }
    if (stopAt !== null) {
      const dist = stopAt - this.s;
      if (dist <= 0.5 && this.v < 0.5) { this.v = 0; this.a = 0; this.s = Math.max(this.s, stopAt); this.mode = 'stopped'; return; }
      // Required deceleration to stop at the line.
      const need = dist > 0 ? (this.v * this.v) / (2 * dist) : Infinity;
      if (need >= this.aDec() * 0.98 || dist <= 0) {
        // Brake: choose deceleration that lands exactly on the line (bounded by hard braking).
        const dec = clamp(need, this.aDec() * 0.98, Math.max(14, this.aDec()));
        aCmd = -dec;
        this.mode = 'stopping';
      }
    }
    this.a = aCmd;
    let vNext = this.v + aCmd * dt;
    if (stopAt === null || this.mode !== 'stopping') { if ((targetV - this.v) * (targetV - vNext) <= 0) vNext = targetV; } // never overshoot the target
    if (vNext < 0) vNext = 0;
    let ds = (this.v + vNext) / 2 * dt;
    if (stopAt !== null && this.s + ds >= stopAt - 0.05) { ds = Math.max(0, stopAt - this.s); vNext = 0; this.mode = 'stopping'; } // never pass a stop line
    this.s += ds;
    this.v = vNext;
    if (stopAt !== null && this.v === 0 && Math.abs(this.s - stopAt) < 1) { this.mode = 'stopped'; this.s = stopAt; }
    else if (this.mode !== 'turning') this.mode = this.v === 0 && targetV === 0 ? 'stopped' : (stopAt !== null && this.mode === 'stopping' ? 'stopping' : 'cruise');
  }

  mph(): number { return this.v / 1.4666666666666666; }
  static fps(mph: number): number { return mphToFps(mph); }
}
