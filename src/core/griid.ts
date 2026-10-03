/** GRIID format helpers (REG VII.B.3.c, VII.F; HB Appendix D): Column B symbols, Column C stacked timing lines, Column D text. No UI imports. */
import type { Instruction, Scenario } from './course.js';

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Interval time: "0m36s", "26m00s", "3h25m00s" (VII.B.3.c(4)); `tenths` gives the calibration form "5m32.0s". */
export function formatInterval(totalSeconds: number, tenths = false): string {
  const t = Math.max(0, tenths ? Math.round(totalSeconds * 10) / 10 : Math.round(totalSeconds));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  const s = t - h * 3600 - m * 60;
  const sec = tenths ? (s < 10 ? `0${s.toFixed(1)}` : s.toFixed(1)) : pad2(Math.round(s));
  return h > 0 ? `${h}h${pad2(m)}m${sec}s` : `${m}m${sec}s`;
}

/** Time of day as printed on a clock face: "8:55:00", "2:55:00" (12-hour, no leading zero). */
export function formatClockFace(tod: number): string {
  const t = ((Math.floor(tod) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)}:${pad2(s)}`;
}

/**
 * GRIID-002: the stacked Column C lines of one instruction.
 * Speeds "40 MPH"; a pause "0 MPH" / "0m15s" / "45 MPH"; a timed change "30 MPH" / "0m36s" / "45 MPH"; a delayed change "1m12s" / "40 MPH";
 * start/restart "CDT 8:55:00" over "30 MPH"; transit "20m00s" (exact) or "(0m30s)" (advisory); calibration box "5m32.0s" over "7m21.3s",
 * the calibration start "26m00s" / "50 MPH" / "* 0m00.0s"; promoted stop "(45m00s)".
 */
export function columnCLines(ins: Partial<Instruction> | null | undefined, timeZone = 'CDT'): string[] {
  if (!ins) return [];
  const out: string[] = [];
  const mph = (v: number): string => `${v} MPH`;
  const calBox = ins.section === 'calibration' && !ins.calibrationStart && ins.perfectInterval !== undefined && ins.perfectCumulative !== undefined;
  if (ins.restartTime !== undefined) out.push(`${timeZone} ${formatClockFace(ins.baseTime ?? ins.restartTime)}`);
  const transitLines: string[] = [];
  if (ins.transit) {
    if (!ins.transit.end) transitLines.push(ins.transit.exact ? formatInterval(ins.transit.seconds) : `(${formatInterval(ins.transit.seconds)})`);
    else if (!ins.transit.exact && ins.transit.seconds > 0 && ins.restartTime === undefined) transitLines.push(`(${formatInterval(ins.transit.seconds)})`);
  }
  if (!calBox) out.push(...transitLines); // the calibration box comes before a transit that begins on the same line (Example Rally #10)
  if (ins.promotedStop) out.push(`(${formatInterval(ins.promotedStop.leaveBeforeEndSeconds)})`);
  const hasPause = typeof ins.pause === 'number' && ins.pause > 0;
  if (hasPause) { out.push(mph(0), formatInterval(ins.pause!)); }
  if (ins.timed && Number.isFinite(ins.timed.holdSpeed)) {
    if (ins.timed.delayed) out.push(formatInterval(ins.timed.seconds), mph(ins.timed.thenSpeed));
    else out.push(mph(ins.timed.holdSpeed), formatInterval(ins.timed.seconds), mph(ins.timed.thenSpeed));
  } else if (typeof ins.speed === 'number') out.push(mph(ins.speed));
  if (ins.calibrationStart) out.push('* 0m00.0s');
  else if (calBox) out.push(formatInterval(ins.perfectInterval!, true), formatInterval(ins.perfectCumulative!, true), ...transitLines);
  return out;
}

/** Symbol ids for Column B (GRIID-003). */
export type ColumnBSymbol =
  | 'warmup' | 'calibration' | 'transit-begin' | 'transit-end' | 'freezone-begin' | 'freezone-end'
  | 'end-timed' | 'pit' | 'meal' | 'refuel' | 'rest' | 'ta' | 'finish';

export function columnBSymbols(ins: Partial<Instruction> | null | undefined): ColumnBSymbol[] {
  if (!ins) return [];
  const out: ColumnBSymbol[] = [];
  if ((ins.section === 'warmup' || ins.section === 'start') && ins.transit && !ins.transit.end) out.push('warmup');
  if (ins.calibrationStart) out.push('calibration');
  if (ins.endTimed) out.push('end-timed');
  if (ins.promotedStop) out.push(ins.promotedStop.kind);
  if (ins.transit) out.push(ins.transit.end ? 'transit-end' : 'transit-begin');
  if (ins.freeZone) out.push(ins.freeZone === 'begin' ? 'freezone-begin' : 'freezone-end');
  if (ins.taPoint) out.push('ta');
  if (ins.section === 'finish') out.push('finish');
  return out;
}

/** Approximate length of the transit begun on this line, in miles (the odometer box of Column B), or null. */
export function transitMiles(ins: Partial<Instruction> | null | undefined): number | null {
  return ins?.transit && !ins.transit.end && ins.transit.miles !== undefined ? ins.transit.miles : null;
}
/** The 4-digit tenths-of-a-mile odometer box: 4.5 miles -> "0045", 21 miles -> "0210" (Example Rally Column B). */
export function odometerBox(ins: Partial<Instruction> | null | undefined): string | null {
  const mi = transitMiles(ins);
  return mi === null ? null : String(Math.min(9999, Math.round(mi * 10))).padStart(4, '0');
}

/** Column D (GRIID-009): 'example' prints the written sentence plus the remark; 'race' prints the remark only. */
export function columnD(ins: Partial<Instruction> | null | undefined, style: Scenario['bookStyle'] = 'example'): string {
  if (!ins) return '';
  const remark = ins.remark ?? ins.hint ?? '';
  return style === 'race' ? remark : [ins.text ?? '', remark].filter(Boolean).join(' ');
}
