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
  /**
   * INST-001: the loose minute hand. Within `slop` seconds either side of the minute change the hand sits between two minute marks and the
   * minute cannot be read off it; the stopwatch in TOD mode reads the unambiguous time (INST-002).
   */
  minuteAmbiguous: boolean;
  /** The minute the hand shows (0..59), or null when it is ambiguous at aids rung <= 1 (no resolved minute). */
  minuteResolved: number | null;
}

/** What the engine reports in observe().clock (INST-001): angles and the flag; all optional so an older engine still renders. */
export interface EngineClock { hourAngle?: number; minuteAngle?: number; secondAngle?: number; minuteAmbiguous?: boolean; minute?: number | null; hour?: number; second?: number }
export interface ClockOptions { /** aids rung 0..3 (the minute is resolved at rung >= 2) */ rung?: number; /** rules.clockMinuteSlop, seconds either side of the minute change */ slop?: number; /** observe().clock */ engine?: EngineClock | null }
export const DEFAULT_MINUTE_SLOP = 5;
/** True within `slop` seconds either side of the minute change. */
export function minuteAmbiguousAt(tod: number, slop = DEFAULT_MINUTE_SLOP): boolean {
  const sec = ((tod % 60) + 60) % 60;
  return sec >= 60 - slop || sec <= slop;
}

export function clockViewModel(tod: number, bezel = 0, opts: ClockOptions = {}): ClockVm {
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
  const eng = opts.engine ?? null;
  const rung = opts.rung ?? 0;
  const slop = Number.isFinite(opts.slop) ? opts.slop! : DEFAULT_MINUTE_SLOP;
  // the engine's flag wins when it reports one; otherwise the same rule is applied here
  const flagged = eng && typeof eng.minuteAmbiguous === 'boolean' ? eng.minuteAmbiguous : minuteAmbiguousAt(t, slop);
  const minuteAmbiguous = rung <= 1 ? flagged : false;
  const trueMinute = Math.floor(t / 60) % 60;
  // ambiguous: draw the hand half way between the two candidate minute marks (between numerals), never on a mark
  const boundary = sec <= slop ? trueMinute : (trueMinute + 1) % 60;   // the minute change the hand sits at
  const between = r3((((boundary - 0.5) % 60 + 60) % 60) * 6);
  const engineMinuteDeg = eng && typeof eng.minuteAngle === 'number' && Number.isFinite(eng.minuteAngle) ? r3(eng.minuteAngle) : null;
  const drawnMinuteDeg = minuteAmbiguous ? between : (engineMinuteDeg ?? minuteDeg);
  const engineMinute = eng && eng.minute !== undefined ? eng.minute : undefined;
  const minuteResolved = minuteAmbiguous ? null : (typeof engineMinute === 'number' ? engineMinute : trueMinute);
  return { hourDeg, minuteDeg: drawnMinuteDeg, secondDeg, bezel: b, bezelDeg, bezelRemaining, minuteAmbiguous, minuteResolved };
}
function r3(x: number): number { return Math.round(x * 1000) / 1000; }
