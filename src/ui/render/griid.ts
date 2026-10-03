/** HTML for one GRIID book row (UI-029): number | A CAMEO | B icons | C stacked lines in a monospace box | D sentence or remark. Pure strings, no DOM. */
import type { BookRow } from '../viewmodels/book.js';
import { griidIcon, odometerHtml } from './griid-icons.js';

export function esc(s: unknown): string { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch)); }

export interface CameoParts {
  /** The CAMEO svg markup (cameoSvg). */
  svg: string;
  /** Sign text box drawn beside the diagram. */
  sign?: { text: string; side: 'L' | 'R'; shape: string } | null;
  /** Landmark caption under the diagram. */
  landmark?: string | null;
}

/** Column A: the CAMEO with the sign boxes on the side of the road they stand on and the landmark name. */
export function columnAHtml(a: CameoParts): string {
  const sign = a.sign ? `<span class="sign-box side-${a.sign.side} shape-${esc(a.sign.shape)}" title="sign on the ${a.sign.side === 'L' ? 'left' : 'right'}">${esc(a.sign.text)}</span>` : '';
  const lm = a.landmark ? `<span class="landmark">${esc(a.landmark)}</span>` : '';
  return `<span class="cameo-svg">${a.svg}</span>${sign}${lm}`;
}

/** Column B: pictograms, with the 4-digit odometer box beside a transit's hourglass. */
export function columnBHtml(r: Pick<BookRow, 'b' | 'odometer'>): string {
  // the odometer box sits under the first of tire / speedometer / hourglass on the line (HB App. D: tire "0090", speedometer "0240", hourglass "0045")
  const host = r.odometer ? r.b.find(s => s === 'warmup' || s === 'calibration' || s === 'transit-begin') : undefined;
  return r.b.map(sym => `<span class="bsym">${griidIcon(sym)}${sym === host && r.odometer ? odometerHtml(r.odometer) : ''}</span>`).join('');
}

const lineClass = (l: string): string => /^\(.*\)$/.test(l) ? 'approx' : /^[A-Z]{3,4} \d{1,2}:\d\d:\d\d$/.test(l) ? 'tod' : /MPH$/.test(l) ? 'speed' : /^\* /.test(l) ? 'ast' : 'time';

/** Column C: the stacked lines in a monospace box; calibration boxes are drawn as a bordered box; the asterisk is set apart. */
export function columnCHtml(r: Pick<BookRow, 'c' | 'cBox'>): string {
  const out: string[] = [];
  r.c.forEach((l, i) => {
    const inBox = !!r.cBox && i >= r.cBox[0] && i <= r.cBox[1];
    const html = l.startsWith('* ') ? `<div class="cl ast"><b class="asterisk">*</b> ${esc(l.slice(2))}</div>` : `<div class="cl ${lineClass(l)}">${esc(l)}</div>`;
    if (inBox && r.cBox && i === r.cBox[0]) out.push('<div class="cbox" title="calibration box: interval over cumulative">');
    out.push(html);
    if (inBox && r.cBox && i === r.cBox[1]) out.push('</div>');
  });
  return out.join('');
}

export function columnDHtml(r: Pick<BookRow, 'd'>): string { return r.d ? esc(r.d) : ''; }

/** The five cells of a row as HTML strings. */
export function griidCells(r: BookRow, a: CameoParts): { n: string; a: string; b: string; c: string; d: string } {
  return { n: esc(r.printed), a: columnAHtml(a), b: columnBHtml(r), c: columnCHtml(r), d: columnDHtml(r) };
}

/** A whole row (used by the printable view; the cockpit builds the same cells inside its own row element). */
export function griidRowHtml(r: BookRow, a: CameoParts, extraClass = ''): string {
  const c = griidCells(r, a);
  return `<div class="grow ${extraClass}${r.omitted ? ' omitted' : ''}" data-n="${r.n}">`
    + `<div class="gn">${c.n}</div><div class="ga">${c.a}</div><div class="gb">${c.b}</div><div class="gc">${c.c}</div><div class="gd">${c.d}${r.omitted ? ' <em>(omitted)</em>' : ''}</div></div>`;
}
