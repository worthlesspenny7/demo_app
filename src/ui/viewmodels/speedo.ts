/** Speedometer needle view-model (UI-003). Dial sweep is 240 degrees: -120 (0 mph) to +120 (max). */
export interface SpeedoVm {
  reading: number;
  maxMph: number;
  /** Needle angle in degrees from 12 o'clock, negative = left. */
  needleDeg: number;
  clamped: boolean;
  /** Major tick labels every 10 mph. */
  ticks: { mph: number; deg: number; major: boolean }[];
  text: string;
}

export const SPEEDO_SWEEP_DEG = 240;

export function speedoViewModel(reading: number, maxMph = 100): SpeedoVm {
  const max = Number.isFinite(maxMph) && maxMph > 0 ? maxMph : 100;
  const r = Number.isFinite(reading) ? reading : 0;
  const v = Math.min(max, Math.max(0, r));
  const clamped = v !== r;
  const toDeg = (mph: number): number => Math.round((-SPEEDO_SWEEP_DEG / 2 + (mph / max) * SPEEDO_SWEEP_DEG) * 1000) / 1000;
  const ticks: SpeedoVm['ticks'] = [];
  for (let m = 0; m <= max; m += 5) ticks.push({ mph: m, deg: toDeg(m), major: m % 10 === 0 });
  return { reading: r, maxMph: max, needleDeg: toDeg(v), clamped, ticks, text: v.toFixed(Number.isInteger(r) ? 0 : 1) };
}
