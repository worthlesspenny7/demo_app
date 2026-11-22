/**
 * SCH-006: the small inline SVG set for concept pages (no images, theme colours through currentColor and CSS variables):
 * the ghost car beside the real car, the five book columns, a stop sign with its chart cell, the dash clock face and the distance bar.
 * A page's `figure` names one of them, or a content/course.ts FIGURES id mapped onto one (FIGURE_ALIAS).
 */
import { STOP_EXAMPLE } from '../../../content/course.js';
import { videoByKey } from '../../../content/videos.js';
/** PT-16 B8: the stop figure quotes the same car and cell as Module 4's worked example (this app's car, not the handbook's Packard). */
const STOP_FIG = STOP_EXAMPLE[0]!;
export type FigureId = 'ghost' | 'columns' | 'stop' | 'clock' | 'distance';
export const FIGURE_IDS: FigureId[] = ['ghost', 'columns', 'stop', 'clock', 'distance'];

/** content/course.ts FIGURES ids drawn by this set (the others have no drawing yet and the page shows the words alone). */
export const FIGURE_ALIAS: Record<string, FigureId> = {
  'ghost-car': 'ghost', 'griid-row': 'columns', cameo: 'columns', 'column-c': 'columns', 'chart-cell': 'stop', 'magic-stop': 'stop',
  'minute-hand': 'clock', launch: 'clock', 'split-sign': 'distance', mark: 'distance',
};
export function figureId(name: string | undefined): FigureId | null {
  if (!name) return null;
  if ((FIGURE_IDS as string[]).includes(name)) return name as FigureId;
  return FIGURE_ALIAS[name] ?? null;
}

const car = (x: number, y: number, fill: string, dash = ''): string =>
  `<g transform="translate(${x} ${y})"${dash ? ` stroke-dasharray="${dash}"` : ''}><path d="M0 18 L6 8 Q8 4 14 4 L34 4 Q40 4 44 10 L52 12 Q58 13 58 18 L58 22 L0 22 Z" fill="${fill}" stroke="currentColor" stroke-width="1.6"/>`
  + `<circle cx="13" cy="23" r="5" fill="var(--bg)" stroke="currentColor" stroke-width="1.6"/><circle cx="45" cy="23" r="5" fill="var(--bg)" stroke="currentColor" stroke-width="1.6"/></g>`;

