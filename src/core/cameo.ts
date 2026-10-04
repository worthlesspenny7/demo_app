/**
 * The one CAMEO renderer (GRIID-001, GRIID-015, SIGN-001): a pure string-building module, no DOM, used by the book (cockpit and printable view),
 * the trap cards and the references. It draws the real page's vocabulary (11a section 3, 11b section 3), in black line art on white:
 * - a bold route: the dot where you are (bottom, left third), a long stem, a right-angle elbow with a solid arrowhead (a curved bold arrow for a bear,
 *   a straight arrow for "go straight"; a slanted road tilts the elbow);
 * - thin roads not taken running the full width of the cell through the junction (a T stops at the stem), dashed for driveways, lots, dead ends and gravel;
 * - road names in bold beside the road, "(US 1 North)" in parentheses for an unposted name, leader lines when two names share a fork;
 * - the control at the junction as a tiny outlined glyph (STOP octagon, yield triangle, three-lamp signal with the top lamp dark, blinker sun-burst,
 *   railroad tracks with ties and a yield triangle), ramp lane ticks on the stem;
 * - a sign face drawn INSIDE the cell: left or right of the arrow, or centred on it (overhead): text sign, "Speed Limit NN" rectangle, warning diamonds with
 *   a pictogram and an advisory plaque (curve, reverse curve, stop ahead, speed limit ahead, crossroad), the round RR advance sign, the white-on-black
 *   business box, and the landmark pictures (building, toll booth) with a bold caption.
 * The viewBox is 150 x 100 (landscape, like the real Column A cell).
 */
import type { Exit, Node, Sign, SignShape, TurnDir } from './course.js';

export interface CameoExit { angle: number; kind?: string; surface?: string; isRoute?: boolean; name?: string; bracketed?: boolean }
export interface CameoSignSpec { text: string; shape: string; side: 'L' | 'R' | 'O'; plaque?: number }
export interface CameoOptions {
  /** The sign standing at this node, drawn inside the diagram. */
  sign?: CameoSignSpec | null;
  /** A landmark caption ("Ogunquit Playhouse", "Toll Booth"), drawn as a small picture with the caption under it. */
  landmark?: string | null;
  /** Ramp or multi-lane approach: lane-marking ticks on the stem. */
  ramp?: boolean;
}

/** The cell is 150 units wide; its height follows the content (58 for a plain row, up to ~100 for a sign face with a plaque): "row heights from content" (11a section 3). */
export const CAMEO_W = 150;
export const CAMEO_H = 100;
const JY = 26;   // the junction (the elbow / cross road) sits near the top of a plain cell

const DASHED = new Set(['driveway', 'lot', 'deadend', 'private']);
const FONT = 'Arial, Helvetica, sans-serif';

export function bandFor(dir: TurnDir): [number, number, number] {
  switch (dir) {
    case 'L': case 'JL': return [-120, -60, -90];
    case 'BL': return [-60, -20, -45];
    case 'S': return [-20, 20, 0];
    case 'BR': return [20, 60, 45];
    case 'R': case 'JR': return [60, 120, 90];
    case 'AL': return [-180, -120, -150];
    case 'AR': return [120, 180, 150];
    default: return [-20, 20, 0];
  }
}

/** Pick the route exit: explicit isRoute wins, else the exit closest to the routeDir band centre, else straight-most. */
export function pickRouteExit<T extends CameoExit>(exits: T[], routeDir?: TurnDir | null): T | null {
  if (!exits.length) return null;
  const flagged = exits.find(e => e.isRoute);
  if (flagged) return flagged;
  const roads = exits.filter(e => !DASHED.has(e.kind ?? 'road'));
  const pool = roads.length ? roads : exits;
  if (routeDir) {
    const [lo, hi, c] = bandFor(routeDir);
    const cands = pool.filter(e => e.angle >= lo && e.angle <= hi).sort((a, b) => Math.abs(a.angle - c) - Math.abs(b.angle - c));
    if (cands[0]) return cands[0];
  }
  return pool.slice().sort((a, b) => Math.abs(a.angle) - Math.abs(b.angle))[0] ?? null;
}

// ---------- text helpers ----------

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (n: number): string => (Math.round(n * 10) / 10).toString();
const KEEP_UPPER = new Set(['US', 'I', 'RR', 'NE', 'NW', 'SE', 'SW', 'USA', 'II', 'III', 'IV', 'MPH', 'PA', 'NH', 'NY', 'ME', 'OH', 'IA', 'IL', 'TN', 'GA', 'CT', 'HWY']);
const SMALL_WORDS = new Set(['of', 'and', 'to', 'the', 'at', 'for', 'in', 'on']);

