/**
 * Phase IX (SCH-001/002/004): where the page player gets its data. The course, the excerpts and the videos are the content agent's
 * (content/course.ts, excerpts.ts, videos.ts); the mini-sim / try-it / guided hooks are the engine's (src/core/decision/school.ts).
 * Every source is feature-detected so the build never breaks while a file or an export is missing: the content files through an
 * eager import.meta.glob (an absent file is an empty map), the engine through its namespace export. A small fallback course
 * (FALLBACK_COURSE) keeps the player usable when content/course.ts is not there.
 */
import type { ControlId, Module, Page, Ref } from '../../../content/course-types.js';
import { CONTROL_IDS } from '../../../content/course-types.js';
import * as core from '../../core/decision/index.js';

export type { ControlId, Module, Page, Ref };
export { CONTROL_IDS };

import { COURSE, FIRST_VISIT, moduleForLesson as contentModuleForLesson } from '../../../content/course.js';
import { excerptFor as contentExcerpt, EXCERPTS } from '../../../content/excerpts.js';
import { videoLink as contentVideoLink } from '../../../content/videos.js';

export interface CourseData { course: Module[]; firstVisit: string; startLabel: string; source: 'content' }
export const COURSE_DATA: CourseData = { course: COURSE, firstVisit: FIRST_VISIT.line, startLabel: FIRST_VISIT.start, source: 'content' };
export const course = (): Module[] => COURSE_DATA.course;
export const moduleById = (id: string): Module | undefined => COURSE_DATA.course.find(m => m.id === id);
export const moduleIndex = (id: string): number => COURSE_DATA.course.findIndex(m => m.id === id);

/** SCH-008: the module that covers an old lesson id (content `covers`), else the table below, else null. */
export const LESSON_MODULE_FALLBACK: Record<string, string> = {
  'ghost-car': 'm0', 'four-s': 'm11', 'griid-cameo': 'm1', markup: 'm1', protocol: 'm2', 'which-timer': 'm3', calibration: 'm3', 'measure-car': 'm4',
  'pause-arithmetic': 'm4', 'timed-leads': 'm5', transits: 'm10', recovery: 'm8', lost: 'm7', 'rally-school': 'm12',
};
export function moduleForLesson(lessonId: string): Module | null {
  const m = contentModuleForLesson(lessonId); if (m) return m;
  const id = LESSON_MODULE_FALLBACK[lessonId]; return id ? moduleById(id) ?? null : null;
}

// SCH-004 / API "School": the app registers the course once so tryItRun / school.tryit resolve module ids
try { const reg = (core as unknown as { registerCourse?: (m: readonly unknown[]) => void }).registerCourse; if (typeof reg === 'function') reg(COURSE); } catch { /* engine not ready */ }

export interface Excerpt { text: string; citation: string; title?: string; seconds?: number; videoKey?: string }
/** SCH-002: the excerpt of a Ref key ('hb:p8', 'reg:V.H.3', 'video:2026:110:28'), or null when not resolved. */
export function excerptFor(key: string): Excerpt | null {
  const e = contentExcerpt(key); if (!e) return null;
  const out: Excerpt = { text: e.text, citation: e.citation, title: e.title };
  const vk = e.video?.key ?? e.videoKey; const sec = e.video?.seconds ?? e.seconds;
  if (vk) out.videoKey = vk; if (typeof sec === 'number') out.seconds = sec;
  return out;
}

/** Every excerpt key (PT-16: verdict source chips resolve against them). */
export const excerptKeys = (): string[] => Object.keys(EXCERPTS);

/** "mm:ss" (minutes may pass 59, as the chips print "110:28"). */
export function mmss(seconds: number): string { const s = Math.max(0, Math.round(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
/** Seconds of a video Ref key 'video:<id>:<mm>:<ss>'. */
export function secondsOfKey(key: string): number | null {
  const m = /^video:[^:]+:(\d+):(\d{2})$/.exec(key); return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** SCH-002: the URL that opens a video Ref at its second (content/videos.ts videoLink), or null while the URL is blank. */
export function videoLink(ref: Pick<Ref, 'key'>, ex: Excerpt | null = excerptFor(ref.key)): string | null {
  const id = ex?.videoKey ?? /^video:([^:]+):/.exec(ref.key)?.[1]; if (!id) return null;
  const s = ex?.seconds ?? secondsOfKey(ref.key) ?? 0;
  return contentVideoLink(id, s) ?? null;
}

/** Engine hooks (src/core/decision/school.ts), or null when an export is missing. */
export interface EngineSchool {
  miniSim?: (kind: string, seed: number, opts?: Record<string, unknown>) => unknown;
  tryItPlan?: (module: Module, seed: number, progress?: unknown) => unknown;
  guidedControls?: (...args: unknown[]) => unknown;
  POINTER_OF_CONTROL?: Record<string, string>;
}
export const engine = (): EngineSchool => core as unknown as EngineSchool;

/** One-line labels of the controls (pointer lines). The engine's POINTER_OF_CONTROL wins when it has one. */
export const CONTROL_LABEL: Record<ControlId, string> = {
  book: 'The book row: the line the car is on.', callTurn: 'Call the turn: tap the way to go.', callSpeed: 'Call the speed: tap the new speed.',
  go: 'GO: tap it when the watch reaches the wait.', watchStartStop: 'START: the left half of the stopwatch.', watchLap: 'LAP: the right half of the stopwatch.',
  chartCell: 'The chart cell: the seconds to sit or lead.', distanceBar: 'The bar: it empties at the sign, on the driver\'s Mark.',
  // PT-16 B2: name what is graded: the call half a ramp before the sign
  callAtMark: 'Tap CALL half a ramp before the Mark, when the bar reaches the tick.',
  clock: 'The dash clock: read the minute hand.', todStrip: 'The time-of-day strip under the watch.', launch: 'LAUNCH: tap at your start second.',
  makeup: 'Make-up: pick how to win back time.', taCard: 'The delay: pick what to claim or make up.', holdCard: 'The OUT time: pick it.', desk: 'Desk mode: every control at once.',
};
export function pointerFor(c: ControlId): string {
  const p = engine().POINTER_OF_CONTROL?.[c];
  return typeof p === 'string' && p ? p : CONTROL_LABEL[c];
}
