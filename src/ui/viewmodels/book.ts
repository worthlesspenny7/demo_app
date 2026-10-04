/**
 * GRIID book rows (UI-005, UI-029, GRIID-014..016): a number gutter and columns A CAMEO | B icons | C stacked lines | D remarks, in the real page's proportions
 * (4 : 30 : 20 : 23.5 : 26.5). Column B/C/D content comes from the core GRIID helpers (src/core/griid.ts); this module adds row state for the cockpit emphasis
 * (UI-009: previous / current / next / far), the layout-driven page breaks (row heights from content, 5 to 10 rows a page) and the three-block page footer.
 */
import type { Instruction, Scenario, Node } from '../../core/course.js';
import { ROWS_PER_PAGE, columnCLines, columnBSymbols, columnCIcons, columnBLabel, odometerBox, columnD, formatInterval, type ColumnBSymbol, type ColumnCIcon } from '../../core/griid.js';
import { cameoOfNode, cameoHeightOfNode, landmarkCaption, CAMEO_W } from '../../core/cameo.js';

export type RowState = 'past' | 'prev' | 'current' | 'next' | 'far';
/** Rows per printed page of the book: 7 by default, 7-8 allowed in the printable view (real sheets carry 6-9). */
export { ROWS_PER_PAGE };
/** A fixed row count can still be chosen in the printable view; the default is the layout-driven page (GRIID-014). */
export const PAGE_ROW_CHOICES = [6, 7, 8] as const;
/** The least and most rows a layout-driven page carries (the real sheets show 5 to 10). */
export const MIN_ROWS_PER_PAGE = 5;
export const MAX_ROWS_PER_PAGE = 10;

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
  /** The bold word above the meal symbol ("no-host"), or null. */
  bLabel: string | null;
  /** Information Box row: the body text of the rounded box over Columns B and C, or null. */
  info: string | null;
  /** The restart watch: the zone label printed above it and the time of day inside it ("EDT", "12:00:00"), or null. */
  tod: { zone: string; time: string } | null;
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
  const d = columnD(ins, opts.style ?? 'race');
  const todm = ins.restartTime !== undefined ? /^([A-Z]{3,4}) (\d{1,2}:\d\d:\d\d)$/.exec(c[0] ?? '') : null;
  return {
    n: ins.n, printed: ins.printed ?? String(ins.n), nodeId: ins.nodeId ?? '', text: ins.text ?? '',
    b: columnBSymbols(ins), odometer: odometerBox(ins), bLabel: columnBLabel(ins), info: ins.infoBox ?? null, tod: todm ? { zone: todm[1]!, time: todm[2]! } : null, c, cIcons: columnCIcons(ins), colC: c.join(' / '), cBox: calibrationBoxRange(ins, c), asterisk: !!ins.calibrationStart,
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

/** The three-block page footer of the real sheets: "(c) year, Great Race" | "Hemmings Motor News Great Race" over "Page n of N" | stage over date. No page header. */
export interface PageFooter { left: string; center: [string, string]; right: [string, string] }
export interface BookPage { page: number; of: number; title: string; /** "Page n of m" (the centre block's second line) */ footer: string; foot: PageFooter; rows: BookRow[] }

/** The date as printed in the footer's third block: "Friday, June 20, 2014". */
export function sheetDate(d: Date): string { return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
export const SHEET_YEAR = 2026;
export function pageFooter(title: string, page: number, of: number, date: string = sheetDate(new Date())): PageFooter {
  return { left: `\u00a9 ${SHEET_YEAR}, Great Race`, center: ['Hemmings Motor News Great Race', `Page ${page} of ${of}`], right: [title, date] };
}

// ---------- layout-driven pages (GRIID-014): row heights come from content ----------

/**
 * Estimated height of one row in units of the table width (11a section 3): the minimum (one speed line, a small sign) is about 0.11, a 3-line Column C stack about 0.155,
 * a 6-line stack or a large CAMEO 0.19 to 0.27, the Information Box row about 0.25. The tallest column wins.
 */
export function estimateRowHeight(ins: Instruction, node: Node | null | undefined, style: Scenario['bookStyle'] = 'race', timeZone = 'CDT'): number {
  if (ins.taPoint) return 0.13;
  if (ins.infoBox !== undefined) return 0.26;
  const lines = columnCLines(ins, timeZone);
  const icons = columnCIcons(ins).length;
  const hasTod = ins.restartTime !== undefined;
  const cH = (lines.length - (hasTod ? 1 : 0)) * 0.031 + (hasTod ? 0.026 : 0) + icons * 0.075 + (ins.calibrationStart ? 0.04 : 0) + (lines.length ? 0.03 : 0);
  const aH = (node ? cameoHeightOfNode(node) : 58) / CAMEO_W * 0.30 + 0.012;   // Column A is 0.30 of the table width and the CAMEO fills it
  const syms = columnBSymbols(ins);
  const bH = syms.length ? syms.length * 0.07 + (odometerBox(ins) ? 0.035 : 0) + (columnBLabel(ins) ? 0.025 : 0) + 0.03 : 0;
  const text = columnD(ins, style);
  const dH = text ? Math.ceil(text.length / 17) * 0.027 + 0.03 : 0;
  return Math.min(0.27, Math.max(0.11, aH, bH, cH, dH));
}

const PAGE_BUDGET = 1.24;   // a letter page: about 9.3 in of table for a 7.5 in wide table
export interface BookLayout { /** page number (1-based) of each row, indexed by row index */ pageOfIndex: number[]; /** index of the first row of each page */ starts: number[]; pages: number; /** the estimated row heights */ heights: number[] }
const layoutCache = new WeakMap<Instruction[], Map<string, BookLayout>>();

/**
 * Break a book into pages by content (GRIID-014): rows are added while their estimated heights fit the page, never fewer than 5 nor more than 10 rows a page
 * (the last page may be short). `perPage` forces a fixed count (the hand-laid-out drill book, the printable view's 6 / 7 / 8 choice).
 */
export function bookLayout(sc: Pick<Scenario, 'book' | 'course' | 'bookStyle' | 'timeZone' | 'rowsPerPage'>, perPage?: number): BookLayout {
  const per = perPage ?? sc.rowsPerPage;
  const key = `${per ?? 'auto'}|${sc.bookStyle}|${sc.timeZone}`;
  let byKey = layoutCache.get(sc.book); if (!byKey) { byKey = new Map(); layoutCache.set(sc.book, byKey); }
  const hit = byKey.get(key); if (hit) return hit;
  const nodes = new Map(sc.course.nodes.map(n => [n.id, n] as const));
  const heights = sc.book.map(ins => per ? 1 : estimateRowHeight(ins, nodes.get(ins.nodeId), sc.bookStyle, sc.timeZone));
  const pageOfIndex: number[] = []; const starts: number[] = [];
  let used = 0, count = 0, page = 0;
  sc.book.forEach((_ins, i) => {
    const h = heights[i]!;
    const full = per ? count >= per : count >= MAX_ROWS_PER_PAGE || (count >= MIN_ROWS_PER_PAGE && used + h > PAGE_BUDGET);
    if (i === 0 || full) { page++; starts.push(i); used = 0; count = 0; }
    pageOfIndex.push(page); used += h; count++;
  });
  const out: BookLayout = { pageOfIndex, starts, pages: Math.max(1, page), heights };
  byKey.set(key, out);
  return out;
}

/** Page breaks: layout-driven by default, or every `perPage` rows when asked; each page carries the three-block footer (UI-029, GRIID-014). */
export function bookPages(book: Instruction[] | undefined | null, title: string, opts: BookOptions & { perPage?: number; currentLine?: number; scenario?: Pick<Scenario, 'book' | 'course' | 'bookStyle' | 'timeZone' | 'rowsPerPage'>; date?: string } = {}): BookPage[] {
  const rows = bookRows(book, opts.currentLine ?? 1, opts);
  let layout: BookLayout;
  if (opts.scenario) layout = bookLayout(opts.scenario, opts.perPage);
  else {
    const per = Math.max(1, Math.round(opts.perPage ?? ROWS_PER_PAGE));
    const pageOfIndex = rows.map((_r, i) => Math.floor(i / per) + 1); const starts = rows.map((_r, i) => i).filter(i => i % per === 0);
    layout = { pageOfIndex, starts, pages: Math.max(1, starts.length), heights: rows.map(() => 1) };
  }
  const of = layout.pages; const pages: BookPage[] = [];
  const date = opts.date ?? sheetDate(new Date());
  for (let p = 0; p < of; p++) {
    const from = layout.starts[p] ?? 0, to = layout.starts[p + 1] ?? rows.length;
    pages.push({ page: p + 1, of, title, footer: `Page ${p + 1} of ${of}`, foot: pageFooter(title, p + 1, of, date), rows: rows.slice(from, to) });
  }
  return pages;
}
/** Page number (1-based) a book line is printed on: layout-driven with a scenario, else every `perPage` rows. */
export function pageOfLine(n: number, perPage: number | Pick<Scenario, 'book' | 'course' | 'bookStyle' | 'timeZone' | 'rowsPerPage'> = ROWS_PER_PAGE): number {
  if (typeof perPage !== 'number') { const l = bookLayout(perPage); return l.pageOfIndex[Math.min(perPage.book.length, Math.max(1, n)) - 1] ?? 1; }
  return Math.floor((Math.max(1, n) - 1) / perPage) + 1;
}

/** The sign standing at this node (drawn INSIDE the CAMEO, left or right of the arrow or overhead, centred on it): its words, side, face and advisory plaque. */
export function signBox(node: Node | undefined | null): { text: string; side: 'L' | 'R' | 'O'; shape: string; plaque?: number } | null {
  const s = node?.sign; if (!s || !s.text) return null;
  return { text: s.text, side: s.side, shape: s.shape, ...(s.plaque !== undefined ? { plaque: s.plaque } : {}) };
}
/** A landmark label (courthouse, "Toll Booth", "Ogunquit Playhouse") drawn as a small picture with a bold caption inside the CAMEO, or null (structural row labels are not landmarks). */
export function landmarkLabel(node: Node | undefined | null): string | null {
  return node && node.kind === 'landmark' && node.label ? landmarkCaption(node.label) : null;
}
/** The CAMEO of a book row: the route, thin roads, names, control glyph, sign face and landmark, all in one SVG (GRIID-015). */
export function rowCameo(node: Node | undefined | null, ins: Pick<Instruction, 'turn'> | undefined | null, size = 64): string {
  return node ? cameoOfNode(node, ins?.turn ?? null, size) : '';
}
