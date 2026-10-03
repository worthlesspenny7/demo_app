/** Speedometer models. DESIGN §6. All speeds in mph here. */
import type { SpeedoSpec, Rng } from './types-rng.js';
import { clamp } from './units.js';

export class Speedometer {
  readonly spec: SpeedoSpec;
  /** Timewise user-set factor relative to the true factor; 1.0 = reads true. */
  userFactor = 1;
  private needle = 0;    // lagged indicated value
  private phase = 0;
  constructor(spec: SpeedoSpec, private readonly rnd: Rng) { this.spec = { ...spec }; }

  /** Instantaneous (un-lagged) indicated value for a true speed. */
  indicatedFor(trueMph: number): number {
    const sp = this.spec;
    const raw = sp.gain * trueMph + sp.offset + sp.quad * trueMph * trueMph;
    return sp.kind === 'timewise' ? raw * this.userFactor : raw;
  }

  /** True speed that produces a wanted indicated reading (steady state). */
  inverse(indicatedMph: number): number {
    const sp = this.spec;
    const target = sp.kind === 'timewise' ? indicatedMph / this.userFactor : indicatedMph;
    if (sp.quad === 0) return Math.max(0, (target - sp.offset) / sp.gain);
    // solve quad*v^2 + gain*v + (offset - target) = 0
    const a = sp.quad, b = sp.gain, c = sp.offset - target;
    const disc = b * b - 4 * a * c;
    return disc < 0 ? 0 : Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
  }

  /** Advance the needle dynamics. */
  step(dt: number, trueMph: number): void {
    const target = this.indicatedFor(trueMph);
    const tau = Math.max(1e-3, this.spec.tau);
    const alpha = 1 - Math.exp(-dt / tau);
    this.needle += (target - this.needle) * alpha;
    this.phase += dt * 7.3;
  }

  /** What the driver/navigator reads: lag + bounce + graduation. */
  reading(trueMph: number): number {
    const bounce = this.spec.bounce > 0 && trueMph > 2 ? this.spec.bounce * Math.sin(this.phase) * (0.6 + 0.4 * this.rnd.next()) : 0;
    const val = Math.max(0, this.needle + bounce);
    const q = this.spec.kind === 'timewise' ? 0.1 : 1;
    return Math.round(val / q) * q;
  }

  /** Un-quantized needle (for rendering a smooth needle). */
  needleValue(): number { return Math.max(0, this.needle); }

  /** New stage: tires/temperature drift for the mechanical unit (+-1%). */
  newStage(): void {
    if (this.spec.kind === 'mechanical') this.spec.gain *= clamp(1 + this.rnd.gauss(0, 0.005), 0.99, 1.01);
  }

  setFactor(k: number): void {
    if (this.spec.kind !== 'timewise') throw new Error('Only a Timewise speedometer has a settable factor');
    this.userFactor = clamp(k, 0.8, 1.25);
  }
}
