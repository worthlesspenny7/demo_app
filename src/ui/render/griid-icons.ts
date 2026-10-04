/**
 * The pictograms of the GRIID book (GRIID-003, GRIID-010, UI-029) as small inline SVG strings, drawn as the real sheets draw them (11a section 3): black line art,
 * no colour. Column B: tire (black disc, white spokes), speedometer (landscape rectangle with a gauge), hourglass (grey sand), camcorder on a tripod (free zone;
 * the begin symbol is the camcorder inside a slashed circle), crossed knife and fork, gas pump, restroom (man, outhouse, woman), cup, checkered flag.
 * Column C: the digital wristwatch (the time inside, the zone label above) and the same watch in a circle with a slash (End timed portion).
 * The odometer is four separate small squares. No DOM needed.
 */
import type { ColumnBSymbol, ColumnCIcon } from '../../core/griid.js';

/** Every pictogram the book draws: Column B symbols, the two Column C watch faces and the Time Allowance box icon (the banner itself has no Column B symbol). */
export type GriidIconId = ColumnBSymbol | ColumnCIcon;

export const SYMBOL_LABEL: Record<GriidIconId, string> = {
  warmup: 'Tire warm-up',
  calibration: 'Speedometer calibration run begins',
  'transit-begin': 'Transit begins (full hourglass)',
  'transit-end': 'Transit ends (empty hourglass)',
  'freezone-begin': 'Free zone begins (camcorder in a slashed circle)',
  'freezone-end': 'Free zone ends (camcorder)',
  'end-timed': 'End timed portion (digital watch in a circle with a slash, Column C)',
  restart: 'Time-of-day restart (digital wristwatch, Column C)',
  pit: 'Hosted pit stop (cup)',
  meal: 'Meal stop (crossed knife and fork)',
  refuel: 'Refuel (gas pump)',
  rest: 'Rest stop (man, outhouse, woman)',
  finish: 'Finish line, Observation Checkpoint (checkered flag)',
};

/** viewBox width : height of each pictogram (most are square). */
const VIEW: Partial<Record<GriidIconId, [number, number]>> = { calibration: [64, 32], rest: [72, 32], restart: [84, 56], 'end-timed': [84, 56] };

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SAND = '#8a8a8a';

/** A video camcorder on a tripod, solid black, in a 32 x 32 box. */
const camcorder = (g = ''): string =>
  `<g ${g}><rect x="5" y="9" width="16" height="10" rx="1.5" fill="currentColor"/><path d="M21 12L28 8V20L21 16Z" fill="currentColor"/><circle cx="9.5" cy="6.5" r="3" fill="currentColor"/><circle cx="16.5" cy="6.5" r="3" fill="currentColor"/>`
  + '<path d="M13 19L7 30M13 19V30M13 19L19 30" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></g>';

function spokes(): string {
  let d = ''; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; d += `M16 16L${(16 + 8 * Math.cos(a)).toFixed(1)} ${(16 + 8 * Math.sin(a)).toFixed(1)}`; }
  return `<path d="${d}" stroke="#fff" stroke-width="0.9" fill="none"/>`;
}

function gauge(): string {
  // a gauge scale arc with tick numerals 0..80, the word MPH and a needle (11a: Column B speedometer)
  let ticks = ''; const cx = 32, cy = 27;
  for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.12 - (i / 8) * 1.24); const x1 = cx + 22 * Math.cos(a), y1 = cy - 22 * Math.sin(a), x2 = cx + 18.5 * Math.cos(a), y2 = cy - 18.5 * Math.sin(a); ticks += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`; }
  return `<rect x="1.5" y="2" width="61" height="28" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.8"/><path d="M10 25A23 21 0 0 1 54 25" fill="none" stroke="currentColor" stroke-width="1"/><path d="${ticks}" stroke="currentColor" stroke-width="1"/>`
    + `<text x="32" y="22.5" text-anchor="middle" font-size="5.5" font-weight="700" font-family="Arial, sans-serif" fill="currentColor">MPH</text><path d="M32 27L40 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="32" cy="27" r="1.8" fill="currentColor"/>`;
}