/** "LEAVING ELDORA CITY LIMIT" -> "Leaving Eldora City Limit": real sign legends are mixed case (11a). Text that is already mixed case is left alone. */
export function mixedCase(text: string): string {
  if (!text || text !== text.toUpperCase() || !/[A-Z]{2}/.test(text)) return text;
  return text.split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w) || w === '') return w;
    if (/\d/.test(w) && /^[A-Z]*-?\d/.test(w)) return w;                       // I-95, 12, 9A
    const core = w.replace(/[^A-Za-z]/g, '');
    if (KEEP_UPPER.has(core)) return w;
    const lower = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(core.toLowerCase())) return lower;
    return lower.replace(/(^|[-/'(])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
  }).join('');
}

/** Greedy word wrap on character count. */
export function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const textEl = (x: number, y: number, s: string, size: number, opts: { anchor?: 'start' | 'middle' | 'end'; fill?: string; weight?: string; cls?: string } = {}): string =>
  `<text${opts.cls ? ` class="${opts.cls}"` : ''} x="${f1(x)}" y="${f1(y)}" font-size="${size}" text-anchor="${opts.anchor ?? 'middle'}" font-weight="${opts.weight ?? '700'}" font-family="${FONT}" fill="${opts.fill ?? 'currentColor'}">${esc(s)}</text>`;

// ---------- control glyphs (small, outlined, black and white) ----------

function octagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return `${f1(cx + r * Math.cos(a))},${f1(cy + r * Math.sin(a))}`; }).join(' ');
}

/**
 * The control drawn at the junction (GRIID-001). Line art: STOP is a small outlined octagon with tiny "STOP" (not red, not filled); a signal is a vertical rounded
 * rectangle with three circles and the TOP circle dark; a blinker is an eight-ray sun-burst; yield is an outlined triangle point down; RR is two rails with ties and a
 * small yield triangle. Pass r ~ 6 for the book. Colours are inherited (`currentColor`) so the glyphs follow the page colour.
 */
export function signGlyph(control: string | undefined, cx: number, cy: number, r: number): string {
  switch (control) {
    case 'STOP':
      return `<g class="cameo-sign cameo-stop"><polygon points="${octagonPoints(cx, cy, r)}" fill="#fff" stroke="currentColor" stroke-width="1"/>${textEl(cx, cy + r * 0.26, 'STOP', r * 0.62, { fill: 'currentColor' })}</g>`;
    case 'YIELD': {
      const pts = `${f1(cx - r)},${f1(cy - r * 0.8)} ${f1(cx + r)},${f1(cy - r * 0.8)} ${f1(cx)},${f1(cy + r)}`;
      return `<polygon class="cameo-sign cameo-yield" points="${pts}" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>`;
    }
    case 'SIGNAL': {
      const w = r * 1.0, h = r * 2.5, ly = [cy - h * 0.3, cy, cy + h * 0.3], lr = r * 0.3;
      return `<g class="cameo-sign cameo-signal"><rect x="${f1(cx - w / 2)}" y="${f1(cy - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(r * 0.35)}" fill="#fff" stroke="currentColor" stroke-width="1"/>`
        + `<circle cx="${f1(cx)}" cy="${f1(ly[0]!)}" r="${f1(lr)}" fill="currentColor"/><circle cx="${f1(cx)}" cy="${f1(ly[1]!)}" r="${f1(lr)}" fill="#fff" stroke="currentColor" stroke-width="0.8"/><circle cx="${f1(cx)}" cy="${f1(ly[2]!)}" r="${f1(lr)}" fill="#fff" stroke="currentColor" stroke-width="0.8"/></g>`;
    }
    case 'BLINKER': {
      const rays = Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `M${f1(cx + r * 0.45 * Math.cos(a))} ${f1(cy + r * 0.45 * Math.sin(a))}L${f1(cx + r * 1.05 * Math.cos(a))} ${f1(cy + r * 1.05 * Math.sin(a))}`; }).join('');
      return `<g class="cameo-sign cameo-blinker"><path d="${rays}" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/><circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 0.28)}" fill="currentColor"/></g>`;
    }
    case 'RR': {
      // two rails with ties across the stem and a small yield triangle to the right (11a row 103)
      const w = r * 3.2, y1 = cy - r * 0.45, y2 = cy + r * 0.45;
      let ties = ''; for (let x = cx - w / 2 + 2; x <= cx + w / 2 - 2; x += 4) ties += `M${f1(x)} ${f1(y1)}V${f1(y2)}`;
      return `<g class="cameo-sign cameo-rr"><path d="M${f1(cx - w / 2)} ${f1(y1)}H${f1(cx + w / 2)}M${f1(cx - w / 2)} ${f1(y2)}H${f1(cx + w / 2)}" stroke="currentColor" stroke-width="1" fill="none"/><path d="${ties}" stroke="currentColor" stroke-width="0.9" fill="none"/>`
        + `<polygon points="${f1(cx + w / 2 + 3)},${f1(cy - r * 0.7)} ${f1(cx + w / 2 + 3 + r * 1.3)},${f1(cy - r * 0.7)} ${f1(cx + w / 2 + 3 + r * 0.65)},${f1(cy + r * 0.5)}" fill="#fff" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></g>`;
    }
    default: return '';
  }
}

