/** Car performance table math: measured by simulating the car model. DESIGN §12. */
import { Car } from './car.js';
import type { CarSpec } from './course.js';
import { mphToFps } from './units.js';

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

/**
 * Time lost by a full stop from vIn and re-acceleration to vOut with ZERO dwell,
 * compared with the ghost car (which changes speed instantly at the stop line).
 */
export function stopLoss(vIn: number, vOut: number, car: CarSpec): number {
  const c = new Car(car); c.v = mphToFps(vIn); c.mode = 'cruise';
  const vi = mphToFps(vIn), vo = mphToFps(vOut);
  const line = 3000; // far enough to brake
  let t = 0;
  // approach and stop at the line
  while (c.mode !== 'stopped' && t < 200) { c.step(DT, vi, line); t += DT; }
  const sStop = c.s;
  // accelerate to vOut
  while (c.v < vo - 0.15 && t < 400) { c.step(DT, vo, null); t += DT; }
  // continue a little at vOut to be safe, then compare with ghost: ghost spends (line/vi) + ((c.s - line)/vo)
  const ghost = line / vi + (c.s - line) / vo;
  void sStop;
  return t - ghost;
}

/** Time lost accelerating from a standstill to vOut versus a ghost already at speed (the start-line loss). */
export function accelLoss(vOut: number, car: CarSpec): number {
  const c = new Car(car); c.mode = 'stopped';
  const vo = mphToFps(vOut); let t = 0;
  while (c.v < vo - 0.15 && t < 400) { c.step(DT, vo, null); t += DT; }
  return t - c.s / vo;
}

/** Dwell to hold at a Pause so that pause == stopLoss + dwell. */
export function dwellFor(pause: number, vIn: number, vOut: number, car: CarSpec): number {
  return Math.max(0, pause - stopLoss(vIn, vOut, car));
}

/** Time lost slowing for a turn of a given angle band and re-accelerating. */
export function turnLoss(angleAbs: number, vIn: number, vOut: number, car: CarSpec): number {
  const cap = angleAbs > 120 ? car.turnSpeedMph.acute : angleAbs >= 60 ? car.turnSpeedMph.turn : car.turnSpeedMph.bear;
  if (cap >= Math.min(vIn, vOut)) return 0;
  const c = new Car(car); c.v = mphToFps(vIn); c.mode = 'cruise';
  const vi = mphToFps(vIn), vo = mphToFps(vOut), vc = mphToFps(cap);
  let t = 0;
  // decelerate to cap
  while (c.v > vc + 0.15 && t < 100) { c.step(DT, vc, null); t += DT; }
  const sTurn = c.s;
  // 60 ft of turn at cap
  while (c.s < sTurn + 60) { c.step(DT, vc, null); t += DT; }
  while (c.v < vo - 0.15 && t < 300) { c.step(DT, vo, null); t += DT; }
  const ghost = sTurn / vi + (c.s - sTurn) / vo;
  return t - ghost;
}

export interface PerfTable { stop: Record<string, number>; lead: Record<string, number>; turn: Record<string, number> }
export const SPEEDS = [20, 25, 30, 35, 40, 45, 50];

export function buildPerfTable(car: CarSpec): PerfTable {
  const stop: Record<string, number> = {}, lead: Record<string, number> = {}, turn: Record<string, number> = {};
  for (const v of SPEEDS) {
    for (const w of SPEEDS) {
      stop[`${v}>${w}`] = round1(stopLoss(v, w, car));
      if (v !== w) lead[`${v}>${w}`] = round1(rampLead(v, w, car));
      turn[`90:${v}>${w}`] = round1(turnLoss(90, v, w, car));
      turn[`45:${v}>${w}`] = round1(turnLoss(45, v, w, car));
    }
  }
  return { stop, lead, turn };
}
function round1(x: number): number { return Math.round(x * 10) / 10; }
