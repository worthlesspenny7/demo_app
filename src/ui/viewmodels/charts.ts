/**
 * The three handbook performance charts as IN x OUT grids (UI-030, CHART-001/003). Pure view-model, no DOM.
 * (a) ACCELERATION - DECELERATION (includes 0), (b) STOP & GO PAUSE TIMES for a 15 s stop, (c) TURNS time lost.
 */
import type { CarSpec, Matrix } from '../../core/course.js';
import { buildPerfTable, matrixAt, stopLoss, speedChangeLoss, chartLead } from '../../core/perf-table.js';

export type ChartId = 'accel' | 'stopGo' | 'turns';
/**
 * One cell of a grid. `blank`: the grey diagonal of chart (a) (no value, shown empty); `unmeasured`: a cell the player has not measured yet (empty, not 0.0);
 * `neg`: a negative number, shown in the warning colour (an impossible loss: a discrepant run, "re-run and re-average", CHART-006).
 */
export interface ChartCell { out: number; value: number; text: string; hi: boolean; blank?: boolean; unmeasured?: boolean; neg?: boolean }
export interface ChartRow { in: number; cells: ChartCell[] }
export interface ChartGrid {
  id: ChartId; letter: 'a' | 'b' | 'c'; title: string; note: string;
  /** The printed axis labels (CHART-001): accel chart "BRAKING" down the side and "ACCELERATION" across the top; the pause and turn charts "IN speed" and "OUT speed". */
  rowAxis: string; colAxis: string;
  /** The sheet's footnotes, verbatim (CHART-001, 11c section 3.3). */
  footnotes: string[];
  /** Column (OUT) speeds; the row (IN) speeds are the same list. */
  speeds: number[]; rows: ChartRow[];
  /** The snapped (in, out) pair that is highlighted, or null. */
  highlight: { in: number; out: number } | null;
}

/** The X-Cup chart sheet's own words (11c section 3.3), kept verbatim: "alloted" is the sheet's spelling. */
export const CHART_FOOTNOTES = {
  accel: 'If 4.5 seconds are lost, start 4.5 seconds earlier',
  pause: ['Instead of pausing for alloted "15" seconds, pause for this amount of time', 'This accounts for accel/decel lost time as well.'],
  pauseFormula: '(START/STOP TIME)-(accel IN + accel OUT)',
} as const;

const TITLES: Record<ChartId, { letter: 'a' | 'b' | 'c'; title: string; note: string; rowAxis: string; colAxis: string; footnotes: string[] }> = {
  accel: { letter: 'a', title: 'Acceleration - deceleration', note: 'Net seconds lost changing speed IN to OUT (0 = from or to a standstill). The ghost changes speed instantly.', rowAxis: 'BRAKING', colAxis: 'ACCELERATION', footnotes: [CHART_FOOTNOTES.accel] },
  stopGo: { letter: 'b', title: 'Stop & go pause times', note: 'Seconds to sit still for a printed 15 s pause (P) with that IN speed and OUT speed.', rowAxis: 'IN speed', colAxis: 'OUT speed', footnotes: [...CHART_FOOTNOTES.pause, CHART_FOOTNOTES.pauseFormula] },
  turns: { letter: 'c', title: 'Turns', note: 'Seconds lost slowing for the turn and accelerating again, IN to OUT.', rowAxis: 'IN speed', colAxis: 'OUT speed', footnotes: [] },
};

const r1 = (x: number): number => Math.round(x * 10) / 10;
const snap = (speeds: number[], v: number): number => speeds.reduce((best, s) => (Math.abs(s - v) < Math.abs(best - v) ? s : best), speeds[0]!);

/** A cell's text: one decimal; a negative number keeps its sign and is flagged (it is in the warning colour). Blank and unmeasured cells print nothing. */
function cellOf(out: number, v: number | null, hi: boolean, blank: boolean): ChartCell {
  if (blank) return { out, value: 0, text: '', hi, blank: true };
  if (v === null || !Number.isFinite(v)) return { out, value: 0, text: '', hi, unmeasured: true };
  return { out, value: v, text: v.toFixed(1), hi, ...(v < 0 ? { neg: true } : {}) };
}

