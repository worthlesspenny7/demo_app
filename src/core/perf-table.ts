/** Car performance table math: measured by simulating the car model, or read from the car's own tables. DESIGN §12, CHART-001..003. */
import { Car } from './car.js';
import type { CarSpec, Matrix } from './course.js';
import { mphToFps } from './units.js';

export type { Matrix } from './course.js';

const DT = 0.05;

/** Seconds to ramp from v1 to v2 mph (either direction) with the preset ramps. */
export function rampTime(v1: number, v2: number, car: CarSpec): number {
  const c = new Car(car); c.v = mphToFps(v1); c.mode = 'cruise';
  const target = mphToFps(v2); let t = 0;
  while (Math.abs(c.v - target) > 0.15 && t < 120) { c.step(DT, target, null); t += DT; }
  return t;
}

/** Half the ramp time: how early to begin a speed change so the ramp is centered on the ideal instant. */
export function rampLead(v1: number, v2: number, car: CarSpec): number { return rampTime(v1, v2, car) / 2; }

// ---------- matrix lookup (handbook layout) ----------

function bracket(speeds: number[], x: number): [number, number, number] {
  if (x <= speeds[0]!) return [0, 0, 0];
  const last = speeds.length - 1;
  if (x >= speeds[last]!) return [last, last, 0];
  let i = 0; while (i < last && speeds[i + 1]! <= x) i++;
  return [i, i + 1, (x - speeds[i]!) / (speeds[i + 1]! - speeds[i]!)];
}
/** Bilinear lookup of a chart cell for any IN / OUT speed (clamped to the printed range). */
export function matrixAt(m: Matrix, vIn: number, vOut: number): number {
  const [i0, i1, fi] = bracket(m.speeds, vIn), [j0, j1, fj] = bracket(m.speeds, vOut);
  const g = (i: number, j: number): number => m.rows[m.speeds[i]!]![m.speeds[j]!]!;
  const top = g(i0, j0) * (1 - fj) + g(i0, j1) * fj, bot = g(i1, j0) * (1 - fj) + g(i1, j1) * fj;
  return top * (1 - fi) + bot * fi;
}

// ---------- model-driven losses ----------

/**
 * Time lost changing speed from vFrom to vTo (mph) compared with the ghost, which changes instantly at the line.
 * vFrom = 0 is a start from rest, vTo = 0 a stop at the line. Table-driven cars read their accel/decel chart instead.
 */
export function speedChangeLoss(vFrom: number, vTo: number, car: CarSpec): number {
  if (car.tables) return vFrom === vTo ? 0 : matrixAt(car.tables.accel, vFrom, vTo);
  if (vFrom === vTo) return 0;
  const c = new Car(car);
  if (vTo === 0) {
    const vi = mphToFps(vFrom); const line = 3000; let t = 0;
    c.v = vi; c.mode = 'cruise';
    while ((c.mode as string) !== 'stopped' && t < 600) { c.step(DT, vi, line); t += DT; }
    return t - line / vi;
  }
  const vt = mphToFps(vTo); let t = 0;
  c.v = mphToFps(vFrom); c.mode = vFrom === 0 ? 'stopped' : 'cruise';
  while (Math.abs(c.v - vt) > 0.15 && t < 400) { c.step(DT, vt, null); t += DT; }
  return vTo > vFrom ? t - c.s / vt : t - c.s / mphToFps(vFrom);
}

/**
 * Time lost by a full stop from vIn and re-acceleration to vOut with ZERO dwell,
 * compared with the ghost car (which changes speed instantly at the stop line).
 * Table-driven cars: 15 s minus the printed stop & go pause for the pair.
 */
export function stopLoss(vIn: number, vOut: number, car: CarSpec, turnCapMph?: number): number {
  if (car.tables) return 15 - matrixAt(car.tables.stopGo, vIn, vOut);
  const c = new Car(car); c.v = mphToFps(vIn); c.mode = 'cruise';
  const vi = mphToFps(vIn), vo = mphToFps(vOut);
  const line = 3000; // far enough to brake
  let t = 0;
  // approach and stop at the line
  while ((c.mode as string) !== 'stopped' && t < 600) { c.step(DT, vi, line); t += DT; }
  // accelerate to vOut (capped through the 60 ft turn zone if turning)
  const cap = turnCapMph !== undefined ? mphToFps(turnCapMph) : Infinity;
  while (c.v < vo - 0.15 && t < 400) { c.step(DT, c.s < line + 60 ? Math.min(vo, cap) : vo, null); t += DT; }
  // continue a little at vOut to be safe, then compare with ghost: ghost spends (line/vi) + ((c.s - line)/vo)
  const ghost = line / vi + (c.s - line) / vo;
  return t - ghost;
}

/** Time lost accelerating from a standstill to vOut versus a ghost already at speed (the start-line loss). */
export function accelLoss(vOut: number, car: CarSpec): number {
  if (car.tables) return matrixAt(car.tables.accel, 0, vOut);
  const c = new Car(car); c.mode = 'stopped';
  const vo = mphToFps(vOut); let t = 0;
  while (c.v < vo - 0.15 && t < 400) { c.step(DT, vo, null); t += DT; }
  return t - c.s / vo;
}

/** Dwell to hold at a Pause so that pause == stopLoss + dwell. */
export function dwellFor(pause: number, vIn: number, vOut: number, car: CarSpec, turnCapMph?: number): number {
  return Math.max(0, pause - stopLoss(vIn, vOut, car, turnCapMph));
}