// ---------- sign faces ----------

/** Shapes whose face is the control itself (drawn as a control glyph at the junction, never as a box). */
const CONTROL_SHAPES = new Set<string>(['octagon', 'triangle', 'rr', 'checkpoint', 'tracks']);
const WARNING_SHAPES = new Set<string>(['diamond', 'curve', 'reverse-curve', 'stop-ahead', 'speed-ahead', 'crossroad']);

/** A drawn sign face: markup positioned at (0,0) = centre of its box, plus its size (so the caller can place it). */
export interface SignFace { svg: string; w: number; h: number; /** the box centre, relative to the face's origin (a diamond with a plaque hangs below its centre) */ dy?: number }

function arrowHead(x: number, y: number, dx: number, dy: number, len: number, wid: number): string {
  const n = Math.hypot(dx, dy) || 1; const ux = dx / n, uy = dy / n; const bx = x - ux * len, by = y - uy * len;
  return `<polygon points="${f1(x)},${f1(y)} ${f1(bx - uy * wid / 2)},${f1(by + ux * wid / 2)} ${f1(bx + uy * wid / 2)},${f1(by - ux * wid / 2)}" fill="currentColor"/>`;
}

/** The pictogram inside a warning diamond (local coordinates, the diamond's half diagonal is 17). */
function diamondPicture(shape: string, text: string): string {
  const left = /left|\bL\b/i.test(text); const m = left ? -1 : 1;
  const sw = 'stroke="currentColor" stroke-width="2.3" fill="none" stroke-linecap="butt" stroke-linejoin="round"';
  switch (shape) {
    case 'curve':
      return `<path d="M${-3 * m} 9V1Q${-3 * m} -5 ${2 * m} -6" ${sw}/>` + arrowHead(7 * m, -6.5, 1 * m, -0.35, 6, 7);
    case 'reverse-curve':
      return `<path d="M${-4 * m} 10V4Q${-4 * m} 0 0 0Q${4 * m} 0 ${4 * m} -4V-6" ${sw}/>` + arrowHead(4 * m, -12, 0, -1, 6, 7);
    case 'stop-ahead':
      return `<path d="M0 -2V-9" ${sw}/>` + arrowHead(0, -13, 0, -1, 5, 7) + `<polygon points="${octagonPoints(0, 6, 6)}" fill="currentColor"/>`;
    case 'speed-ahead': {
      const n = (text.match(/(\d{2})/) ?? [])[1] ?? '';
      return `<path d="M0 -1V-8" ${sw}/>` + arrowHead(0, -12, 0, -1, 5, 7) + `<rect x="-7" y="1" width="14" height="10" fill="#fff" stroke="currentColor" stroke-width="1.2"/>` + textEl(0, 9.3, n, 7.5);
    }
    case 'crossroad':
      return /\bT\b/.test(text) ? `<path d="M-9 -3H9M0 -3V10" ${sw}/>` : `<path d="M-9 0H9M0 -9V10" ${sw}/>`;
    default: {
      const lines = wrapWords(mixedCase(text), 7).slice(0, 3);
      return lines.map((l, i) => textEl(0, (i - (lines.length - 1) / 2) * 7 + 2.4, l, 5.8)).join('');
    }
  }
}

