/** Card "~N min": computed from the 1x ghost time of the scenario (perfect times) plus the pre-read, not a hand-typed guess. */
import type { Scenario } from '../../core/course.js';
import type { Drill } from '../../core/drills/types.js';
import { buildGhost } from '../../core/ghost.js';

/** Pre-read time counted toward the estimate: the player reads the book, but long pre-reads (D12: 30 min) can be skipped. */
export const PREREAD_CAP_S = 5 * 60;

/** Minutes at 1x: the ghost's drive time from the official start (pauses and the lunch hold included) plus the capped pre-read. */
export function scenarioMinutes(sc: Scenario): number {
  const g = buildGhost(sc);
  const drive = Math.max(0, g.endTod - sc.startTime);
  const pre = Math.min(Math.max(0, sc.prereadSeconds || 0), PREREAD_CAP_S);
  return Math.max(1, Math.round((drive + pre) / 60));
}

const cache = new Map<string, number>();
/** Estimate for a drill card (seed 1, Bronze, which has the same course length as the other tiers); falls back to the drill's own guess. */
export function drillMinutes(d: Pick<Drill, 'id' | 'minutes' | 'kind' | 'scenario'>): number {
  if (d.kind === 'quiz' || d.kind === 'math') return d.minutes;   // decks, not drives
  const hit = cache.get(d.id); if (hit !== undefined) return hit;
  let m = d.minutes;
  try { m = scenarioMinutes(d.scenario(1, 0)); } catch { m = d.minutes; }
  cache.set(d.id, m);
  return m;
}

/** "~9 min", "~1 h 10 min", "~4 h 53 min". */
export function formatMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `~${h} h` : `~${h} h ${r} min`;
}
