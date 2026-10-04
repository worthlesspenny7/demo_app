/** Curriculum order, the "Start here" path and next-drill lookup (UI-016). Pure: no DOM. */
import type { Drill } from '../../core/drills/types.js';

/** Order the drills are meant to be played in (the Home tracks, flattened). */
export const CURRICULUM: string[] = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D08b', 'D09', 'D10', 'D14', 'D15', 'D16', 'D17', 'D18', 'D11', 'D12', 'D13'];

export type StartStep = { kind: 'lesson'; id: string; label: string } | { kind: 'drill'; id: string; label: string };
/** First-run path: School lesson 1, then D01, D03, D04, D05, then the prerequisites of the first whole leg. */
export const START_PATH: StartStep[] = [
  { kind: 'lesson', id: 'ghost-car', label: 'School: the ghost car' },
  { kind: 'drill', id: 'D01', label: 'D01 Stopwatch on the landmark' },
  { kind: 'drill', id: 'D03', label: 'D03 Pause arithmetic' },
  { kind: 'drill', id: 'D04', label: 'D04 Timed speed changes' },
  { kind: 'drill', id: 'D05', label: 'D05 Speed changes at landmarks' },
  { kind: 'drill', id: 'D08', label: 'D08 Running early or late' },
  { kind: 'drill', id: 'D10', label: 'D10 Course following' },
  { kind: 'drill', id: 'D18', label: 'D18 Miniature leg' },
];

export interface StartPathState { step: StartStep; done: boolean; current: boolean }
export function startPathState(drillStars: Record<string, number>, lessonDone: (id: string) => boolean): StartPathState[] {
  let currentTaken = false;
  return START_PATH.map(step => {
    const done = step.kind === 'lesson' ? lessonDone(step.id) : (drillStars[step.id] ?? 0) >= 1;
    const current = !done && !currentTaken; if (current) currentTaken = true;
    return { step, done, current };
  });
}

/** The next playable drill after `id` in curriculum order (drive drills only), with its lock state. */
export function nextDrill(id: string, drills: Drill[], best: Record<string, number>): { drill: Drill; locked: boolean; needs: string } | null {
  const i = CURRICULUM.indexOf(id);
  for (let k = i + 1; k < CURRICULUM.length; k++) {
    const d = drills.find(x => x.id === CURRICULUM[k]);
    if (!d || d.kind !== 'drive') continue;
    const missing = d.unlock.filter(u => (best[u.drill] ?? 0) < u.stars);
    return { drill: d, locked: missing.length > 0, needs: `${missing.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ')} at Silver or Gold` };
  }
  return null;
}

/**
 * Stars that count toward unlocks (DRILL-004): the best at Silver or Gold only, so Bronze (live answer aids) never opens
 * more content. Single-tier drills (quiz and math decks) count their only tier; progress saved before per-tier stars were
 * tracked falls back to the old best-of-any-tier number.
 */
export function unlockStars(drill: Pick<Drill, 'tiers'> | undefined, p: { stars: number; tierStars?: number[] } | undefined): number {
  if (!p) return 0;
  const tiers = drill?.tiers.length ?? 3;
  if (tiers <= 1) return p.stars;
  if (!Array.isArray(p.tierStars)) return p.stars;
  return Math.max(p.tierStars[1] ?? 0, p.tierStars[2] ?? 0);
}
/** Best unlock stars per drill id from stored progress. */
export function unlockBest(drills: Pick<Drill, 'id' | 'tiers'>[], prog: { drills: Record<string, { stars: number; tierStars?: number[] }> }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(prog.drills)) out[id] = unlockStars(drills.find(d => d.id === id), p);
  return out;
}

/** PLAY-001: stars that move the Start-here path on: the best of ANY tier, Bronze included (unlocks stay Silver/Gold only). */
export function pathStars(prog: { drills: Record<string, { stars: number; tierStars?: number[] }> }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, p] of Object.entries(prog.drills)) out[id] = Math.max(p.stars ?? 0, ...(Array.isArray(p.tierStars) ? p.tierStars : [0]));
  return out;
}
/**
 * Start-here path state from stored progress (PLAY-001): a drill step is done with a star at any tier, Bronze included, so the path
 * advances as the panel says ("play D01, D03 and D04 at Bronze"); the whole-leg unlocks still need Silver or Gold (unlockStars).
 * Lesson steps use `lessonDone`. `drills` is kept for the signature.
 */
export function startPathFromProgress(drills: Pick<Drill, 'id' | 'tiers'>[], prog: { drills: Record<string, { stars: number; tierStars?: number[] }> }, lessonDone: (id: string) => boolean): StartPathState[] {
  void drills;
  return startPathState(pathStars(prog), lessonDone);
}
/** PLAY-001: the hash the path's Next button opens for a step: the lesson, or the drill at Bronze, seed 1. */
export function pathStepHash(step: StartStep): string { return step.kind === 'lesson' ? `#/school/${step.id}` : `#/cockpit/drill/${step.id}/0/1`; }
/** PLAY-001: the current (first not done) step of the path, or null when the path is complete. */
export function currentPathStep(steps: StartPathState[]): StartStep | null { return steps.find(s => s.current)?.step ?? null; }
