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
    return { drill: d, locked: missing.length > 0, needs: missing.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ') };
  }
  return null;
}
