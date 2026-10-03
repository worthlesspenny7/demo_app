/** Column B pictograms of the GRIID book (GRIID-003, UI-029) as small inline SVG strings. No DOM needed. */
import type { ColumnBSymbol, ColumnCIcon } from '../../core/griid.js';

/** Every pictogram the book draws: Column B symbols and the two Column C watch faces. */
export type GriidIconId = ColumnBSymbol | ColumnCIcon;

export const SYMBOL_LABEL: Record<GriidIconId, string> = {
  warmup: 'Tire warm-up',
  calibration: 'Speedometer calibration run begins',
  'transit-begin': 'Transit begins (full hourglass)',
  'transit-end': 'Transit ends (empty hourglass)',
  'freezone-begin': 'Free zone begins (crossed-out camera)',
  'freezone-end': 'Free zone ends (camera)',
  'end-timed': 'End timed portion (crossed-out watch, Column C)',
  restart: 'Time-of-day restart (watch face, Column C)',
  pit: 'Hosted pit stop (cup)',
  meal: 'Meal stop (knife and fork)',
  refuel: 'Refuel (pump)',
  rest: 'Rest stop (restroom figures)',
  ta: 'Time Allowance point (yellow box)',
  finish: 'Finish line, Observation Checkpoint (checkered flag)',
};

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const CROSS = '<path d="M5 27 L27 5" stroke="#d6453d" stroke-width="3" stroke-linecap="round" fill="none"/>';

const camera = '<rect x="4" y="10" width="24" height="15" rx="2.5" ' + S + '/><circle cx="16" cy="17.5" r="4.5" ' + S + '/><path d="M10 10 L12 6 H20 L22 10" ' + S + '/>';

const BODY: Record<GriidIconId, string> = {
  // tire: heavy outer ring, hub, a few tread ticks
  warmup: '<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="5" fill="none"/><circle cx="16" cy="16" r="4.5" ' + S + '/><path d="M16 4 V1.5 M16 30.5 V28 M4 16 H1.5 M30.5 16 H28" ' + S + '/>',
  // speedometer face: dial arc, ticks, needle
  calibration: '<path d="M4 24 A12 12 0 1 1 28 24" ' + S + '/><path d="M16 8 V10 M8.5 11.5 L10 13 M23.5 11.5 L22 13 M5.5 19 H7.5 M26.5 19 H24.5" ' + S + '/><path d="M16 22 L22 13" stroke="#d6453d" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="16" cy="22" r="2" fill="currentColor"/>',
  // hourglass, sand in the top bulb (full) or in the bottom (empty)
  'transit-begin': '<path d="M8 4 H24 M8 28 H24 M10 4 C10 12 16 14 16 16 C16 18 10 20 10 28 M22 4 C22 12 16 14 16 16 C16 18 22 20 22 28" ' + S + '/><path d="M11.5 5.5 H20.5 C20 9 17.5 11 16 13 C14.5 11 12 9 11.5 5.5 Z" fill="currentColor"/>',
  'transit-end': '<path d="M8 4 H24 M8 28 H24 M10 4 C10 12 16 14 16 16 C16 18 10 20 10 28 M22 4 C22 12 16 14 16 16 C16 18 22 20 22 28" ' + S + '/><path d="M11.5 26.5 H20.5 C20 23 17.5 21 16 19 C14.5 21 12 23 11.5 26.5 Z" fill="currentColor"/>',
  'freezone-begin': camera + CROSS,
  'freezone-end': camera,
  'end-timed': '<circle cx="16" cy="16" r="12" ' + S + '/><path d="M16 9 V16 L21 19" ' + S + '/>' + CROSS,
  // watch face with the hands and the twelve ticks (Column C, over the time of day and the speed)
  restart: '<circle cx="16" cy="16" r="12" ' + S + '/><path d="M16 5.5 V8 M16 24 V26.5 M5.5 16 H8 M24 16 H26.5" ' + S + '/><path d="M16 16 V9.5 M16 16 L21 19" ' + S + '/><circle cx="16" cy="16" r="1.6" fill="currentColor"/>',
  // cup and saucer
  pit: '<path d="M6 10 H21 V17 C21 21 18 24 13.5 24 C9 24 6 21 6 17 Z" ' + S + '/><path d="M21 12 H24 C26.5 12 26.5 18 23 18 H21" ' + S + '/><path d="M4 28 H24" ' + S + '/><path d="M10 4 C9 6 11 6 10 8 M15 4 C14 6 16 6 15 8" ' + S + '/>',
  // fork (left) and knife (right)
  meal: '<path d="M8 3 V11 M12 3 V11 M16 3 V11 M8 11 C8 15 16 15 16 11 M12 14 V29" ' + S + '/><path d="M24 29 V3 C20 6 20 14 24 17" ' + S + '/>',
  // fuel pump with hose and nozzle
  refuel: '<rect x="5" y="6" width="14" height="22" rx="2" ' + S + '/><rect x="8" y="9" width="8" height="6" ' + S + '/><path d="M19 12 H23 C25.5 12 25.5 14 25.5 16 V22 C25.5 25 29 25 29 22 V12 L26 8" ' + S + '/><path d="M3 28 H21" ' + S + '/>',
  // two restroom figures: trousers and skirt
  rest: '<circle cx="9" cy="6" r="2.6" fill="currentColor"/><path d="M9 10 V18 M5.5 12.5 H12.5 M9 18 V28 M6 28 V18" ' + S + '/><circle cx="23" cy="6" r="2.6" fill="currentColor"/><path d="M23 10 L18.5 21 H27.5 Z M20.5 21 V28 M25.5 21 V28" ' + S + '/><path d="M16 2 V30" stroke="currentColor" stroke-width="1" fill="none"/>',
  // yellow box
  ta: '<rect x="3" y="6" width="26" height="20" rx="2" fill="#f5d90a" stroke="#6b5d00" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="12" font-weight="800" font-family="sans-serif" fill="#2b2500">TA</text>',
  // checkered flag
  finish: '<path d="M6 29 V3" ' + S + '/>' + checkers(),
};

function checkers(): string {
  let s = '';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) s += `<rect x="${8 + c * 4.2}" y="${4 + r * 4.2}" width="4.2" height="4.2" fill="currentColor"/>`;
  return s + '<rect x="8" y="4" width="21" height="16.8" fill="none" stroke="currentColor" stroke-width="1.4"/>';
}

/** One pictogram (Column B symbol or Column C watch face), 28 px by default; `data-sym` carries the symbol id (tests and e2e look for it). */
export function griidIcon(sym: GriidIconId, size = 28): string {
  return `<svg class="gicon" data-sym="${sym}" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${SYMBOL_LABEL[sym]}"><title>${SYMBOL_LABEL[sym]}</title>${BODY[sym]}</svg>`;
}

/** The 4-digit tenths-of-a-mile odometer box: three white digit boxes and the black tenths box (HB App. D). */
export function odometerHtml(box: string): string {
  const d = box.padStart(4, '0').slice(-4).split('');
  const miles = (Number(box) / 10).toFixed(1);
  return `<span class="odo" data-odo="${box}" title="about ${miles} miles" aria-label="odometer box ${box}, about ${miles} miles">${d.map((c, i) => `<i${i === 3 ? ' class="tenths"' : ''}>${c}</i>`).join('')}</span>`;
}