function gridOf(id: ChartId, m: Matrix, pair: { vIn: number; vOut: number } | null, values?: Record<string, number | null>): ChartGrid {
  const hi = pair ? { in: snap(m.speeds, pair.vIn), out: snap(m.speeds, pair.vOut) } : null;
  const rows: ChartRow[] = m.speeds.map(i => ({ in: i, cells: m.speeds.map(o => {
    const isHi = !!hi && hi.in === i && hi.out === o;
    // the grey diagonal of chart (a) has no value: a speed does not change to itself
    const v = values ? (values[`${i}>${o}`] ?? null) : (m.rows[i]?.[o] ?? 0);
    return cellOf(o, v, isHi, id === 'accel' && i === o);
  }) }));
  return { id, ...TITLES[id], speeds: m.speeds, rows, highlight: hi };
}

/**
 * The player's own chart (CHART-001, CHART-006): the same grid, with only the measured cells filled in (`values` keyed "in>out"); an unmeasured cell is blank, not 0.0,
 * and a negative derived cell is flagged in the warning colour. `speeds` are the chart's speeds (accel: with 0).
 */
export function playerGrid(id: ChartId, speeds: number[], values: Record<string, number | null>): ChartGrid {
  const rows: Record<number, Record<number, number>> = {}; for (const i of speeds) { rows[i] = {}; for (const o of speeds) rows[i]![o] = 0; }
  return gridOf(id, { speeds, rows }, null, values);
}
/** True when any cell of the grid is negative: the sheet's warning ("check for large discrepancies in each speed run"). */
export const gridHasNegative = (g: ChartGrid): boolean => g.rows.some(r => r.cells.some(c => c.neg));