/** Apex speed (mph) of a turn of this angle band for the car (CHART-003). */
export function apexSpeed(angleAbs: number, car: CarSpec): number {
  return angleAbs > 120 ? car.turnSpeedMph.acute : angleAbs >= 60 ? car.turnSpeedMph.turn : car.turnSpeedMph.bear;
}

/**
 * Time lost slowing for a turn of a given angle band and re-accelerating. Model cars: slow to the apex speed, hold it through the
 * turn zone, accelerate (what the simulated driver does). Table-driven cars: braking IN->apex plus acceleration apex->OUT from the
 * chart (the Packard's "turns" chart for the 15 mph apex).
 */
export function turnLoss(angleAbs: number, vIn: number, vOut: number, car: CarSpec): number {
  const cap = apexSpeed(angleAbs, car);
  if (car.tables) {
    if (cap === 15 && vIn >= 15 && vOut >= 15) return matrixAt(car.tables.turns, vIn, vOut);
    const ap = Math.min(cap, vIn, vOut);
    return matrixAt(car.tables.accel, vIn, ap) + matrixAt(car.tables.accel, ap, vOut);
  }
  // PLAY-009: at or below the apex speed the turn itself costs nothing, but the IN -> OUT change still does (the ghost changes instantly): chart (c)'s 10 mph row is not all zeros
  if (cap >= Math.min(vIn, vOut)) return vIn === vOut ? 0 : speedChangeLoss(vIn, vOut, car);
  const c = new Car(car); c.v = mphToFps(vIn); c.mode = 'cruise';
  const vi = mphToFps(vIn), vo = mphToFps(vOut), vc = mphToFps(cap);
  let t = 0;
  // decelerate to cap
  while (c.v > vc + 0.15 && t < 100) { c.step(DT, vc, null); t += DT; }
  const sTurn = c.s;
  // the turn zone at cap
  const zone = car.turnZoneFt ?? 60;
  while (c.s < sTurn + zone) { c.step(DT, vc, null); t += DT; }
  while (c.v < vo - 0.15 && t < 300) { c.step(DT, vo, null); t += DT; }
  const ghost = sTurn / vi + (c.s - sTurn) / vo;
  return t - ghost;
}

// ---------- the three handbook charts (CHART-001) ----------

export interface PerfTable {
  /** (a) ACCELERATION - DECELERATION net time lost: start speed rows x end speed columns, including 0 (diagonal 0). */
  accel: Matrix;
  /** (b) STOP & GO pause times for a 15 s stop: IN rows x OUT columns (seconds to sit stationary). */
  stopGo: Matrix;
  /** (c) TURNS time lost: IN rows x OUT columns for the car's apex speed. */
  turns: Matrix;
  /** SPEED-001: the speeds (mph, ascending) the charts cover: 10..55 for a model car, the table's own speeds (Packard 15..55) for a table-driven one. */
  speeds: number[];
  /** SPEED-001: speeds that are extrapolated, not printed (Packard 55). Empty for model cars. */
  extrapolated: number[];
  /** Derived accessors (old layout): `${in}>${out}` -> stop loss; ramp lead; `${90|45}:${in}>${out}` -> turn loss. */
  stop: Record<string, number>;
  lead: Record<string, number>;
  turn: Record<string, number>;
}
/** Speeds of the model-driven charts (IN rows / OUT columns). */
/** SPEED-001: 10 to 55 mph in steps of 5, plus the 12 mph row the real charts carry (11a: the rows run 55 ... 15, 12, 10) and the 48 mph row generated books assign (PLAY-009). */
export const CHART_SPEEDS = [10, 12, 15, 20, 25, 30, 35, 40, 45, 48, 50, 55];
/** Speeds used by the older reference tables. */
export const SPEEDS = [20, 25, 30, 35, 40, 45, 50];

const tableCache = new WeakMap<CarSpec, PerfTable>();

export function buildPerfTable(car: CarSpec): PerfTable {
  const cached = tableCache.get(car); if (cached) return cached;
  let accel: Matrix, stopGo: Matrix, turns: Matrix;
  if (car.tables) { accel = car.tables.accel; stopGo = car.tables.stopGo; turns = car.tables.turns; }
  else {
    const sp = CHART_SPEEDS, ap = [0, ...CHART_SPEEDS];
    accel = { speeds: ap, rows: {} }; stopGo = { speeds: sp, rows: {} }; turns = { speeds: sp, rows: {} };
    for (const r of ap) { accel.rows[r] = {}; for (const c of ap) accel.rows[r]![c] = r === c ? 0 : round1(speedChangeLoss(r, c, car)); }
    for (const r of sp) {
      stopGo.rows[r] = {}; turns.rows[r] = {};
      for (const c of sp) {
        stopGo.rows[r]![c] = Math.max(0, round1(15 - (accel.rows[r]![0]!) - (accel.rows[0]![c]!)));
        turns.rows[r]![c] = round1(turnLoss(90, r, c, car));
      }
    }
  }
  const stop: Record<string, number> = {}, lead: Record<string, number> = {}, turn: Record<string, number> = {};
  for (const v of SPEEDS) {
    for (const w of SPEEDS) {
      stop[`${v}>${w}`] = round1(stopLoss(v, w, car));
      if (v !== w) lead[`${v}>${w}`] = round1(rampLead(v, w, car));
      turn[`90:${v}>${w}`] = round1(turnLoss(90, v, w, car));
      turn[`45:${v}>${w}`] = round1(turnLoss(45, v, w, car));
    }
  }
  const out: PerfTable = { accel, stopGo, turns, speeds: stopGo.speeds.slice(), extrapolated: [...(car.extrapolated ?? [])], stop, lead, turn };
  tableCache.set(car, out);
  return out;
}
function round1(x: number): number { return Math.round(x * 10) / 10; }
