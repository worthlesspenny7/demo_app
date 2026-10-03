/** Unit conversions and formatting. Internal: feet, ft/s, seconds (TOD). */
export const FPS_PER_MPH = 1.4666666666666666; // 5280/3600
export const FT_PER_MILE = 5280;

export function mphToFps(mph: number): number { return mph * FPS_PER_MPH; }
export function fpsToMph(fps: number): number { return fps / FPS_PER_MPH; }
export function milesToFt(mi: number): number { return mi * FT_PER_MILE; }
export function ftToMiles(ft: number): number { return ft / FT_PER_MILE; }

/** Round-half-up to the nearest whole second ("to the nearest second"). */
export function roundToSecond(t: number): number { return Math.floor(t + 0.5); }

export function hms(h: number, m: number, s = 0): number { return h * 3600 + m * 60 + s; }

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

/** Time of day HH:MM:SS (wraps at 24 h). */
export function formatClock(tod: number): string {
  const t = ((Math.floor(tod) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Elapsed M:SS.d (one decimal). Negative values keep a leading minus. */
export function formatElapsed(sec: number, decimals = 1): string {
  const neg = sec < 0; const a = Math.abs(sec);
  const m = Math.floor(a / 60);
  const s = a - m * 60;
  const sStr = s.toFixed(decimals);
  const sPadded = s < 10 ? `0${sStr}` : sStr;
  return `${neg ? '-' : ''}${m}:${sPadded}`;
}

/** Signed seconds like "+3" / "-12" / "0". */
export function formatSigned(sec: number): string {
  const r = Math.round(sec);
  return r > 0 ? `+${r}` : `${r}`;
}

export function clamp(x: number, lo: number, hi: number): number { return x < lo ? lo : x > hi ? hi : x; }
