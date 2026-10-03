/** GRIID book rows (UI-005). Columns: # | A cameo/text | B section symbol | C speed & timing | D hints. */
import type { Instruction, Section } from '../../core/course.js';

export type RowState = 'past' | 'prev' | 'current' | 'next' | 'far';

export interface BookRow {
  n: number;
  nodeId: string;
  text: string;
  colB: string;
  colC: string;
  colD: string;
  isCurrent: boolean;
  state: RowState;
  /** Distance in lines from the current one (negative = behind). */
  offset: number;
  turn?: Instruction['turn'];
  speed?: number;
  pause?: number;
  timed?: Instruction['timed'];
  perfectCumulative?: number;
}

const SECTION_SYMBOL: Record<Section, string> = {
  warmup: 'W', calibration: 'CAL', start: 'START', transit: 'TRANSIT', freezone: 'FREE', lunch: 'LUNCH', refuel: 'FUEL', pit: 'PIT', finish: 'FINISH', restart: 'RESTART',
};

export function fmtMMSS(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Column C text: "35", "P15", "35 P15", "30 for 0:36 then 40", "P15 30 for 0:36 then 40". */
export function columnC(ins: Partial<Instruction> | undefined | null): string {
  if (!ins) return '';
  const parts: string[] = [];
  if (ins.timed && Number.isFinite(ins.timed.holdSpeed)) {
    if (ins.pause) parts.push(`P${ins.pause}`);
    parts.push(`${ins.timed.holdSpeed} for ${fmtMMSS(ins.timed.seconds)} then ${ins.timed.thenSpeed}`);
    return parts.join(' ');
  }
  if (typeof ins.speed === 'number') parts.push(`${ins.speed}`);
  if (typeof ins.pause === 'number' && ins.pause > 0) parts.push(`P${ins.pause}`);
  return parts.join(' ');
}

export function bookRows(book: Instruction[] | undefined | null, currentLine: number): BookRow[] {
  const b = Array.isArray(book) ? book : [];
  if (!b.length) return [];
  const cur = Math.min(b.length, Math.max(1, Math.round(Number.isFinite(currentLine) ? currentLine : 1)));
  return b.map((ins, i) => {
    const n = typeof ins.n === 'number' ? ins.n : i + 1;
    const offset = n - cur;
    const state: RowState = offset === 0 ? 'current' : offset === -1 ? 'prev' : offset < 0 ? 'past' : offset <= 2 ? 'next' : 'far';
    return {
      n, nodeId: ins.nodeId ?? '', text: ins.text ?? '', colB: ins.section ? (SECTION_SYMBOL[ins.section] ?? '') : '', colC: columnC(ins), colD: ins.hint ?? '',
      isCurrent: offset === 0, state, offset, turn: ins.turn, speed: ins.speed, pause: ins.pause, timed: ins.timed, perfectCumulative: ins.perfectCumulative,
    };
  });
}
