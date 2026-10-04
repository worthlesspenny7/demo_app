/**
 * HTML for one GRIID book row (UI-029, GRIID-015, GRIID-016): number gutter | A CAMEO | B pictograms | C bold centred lines | D remarks. Pure strings, no DOM.
 * The cells follow the real page (11a section 3): Column C is bold, centred and unboxed with generous leading; a calibration box is thin, with the interval at the left
 * over the cumulative at the right; the calibration start prints "50 MPH" / "29m00s" and then the empty box with its dot and "0m00.0s"; a restart is the bold zone label
 * over a digital wristwatch with the time inside; the TA row is one rounded black-outlined box over A to D on yellow; the Information Box is a rounded box over B and C.
 */
import type { BookRow, PageFooter } from '../viewmodels/book.js';
import { griidIcon, odometerHtml } from './griid-icons.js';

export function esc(s: unknown): string { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch)); }

export interface CameoParts {
  /** The CAMEO svg markup (cameoSvg): the route, roads, names, control glyph, sign face and landmark are all drawn inside it. */
  svg: string;
}

/** Column A: the CAMEO (sign boxes and landmark pictures live inside the drawing, left or right of the arrow or overhead). */
export function columnAHtml(a: CameoParts): string {
  return `<span class="cameo-svg">${a.svg}</span>`;
}

/** Column B: pictograms centred in the cell, the odometer box under a begin symbol, the "no-host" label above a meal. */
export function columnBHtml(r: Pick<BookRow, 'b' | 'odometer'> & Arrows & { bLabel?: string | null }): string {
  // the odometer box sits under the first of tire / speedometer / hourglass on the line (HB App. D: tire "0090", speedometer "0240", hourglass "0045"); never under an end symbol
  const host = r.odometer ? r.b.find(s => s === 'warmup' || s === 'calibration' || s === 'transit-begin') : undefined;
  return withArrows(r, r.b.map(sym => `<span class="bsym">${sym === 'meal' && r.bLabel ? `<b class="blabel">${esc(r.bLabel)}</b>` : ''}${griidIcon(sym)}${sym === host && r.odometer ? odometerHtml(r.odometer) : ''}</span>`).join(''));
}

/** The class list of a Column B or C cell: the section arrow (`vin` arrives from above, `vout` leaves downward; real sheets draw it down both columns for a transit or the calibration run). */
export function arrowClass(base: string, r: Pick<BookRow, 'vin' | 'vout' | 'vcont'>): string { return `${base}${r.vin ? ' vin' : ''}${r.vout ? ' vout' : ''}${r.vcont ? ' vcont' : ''}`; }
type Arrows = Partial<Pick<BookRow, 'vin' | 'vout' | 'vcont'>>;
/** The arrow segments wrapped around a column's content: arrival from the row above (head), departure to the row below (tail), or the line straight through (cont). */
function withArrows(a: Arrows, inner: string): string {
  if (a.vcont) return `<span class="vseg cont" aria-hidden="true"></span>${inner}`;
  return `${a.vin ? '<span class="vseg head" aria-hidden="true"></span>' : ''}${inner}${a.vout ? '<span class="vseg tail" aria-hidden="true"></span>' : ''}`;
}

const lineClass = (l: string): string => /^\(.*\)$/.test(l) ? 'approx' : /MPH$/.test(l) ? 'speed' : 'time';

/**
 * Column C: bold, centred, unboxed lines with about 1.8 line spacing. The watch pictograms sit in this column: a restart is the zone label (bold) over the digital wristwatch
 * with the time inside, then the speed or interval; the end of a timed portion is the same watch in a circle with a slash, the interval below. A calibration box is thin:
 * interval left over cumulative right. The calibration start prints the speed, the allowance, then the empty box with its dot and "0m00.0s".
 */