/** The face of a sign as the real sheets draw it, or null when the shape is a control glyph / has no face. */
export function signFace(shape: SignShape | string, text: string, plaque?: number): SignFace | null {
  if (CONTROL_SHAPES.has(shape)) return null;
  const t = mixedCase(text);
  if (WARNING_SHAPES.has(shape)) {
    const d = 18;
    let svg = `<g class="cameo-sign cameo-warning cameo-${esc(shape)}"><polygon points="0,${-d} ${d},0 0,${d} ${-d},0" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>${diamondPicture(shape, text)}</g>`;
    let h = 2 * d;
    if (plaque !== undefined || shape === 'speed-ahead') {
      const label = shape === 'speed-ahead' ? 'AHEAD' : String(plaque);
      const py = d + 1.5;
      svg += `<g class="cameo-plaque"><rect x="${shape === 'speed-ahead' ? -13 : -11}" y="${py}" width="${shape === 'speed-ahead' ? 26 : 22}" height="${shape === 'speed-ahead' ? 9 : 17}" fill="#fff" stroke="currentColor" stroke-width="1.2"/>`
        + (shape === 'speed-ahead' ? textEl(0, py + 7, label, 5.8) : textEl(0, py + 9.5, label, 9.5) + textEl(0, py + 15, 'MPH', 4.6))
        + '</g>';
      h += 1.5 + (shape === 'speed-ahead' ? 9 : 17);
    }
    return { svg, w: 2 * d, h, dy: (h - 2 * d) / 2 };
  }
  if (shape === 'rr-advance') {
    const r = 15;
    return { svg: `<g class="cameo-sign cameo-rr-advance"><circle r="${r}" fill="#fff" stroke="currentColor" stroke-width="2.2"/><path d="M-9 -9L9 9M-9 9L9 -9" stroke="currentColor" stroke-width="3" stroke-linecap="butt"/>${textEl(-11, 2.2, 'R', 6)}${textEl(11, 2.2, 'R', 6)}</g>`, w: 2 * r, h: 2 * r };
  }
  if (shape === 'speedlimit') {
    const n = (text.match(/(\d{2,3})\s*$/) ?? text.match(/(\d{2,3})/) ?? [])[1] ?? '';
    return { svg: `<g class="cameo-sign cameo-speedlimit"><rect x="-18" y="-21" width="36" height="42" fill="#fff" stroke="currentColor" stroke-width="1.6"/>${textEl(0, -9.5, 'Speed', 8.6)}${textEl(0, -0.5, 'Limit', 8.6)}${textEl(0, 15, n, 17)}</g>`, w: 36, h: 42 };
  }
  if (shape === 'business') {
    const lines = wrapWords(t, 9).slice(0, 2); const w = Math.max(26, Math.max(...lines.map(l => l.length)) * 3.9 + 8), h = lines.length * 8 + 7;
    return { svg: `<g class="cameo-sign cameo-business"><rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" fill="#000" stroke="#000" stroke-width="1"/>${lines.map((l, i) => textEl(0, -h / 2 + 8 + i * 8 - 0.5, l, 6.4, { fill: '#fff', weight: '600' })).join('')}</g>`, w, h };
  }
  if (shape === 'tollbooth' || shape === 'landmark') return null;   // drawn as pictures with a caption (landmarkPicture)
  // text signs: green freeway, brown, street name, route shield: a square-cornered outlined rectangle with bold mixed-case text (monochrome)
  const lines = wrapWords(t, shape === 'shield' ? 6 : 11).slice(0, 3);
  const w = Math.min(54, Math.max(24, Math.max(...lines.map(l => l.length)) * 5.1 + 8)), h = lines.length * 9.6 + 6;
  const body = shape === 'shield'
    ? `<path d="M${f1(-w / 2)} ${f1(-h / 2)}H${f1(w / 2)}V${f1(h / 2 - 5)}L0 ${f1(h / 2 + 3)}L${f1(-w / 2)} ${f1(h / 2 - 5)}Z" fill="#fff" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`
    : `<rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" fill="#fff" stroke="currentColor" stroke-width="1.6"/>`;
  return { svg: `<g class="cameo-sign cameo-textsign">${body}${lines.map((l, i) => textEl(0, -h / 2 + 9.2 + i * 9.6, l, 8.4)).join('')}</g>`, w, h: shape === 'shield' ? h + 3 : h };
}

/** A line-drawn landmark picture (building / toll booth) in a 24 x 24 box centred at the origin. */
function landmarkPicture(kind: 'building' | 'toll' | 'bridge' | 'tower'): string {
  if (kind === 'bridge') return '<g class="cameo-landmark cameo-bridge"><path d="M-13 4H13M-13 10H13" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M-11 4C-7 -9 7 -9 11 4" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M-6 -3V4M0 -5V4M6 -3V4" stroke="currentColor" stroke-width="1" fill="none"/></g>';
  if (kind === 'tower') return '<g class="cameo-landmark cameo-tower"><ellipse cx="0" cy="-4" rx="8" ry="6" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M-6 1L-9 11M6 1L9 11M-8 11H8M-3 3V11M3 3V11" stroke="currentColor" stroke-width="1.2" fill="none"/></g>';
  if (kind === 'toll') {
    return '<g class="cameo-landmark cameo-toll"><path d="M-9 10V-4L0 -10L9 -4V10Z" fill="#fff" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><rect x="-4.5" y="-3" width="9" height="8" fill="#ddd" stroke="currentColor" stroke-width="1"/><path d="M-12 10H12M9 3H15V9" stroke="currentColor" stroke-width="1.1" fill="none"/></g>';
  }
  return '<g class="cameo-landmark cameo-building"><path d="M-11 11V-1L0 -9L11 -1V11Z" fill="#fff" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M-6 11V3H-1V11M3 3H8V7H3Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M-13 11H13" stroke="currentColor" stroke-width="1.3"/></g>';
}