const glass = '<path d="M7 3H25M7 29H25" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M8.5 3V29M23.5 3V29" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 4C10.5 12 16 14 16 16C16 18 10.5 20 10.5 28M21.5 4C21.5 12 16 14 16 16C16 18 21.5 20 21.5 28" fill="none" stroke="currentColor" stroke-width="1.3"/>';

/** The digital wristwatch seen from above (11a section 3): a rounded case with a black band stub above and below, a small crown on the right edge, four screws and an inner display. */
function watch(time: string | null, scale = 1, cx = 42, cy = 28): string {
  const t = time ? `<text x="38" y="35" text-anchor="middle" font-size="12.5" font-weight="700" font-family="Arial, sans-serif" fill="currentColor" textLength="46" lengthAdjust="spacingAndGlyphs">${time.replace(/&/g, '&amp;')}</text>` : '';
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-42 -28)"><rect x="24" y="0" width="30" height="8" fill="currentColor"/><rect x="24" y="48" width="30" height="8" fill="currentColor"/>`
    + `<rect x="3" y="6" width="70" height="44" rx="12" fill="#fff" stroke="currentColor" stroke-width="2.4"/><rect x="73" y="23" width="5" height="9" rx="1.5" fill="currentColor"/>`
    + '<circle cx="11" cy="14" r="1.7" fill="currentColor"/><circle cx="65" cy="14" r="1.7" fill="currentColor"/><circle cx="11" cy="42" r="1.7" fill="currentColor"/><circle cx="65" cy="42" r="1.7" fill="currentColor"/>'
    + `<rect x="13" y="15" width="50" height="26" rx="8" fill="#fff" stroke="currentColor" stroke-width="1.8"/>${t}</g>`;
}