export function columnCHtml(r: Pick<BookRow, 'c' | 'cBox'> & Arrows & { cIcons?: BookRow['cIcons']; tod?: BookRow['tod'] }): string {
  const out: string[] = [];
  const icons = r.cIcons ?? [];
  let lines = r.c;
  if (icons.includes('restart')) {
    const tod = r.tod ?? null;
    if (tod) { out.push(`<div class="cicons"><b class="zone">${esc(tod.zone)}</b><span class="csym">${griidIcon('restart', 44, { time: tod.time })}</span></div>`); lines = lines.slice(1); }
    else out.push(`<div class="cicons"><span class="csym">${griidIcon('restart', 44)}</span></div>`);
  }
  if (icons.includes('end-timed')) out.push(`<div class="cicons"><span class="csym">${griidIcon('end-timed', 44)}</span></div>`);
  lines.forEach((l, i) => {
    const inBox = !!r.cBox && i >= r.cBox[0] && i <= r.cBox[1];
    if (l.startsWith('* ')) { out.push(`<div class="cbox cstart" title="the box the next interval is measured from"><i class="cdot asterisk" aria-label="start mark"></i><span class="cum">${esc(l.slice(2))}</span></div>`); return; }
    if (inBox && r.cBox) {
      if (i === r.cBox[0]) out.push(`<div class="cbox" title="calibration box: interval over cumulative"><span class="iv">${esc(l)}</span>`);
      else out.push(`<span class="cum">${esc(l)}</span>`);
      if (i === r.cBox[1]) out.push('</div>');
      return;
    }
    out.push(`<div class="cl ${lineClass(l)}">${esc(l)}</div>`);
  });
  return withArrows(r, out.join(''));
}

export function columnDHtml(r: Pick<BookRow, 'd'>): string { return r.d ? esc(r.d) : ''; }

/**
 * The Time Allowance row (REG Example #18): one rounded black-outlined box over Columns A to D on a yellow fill, with no Column B symbol. The sentence is always the written
 * one, whatever the book style; the method (web page, phone, or the Observation Checkpoint) is whatever the day's instructions print.
 */
export function taBannerHtml(r: Pick<BookRow, 'text'>): string {
  return `<div class="tabanner" role="note"><span class="tab-text">${esc(r.text)}</span></div>`;
}

/** The Information Box (11a, GRIID-016): a rounded rectangle over Columns B and C holding the body text; Column D keeps its own list beside it. */
export function infoBoxHtml(r: Pick<BookRow, 'info'>): string {
  return `<div class="infobox" role="note">${esc(r.info ?? '')}</div>`;
}

/** The cells of a row as HTML strings. */
export function griidCells(r: BookRow, a: CameoParts): { n: string; a: string; b: string; c: string; d: string } {
  return { n: esc(r.printed), a: columnAHtml(a), b: columnBHtml(r), c: columnCHtml(r), d: columnDHtml(r) };
}

/** A whole row (used by the printable view; the cockpit builds the same cells inside its own row element). */
export function griidRowHtml(r: BookRow, a: CameoParts, extraClass = ''): string {
  if (r.ta) return `<div class="grow ta-row ${extraClass}" data-n="${r.n}"><div class="gn">${esc(r.printed)}</div>${taBannerHtml(r)}</div>`;
  const c = griidCells(r, a);
  if (r.info !== null) return `<div class="grow info-row ${extraClass}" data-n="${r.n}"><div class="gn">${c.n}</div><div class="ga">${c.a}</div><div class="gbc">${infoBoxHtml(r)}</div><div class="gd">${c.d}</div></div>`;
  return `<div class="grow ${extraClass}${r.omitted ? ' omitted' : ''}" data-n="${r.n}"${r.pause ? ` data-pause="${r.pause}"` : ''}>`
    + `<div class="gn">${c.n}</div><div class="ga">${c.a}</div><div class="${arrowClass('gb', r)}">${c.b}</div><div class="${arrowClass('gc', r)}">${c.c}</div><div class="gd">${c.d}${r.omitted ? ' <em>(omitted)</em>' : ''}</div></div>`;
}

/** The page footer of the real sheets: three blocks, no rule, no page header ("(c) 2026, Great Race" | "Hemmings Motor News Great Race / Page n of N" | "stage / date"). */
export function sheetFootHtml(f: PageFooter): string {
  return `<div class="sheet-foot"><span class="sf-left">${esc(f.left)}</span><span class="sf-mid">${esc(f.center[0])}<br><span class="pageno">${esc(f.center[1])}</span></span><span class="sf-right">${esc(f.right[0])}<br>${esc(f.right[1])}</span></div>`;
}