// ---------- geometry ----------

/** Where the ray (x,y)+t(dx,dy) leaves the drawing box (margin m). */
function hitEdge(x: number, y: number, dx: number, dy: number, m = 3, H = CAMEO_H): { x: number; y: number; t: number } {
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (CAMEO_W - m - x) / dx); else if (dx < -1e-6) t = Math.min(t, (m - x) / dx);
  if (dy > 1e-6) t = Math.min(t, (H - m - y) / dy); else if (dy < -1e-6) t = Math.min(t, (m - y) / dy);
  if (!Number.isFinite(t)) t = 0;
  return { x: x + dx * t, y: y + dy * t, t };
}
const dirOf = (angle: number): { dx: number; dy: number } => { const a = (angle * Math.PI) / 180; return { dx: Math.sin(a), dy: -Math.cos(a) }; };

function ariaFor(ex: CameoExit[], route: CameoExit | null, control?: string, sign?: CameoSignSpec | null): string {
  const dir = route ? (Math.abs(route.angle) < 20 ? 'straight' : route.angle < 0 ? `left ${Math.abs(route.angle)} deg` : `right ${route.angle} deg`) : 'straight';
  const sg = sign ? `, ${sign.side === 'O' ? 'overhead' : sign.side === 'L' ? 'left' : 'right'} sign ${mixedCase(sign.text)}` : '';
  return `${control && control !== 'none' ? control + ' ' : ''}intersection, ${ex.length} exits, route ${dir}${sg}`;
}

/**
 * The cell's height in viewBox units (the width is 150): 58 for a plain row, taller for a sign face (with its plaque), a landmark picture or ramp lane ticks, so that
 * the row's height follows its content. The book's page layout uses the same number.
 */
export function cameoHeight(o: { face?: SignFace | null; side?: 'L' | 'R' | 'O'; ramp?: boolean; landmark?: string | null }): number {
  let H = 58;
  if (o.face) H = Math.max(H, JY + 8 + o.face.h + (o.side === 'O' ? 17 : 7));
  if (o.ramp) H = Math.max(H, JY + 8 + 36 + 14);
  if (o.landmark) H = Math.max(H, wrapWords(o.landmark, 11).length > 1 ? 88 : 78);
  return Math.round(H);
}

const nameOf = (e: CameoExit): string => { const n = e.name ?? ''; return !n ? '' : e.bracketed && !n.startsWith('(') ? `(${n})` : n; };

/**
 * Build the CAMEO SVG. `exits` are relative to our approach heading (0 = straight ahead, negative = left).
 * `control` is the traffic control on our approach ('STOP' | 'YIELD' | 'SIGNAL' | 'BLINKER' | 'RR' | 'none'). `routeDir` picks the bold path when no exit carries isRoute.
 * `size` is the rendered height in px (the width follows the 3:2 cell); `opts.sign` and `opts.landmark` are drawn inside the cell.
 */
