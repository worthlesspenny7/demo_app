/** Curriculum order, the "Start here" path and next-drill lookup (UI-016). Pure: no DOM. */
import type { Drill } from '../../core/drills/types.js';
import { drillMinutes, formatMinutes } from './estimate.js';

/**
 * Order the drills are meant to be played in (the Home tracks, flattened). EDU-005: the Four S's order of the Rookie Handbook (HB p.13-14):
 * stay on course and start on time first (D09, D10, D16), then the stay-on-time drills, then the whole legs. D02 (dial reading) is retired:
 * the dash clock is read for its second hand only and the stopwatch is digital (REG II.H.1.d), which D01 and D16 cover.
 */
export const CURRICULUM: string[] = ['D09', 'D10', 'D16', 'D01', 'D03', 'D04', 'D05', 'D06', 'D08', 'D08b', 'D07', 'D17', 'D14', 'D15', 'D18', 'D11', 'D12', 'D13'];

export type StartStep = { kind: 'lesson'; id: string; label: string } | { kind: 'drill'; id: string; label: string };
/**
 * First-run path (EDU-005), in the Four S's order: safety and the priorities, reading the page and the team protocol, the trap quiz, what to do when
 * lost, the course drill; then starts and restarts (LESSON-004) and D16; then the ghost car and the stay-on-time drills up to the miniature leg.
 */
export const START_PATH: StartStep[] = [
  { kind: 'lesson', id: 'four-s', label: "School: the Four S's (safety first)" },
  { kind: 'lesson', id: 'griid-cameo', label: 'School: the GRIID page and the CAMEO' },
  { kind: 'lesson', id: 'protocol', label: "School: team protocol and Dad's card" },
  { kind: 'drill', id: 'D09', label: 'D09 Trap quiz: which way?' },
  { kind: 'lesson', id: 'lost', label: 'School: when you are lost' },
  { kind: 'drill', id: 'D10', label: 'D10 Course following' },
  { kind: 'lesson', id: 'transits', label: 'School: transits and restarts' },
  { kind: 'drill', id: 'D16', label: 'D16 Start on the second' },
  { kind: 'lesson', id: 'ghost-car', label: 'School: the ghost car' },
  { kind: 'drill', id: 'D01', label: 'D01 Stopwatch on the landmark' },
  { kind: 'drill', id: 'D03', label: 'D03 Pause arithmetic' },
  { kind: 'drill', id: 'D04', label: 'D04 Timed speed changes' },
  { kind: 'drill', id: 'D05', label: 'D05 Speed changes at landmarks' },
  { kind: 'drill', id: 'D06', label: 'D06 Build your charts' },
  { kind: 'drill', id: 'D08', label: 'D08 Running early or late' },
  { kind: 'drill', id: 'D07', label: 'D07 Morning calibration run' },
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
export function nextDrill(id: string, drills: Drill[], best: Record<string, number>, lessonDone?: (id: string) => boolean): { drill: Drill; locked: boolean; needs: string } | null {
  const i = CURRICULUM.indexOf(id);
  for (let k = i + 1; k < CURRICULUM.length; k++) {
    const d = drills.find(x => x.id === CURRICULUM[k]);
    if (!d || d.kind !== 'drive') continue;
    const missing = d.unlock.filter(u => (best[u.drill] ?? 0) < u.stars);
    const lessons = lessonDone ? (d.lessonGate ?? []).filter(l => !lessonDone(l)) : [];
    return { drill: d, locked: missing.length > 0 || lessons.length > 0, needs: lockText(missing, lessons) };
  }
  return null;
}

/** EDU-005: what a locked drill or tier still needs, in words: "D03 ★★, D16 ★ at Silver or Gold; read the lesson lost". */
export function lockText(missing: { drill: string; stars: number }[], lessons: string[] = [], lessonTitle: (id: string) => string = id => id): string {
  const parts: string[] = [];
  if (missing.length) parts.push(`${missing.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ')} at Silver or Gold`);
  if (lessons.length) parts.push(`pass the lesson ${lessons.map(l => `"${lessonTitle(l)}"`).join(' and ')}`);
  return parts.join('; ');
}

/** EDU-005: the lesson(s) a drill card links to ("Read first"), with the ones that gate the drill marked. */
export function readFirstOf(d: Pick<Drill, 'readFirst' | 'lessonGate'>): { id: string; gate: boolean }[] {
  const ids = [...new Set([...(d.readFirst ?? []), ...(d.lessonGate ?? [])])];
  return ids.map(id => ({ id, gate: (d.lessonGate ?? []).includes(id) }));
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
/** The static drills (decks, not drives) and the screen that opens them. */
const STATIC_DRILL: Record<string, 'quiz' | 'math'> = { D09: 'quiz', D14: 'math' };
export function pathStepHash(step: StartStep): string { return step.kind === 'lesson' ? `#/school/${step.id}` : STATIC_DRILL[step.id] ? `#/${STATIC_DRILL[step.id]}/${step.id}` : `#/cockpit/drill/${step.id}/0/1`; }
/** PLAY-001: the current (first not done) step of the path, or null when the path is complete. */
export function currentPathStep(steps: StartPathState[]): StartStep | null { return steps.find(s => s.current)?.step ?? null; }

/** EDU-010: the card's time budget from the ghost's time: "~23 min at 1x · ~6 min at 4x" (D01 and D03 are locked to 1x; decks show their own minutes). */
export function cardMinutesText(d: Pick<Drill, 'id' | 'minutes' | 'kind' | 'scenario'>): string {
  const m = drillMinutes(d); const per = d.id === 'D13' ? ' per stage' : '';
  if (d.kind !== 'drive' || d.id === 'D01' || d.id === 'D03') return `${formatMinutes(m)}${per} at 1x`;
  return `${formatMinutes(m)}${per} at 1x · ${formatMinutes(m / 4)}${per} at 4x`;
}
