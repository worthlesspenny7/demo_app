/**
 * SCH-006 / SCH-002: a reference chip opens a bottom sheet with the excerpt text, its citation and, for a video whose URL is known,
 * "Open video at mm:ss". The sheet is an overlay: nothing from the reference is pasted into the page.
 */
import { el } from '../state.js';
import { excerptFor, mmss, secondsOfKey, videoLink, type Ref } from './sources.js';

export function refChip(ref: Ref): HTMLElement {
  const b = el('button', { class: 's2-chip', type: 'button', 'data-ref': ref.key, 'data-ref-type': ref.type }, ref.label);
  b.onclick = () => openSheet(ref);
  return b;
}

export function closeSheet(): void { document.getElementById('s2-sheet')?.remove(); }

export function openSheet(ref: Ref): HTMLElement {
  closeSheet();
  const ex = excerptFor(ref.key);
  const url = videoLink(ref, ex);
  const secs = ex?.seconds ?? secondsOfKey(ref.key);
  const close = el('button', { class: 'mob-btn small s2-sheet-x', type: 'button', 'data-action': 'close-sheet', 'aria-label': 'Close' }, 'Close');
  const body = el('div', { class: 's2-sheet-body' },
    el('div', { class: 's2-sheet-head' }, el('b', {}, ex?.title ?? ref.label), close),
    el('p', { class: 's2-sheet-text', 'data-testid': 'sheet-text' }, ex?.text || 'The excerpt for this reference is not in the app yet.'),
    el('p', { class: 's2-sheet-cite', 'data-testid': 'sheet-cite' }, ex?.citation ?? ref.label));
  if (url) body.append(el('a', { class: 'mob-btn primary s2-video', href: url, target: '_blank', rel: 'noopener', 'data-testid': 'open-video' }, `Open video at ${mmss(secs ?? 0)}`));
  const sheet = el('div', { class: 's2-sheet', id: 's2-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': ref.label }, body);
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  close.onclick = () => closeSheet();
  window.addEventListener('hashchange', closeSheet, { once: true });
  document.body.append(sheet);
  return sheet;
}
