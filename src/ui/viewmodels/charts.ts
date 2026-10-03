/**
 * The three handbook performance charts as IN x OUT grids (UI-030, CHART-001/003). Pure view-model, no DOM.
 * (a) ACCELERATION - DECELERATION (includes 0), (b) STOP & GO PAUSE TIMES for a 15 s stop, (c) TURNS time lost.
 */
import type { CarSpec, Matrix } from '../../core/course.js';
import { buildPerfTable, matrixAt, stopLoss } from '../../core/perf-table.js';

export type ChartId = 'accel' | 'stopGo' | 'turns';
export interface ChartCell { out: number; value: number; text: string; hi: boolean }
export interface ChartRow { in: number; cells: ChartCell[] }
export interface ChartGrid {
  id: ChartId; letter: 'a' | 'b' | 'c'; title: string; note: string;
  /** Column (OUT) speeds; the row (IN) speeds are the same list. */
  speeds: number[]; rows: ChartRow[];
  /** The snapped (in, out) pair that is highlighted, or null. */
  highlight: { in: number; out: number } | null;
}

const TITLES: Record<ChartId, { letter: 'a' | 'b' | 'c'; title: string; note: string }> = {
  accel: { letter: 'a', title: 'Acceleration - deceleration', note: 'Net seconds lost changing speed IN to OUT (0 = from or to a standstill). The ghost changes speed instantly.' },
  stopGo: { letter: 'b', title: 'Stop & go pause times', note: 'Seconds to sit still for a printed 15 s pause (P) with that IN speed and OUT speed.' },
  turns: { letter: 'c', title: 'Turns', note: 'Seconds lost slowing for the turn and accelerating again, IN to OUT.' },
};

const r1 = (x: number): number => Math.round(x * 10) / 10;
const snap = (speeds: number[], v: number): number => speeds.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), speeds[0]!);

function gridOf(id: ChartId, m: Matrix, pair: { vIn: number; vOut: number } | null): ChartGrid {
  const hi = pair ? { in: snap(m.speeds, pair.vIn), out: snap(m.speeds, pair.vOut) } : null;
  const rows: ChartRow[] = m.speeds.map(i => ({ in: i, cells: m.speeds.map(o => { const v = m.rows[i]?.[o] ?? 0; return { out: o, value: v, text: v.toFixed(1), hi: !!hi && hi.in === i && hi.out === o }; }) }));
  return { id, ...TITLES[id], speeds: m.speeds, rows, highlight: hi };
}

/** The three charts for a car, with the current (IN, OUT) pair highlighted in each (accel: a start from rest highlights row 0). */
export function chartGrids(car: CarSpec, pair: { vIn: number | null; vOut: number | null } | null = null): ChartGrid[] {
  const t = buildPerfTable(car);
  const vOut = pair?.vOut ?? null; const vIn = pair?.vIn ?? null;
  const p = vOut !== null ? { vIn: vIn !== null && vIn > 0 ? vIn : vOut, vOut } : null;
  const pa = vOut !== null ? { vIn: vIn ?? 0, vOut } : null;
  return [gridOf('accel', t.accel, pa), gridOf('stopGo', t.stopGo, p), gridOf('turns', t.turns, p)];
}

/** Chart (b) read for a stop: the pause time for a 15 s stop at this IN/OUT, and the sit time for the printed pause (chart + (pause - 15)). */
export function stopChartReading(car: CarSpec, vIn: number, vOut: number, pause = 15): { vIn: number; vOut: number; chart: number; pause: number; sit: number } {
  const chart = r1(Math.max(0, matrixAt(buildPerfTable(car).stopGo, vIn, vOut)));
  return { vIn, vOut, chart, pause, sit: r1(Math.max(0, chart + (pause - 15))) };
}

/**
 * Car loss of a stop, the number the book strip, the perf card and the Debrief all use. A straight stop reads chart (b) directly
 * (loss = 15 s minus the chart's pause time); a stop at a turn keeps the turn-capped model number.
 */
export function chartStopLoss(car: CarSpec, vIn: number, vOut: number, turnCapMph?: number): number {
  if (turnCapMph === undefined) return r1(Math.max(0, 15 - matrixAt(buildPerfTable(car).stopGo, vIn, vOut)));
  return r1(stopLoss(vIn, vOut, car, turnCapMph));
}

/** The 10 % rule (HB): to make up `lostSeconds`, drive 10 % above the assigned speed for ten times that many seconds. */
export function tenPercentRule(assignedMph: number, lostSeconds: number): { mph: number; seconds: number; text: string } {
  const mph = r1(assignedMph * 1.1); const seconds = Math.round(lostSeconds * 10);
  return { mph, seconds, text: `10 % rule: ${mph} mph for ${seconds} s makes up ${lostSeconds.toFixed(1)} s` };
}
