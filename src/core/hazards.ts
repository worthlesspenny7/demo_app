/** Hazard helpers. DESIGN §7/§13. */
import type { Hazard, SignalHazard, TrainHazard } from './course.js';

export function signalIsRed(h: SignalHazard, tod: number): boolean {
  const cycle = h.redSeconds + h.greenSeconds;
  const phase = (((tod - h.offset) % cycle) + cycle) % cycle;
  return phase < h.redSeconds;
}
export function signalRedRemaining(h: SignalHazard, tod: number): number {
  const cycle = h.redSeconds + h.greenSeconds;
  const phase = (((tod - h.offset) % cycle) + cycle) % cycle;
  return phase < h.redSeconds ? h.redSeconds - phase : 0;
}
export function trainActive(h: TrainHazard, tod: number): boolean { return tod >= h.startTod && tod < h.startTod + h.durationSeconds; }
export function trainRemaining(h: TrainHazard, tod: number): number { return trainActive(h, tod) ? h.startTod + h.durationSeconds - tod : 0; }

/** Hazards that justify a Time Allowance request (R1.8). */
export function qualifiesForTA(h: Hazard): boolean { return h.kind === 'train' || h.kind === 'signal'; }