/** The three charts for a car, with the current (IN, OUT) pair highlighted in each (accel: a start from rest highlights row 0). */
/** PLAY-009: a chart that does not print 48 mph (the Packard's 15-50 table) gets a 48 row and column interpolated between its 45 and 50 cells. */
export function with48(m: Matrix): Matrix {
  if (m.speeds.includes(48) || !m.speeds.includes(45) || !m.speeds.includes(50)) return m;
  const speeds = [...m.speeds, 48].sort((a, b) => a - b); const rows: Matrix['rows'] = {};
  for (const i of speeds) { rows[i] = {}; for (const o of speeds) rows[i]![o] = m.rows[i]?.[o] ?? Math.round(matrixAt(m, i, o) * 10) / 10; }
  return { speeds, rows };
}
export function chartGrids(car: CarSpec, pair: { vIn: number | null; vOut: number | null } | null = null): ChartGrid[] {
  const t0 = buildPerfTable(car);
  const t = car.tables ? { ...t0, accel: with48(t0.accel), stopGo: with48(t0.stopGo), turns: with48(t0.turns) } : t0;
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

// ---------- CHART-007: the simple chart (Navigating 101) ----------

/** The speeds of the simple chart: 55, 50, 48, 45, 40, 35, 30, 25, 20, 15, 12, 10 (11a section 2.2). */
export const SIMPLE_CHART_SPEEDS = [55, 50, 48, 45, 40, 35, 30, 25, 20, 15, 12, 10] as const;
export type SimpleColumn = 'Dec' | 'Acc' | 'S/G' | 'TS/G' | 'T@15' | 'T@20' | 'Lead';
export interface SimpleChartRow {
  speed: number;
  /** Time lost braking to a stop, accelerating from a stop, their sum, and the loss of a turn taken at 15 / 20 mph (null: N/A, the approach speed is at or below the turn speed). */
  dec: number; acc: number; sg: number;
  /** PT-11 N-D1: the Lead column: half the ramp time for a 10 mph change from this speed, up (row speed to +10) and down (to -10); null off the chart */
  leadUp: number | null; leadDown: number | null; /** PT-10 N-C5: a stop and go that turns 90 degrees out of the stop (the car leaves at its turn speed); null for a table car (the Packard prints none) */ tsg: number | null; t15: number | null; t20: number | null;
  /** The printed texts: one decimal, "+x.x" for a gain (a negative loss), "N/A". */
  text: Record<SimpleColumn, string>;
}
export interface SimpleChart { speeds: number[]; columns: SimpleColumn[]; /** the car has a T@20 column (a model-driven car; the Packard booklet prints only the 15 mph turn) */ hasT20: boolean; /** the car has a turning-stop column (a model-driven car) */ hasTS: boolean; rows: SimpleChartRow[]; note: string }

/** PT-11 N-D1: what the Lead column means, in the card's words. */
export const LEAD_NOTE = 'Lead: half the ramp time, the seconds to call a speed change early so the car crosses the sign (or ends the timed count) at the midpoint speed; read the row of the speed you are at: ↑ for 10 mph up, ↓ for 10 mph down (30 → 40: row 30, ↑).';
/** PT-11 N-D1: where the card sends a Silver navigator for the lead of a pair: the row he is at and the arrow. */
export function leadSource(from: number, to: number): string {
  const d = to - from; const arrow = d > 0 ? '↑' : '↓';
  if (Math.abs(d) === 10) return `simple chart, Lead column, row ${from}, ${arrow}`;
  if (Math.abs(d) % 10 === 0) { const steps: number[] = []; for (let v = from; d > 0 ? v < to : v > to; v += d > 0 ? 10 : -10) steps.push(v); return `simple chart, Lead column: add the ${arrow} figures of rows ${steps.join(' and ')}`; }
  return `simple chart, Lead column, row ${from}, ${arrow} (that figure is for 10 mph: for a ${Math.abs(d)} mph change take about ${Math.abs(d) < 10 ? 'half' : 'one and a half times'} of it)`;
}
/** A time lost as the simple chart prints it: "3.7"; a gain (negative loss) as "+0.3"; null as "N/A". */
export function formatLoss(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return 'N/A';
  const r = Math.round(v * 10) / 10;
  return r < 0 ? `+${Math.abs(r).toFixed(1)}` : r.toFixed(1);
}

/**
 * The simple chart a navigator keeps on the lapboard (11a: "Navigating 101"): Speed | Dec | Acc | S/G | T@15 (| T@20), derived from the car model. Dec = time lost braking to
 * a stop, Acc = time lost accelerating from a stop, S/G (stop and go) = Dec + Acc (exactly, as printed), T@15 / T@20 = time lost in a turn made at 15 / 20 mph apex speed
 * (slowing to the apex and speeding up again; N/A when the approach speed is at or below the apex).
 */
export function simpleChart(car: CarSpec): SimpleChart {
  const r1 = (x: number): number => Math.round(x * 10) / 10;
  const hasT20 = !car.tables; const hasTS = !car.tables;
  const turn = (v: number, apex: number): number | null => (v < apex ? null : r1(speedChangeLoss(v, apex, car) + speedChangeLoss(apex, v, car)));
  const rows: SimpleChartRow[] = SIMPLE_CHART_SPEEDS.map(speed => {
    const dec = r1(speedChangeLoss(speed, 0, car)), acc = r1(speedChangeLoss(0, speed, car)), sg = r1(dec + acc);
    const tsg = hasTS ? r1(stopLoss(speed, speed, car, car.turnSpeedMph.turn)) : null;   // stop & go through a 90 degree turn: brake to a stop, turn out at the car's turn speed, accelerate
    const t15 = turn(speed, 15), t20 = hasT20 ? turn(speed, 20) : null;
    const leadUp = speed + 10 <= 55 && speed !== 12 ? chartLead(speed, speed + 10, car) : null, leadDown = speed - 10 >= 10 ? chartLead(speed, speed - 10, car) : null;
    const leadText = `${leadUp === null ? '' : `↑${leadUp.toFixed(1)}`}${leadUp !== null && leadDown !== null ? ' ' : ''}${leadDown === null ? '' : `↓${leadDown.toFixed(1)}`}` || 'N/A';
    return { speed, dec, acc, sg, leadUp, leadDown, tsg, t15, t20, text: { Dec: formatLoss(dec), Acc: formatLoss(acc), 'S/G': formatLoss(sg), 'TS/G': hasTS ? formatLoss(tsg) : '', 'T@15': formatLoss(t15), 'T@20': hasT20 ? formatLoss(t20) : '', Lead: leadText } };
  });
  const columns: SimpleColumn[] = ['Dec', 'Acc', 'S/G', ...(hasTS ? ['TS/G' as const] : []), 'T@15', ...(hasT20 ? ['T@20' as const] : []), 'Lead'];
  return { speeds: [...SIMPLE_CHART_SPEEDS], columns, hasT20, hasTS, rows, note: `Dec: seconds lost braking to a stop. Acc: seconds lost accelerating from a stop. S/G: stop and go = Dec + Acc. TS/G: a stop and go that turns 90 degrees out of the stop (the car leaves at its turn speed, so it costs more than S/G). T@15 / T@20: seconds lost in a turn made at 15 / 20 mph. "+" is a gain. ${LEAD_NOTE}` };
}
