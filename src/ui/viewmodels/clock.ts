/** Analog time-of-day clock with a rotating bezel (UI-002). No numeric readout: REG II.H.1.d(1) forbids a digital readout on the clock (UI-033). */

export interface ClockVm {
  /** Hour hand: moves with whole minutes (12 h = 360 deg). */
  hourDeg: number;
  /** Minute hand: moves continuously with seconds (60 min = 360 deg). */
  minuteDeg: number;
  secondDeg: number;
  /** Bezel index (seconds-of-minute, 0..59) and its rotation. */
  bezel: number;
  bezelDeg: number;
  /** Seconds until the second hand reaches the bezel index. */
  bezelRemaining: number;
}

export function clockViewModel(tod: number, bezel = 0): ClockVm {
  const t = Number.isFinite(tod) ? ((tod % 86400) + 86400) % 86400 : 0;
  const b = Number.isFinite(bezel) ? ((Math.round(bezel) % 60) + 60) % 60 : 0;
  const sec = t % 60;
  const wholeMinutes = Math.floor(t / 60);
  const hourDeg = r3(((wholeMinutes % 720) / 720) * 360);
  const minuteDeg = r3(((t % 3600) / 3600) * 360);
  const secondDeg = r3((sec / 60) * 360);
  const bezelDeg = r3((b / 60) * 360);
  const bezelRaw = (((b - sec) % 60) + 60) % 60;
  const bezelRemaining = bezelRaw < 1e-6 || bezelRaw > 60 - 1e-3 ? 0 : r3(bezelRaw);
  return { hourDeg, minuteDeg, secondDeg, bezel: b, bezelDeg, bezelRemaining };
}
function r3(x: number): number { return Math.round(x * 1000) / 1000; }
