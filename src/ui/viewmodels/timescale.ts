/** Adaptive time scale (UI-010). UI-only: the core has no notion of time scale. */
export interface ScaleInputs {
  /** Scale the player asked for (1, 2, 4, 8). */
  requested: number;
  paused: boolean;
  phase: 'preread' | 'running' | 'finished' | string;
  carStopped: boolean;
  waitingForGo: boolean;
  /** Distance to the nearest visible feature, or null when nothing is in sight. */
  nearestFeatureFt: number | null;
  hazardActive: boolean;
  /** Seconds to the next countdown / bezel target, null when none is armed. */
  countdownSeconds: number | null;
  bezelRemaining: number | null;
  /** Drills D01 / D03 lock the scale to 1x. */
  lockedTo1x?: boolean;
  maxScale?: number;
}

export const SCALE_STEPS = [1, 2, 4, 8];
export const NEAR_FEATURE_FT = 800;
export const NEAR_TARGET_S = 15;

/** 0 while paused; 1 when anything needs reaction time; otherwise the requested scale clamped to maxScale. */
export function effectiveScale(i: ScaleInputs): number {
  if (i.paused) return 0;
  const req = Number.isFinite(i.requested) && i.requested > 0 ? i.requested : 1;
  const max = Number.isFinite(i.maxScale) && (i.maxScale ?? 0) > 0 ? i.maxScale! : 8;
  if (i.lockedTo1x) return 1;
  if (i.phase === 'preread') return Math.min(req, max);          // nothing to react to before the start
  if (i.phase !== 'running') return 1;
  if (i.carStopped || i.waitingForGo) return 1;
  if (i.nearestFeatureFt !== null && i.nearestFeatureFt <= NEAR_FEATURE_FT) return 1;
  if (i.hazardActive) return 1;
  if (i.countdownSeconds !== null && i.countdownSeconds >= 0 && i.countdownSeconds <= NEAR_TARGET_S) return 1;
  if (i.bezelRemaining !== null && i.bezelRemaining > 0 && i.bezelRemaining <= NEAR_TARGET_S) return 1;
  return Math.min(req, max);
}

/** Sim seconds to advance this frame: wallDt * scale, capped so a stalled tab cannot fast-forward the run. */
export function simAdvance(wallDtSeconds: number, scale: number, capSeconds = 2): number {
  const dt = Number.isFinite(wallDtSeconds) && wallDtSeconds > 0 ? wallDtSeconds : 0;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 0;
  return Math.min(capSeconds, dt * s);
}

export function nextScale(current: number, delta: 1 | -1): number {
  const i = Math.max(0, SCALE_STEPS.indexOf(current));
  return SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, i + delta))]!;
}