const SVG: Record<FigureId, () => string> = {
  ghost: () => `<svg viewBox="0 0 300 120" role="img" aria-label="the ghost car beside your car">`
    + `<line x1="10" y1="48" x2="290" y2="48" stroke="var(--line)" stroke-width="2"/><line x1="10" y1="104" x2="290" y2="104" stroke="var(--line)" stroke-width="2"/>`
    + `<g opacity="0.55">${car(170, 18, 'none', '4 3')}</g><text x="200" y="14" font-size="13" text-anchor="middle" fill="var(--muted)">ghost (perfect)</text>`
    + `${car(120, 74, 'var(--accent)')}<text x="150" y="70" font-size="13" text-anchor="middle" fill="currentColor">your car</text>`
    + `<path d="M182 92 L204 92" stroke="var(--danger)" stroke-width="2" marker-end="url(#fg-arr)"/><text x="210" y="96" font-size="13" fill="var(--danger)">2 s behind</text>`
    + `<defs><marker id="fg-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="var(--danger)"/></marker></defs></svg>`,
  columns: () => {
    const cols: [string, string, number][] = [['#', 'line', 30], ['A', 'map', 80], ['B', 'symbols', 56], ['C', 'speed', 64], ['D', 'words', 66]];
    let x = 4; let s = `<svg viewBox="0 0 300 120" role="img" aria-label="one book line: the line number, then columns A to D">`;
    for (const [k, label, w] of cols) {
      s += `<rect x="${x}" y="30" width="${w - 4}" height="60" rx="4" fill="var(--panel-2)" stroke="currentColor" stroke-width="1.2"/><text x="${x + (w - 4) / 2}" y="22" font-size="14" font-weight="700" text-anchor="middle" fill="var(--accent)">${k}</text><text x="${x + (w - 4) / 2}" y="106" font-size="11" text-anchor="middle" fill="var(--muted)">${label}</text>`;
      x += w;
    }
    // line 12; a CAMEO dot-and-arrow in A; 40 MPH bold in C
    s += `<text x="17" y="66" font-size="15" font-weight="700" text-anchor="middle" fill="currentColor">12</text>`;
    s += `<line x1="72" y1="34" x2="72" y2="86" stroke="currentColor" stroke-width="0.8"/><circle cx="72" cy="80" r="4" fill="currentColor"/><path d="M72 80 L72 56 L50 56" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M52 51 L44 56 L52 61 Z" fill="currentColor"/>`;
    s += `<text x="194" y="58" font-size="16" font-weight="800" text-anchor="middle" fill="currentColor">40</text><text x="194" y="76" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">MPH</text>`;
    s += `<text x="261" y="64" font-size="11" text-anchor="middle" fill="currentColor">Comes</text><text x="261" y="77" font-size="11" text-anchor="middle" fill="currentColor">quick</text></svg>`;
    return s;
  },
  stop: () => {
    const pts = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 8) + i * Math.PI / 4; return `${(70 + Math.cos(a) * 46).toFixed(1)},${(60 + Math.sin(a) * 46).toFixed(1)}`; }).join(' ');
    return `<svg viewBox="0 0 300 120" role="img" aria-label="a stop sign and its chart cell"><polygon points="${pts}" fill="#c0392b" stroke="#fff" stroke-width="3"/><text x="70" y="67" font-size="22" font-weight="800" text-anchor="middle" fill="#fff">STOP</text>`
      + `<rect x="150" y="26" width="140" height="68" rx="8" fill="var(--panel-2)" stroke="var(--accent)" stroke-width="2"/><text x="220" y="48" font-size="13" text-anchor="middle" fill="var(--muted)">This app's car: ${STOP_FIG.vIn} → ${STOP_FIG.vOut}</text><text x="220" y="80" font-size="24" font-weight="800" text-anchor="middle" fill="var(--accent)">sit ${STOP_FIG.sit.toFixed(1)} s</text></svg>`;
  },
  clock: () => {
    let t = ''; for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; const r0 = i % 5 ? 44 : 39; t += `<line x1="${(150 + Math.sin(a) * r0).toFixed(1)}" y1="${(60 - Math.cos(a) * r0).toFixed(1)}" x2="${(150 + Math.sin(a) * 48).toFixed(1)}" y2="${(60 - Math.cos(a) * 48).toFixed(1)}" stroke="#111" stroke-width="${i % 5 ? 0.7 : 1.8}"/>`; }
    const hand = (deg: number, len: number, w: number, col: string): string => { const a = (deg - 90) * Math.PI / 180; return `<line x1="150" y1="60" x2="${(150 + Math.cos(a) * len).toFixed(1)}" y2="${(60 + Math.sin(a) * len).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
    return `<svg viewBox="0 0 300 120" role="img" aria-label="the dash clock: hands only, no digits"><circle cx="150" cy="60" r="52" fill="#f7f5ee" stroke="#333" stroke-width="2"/>${t}${hand(285, 26, 4, '#111')}${hand(186, 40, 3, '#111')}${hand(90, 46, 1.2, '#c0392b')}<circle cx="150" cy="60" r="3" fill="#111"/></svg>`;
  },
  distance: () => `<svg viewBox="0 0 300 120" role="img" aria-label="the distance bar shrinks to the sign">`
    + `<rect x="14" y="48" width="240" height="20" rx="10" fill="var(--panel-2)" stroke="var(--line)"/><rect x="14" y="48" width="96" height="20" rx="10" fill="var(--accent2)"/>`
    + `<rect x="262" y="26" width="6" height="64" fill="currentColor"/><rect x="246" y="14" width="38" height="22" rx="3" fill="#fff" stroke="#111"/><text x="265" y="30" font-size="12" font-weight="800" text-anchor="middle" fill="#111">45</text>`
    + `<text x="60" y="96" font-size="14" fill="var(--muted)">160 ft</text><text x="236" y="108" font-size="15" font-weight="800" text-anchor="middle" fill="var(--accent)">Mark!</text></svg>`,
};

/** SCH-024: the Great Race vibe page: stills from the official rally school videos (docs/research/frames, copied to public/intro), credited;
 *  plus the intro video when content/videos.ts gets an `intro` URL. */
export const INTRO_PHOTOS: { src: string; caption: string; frame: string }[] = [
  { src: 'intro/lapboard.jpg', caption: 'Lapboard and clock', frame: '2026-13m56s+0' },
  { src: 'intro/rally-clock.jpg', caption: 'Rally clock', frame: 'clock-00m40s+4' },
  { src: 'intro/stop-board.jpg', caption: 'STOP board', frame: 'classen1-02m40s+0' },
];
export const PHOTO_CREDIT = 'Stills from Great Race rally school videos';
const BASE = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) ?? '/';
function photosHtml(): string {
  const intro = videoByKey('intro' as never)?.url;
  return `<figure class="s2-fig s2-photos" data-figure="photos"><div class="s2-photo-row">${INTRO_PHOTOS.map(p => `<span class="s2-photo"><img src="${BASE}${p.src}" alt="${p.caption}" loading="lazy" width="160" height="90"><span>${p.caption}</span></span>`).join('')}</div>`
    + `<figcaption class="s2-credit" data-testid="photo-credit">${PHOTO_CREDIT}${intro ? ` · <a href="${intro}" target="_blank" rel="noopener" data-testid="intro-video">Watch the intro video</a>` : ''}</figcaption></figure>`;
}

/** The figure's SVG markup, or '' when the name does not resolve. */
export function figureSvg(name: string | undefined): string {
  if (name === 'photos') return photosHtml();
  const id = figureId(name); return id ? `<figure class="s2-fig" data-figure="${id}">${SVG[id]()}</figure>` : '';
}
