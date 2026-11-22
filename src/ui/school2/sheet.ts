/**
 * SCH-006 / SCH-002: a reference chip opens a bottom sheet with the excerpt text, its citation and, for a video whose URL is known,
 * "Open video at mm:ss". The sheet is an overlay: nothing from the reference is pasted into the page.
 */
import { el } from '../state.js';
import { excerptFor, mmss, secondsOfKey, videoLink, excerptKeys, type Ref } from './sources.js';
import { VIDEOS } from '../../../content/videos.js';

export function refChip(ref: Ref): HTMLElement {
  const b = el('button', { class: 's2-chip', type: 'button', 'data-ref': ref.key, 'data-ref-type': ref.type }, ref.label);
  b.onclick = () => openSheet(ref);
  return b;
}

export function closeSheet(): void { document.getElementById('s2-sheet')?.remove(); }

export function openSheet(ref: Ref, fallback?: { title: string; text: string; citation: string }): HTMLElement {
  closeSheet();
  const ex = excerptFor(ref.key) ?? (fallback ? { ...fallback } : null);
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

// ---------------------------------------------------------------- PT-16 B10: a verdict's source as chips
/** The video a source names ("2026 Training Session", "Rally School Part 2", "Time Delay Form" ...). */
const VIDEO_HINTS: [RegExp, string][] = [[/2026/, '2026'], [/2024/, '2024'], [/Part 1|Classen/i, 'classen1'], [/Part 2|Croker/i, 'croker2'], [/Clock/i, 'clock'], [/Starting|Start video/i, 'start'], [/Delay/i, 'delay'], [/Making Up/i, 'makeup'], [/Reading/i, 'reading']];
/** The excerpt keys a rule source names, in order, deduped: HB pages and appendices, REG rules (trimmed to the rule the excerpts hold),
 *  video stamps (the nearest excerpt of that video within 90 s). Unresolved parts are dropped. */
export function sourceKeys(source: string): string[] {
  const keys = excerptKeys(); const out: string[] = [];
  const add = (k: string | null): void => { if (k && !out.includes(k)) out.push(k); };
  for (const seg of source.split(';')) {
    for (const m of seg.matchAll(/HB (?:App(?:endix|\.)? ([A-F])|((?:p\.\d+(?:-\d+)?(?:,\s*)?)+))/g)) {
      if (m[1]) add(keys.includes(`hb:app${m[1]}`) ? `hb:app${m[1]}` : null);
      else for (const pm of m[2]!.matchAll(/p\.(\d+)/g)) add(keys.includes(`hb:p${pm[1]}`) ? `hb:p${pm[1]}` : null);
    }
    for (const m of seg.matchAll(/REG ((?:[IVX]+\.[A-Z](?:\.[\w()]+)*)(?:,\s*[IVX]+\.[A-Z](?:\.[\w()]+)*)*)/g)) {
      for (const r of m[1]!.split(/,\s*/)) { const parts = r.split('.'); let hit: string | null = null; for (let n = parts.length; n >= 2 && !hit; n--) { const k = `reg:${parts.slice(0, n).join('.')}`; if (keys.includes(k)) hit = k; } add(hit); }
    }
  }
  let video: string | null = null;
  for (const seg of source.split(';')) {
    const hint = VIDEO_HINTS.find(([re]) => re.test(seg)); if (hint) video = hint[1];
    for (const m of seg.matchAll(/\[(\d+):(\d\d)\]/g)) {
      if (!video) continue; const sec = Number(m[1]) * 60 + Number(m[2]);
      const near = keys.filter(k => k.startsWith(`video:${video}:`)).map(k => ({ k, d: Math.abs((secondsOfKey(k) ?? 1e9) - sec) })).filter(x => x.d <= 90).sort((a, b) => a.d - b.d)[0];
      add(near?.k ?? null);
    }
  }
  return out;
}
const labelOf = (key: string): string => {
  if (key.startsWith('hb:app')) return `HB App. ${key.slice(6)}`;
  if (key.startsWith('hb:p')) return `HB p.${key.slice(4)}`;
  if (key.startsWith('reg:')) return `REG ${key.slice(4)}`;
  const [, vk, mm, ss] = key.split(':'); return `Video ${VIDEOS.find(v => v.key === vk)?.short ?? vk} ${mm}:${ss}`;
};
/** At most two chips for a verdict's source; with nothing resolvable, one "Source" chip opening the plain citation. */
export function sourceChips(source: string | undefined, _kind?: string): HTMLElement[] {
  void _kind;
  if (!source) return [];
  const keys = sourceKeys(source).slice(0, 2);
  if (keys.length) return keys.map(k => refChip({ type: k.split(':')[0] as Ref['type'], key: k, label: labelOf(k) }));
  const plain = source.replace(/\s*\((?:video[^)]*|simulator convention)\)/g, '').trim();
  const b = el('button', { class: 's2-chip', type: 'button', 'data-ref': 'source' }, 'Source');
  b.onclick = () => openSheet({ type: 'hb', key: 'source', label: 'Source' }, { title: 'Where this rule comes from', text: plain, citation: /simulator convention/.test(source) ? 'Part of it is this simulator\'s convention.' : plain });
  return [b];
}

/** PT-16: the time-zone label on a card's watch ("CDT") explained in one tap. */
export const ZONE_NAMES: Record<string, string> = { CDT: 'Central Daylight Time', CST: 'Central Standard Time', MDT: 'Mountain Daylight Time', MST: 'Mountain Standard Time', PDT: 'Pacific Daylight Time', EDT: 'Eastern Daylight Time' };
export function zoneChip(zone: string): HTMLElement | null {
  const name = ZONE_NAMES[zone]; if (!name) return null;
  const b = el('button', { class: 's2-chip s2-zone', type: 'button', 'data-testid': 'zone-chip' }, `${zone}?`);
  b.onclick = () => openSheet({ type: 'hb', key: `zone:${zone}`, label: zone }, { title: `${zone}: ${name}`, text: `${zone} is ${name}. The book prints every time of day in the local time zone of the day's route, so the watch shows it the same way.`, citation: 'Time zones on the route' });
  return b;
}