export function cameoSvg(exits: CameoExit[] | undefined | null, control?: string, routeDir?: TurnDir | null, size = 64, opts: CameoOptions = {}): string {
  const ex = Array.isArray(exits) ? exits.filter(e => e && Number.isFinite(e.angle)) : [];
  const route = pickRouteExit(ex, routeDir);
  const sign = opts.sign && !CONTROL_SHAPES.has(opts.sign.shape) && opts.sign.shape !== 'landmark' && opts.sign.shape !== 'tollbooth' ? opts.sign : null;
  const lmCaption = opts.landmark ?? (opts.sign && (opts.sign.shape === 'tollbooth' || opts.sign.shape === 'landmark') ? opts.sign.text : null);
  const routeAngle = route ? route.angle : 0;
  const routeLeft = routeAngle < -20, routeRight = routeAngle > 20;
  const rt = !route || Math.abs(routeAngle) < 20 ? 'S' : Math.abs(routeAngle) >= 120 ? 'A' : Math.abs(routeAngle) >= 60 ? 'T' : 'B';
  // the stem column: left third by default; the right side when the route turns left or a sign stands on the left; the middle for an overhead sign
  const stemX = sign?.side === 'O' ? 75 : routeLeft ? (sign?.side === 'R' ? 80 : 105) : sign?.side === 'L' ? 95 : 52;
  const face = sign ? signFace(sign.shape, sign.text, sign.plaque) : null;
  const H = cameoHeight({ face, side: sign?.side, ramp: opts.ramp, landmark: lmCaption });
  const dotY = H - 11, jy = JY;
  const bold = 3.2, thin = 1;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="cameo" viewBox="0 0 ${CAMEO_W} ${H}" width="${Math.round(size * CAMEO_W / H)}" height="${size}" role="img" aria-label="${esc(ariaFor(ex, route, control, sign))}">`);
  const thinLine = (x1: number, y1: number, x2: number, y2: number, dashed: boolean): string =>
    `<line class="cameo-thin${dashed ? ' cameo-dashed' : ''}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="currentColor" stroke-width="${thin}"${dashed ? ' stroke-dasharray="4 3"' : ''} stroke-linecap="butt"/>`;

  // ----- thin roads not taken -----
  const others = ex.filter(e => e !== route);
  const isDashed = (e: CameoExit): boolean => DASHED.has(e.kind ?? 'road') || e.surface === 'gravel';
  const jx = stemX, jyAt = rt === 'B' ? Math.round(jy + (dotY - jy) * 0.55) : jy;   // a bear/fork splits lower down the stem
  const sideRoads = (list: CameoExit[], left: boolean): CameoExit[] => list.filter(e => (left ? e.angle < -50 : e.angle > 50) && Math.abs(e.angle) <= 130);
  const leftSide = sideRoads([...others, ...(route ? [route] : [])], true), rightSide = sideRoads([...others, ...(route ? [route] : [])], false);
  const throughRoad = leftSide.length > 0 && rightSide.length > 0 && !leftSide.concat(rightSide).some(isDashed) && rt !== 'B';
  const drawn = new Set<CameoExit>();
  if (throughRoad) {
    // one thin line through the junction, the full width of the cell (a slanted cross road tilts both ways); the route overlays its own half in bold
    const ref = leftSide[0]!, a = dirOf(ref.angle);
    const lEnd = hitEdge(jx, jy, a.dx, a.dy, 3, H), b = dirOf(rightSide[0]!.angle), rEnd = hitEdge(jx, jy, b.dx, b.dy, 3, H);
    parts.push(thinLine(lEnd.x, lEnd.y, rEnd.x, rEnd.y, false));
    for (const e of [...leftSide, ...rightSide]) drawn.add(e);
  }
  for (const e of others) {
    if (drawn.has(e)) continue;
    const d = dirOf(e.angle); const dashed = isDashed(e);
    const oy = Math.abs(e.angle) < 20 ? jy : (rt === 'B' ? jyAt : jy);
    const end = hitEdge(jx, oy, d.dx, d.dy, 3, H);
    const len = dashed ? Math.min(end.t, 34) : Math.min(end.t, Math.abs(e.angle) < 20 ? 200 : 140);
    parts.push(thinLine(jx, oy, jx + d.dx * len, oy + d.dy * len, dashed));
  }

  // ----- the bold route: stem, elbow / bend / straight, arrowhead -----
  const route0 = route ?? { angle: 0 };
  let endX = stemX, endY = 8, tipDx = 0, tipDy = -1;
  let path = '';
  const routeDashed = route ? DASHED.has(route.kind ?? 'road') : false;
  if (rt === 'S') {
    path = `M${stemX} ${dotY}V${endY + 6}`;
  } else if (rt === 'B') {
    // curved bold arrow: up the stem, then a smooth curve toward the exit side
    const dir = route0.angle < 0 ? -1 : 1;
    const bendY = jyAt;
    endX = stemX + dir * (Math.abs(route0.angle) > 40 ? 44 : 36); endY = 12;
    path = `M${stemX} ${dotY}V${bendY}Q${stemX} ${bendY - 22} ${f1(endX - dir * 6)} ${endY + 5}`;
    tipDx = dir * 0.62; tipDy = -0.78;
  } else if (rt === 'A') {
    const dir = route0.angle < 0 ? -1 : 1;
    endX = stemX + dir * 44; endY = Math.min(jy + 32, dotY - 8);
    path = `M${stemX} ${dotY}V${jy}L${f1(endX - dir * 6)} ${f1(endY - 5)}`;
    tipDx = dir * 0.76; tipDy = 0.65;
  } else {
    // a turn at the end of the stem: a right-angle elbow (tilted when the road is slanted)
    const a = dirOf(route0.angle); const edge = hitEdge(stemX, jy, a.dx, a.dy, 14, H);
    const len = Math.min(edge.t, 92);
    endX = stemX + a.dx * len; endY = jy + a.dy * len;
    path = `M${stemX} ${dotY}V${jy}L${f1(stemX + a.dx * (len - 5))} ${f1(jy + a.dy * (len - 5))}`;
    tipDx = a.dx; tipDy = a.dy;
  }
  parts.push(`<path class="cameo-route cameo-bold cameo-exit" d="${path}" fill="none" stroke="currentColor" stroke-width="${bold}" stroke-linejoin="miter"${routeDashed ? ' stroke-dasharray="6 4"' : ''}/>`);
  parts.push(`<g class="cameo-arrowhead">${arrowHead(endX, endY, tipDx, tipDy, 12, 10)}</g>`);
  parts.push(`<circle class="cameo-dot" cx="${stemX}" cy="${dotY}" r="4.6" fill="currentColor"/>`);

  // ----- ramp lane ticks, control glyph at the junction -----
  if (opts.ramp) {
    let ticks = '';
    for (let y = jy + 14; y <= dotY - 8; y += 9) ticks += `M${stemX - 8} ${y + 3}L${stemX} ${y}L${stemX + 8} ${y + 3}`;
    parts.push(`<path class="cameo-lanes" d="${ticks}" fill="none" stroke="currentColor" stroke-width="1"/>`);
  }
  if (control === 'SIGNAL') parts.push(`<line class="cameo-stopline" x1="${stemX - 13}" y1="${jy + 18}" x2="${stemX + 13}" y2="${jy + 18}" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2"/>`);
  const glyphLeft = sign?.side === 'R';
  const gx = glyphLeft ? stemX - 13 : stemX + 13;
  if (control === 'RR') parts.push(signGlyph('RR', stemX, jy + 18, 7.5));
  else if (control === 'SIGNAL') parts.push(signGlyph('SIGNAL', gx, jy + (rt === 'T' ? 26 : 8), 6.6));
  else if (control === 'STOP' || control === 'YIELD' || control === 'BLINKER') parts.push(signGlyph(control, gx, jyAt + 14, 6.8));
  if (opts.sign && opts.sign.shape === 'tracks' && control !== 'RR') parts.push(signGlyph('RR', stemX, jy + 18, 7.5));

  // ----- road names: bold, beside the road they name; leader lines when two names share a fork -----
  const named = [route, ...others].filter((e): e is CameoExit => !!e && !!nameOf(e));
  const labelSize = 8.6;
  const estW = (s: string): number => s.length * labelSize * 0.6;
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const shareFork = named.length >= 2 && named.some((a, i) => named.some((b, j) => j > i && Math.abs(a.angle - b.angle) < 70 && Math.abs(a.angle) > 10 && Math.abs(b.angle) > 10));
  const forkY = rt === 'B' ? jyAt : jy;
  named.forEach((e, k) => {
    const nm = nameOf(e); const w = estW(nm);
    let x: number, y: number, anchor: 'start' | 'end';
    let leaderTo: { x: number; y: number } | null = null;
    const d = dirOf(e.angle);
    if (shareFork && named.length >= 2) {
      // names stacked in a column beside the fork, each tied to its road by a thin leader (11a row 2)
      const onRight = (named[0]!.angle + named[1]!.angle) / 2 < 0;   // the fork leans left: the column goes to the right
      anchor = onRight ? 'end' : 'start'; x = onRight ? CAMEO_W - 3 : 3; y = 14 + k * Math.round(H * 0.3);
      const mid = rt === 'B' && e === route ? 0.5 : 0.55; const len = hitEdge(jx, forkY, d.dx, d.dy, 6, H).t * mid;
      leaderTo = { x: jx + d.dx * len, y: forkY + d.dy * len };
    } else if (e === route) {
      if (rt === 'S') { const crowdRight = others.some(o => o.angle > 0 && o.angle < 60); x = crowdRight ? stemX - 9 : stemX + 9; y = 17; anchor = crowdRight ? 'end' : 'start'; if (anchor === 'start' && x + w > CAMEO_W - 2) { x = stemX - 9; anchor = 'end'; } }
      else if (rt === 'T') { anchor = tipDx >= 0 ? 'end' : 'start'; x = tipDx >= 0 ? endX - 2 : endX + 2; y = endY - 6; }
      else { anchor = tipDx >= 0 ? 'start' : 'end'; x = endX + (tipDx >= 0 ? 8 : -8); y = Math.max(11, endY + 3); }
    } else {
      const oy = Math.abs(e.angle) < 20 ? jy : forkY;
      const end = hitEdge(jx, oy, d.dx, d.dy, 6, H);
      const dashed = isDashed(e);
      const len = Math.min(end.t, dashed ? 34 : 140);
      const px = jx + d.dx * len, py = oy + d.dy * len;
      if (Math.abs(e.angle) >= 50) { anchor = e.angle > 0 ? 'end' : 'start'; x = e.angle > 0 ? px - 2 : px + 2; y = py - 4; }
      else { anchor = e.angle >= 0 ? 'start' : 'end'; x = px + (e.angle >= 0 ? 5 : -5); y = Math.max(11, py + 4); }
    }
    // keep inside the cell, and off the stem and earlier names
    const span = (): { x0: number; x1: number } => (anchor === 'start' ? { x0: x, x1: x + w } : { x0: x - w, x1: x });
    if (span().x1 > CAMEO_W - 2) x -= span().x1 - (CAMEO_W - 2);
    if (span().x0 < 2) x += 2 - span().x0;
    for (let guard = 0; guard < 6; guard++) {
      const sp = span();
      const hit = boxes.find(b => sp.x0 < b.x1 + 2 && sp.x1 > b.x0 - 2 && y - 8 < b.y1 && y > b.y0);
      if (!hit) break;
      y = hit.y1 + 10;
    }
    boxes.push({ ...span(), y0: y - 8, y1: y });
    if (leaderTo) {
      const sp = span(); const lx = anchor === 'end' ? sp.x0 - 2 : sp.x1 + 2;
      parts.push(`<line class="cameo-leader" x1="${f1(lx)}" y1="${f1(y - 3)}" x2="${f1(leaderTo.x)}" y2="${f1(leaderTo.y)}" stroke="currentColor" stroke-width="0.8"/>`);
    }
    parts.push(textEl(x, y, nm, labelSize, { anchor, cls: 'cameo-name' }));
  });

  // ----- the sign face inside the cell -----
  if (sign) {
    if (face) {
      const cy = (jy + 8 + H - 5) / 2 - (face.dy ?? 0);
      const cxs = sign.side === 'O' ? stemX : sign.side === 'L' ? Math.max(4 + face.w / 2, stemX - 12 - face.w / 2) : Math.min(CAMEO_W - 4 - face.w / 2, stemX + 12 + face.w / 2);
      parts.push(`<g class="cameo-signface side-${sign.side}" transform="translate(${f1(cxs)} ${f1(cy)})">${face.svg}</g>`);
    }
  }
  // ----- landmark picture and caption (lower left, or right when the stem sits on the left) -----
  if (lmCaption) {
    const lmx = stemX > 70 ? 30 : 112;
    const kind = /toll/i.test(lmCaption) ? 'toll' : /bridge|overpass/i.test(lmCaption) ? 'bridge' : /tower/i.test(lmCaption) ? 'tower' : 'building';
    const lines = wrapWords(mixedCase(lmCaption), 11).slice(0, 2);
    const baseY = H - 4 - (lines.length - 1) * 9;   // the caption's first line; the picture sits above it
    parts.push(`<g class="cameo-landmark-wrap" transform="translate(${lmx} ${baseY - 20}) scale(1.05)">${landmarkPicture(kind)}</g>`);
    lines.forEach((l, i) => parts.push(textEl(lmx, baseY + i * 9, l, 8, { cls: 'cameo-caption' })));
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Convenience for the trap cards and the references: the CAMEO of core `Exit`s with the node's sign, control and landmark. */
export function cameoOfNode(node: Pick<Node, 'exits' | 'control' | 'sign' | 'label' | 'ramp' | 'kind'> | null | undefined, routeDir?: TurnDir | null, size = 64): string {
  if (!node) return '';
  const exits: Exit[] | undefined = node.exits;
  const sign: CameoSignSpec | null = node.sign ? { text: node.sign.text, shape: node.sign.shape, side: node.sign.side, plaque: (node.sign as Sign).plaque } : null;
  const ex = exits && exits.length ? exits : (node.sign || (node.control && node.control !== 'none') ? [{ angle: 0, kind: 'road', isRoute: true }] : []);
  return cameoSvg(ex, node.control, routeDir ?? null, size, { sign, ramp: node.ramp, landmark: node.kind === 'landmark' && !sign ? landmarkCaption(node.label) : null });
}

/** The height (viewBox units, width 150) the CAMEO of this node will have; used by the book's content-driven page layout. */
export function cameoHeightOfNode(node: Pick<Node, 'sign' | 'label' | 'ramp' | 'kind'> | null | undefined): number {
  if (!node) return 58;
  const face = node.sign ? signFace(node.sign.shape, node.sign.text, node.sign.plaque) : null;
  const lm = (node.sign && (node.sign.shape === 'tollbooth' || node.sign.shape === 'landmark') ? node.sign.text : null) ?? (node.kind === 'landmark' && !node.sign ? landmarkCaption(node.label) : null);
  return cameoHeight({ face, side: node.sign?.side, ramp: node.ramp, landmark: lm ? mixedCase(lm) : null });
}

/** Structural row labels the builder gives landmark nodes ("Begin transit", "Time Allowance point") are not pictures worth drawing. */
const STRUCTURAL = /^(begin transit|restart|time allowance point|lunch stop|fuel stop|pit stop|rest stop|finish banner|start banner|information)/i;
export function landmarkCaption(label: string | undefined | null): string | null { return label && !STRUCTURAL.test(label) ? label : null; }
