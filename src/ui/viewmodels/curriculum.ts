/** Curriculum order, the "Start here" path and next-drill lookup (UI-016). Pure: no DOM. */
import type { Drill } from '../../core/drills/types.js';
import { drillMinutes, formatMinutes } from './estimate.js';

/**
 * Order the drills are meant to be played in (the Home tracks, flattened). PLAY-023: the Four S's in the handbook's own order (HB p.13-14):
 * Safety, Start on time (D16), Stay on course (D09, D10), Stay on time (D01 ... D18), then the whole legs. D02 (dial reading) is retired:
 * the dash clock is read for its second hand only and the stopwatch is digital (REG II.H.1.d), which D01 and D16 cover.
 */
export const CURRICULUM: string[] = ['D16', 'D09', 'D10', 'D01', 'D03', 'D04', 'D05', 'D06', 'D08', 'D08b', 'D07', 'D17', 'D14', 'D15', 'D18', 'D11', 'D12', 'D13'];

/** PLAY-023: which of the Four S's a path step belongs to (the Home panel prints the four headings in this order). */
export type FourS = 'safety' | 'start' | 'course' | 'time';
export const FOUR_S_TITLE: Record<FourS, string> = { safety: '1. Safety first', start: '2. Start on time', course: '3. Stay on course', time: '4. Stay on time' };
/** PLAY-023: the one line that says why the path does starts and course before time (HB p.13-14). */
export const PATH_WHY = "Starts and course come before time because their errors cost minutes (a minute misread at a restart, 180 s for a missed checkpoint) while stop and turn errors cost seconds (HB p.13-14).";

export type StartStep = { kind: 'lesson'; id: string; label: string; s: FourS } | { kind: 'drill'; id: string; label: string; s: FourS };
/**
 * First-run path (PLAY-023), in the handbook's Four S's order, every drill after the lessons on its "Read first" line:
 * 1 Safety (the Four S's); 2 Start on time (transits and restarts, which timer, the ghost car, then D16); 3 Stay on course (the GRIID page and
 * CAMEO, the team protocol, D09, when you are lost, D10); 4 Stay on time (pause arithmetic, D01, D03; timed leads, D04, D05; measure your car,
 * D06; recovery, D08; calibration, D07; then D18, the miniature leg).
 */
export const START_PATH: StartStep[] = [
  { kind: 'lesson', id: 'four-s', label: "School: the Four S's (safety first)", s: 'safety' },
  { kind: 'lesson', id: 'transits', label: 'School: transits and restarts', s: 'start' },
  { kind: 'lesson', id: 'which-timer', label: 'School: which timer, when', s: 'start' },
  { kind: 'lesson', id: 'ghost-car', label: 'School: the ghost car', s: 'start' },
  { kind: 'drill', id: 'D16', label: 'D16 Start on the second', s: 'start' },
  { kind: 'lesson', id: 'griid-cameo', label: 'School: the GRIID page and the CAMEO', s: 'course' },
  { kind: 'lesson', id: 'protocol', label: "School: team protocol and Dad's card", s: 'course' },
  { kind: 'drill', id: 'D09', label: 'D09 Trap quiz: which way?', s: 'course' },
  { kind: 'lesson', id: 'lost', label: 'School: when you are lost', s: 'course' },
  { kind: 'drill', id: 'D10', label: 'D10 Course following', s: 'course' },
  { kind: 'lesson', id: 'pause-arithmetic', label: 'School: pause arithmetic', s: 'time' },
  { kind: 'drill', id: 'D01', label: 'D01 Stopwatch on the landmark', s: 'time' },
  { kind: 'drill', id: 'D03', label: 'D03 Pause arithmetic', s: 'time' },
  { kind: 'lesson', id: 'timed-leads', label: 'School: timed segments and ramp leads', s: 'time' },
  { kind: 'drill', id: 'D04', label: 'D04 Timed speed changes', s: 'time' },
  { kind: 'drill', id: 'D05', label: 'D05 Speed changes at landmarks', s: 'time' },
  { kind: 'lesson', id: 'measure-car', label: 'School: measure your car', s: 'time' },
  { kind: 'drill', id: 'D06', label: 'D06 Build your charts', s: 'time' },
  { kind: 'lesson', id: 'recovery', label: 'School: early, late and the 10 % rule', s: 'time' },
  { kind: 'drill', id: 'D08', label: 'D08 Running early or late', s: 'time' },
  { kind: 'lesson', id: 'calibration', label: 'School: the morning calibration run', s: 'time' },
  { kind: 'drill', id: 'D07', label: 'D07 Morning calibration run', s: 'time' },
  { kind: 'drill', id: 'D18', label: 'D18 Miniature leg', s: 'time' },
];

export interface StartPathState { step: StartStep; done: boolean; current: boolean; /** PLAY-024: a drill step whose unlock is not met (Silver/Gold stars or a gating lesson) */ locked?: boolean; needs?: string }
export function startPathState(drillStars: Record<string, number>, lessonDone: (id: string) => boolean, lock?: { drills: Pick<Drill, 'id' | 'unlock' | 'lessonGate'>[]; best: Record<string, number> }): StartPathState[] {
  let currentTaken = false;
  return START_PATH.map(step => {
    const done = step.kind === 'lesson' ? lessonDone(step.id) : (drillStars[step.id] ?? 0) >= 1;
    const current = !done && !currentTaken; if (current) currentTaken = true;
    const st: StartPathState = { step, done, current };
    if (lock && step.kind === 'drill') {
      const d = lock.drills.find(x => x.id === step.id);
      if (d) { const miss = d.unlock.filter(u => (lock.best[u.drill] ?? 0) < u.stars); const ls = (d.lessonGate ?? []).filter(l => !lessonDone(l)); if (miss.length || ls.length) { st.locked = true; st.needs = lockText(miss, ls); } }
    }
    return st;
  });
}

