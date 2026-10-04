/**
 * PREREAD-001: the hand marks a navigator writes on the book, drawn onto one rendered row (the cockpit's book and the printable page share this):
 * "P23.5" beside the struck printed pause, a circled loss under the OUT speed, the speed carried in an empty Column C box, the quick-row note and the time-of-day, checkpoint and TRAIN notes in Column D.
 */
import { formatInterval } from '../../core/griid.js';
import type { Mark } from '../viewmodels/annotations.js';
import { esc } from './griid.js';

export interface RowMarkContext {
  /** The row's printed pause in seconds (the struck "0m15s" is found by its text). */
  pause?: number;
  /** The row heads a page after the first (its carried speed is written at the page top, not in Column C). */
  pageTop: boolean;
  /** The row is the last of its page (its quick note is written at the page bottom, not in Column D). */
  lastOnPage: boolean;
}

export function placeRowMarks(row: HTMLElement, marks: Mark[], ctx: RowMarkContext): void {
  const gc = row.querySelector('.gc') as HTMLElement | null; const dCell = row.querySelector('.gd') as HTMLElement | null;
  for (const m of marks) {
    const hand = (cls: string, text: string, star = false): string => `<span class="hand ${cls}" data-mark="${m.kind}">${esc(text)}${star ? ' <b class="star">★</b>' : ''}</span>`;
    if (m.kind === 'pause' && gc) { const t = [...gc.querySelectorAll('.cl.time')].find(x => ctx.pause !== undefined && x.textContent === formatInterval(ctx.pause)); if (t) { t.classList.add('struck'); t.innerHTML = `<span class="struck-text">${esc(t.textContent ?? '')}</span> ${hand('pnote', m.text)}`; } }
    else if (m.kind === 'loss' && gc) { const sp = [...gc.querySelectorAll('.cl.speed')]; const last = sp[sp.length - 1]; const html = `<div>${hand('circled', m.text)}</div>`; if (last) last.insertAdjacentHTML('afterend', html); else gc.insertAdjacentHTML('beforeend', html); }
    else if (m.kind === 'carry' && !ctx.pageTop && gc) gc.insertAdjacentHTML('beforeend', `<div>${hand('big', m.text)}</div>`);   // an empty Column C box
    else if (m.kind === 'quick' && !ctx.lastOnPage && dCell) dCell.insertAdjacentHTML('beforeend', `<div>${hand('quick-note', m.text)}</div>`);
    else if ((m.kind === 'tod' || m.kind === 'cp' || m.kind === 'train') && dCell) dCell.insertAdjacentHTML('beforeend', `<div>${hand('dnote', m.text, m.star)}</div>`);
  }
}