const BODY: Record<GriidIconId, string> = {
  // tire: black disc with white wire-wheel spokes in the middle (no sponsor lettering)
  warmup: '<circle cx="16" cy="16" r="14" fill="currentColor"/><circle cx="16" cy="16" r="8.6" fill="none" stroke="#fff" stroke-width="1"/>' + spokes() + '<circle cx="16" cy="16" r="1.8" fill="#fff"/>',
  calibration: gauge(),
  // hourglass, grey sand in the top bulb with a trickle (full) or collected at the bottom (empty)
  'transit-begin': glass + `<path d="M11.5 5.5H20.5C20 9 17.5 11 16 13C14.5 11 12 9 11.5 5.5Z" fill="${SAND}"/><path d="M16 13V25" stroke="${SAND}" stroke-width="0.8"/><path d="M12 28.5H20C19 26.5 17.5 25.5 16 25C14.5 25.5 13 26.5 12 28.5Z" fill="${SAND}"/>`,
  'transit-end': glass + `<path d="M11.5 28H20.5C20 24 17.5 22 16 19.5C14.5 22 12 24 11.5 28Z" fill="${SAND}"/>`,
  // free zone: the camcorder inside a circle with a diagonal slash on begin, the plain camcorder on end
  'freezone-begin': '<circle cx="16" cy="16" r="14.2" fill="none" stroke="currentColor" stroke-width="2.4"/>' + camcorder('transform="translate(4.4 4.4) scale(0.72)"') + '<path d="M6.2 6.2L25.8 25.8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  'freezone-end': camcorder(),
  // the watch in a circle with a slash (Column C)
  'end-timed': '<circle cx="42" cy="28" r="26" fill="#fff" stroke="currentColor" stroke-width="3"/>' + watch(null, 0.62) + '<path d="M23.6 9.6L60.4 46.4" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>',
  restart: watch(null),
  // cup and saucer
  pit: '<path d="M6 10H21V17C21 21 18 24 13.5 24C9 24 6 21 6 17Z" ' + S + '/><path d="M21 12H24C26.5 12 26.5 18 23 18H21" ' + S + '/><path d="M4 28H24" ' + S + '/><path d="M10 4C9 6 11 6 10 8M15 4C14 6 16 6 15 8" ' + S + '/>',
  // crossed knife and fork (an X), outlined
  meal: '<g transform="rotate(-32 16 16)"><path d="M10.5 2V10C10.5 13 13 14 13 14V30M13 2V10M15.5 2V10C15.5 13 13 14 13 14" ' + S + ' stroke-width="1.6"/></g>'
    + '<g transform="rotate(32 16 16)"><path d="M19 30V16C16.5 15 15.5 9 16.5 3C19.5 4 21.5 8 21.5 13V16" fill="#fff" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></g>',
  // grey line-drawn pump with display panel and hose
  refuel: '<g opacity="0.75"><rect x="5" y="5" width="14" height="23" rx="2" ' + S + '/><rect x="8" y="8" width="8" height="6" ' + S + ' stroke-width="1.4"/><path d="M19 11H23C25.5 11 25.5 13 25.5 15V22C25.5 25 29 25 29 22V11L26 7" ' + S + ' stroke-width="1.6"/><path d="M3 28.5H21" ' + S + '/></g>',
  // a man, a small outhouse (pointed roof, door with a crescent) and a woman, in a row
  rest: '<g fill="currentColor"><circle cx="10" cy="6" r="3.2"/><path d="M5.5 11H14.5L15.5 20H13V30H11V21H9V30H7V20H4.5Z"/>'
    + '<path d="M26 11L36 3L46 11Z"/></g><rect x="27.5" y="11.5" width="17" height="18.5" fill="#fff" stroke="currentColor" stroke-width="1.8"/><path d="M33 16H39V28H33Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M35.2 19.5A1.7 1.7 0 1 0 36.8 22.6A2.3 2.3 0 0 1 35.2 19.5Z" fill="currentColor"/>'
    + '<g fill="currentColor"><circle cx="62" cy="6" r="3.2"/><path d="M62 10L57.5 21H60V30H64V21H66.5Z"/></g>',
  // checkered flag
  finish: '<path d="M6 29V3" ' + S + '/>' + checkers(),
};

function checkers(): string {
  let s = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) s += `<rect x="${8 + c * 4.2}" y="${4 + r * 4.2}" width="4.2" height="4.2" fill="currentColor"/>`;
  return s + '<rect x="8" y="4" width="21" height="16.8" fill="none" stroke="currentColor" stroke-width="1.4"/>';
}

/** One pictogram, `size` px tall (a speedometer or a restroom row is wider); `data-sym` carries the symbol id (tests and e2e look for it). A restart watch can carry the time inside it. */
export function griidIcon(sym: GriidIconId, size = 28, opts: { time?: string } = {}): string {
  const [vw, vh] = VIEW[sym] ?? [32, 32];
  const body = sym === 'restart' && opts.time ? watch(opts.time) : BODY[sym];
  return `<svg class="gicon gicon-${sym}" data-sym="${sym}" viewBox="0 0 ${vw} ${vh}" width="${Math.round(size * vw / vh)}" height="${size}" role="img" aria-label="${SYMBOL_LABEL[sym]}"><title>${SYMBOL_LABEL[sym]}</title>${body}</svg>`;
}

/** The odometer box under a begin symbol: four SEPARATE small squares (thin border, one digit each, a gap between), the fourth (tenths) solid black with a white digit (11a: Column B). */
export function odometerHtml(box: string): string {
  const d = box.padStart(4, '0').slice(-4).split('');
  const miles = (Number(box) / 10).toFixed(1);
  return `<span class="odo" data-odo="${box}" title="about ${miles} miles" aria-label="odometer box ${box}, about ${miles} miles">${d.map((c, i) => `<i${i === 3 ? ' class="tenths"' : ''}>${c}</i>`).join('')}</span>`;
}