/**
 * PLAY-024: what the path's Next button does. A due lesson first (a drill whose "Read first" lesson is not read yet opens that lesson);
 * a locked drill is never opened: Next replays the first missing prerequisite at Silver instead and says why; null when the path is done.
 */
export type PathNext =
  | { kind: 'step'; step: StartStep; hash: string; label: string }
  | { kind: 'replay'; drillId: string; tier: number; hash: string; label: string; forStep: StartStep; needs: string }
  | { kind: 'blocked'; forStep: StartStep; label: string; needs: string };
export function pathNext(steps: StartPathState[], drills: Pick<Drill, 'id' | 'unlock' | 'lessonGate' | 'readFirst' | 'tiers'>[], best: Record<string, number>, lessonDone: (id: string) => boolean, lessonTitle: (id: string) => string = id => id): PathNext | null {
  const cur = steps.find(s => s.current); if (!cur) return null;
  const step = cur.step;
  if (step.kind === 'drill') {
    const d = drills.find(x => x.id === step.id);
    const due = d ? readFirstOf(d).map(l => l.id).find(id => !lessonDone(id)) : undefined;
    if (due) { const ls: StartStep = { kind: 'lesson', id: due, label: `School: ${lessonTitle(due)}`, s: step.s }; return { kind: 'step', step: ls, hash: pathStepHash(ls), label: `Read first: ${lessonTitle(due)} (before ${step.id})` }; }
    if (cur.locked && d) {
      const miss = d.unlock.filter(u => (best[u.drill] ?? 0) < u.stars);
      for (const u of miss) {
        const pre = drills.find(x => x.id === u.drill); if (!pre) continue;
        const preLocked = pre.unlock.some(v => (best[v.drill] ?? 0) < v.stars) || (pre.lessonGate ?? []).some(l => !lessonDone(l));
        if (preLocked) continue;
        const tier = Math.min(1, pre.tiers.length - 1);
        const tierName = pre.tiers[tier]?.name ?? 'Silver';
        return { kind: 'replay', drillId: pre.id, tier, hash: STATIC_DRILL[pre.id] ? `#/${STATIC_DRILL[pre.id]}/${pre.id}` : `#/cockpit/drill/${pre.id}/${tier}/1`, forStep: step, needs: cur.needs ?? '', label: `Replay ${pre.id} at ${tierName} (${step.id} needs ${u.drill} ${'★'.repeat(u.stars)} at Silver or Gold)` };
      }
      return { kind: 'blocked', forStep: step, needs: cur.needs ?? '', label: `🔒 ${step.id} needs ${cur.needs ?? ''}` };
    }
  }
  return { kind: 'step', step, hash: pathStepHash(step), label: step.label };
}

/** PLAY-024: the path's last line names what opens the whole-leg drills, from their own unlock lists ("D11 opens with D18 ★ and D07 ★★ at Silver or Gold"). */
export function pathCompleteText(drills: Pick<Drill, 'id' | 'unlock'>[], best: Record<string, number>): string {
  const part = (id: string, what: string): string => {
    const d = drills.find(x => x.id === id); if (!d) return '';
    const miss = d.unlock.filter(u => (best[u.drill] ?? 0) < u.stars);
    return miss.length ? `${id} (${what}) opens with ${miss.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ')} at Silver or Gold` : `${id} (${what}) is open`;
  };
  return `Path complete. ${[part('D11', 'full leg'), part('D12', 'full stage')].filter(Boolean).join('; ')}. Bronze stars tick the path; only Silver or Gold stars open the whole legs, so replay those drills at Silver.`;
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
  const lockable = drills.filter((d): d is Pick<Drill, 'id' | 'tiers'> & Pick<Drill, 'unlock' | 'lessonGate'> => Array.isArray((d as Partial<Drill>).unlock));
  return startPathState(pathStars(prog), lessonDone, lockable.length ? { drills: lockable, best: unlockBest(drills, prog) } : undefined);   // PLAY-024: the lock shows on the path
}
/** PLAY-001: the hash the path's Next button opens for a step: the lesson, or the drill at Bronze, seed 1. */
/** The static drills (decks, not drives) and the screen that opens them. */
const STATIC_DRILL: Record<string, 'quiz' | 'math'> = { D09: 'quiz', D14: 'math' };
export function pathStepHash(step: { kind: 'lesson' | 'drill'; id: string; label?: string }): string { return step.kind === 'lesson' ? `#/school/${step.id}` : STATIC_DRILL[step.id] ? `#/${STATIC_DRILL[step.id]}/${step.id}` : `#/cockpit/drill/${step.id}/0/1`; }
/** PLAY-001: the current (first not done) step of the path, or null when the path is complete. */
export function currentPathStep(steps: StartPathState[]): StartStep | null { return steps.find(s => s.current)?.step ?? null; }

/** EDU-010: the card's time budget from the ghost's time: "~23 min at 1x · ~6 min at 4x" (D01 and D03 are locked to 1x; decks show their own minutes). */
export function cardMinutesText(d: Pick<Drill, 'id' | 'minutes' | 'kind' | 'scenario'>): string {
  const m = drillMinutes(d); const per = d.id === 'D13' ? ' per stage' : '';
  if (d.kind !== 'drive' || d.id === 'D01' || d.id === 'D03') return `${formatMinutes(m)}${per} at 1x`;
  return `${formatMinutes(m)}${per} at 1x · ${formatMinutes(m / 4)}${per} at 4x`;
}

/** PLAY-026: "Fast-forward" on a full start stops this many seconds before the launch second, so the 30-s warning and the count still happen. */
export const FULL_START_FF_LEAD = 45;
