/**
 * Course progress (SCH-004 / SCH-006 / SCH-007), the UI side. The durable state is the engine's CourseState ({modulesDone, pages,
 * tryItStars}) inside the decision progress (src/core/decision/progress.ts, key rally-trainer.decision.v1, the shared Storage);
 * the page each module is open at (SCH-006 "the module remembers the page", which can move back) is a per-viewer convenience under
 * its own key. The guided state is the engine's guidedControls, applied only once the visitor has started the course, so a player
 * who never opened the School keeps the full run screen.
 */
import * as core from '../../core/decision/index.js';
import type { DecisionProgressState } from '../../core/decision/index.js';
import type { ControlId, Module } from './sources.js';
import { course } from './sources.js';
import { loadProgress, saveProgress } from '../mobile/progress.js';

export const COURSE_POS_KEY = 'rally-trainer.course.pos.v1';
/** SCH-004: modules 0..6 are the core: finishing them ends the guided state and unlocks the unguided runs. */
export const CORE_MODULES: number = (core as unknown as { CORE_MODULES?: number }).CORE_MODULES ?? 7;
export const DESK_MODULE: number = (core as unknown as { DESK_MODULE?: number }).DESK_MODULE ?? 12;

export interface CourseState { modulesDone: string[]; pages: Record<string, number>; tryItStars: Record<string, number> }
export interface CoursePos { pos: Record<string, number>; last: string | null }
export interface CourseView { state: CourseState; pos: CoursePos }

export const emptyCourseState = (): CourseState => ({ modulesDone: [], pages: {}, tryItStars: {} });
export function normalizeCourseState(x: unknown): CourseState {
  const c = emptyCourseState(); if (!x || typeof x !== 'object') return c;
  const o = x as Partial<CourseState>;
  const rec = (v: unknown, hi: number): Record<string, number> => { const out: Record<string, number> = {}; if (v && typeof v === 'object') for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = Math.round(Math.min(hi, Math.max(0, n))); return out; };
  c.modulesDone = Array.isArray(o.modulesDone) ? [...new Set(o.modulesDone.filter((m): m is string => typeof m === 'string'))] : [];
  c.pages = rec(o.pages, 99); c.tryItStars = rec(o.tryItStars, 3);
  return c;
}

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
function ls(): KV | null { try { if (typeof localStorage === 'undefined') return null; localStorage.getItem(COURSE_POS_KEY); return localStorage; } catch { return null; } }
let posMemory: CoursePos | null = null;
export function loadPos(store: KV | null = ls()): CoursePos {
  try { const raw = store?.getItem(COURSE_POS_KEY); if (raw) { const o = JSON.parse(raw) as Partial<CoursePos>; const pos: Record<string, number> = {}; for (const [k, v] of Object.entries(o.pos ?? {})) if (Number.isInteger(v) && v >= 0) pos[k] = v; return (posMemory = { pos, last: typeof o.last === 'string' ? o.last : null }); } } catch { /* blocked */ }
  return posMemory ?? (posMemory = { pos: {}, last: null });
}
export function savePos(p: CoursePos, store: KV | null = ls()): void { posMemory = p; try { store?.setItem(COURSE_POS_KEY, JSON.stringify(p)); } catch { /* blocked */ } }

/** The course state out of a decision progress object. */
export const courseOf = (p: DecisionProgressState): CourseState => normalizeCourseState((p as DecisionProgressState & { course?: unknown }).course);
export function loadCourse(): CourseView { return { state: courseOf(loadProgress()), pos: loadPos() }; }
function writeState(f: (c: CourseState) => CourseState): CourseState {
  const p = loadProgress(); const c = f(courseOf(p)); saveProgress({ ...p, course: c } as DecisionProgressState); return c;
}

// ---------------------------------------------------------------- pure transitions (the engine's Progress.markPage / markTryIt semantics)
/** Pages reached only ever move forward (Progress.markPage). */
export const withPageReached = (c: CourseState, id: string, count: number): CourseState => ({ ...c, pages: { ...c.pages, [id]: Math.max(c.pages[id] ?? 0, Math.min(99, Math.max(0, Math.round(count)))) } });
/** SCH-007: a try-it played: best stars kept, the module done (Progress.markTryIt). */
export const withTryIt = (c: CourseState, id: string, stars: number): CourseState => ({ ...c, tryItStars: { ...c.tryItStars, [id]: Math.max(c.tryItStars[id] ?? 0, Math.min(3, Math.max(0, Math.round(stars)))) }, modulesDone: c.modulesDone.includes(id) ? c.modulesDone : [...c.modulesDone, id] });

// ---------------------------------------------------------------- effects
/** SCH-006: open module `id` at page `page` (remembered), and count the pages reached. */
export function visitPage(id: string, page: number): void {
  const pos = loadPos(); savePos({ pos: { ...pos.pos, [id]: Math.max(0, page) }, last: id });
  if (page > 0) writeState(c => withPageReached(c, id, page));
}
/** A page finished (a right answer, a widget done, or moving past a reading page): pages reached = index + 1. */
export function finishPage(id: string, page: number): void { writeState(c => withPageReached(c, id, page + 1)); }
export function recordTryIt(id: string, stars: number): void { writeState(c => withTryIt(c, id, stars)); }
export const rememberedPage = (v: CourseView, id: string): number => v.pos.pos[id] ?? 0;

