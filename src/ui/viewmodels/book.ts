/**
 * GRIID book rows (UI-005, UI-029): five columns - number | A CAMEO | B icons | C stacked lines | D sentence or remark.
 * Column B/C/D content comes from the core GRIID helpers (src/core/griid.ts); this module adds row state for the cockpit emphasis
 * (UI-009: previous / current / next / far) and page breaks for the printable view (6 rows per page, "Page n of m").
 */
import type { Instruction, Scenario, Node } from '../../core/course.js';
import { ROWS_PER_PAGE, columnCLines, columnBSymbols, columnCIcons, odometerBox, columnD, formatInterval, type ColumnBSymbol, type ColumnCIcon } from '../../core/griid.js';

export type RowState = 'past' | 'prev' | 'current' | 'next' | 'far';
/** Rows per printed page of the book: 7 by default, 7-8 allowed in the printable view (real sheets carry 6-9). */
export { ROWS_PER_PAGE };
export const PAGE_ROW_CHOICES = [7, 8] as const;

export interface BookRow {
  n: number;
  /** The number as printed ("3a" for a lettered line, GRIID-005). */
  printed: string;
  nodeId: string;
  /** The written sentence (GRIID-004). Shown in Column D only in the 'example' style. */
  text: string;
  /** Column B: pictogram ids, and the odometer box digits for a transit begin ("0045"). */
  b: ColumnBSymbol[];
  odometer: string | null;
  /** Column C: one entry per stacked line ("0 MPH", "0m15s", "45 MPH"). */
  c: string[];
  /** Column C pictograms: the restart watch face and the crossed-out watch of "End timed portion" (HB p.27, Example #17). */
  cIcons: ColumnCIcon[];
  /** Column C text on one line, for aria labels and plain-text uses ("0 MPH / 0m15s / 45 MPH"). */
  colC: string;
  /** Index range [from, to] of the Column C lines drawn inside the calibration box (interval over cumulative), or null. */
  cBox: [number, number] | null;
  /** Calibration run start: the line carrying the asterisk ("* 0m00.0s"). */
  asterisk: boolean;
  /** Column D: the sentence plus remark (example style) or the remark alone (race style). */
  d: string;
  /** The Column D remark alone. */
  remark: string;
  isCurrent: boolean;
  state: RowState;
  /** Distance in lines from the current one (negative = behind). */
  offset: number;
  omitted: boolean;
  ta: boolean;
  turn?: Instruction['turn'];
  speed?: number;
  pause?: number;
  timed?: Instruction['timed'];
  perfectCumulative?: number;
  /** Compatibility aliases of d (the old name of the column). */
  colD: string;
}

export interface BookOptions { timeZone?: string; style?: Scenario['bookStyle'] }

export function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Column C on one line in the book's own notation: "0 MPH / 0m15s / 45 MPH", "30 MPH / 0m36s / 45 MPH", "CDT 8:55:00 / 30 MPH". */
export function columnC(ins: Partial<Instruction> | undefined | null, timeZone = 'CDT'): string {
  return columnCLines(ins, timeZone).join(' / ');
}

/** The lines of the calibration box (interval over cumulative), by index into the stacked lines. */
export function calibrationBoxRange(ins: Partial<Instruction> | undefined | null, lines: string[]): [number, number] | null {
  if (!ins || ins.section !== 'calibration' || ins.calibrationStart || ins.perfectInterval === undefined || ins.perfectCumulative === undefined) return null;
  const a = formatInterval(ins.perfectInterval, true), b = formatInterval(ins.perfectCumulative, true);
  for (let i = 0; i + 1 < lines.length; i++) if (lines[i] === a && lines[i + 1] === b) return [i, i + 1];
  return null;
}

/** One book row in the five-column form (no cockpit state). */
export function griidRow(ins: Instruction, opts: BookOptions = {}): Omit<BookRow, 'isCurrent' | 'state' | 'offset'> {
  const c = columnCLines(ins, opts.timeZone ?? 'CDT');
  const remark = ins.remark ?? ins.hint ?? '';
  const d = columnD(ins, opts.style ?? 'example');
  return {
    n: ins.n, printed: ins.printed ?? String(ins.n), nodeId: ins.nodeId ?? '', text: ins.text ?? '',
    b: columnBSymbols(ins), odometer: odometerBox(ins), c, cIcons: columnCIcons(ins), colC: c.join(' / '), cBox: calibrationBoxRange(ins, c), asterisk: !!ins.calibrationStart,
    d, colD: d, remark, omitted: !!ins.omitted, ta: !!ins.taPoint,
    turn: ins.turn, speed: ins.speed, pause: ins.pause, timed: ins.timed, perfectCumulative: ins.perfectCumulative,
  };
}

export function bookRows(book: Instruction[] | undefined | null, currentLine: number, opts: BookOptions = {}): BookRow[] {
  const b = Array.isArray(book) ? book : [];
  if (!b.length) return [];
  const cur = Math.min(b.length, Math.max(1, Math.round(Number.isFinite(currentLine) ? currentLine : 1)));
  return b.map((ins, i) => {
    const n = typeof ins.n === 'number' ? ins.n : i + 1;
    const offset = n - cur;
    const state: RowState = offset === 0 ? 'current' : offset === -1 ? 'prev' : offset < 0 ? 'past' : offset <= 2 ? 'next' : 'far';
    return { ...griidRow({ ...ins, n }, opts), isCurrent: offset === 0, state, offset };
  });
}

export interface BookPage { page: number; of: number; title: string; footer: string; rows: BookRow[] }

/** Page breaks every `perPage` rows: "Page n of m" with the stage title (UI-029). */
export function bookPages(book: Instruction[] | undefined | null, title: string, opts: BookOptions & { perPage?: number; currentLine?: number } = {}): BookPage[] {
  const rows = bookRows(book, opts.currentLine ?? 1, opts);
  const per = Math.max(1, Math.round(opts.perPage ?? ROWS_PER_PAGE));
  const of = Math.max(1, Math.ceil(rows.length / per));
  const pages: BookPage[] = [];
  for (let p = 0; p < of; p++) pages.push({ page: p + 1, of, title, footer: `Page ${p + 1} of ${of}`, rows: rows.slice(p * per, (p + 1) * per) });
  return pages;
}
/** Page number (1-based) a book line is printed on. */
export function pageOfLine(n: number, perPage = ROWS_PER_PAGE): number { return Math.floor((Math.max(1, n) - 1) / perPage) + 1; }

/** The sign box text drawn beside the CAMEO (Column A): the posted words of the sign at this node, with the side of the road. */
export function signBox(node: Node | undefined | null): { text: string; side: 'L' | 'R'; shape: string } | null {
  const s = node?.sign; if (!s || !s.text) return null;
  return { text: s.text, side: s.side, shape: s.shape };
}
/** A landmark label (courthouse, bridge, "water tower on L") drawn as a small caption under the CAMEO, or null. */
export function landmarkLabel(node: Node | undefined | null): string | null {
  return node && node.kind === 'landmark' && node.label ? node.label : null;
}
