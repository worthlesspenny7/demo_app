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
 * start/restart "CDT 8:55:00" over "30 MPH" (the book draws the zone label bold over a digital wristwatch with the time inside, then the speed or interval; a restart may
 * carry a timed chain after it); transit "20m00s" (take exactly, or an official plain interval) or "(0m30s)" (advisory; the countdown rows read "(10m00s)", "(8m00s)",
 * "(3m00s)", "(0m30s)"); calibration box "5m32.0s" over "7m21.3s" (interval at the left, cumulative at the right); the calibration start as the real race sheet prints it,
 * speed first: "50 MPH" / "29m00s" / "* 0m00.0s" (the box with its dot and "0m00.0s"); promoted stop "(45m00s)".
 */
export function columnCLines(ins: Partial<Instruction> | null | undefined, timeZone = 'CDT'): string[] {
  if (!ins) return [];
  const out: string[] = [];
  const mph = (v: number): string => `${v} MPH`;
  const calBox = ins.section === 'calibration' && !ins.calibrationStart && ins.perfectInterval !== undefined && ins.perfectCumulative !== undefined;
  if (ins.restartTime !== undefined) out.push(`${timeZone} ${formatClockFace(ins.baseTime ?? ins.restartTime)}`);
  const transitLines: string[] = [];
  if (ins.calibrationStart && typeof ins.speed === 'number') out.push(mph(ins.speed));   // 2014 race sheet (reading 00:34, row 6): "50 MPH" then "29m00s" then the box
  if (ins.transit) {
    if (!ins.transit.end) transitLines.push(ins.transit.exact || ins.transit.plain ? formatInterval(ins.transit.seconds) : `(${formatInterval(ins.transit.seconds)})`);
    else if (!ins.transit.exact && ins.transit.seconds > 0 && ins.restartTime === undefined) transitLines.push(`(${formatInterval(ins.transit.seconds)})`);
  }
  if (!calBox) out.push(...transitLines); // the calibration box comes before a transit that begins on the same line (Example Rally #10)
  if (ins.promotedStop) out.push(`(${formatInterval(ins.promotedStop.leaveBeforeEndSeconds)})`);
  if (ins.transitGuide !== undefined && ins.transitGuide > 0) out.push(`(${formatInterval(ins.transitGuide)})`);   // time left to the end of the transit (HB #11)
  if (ins.transitCountdown !== undefined && ins.transitCountdown > 0) out.push(`(${formatInterval(ins.transitCountdown)})`);   // the countdown rows of a long transit (11a): (10m00s), (8m00s), (3m00s)
  const hasPause = typeof ins.pause === 'number' && ins.pause > 0;
  if (hasPause) { out.push(mph(0), formatInterval(ins.pause!)); }
  if (ins.timed && Number.isFinite(ins.timed.holdSpeed)) {
    if (ins.timed.delayed) out.push(formatInterval(ins.timed.seconds), mph(ins.timed.thenSpeed));
    else out.push(mph(ins.timed.holdSpeed), formatInterval(ins.timed.seconds), mph(ins.timed.thenSpeed));
  } else if (typeof ins.speed === 'number' && !ins.calibrationStart) out.push(mph(ins.speed));
  if (ins.calibrationStart) out.push('* 0m00.0s');
  else if (calBox) out.push(formatInterval(ins.perfectInterval!, true), formatInterval(ins.perfectCumulative!, true), ...transitLines);
  return out;
}

/** Rows per printed page: real sheets carry 6-9 (HB App. D: 6-7 in the Example, 7-9 in the 2014 Trophy Run); the book, the cockpit page breaks and D15's page tops use 7, the printable view also offers 8. */
export const ROWS_PER_PAGE = 7;

/**
 * Symbol ids for Column B (GRIID-003). The two watch faces are not here: they belong in Column C (HB p.27, Example #17); the Time Allowance row has NO Column B symbol
 * (it is one rounded yellow box across A-D, 11a section 3).
 */
export type ColumnBSymbol =
  | 'warmup' | 'calibration' | 'transit-begin' | 'transit-end' | 'freezone-begin' | 'freezone-end'
  | 'pit' | 'meal' | 'refuel' | 'rest' | 'finish';
/** Pictograms drawn in Column C beside the times (GRIID-003): the watch face of a time-of-day restart and the crossed-out watch that ends the timed portion. */
export type ColumnCIcon = 'restart' | 'end-timed';

export function columnCIcons(ins: Partial<Instruction> | null | undefined): ColumnCIcon[] {
  if (!ins) return [];
  const out: ColumnCIcon[] = [];
  if (ins.restartTime !== undefined) out.push('restart');
  if (ins.endTimed) out.push('end-timed');
  return out;
}

export function columnBSymbols(ins: Partial<Instruction> | null | undefined): ColumnBSymbol[] {
  if (!ins) return [];
  const out: ColumnBSymbol[] = [];
  if ((ins.section === 'warmup' || ins.section === 'start') && ins.transit && !ins.transit.end) out.push('warmup');
  if (ins.calibrationStart) out.push('calibration');
  if (ins.promotedStop) out.push(ins.promotedStop.kind);
  // the tire and the speedometer stand for the transit they begin (11a: row 1 shows the tire with its odometer box, no hourglass)
  if (ins.transit && (ins.transit.end || !out.some(x => x === 'warmup' || x === 'calibration'))) out.push(ins.transit.end ? 'transit-end' : 'transit-begin');
  if (ins.freeZone) out.push(ins.freeZone === 'begin' ? 'freezone-begin' : 'freezone-end');
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

/**
 * Column D (GRIID-009): real sheets print NO sentence ("comes quick", "look sharp", "$1.50"); 'race' prints the remark only. 'example' (the written sentence plus the remark)
 * is a training aid shown only at aids rung 3.
 */
export function columnD(ins: Partial<Instruction> | null | undefined, style: Scenario['bookStyle'] = 'race'): string {
  if (!ins) return '';
  const remark = ins.remark ?? ins.hint ?? '';
  if (ins.infoBox !== undefined && style === 'race') return remark;
  return style === 'race' ? remark : [ins.text ?? '', remark].filter(Boolean).join(' ');
}

/** The book style at an aids rung: sentences in Column D only as a training aid at rung 3 (GRIID-009); real sheets have none. */
export function bookStyleForRung(rung: number): Scenario['bookStyle'] { return rung >= 3 ? 'example' : 'race'; }

/** The label printed above the meal symbol: "no-host" for an unhosted meal (11a section 3: the word in bold above the crossed knife and fork), else null. */
export function columnBLabel(ins: Partial<Instruction> | null | undefined): string | null {
  return ins?.promotedStop?.kind === 'meal' && ins.promotedStop.noHost ? 'no-host' : null;
}