// ---------------------------------------------------------------- reading
export const isComplete = (c: CourseState, id: string): boolean => c.modulesDone.includes(id);
/** The visitor has started the course (a page reached or a module done). */
export const courseStarted = (c: CourseState): boolean => c.modulesDone.length > 0 || Object.values(c.pages).some(n => n > 0);
type CoreFns = { coreDone?: (c: CourseState, m?: readonly { id: string }[]) => boolean; deskUnlocked?: (c: CourseState, m?: readonly { id: string }[]) => boolean; guidedControls?: (c: CourseState, m: readonly Module[]) => { introduced: ControlId[]; newest: ControlId | null; guided: boolean } };
const fns = (): CoreFns => core as unknown as CoreFns;
/** SCH-004: modules 0..6 complete. */
export function coreComplete(c: CourseState, mods: Module[] = course()): boolean {
  const f = fns().coreDone; if (typeof f === 'function') { try { return f(c, mods); } catch { /* fall back */ } }
  const coreMods = mods.slice(0, CORE_MODULES); return coreMods.length >= CORE_MODULES && coreMods.every(m => isComplete(c, m.id));
}
/** SCH-004: module 12 (the Desk module) complete. */
export function deskUnlocked(c: CourseState, mods: Module[] = course()): boolean {
  const f = fns().deskUnlocked; if (typeof f === 'function') { try { return f(c, mods); } catch { /* fall back */ } }
  const m = mods.find(x => x.unlocks === 'desk') ?? mods[DESK_MODULE]; return !!m && isComplete(c, m.id);
}
/** The module's number as the course names it ('m3' -> 3), else its index. */
export function moduleNumber(m: Module, index: number): number { const n = /^m(\d+)$/.exec(m.id); return n ? Number(n[1]) : index; }
/** Home "Continue course: Module n, page m": the first module not done, at its remembered page. */
export function continueTarget(v: CourseView = loadCourse(), mods: Module[] = course()): { module: Module; index: number; page: number } | null {
  const i = mods.findIndex(m => !isComplete(v.state, m.id)); if (i < 0) return null;
  const m = mods[i]!; return { module: m, index: i, page: Math.min(rememberedPage(v, m.id), Math.max(0, m.pages.length - 1)) };
}
export const continueLabel = (t: { index: number; page: number; module: Module }): string => `Continue course: Module ${moduleNumber(t.module, t.index)}, page ${t.page + 1}`;

export interface GuidedState { active: boolean; introduced: ControlId[]; newest: ControlId | null; deskUnlocked: boolean }
/** SCH-004 guided controls (the engine's guidedControls when exported), active only for a visitor who has started the course. */
export function guidedState(c: CourseState = loadCourse().state, mods: Module[] = course()): GuidedState {
  const desk = deskUnlocked(c, mods); const started = courseStarted(c);
  const f = fns().guidedControls;
  if (typeof f === 'function') { try { const g = f(c, mods); return { active: started && g.guided, introduced: [...g.introduced], newest: g.newest, deskUnlocked: desk }; } catch { /* fall back */ } }
  const done = new Set(c.modulesDone); const current = mods.find(m => !done.has(m.id))?.id ?? null;
  const introduced: ControlId[] = []; let newest: ControlId | null = null;
  for (const m of mods) { if (!(done.has(m.id) || (m.id === current && (c.pages[m.id] ?? 0) > 0))) continue; for (const x of m.controls) { if (!introduced.includes(x)) introduced.push(x); newest = x; } }
  return { active: started && !coreComplete(c, mods), introduced, newest, deskUnlocked: desk };
}

/** PT-17 N6 (B13): where a visit to the bare page lands. A newcomer (no Desk drill played, no phone run finished, Module 0 not done) lands on
 *  the School every visit until Module 0 is finished, not only the first; opening the page consumes nothing. `first` = no course page
 *  reached yet (show the first-visit line and Start on Module 0 page 1); otherwise the School continues where they were. Pure (raw strings). */
export function newcomerLanding(deskRaw: string | null, decisionRaw: string | null): { school: boolean; first: boolean } {
  const parse = (raw: string | null): Record<string, unknown> | null => { if (!raw) return null; try { const o = JSON.parse(raw) as unknown; return o && typeof o === 'object' ? o as Record<string, unknown> : {}; } catch { return {}; } };
  const desk = parse(deskRaw); const dec = parse(decisionRaw);
  const drills = desk?.['drills']; if (drills && typeof drills === 'object' && Object.keys(drills).length) return { school: false, first: false };
  if (dec && typeof dec['runs'] === 'number' && dec['runs'] > 0) return { school: false, first: false };
  const c = normalizeCourseState(dec?.['course']);
  if (c.modulesDone.includes(course()[0]?.id ?? 'm0')) return { school: false, first: false };
  return { school: true, first: !courseStarted(c) };
}
