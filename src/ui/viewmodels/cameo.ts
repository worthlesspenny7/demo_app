/**
 * CAMEO intersection diagram (UI-004), per the GRIID grammar (research 04 §2.2):
 * dot = road we arrive on (bottom), arrow = road we leave on, bold line dot->arrow = route,
 * thin lines = roads not taken, dashed = driveway / lot / dead end / private.
 * A sign glyph (octagon / triangle / signal / crossbuck) marks the control on our approach.
 */
import type { TurnDir } from '../../core/course.js';

export interface CameoExit { angle: number; kind?: string; surface?: string; isRoute?: boolean; name?: string }

const DASHED = new Set(['driveway', 'lot', 'deadend', 'private']);

function bandFor(dir: TurnDir): [number, number, number] {
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
export function pickRouteExit(exits: CameoExit[], routeDir?: TurnDir | null): CameoExit | null {
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

export function signGlyph(control: string | undefined, cx: number, cy: number, r: number): string {
  switch (control) {
    case 'STOP': {
      const pts = Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 8) + (i * Math.PI) / 4; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
      return `<polygon class="cameo-sign cameo-stop" points="${pts}" fill="#c8312b" stroke="#fff" stroke-width="1.2"/><text x="${cx}" y="${cy + r * 0.22}" font-size="${(r * 0.62).toFixed(1)}" text-anchor="middle" fill="#fff" font-weight="700" font-family="sans-serif">STOP</text>`;
    }
    case 'YIELD': {
      const pts = `${cx - r},${cy - r * 0.8} ${cx + r},${cy - r * 0.8} ${cx},${cy + r}`;
      return `<polygon class="cameo-sign cameo-yield" points="${pts}" fill="#fff" stroke="#c8312b" stroke-width="${(r * 0.35).toFixed(1)}"/>`;
    }
    case 'SIGNAL': {
      const w = r * 0.9, h = r * 2.1;
      return `<rect class="cameo-sign cameo-signal" x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${r * 0.2}" fill="#222" stroke="#999" stroke-width="1"/>` +
        `<circle cx="${cx}" cy="${cy - h * 0.3}" r="${r * 0.26}" fill="#e34948"/><circle cx="${cx}" cy="${cy}" r="${r * 0.26}" fill="#eda100"/><circle cx="${cx}" cy="${cy + h * 0.3}" r="${r * 0.26}" fill="#1baf7a"/>`;
    }
    case 'BLINKER':
      return `<circle class="cameo-sign cameo-blinker" cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="#222" stroke="#999"/><circle cx="${cx}" cy="${cy}" r="${r * 0.4}" fill="#eda100"/>`;
    case 'RR': {
      const d = r * 0.9;
      return `<g class="cameo-sign cameo-rr" stroke="#fff" stroke-width="${(r * 0.3).toFixed(1)}" stroke-linecap="round"><line x1="${cx - d}" y1="${cy - d * 0.45}" x2="${cx + d}" y2="${cy + d * 0.45}"/><line x1="${cx - d}" y1="${cy + d * 0.45}" x2="${cx + d}" y2="${cy - d * 0.45}"/></g>`;
    }
    default: return '';
  }
}

/**
 * Build the CAMEO SVG. `exits` are relative to our approach heading (0 = straight ahead, negative = left).
 * `control` is the traffic control on our approach ('STOP' | 'YIELD' | 'SIGNAL' | 'BLINKER' | 'RR' | 'none').
 * `routeDir` picks the bold path when no exit carries isRoute.
 */
export function cameoSvg(exits: CameoExit[] | undefined | null, control?: string, routeDir?: TurnDir | null, size = 64): string {
  const ex = Array.isArray(exits) ? exits.filter(e => e && Number.isFinite(e.angle)) : [];
  const cx = size / 2, cy = size / 2;
  const L = size * 0.42;      // leg length
  const entry = { x: cx, y: cy + L };
  const route = pickRouteExit(ex, routeDir);
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="cameo" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${ariaFor(ex, route, control)}">`);
  parts.push(`<defs><marker id="cameo-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><polygon points="0,0 10,5 0,10" fill="currentColor"/></marker></defs>`);
  const end = (angle: number) => { const a = (angle * Math.PI) / 180; return { x: cx + L * Math.sin(a), y: cy - L * Math.cos(a) }; };
  // thin (non-route) exits first so the bold route draws on top
  for (const e of ex) {
    if (e === route) continue;
    const p = end(e.angle);
    const dashed = DASHED.has(e.kind ?? 'road') || e.surface === 'gravel';
    parts.push(`<line class="cameo-thin${dashed ? ' cameo-dashed' : ''}" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.75"${dashed ? ' stroke-dasharray="3 3"' : ''}/>`);
  }
  // entry leg (bold, from the dot to the centre)
  parts.push(`<line class="cameo-route cameo-bold" x1="${entry.x}" y1="${entry.y}" x2="${cx}" y2="${cy}" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`);
  if (route) {
    const p = end(route.angle);
    const dashed = DASHED.has(route.kind ?? 'road');
    parts.push(`<line class="cameo-route cameo-bold cameo-exit" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="currentColor" stroke-width="4" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#cameo-arrow)"/>`);
  } else {
    // no exits known: straight through with an arrow
    parts.push(`<line class="cameo-route cameo-bold cameo-exit" x1="${cx}" y1="${cy}" x2="${cx}" y2="${(cy - L).toFixed(1)}" stroke="currentColor" stroke-width="4" stroke-linecap="round" marker-end="url(#cameo-arrow)"/>`);
  }
  parts.push(`<circle class="cameo-dot" cx="${entry.x}" cy="${entry.y}" r="${(size * 0.07).toFixed(1)}" fill="currentColor"/>`);
  // GRIID-001: the intersection control is drawn at the junction, beside the approach road
  const glyph = signGlyph(control, cx + size * 0.25, cy + size * 0.22, size * 0.115);
  if (glyph) parts.push(glyph);
  parts.push('</svg>');
  return parts.join('');
}

function ariaFor(ex: CameoExit[], route: CameoExit | null, control?: string): string {
  const dir = route ? (Math.abs(route.angle) < 20 ? 'straight' : route.angle < 0 ? `left ${Math.abs(route.angle)} deg` : `right ${route.angle} deg`) : 'straight';
  return `${control && control !== 'none' ? control + ' ' : ''}intersection, ${ex.length} exits, route ${dir}`;
}
