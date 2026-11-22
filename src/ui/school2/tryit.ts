/**
 * SCH-007 try-it: the module's last page starts a 5-card run (the engine's tryItPlan: only the module's kinds, no rule cards) through
 * the phone run screen (#/m/run); when it finishes the run screen hands back to #/school/<id>/recap: stars, the module's
 * "You can now ..." line, and the module recorded as done (Progress.markTryIt semantics). Lessons the module covers are marked read
 * in the Desk progress so the Desk path does not ask for them again.
 */
import type { RunPlan, RunResult } from '../../core/decision/index.js';
import * as core from '../../core/decision/index.js';
import { el, app } from '../state.js';
import { session } from '../mobile/session.js';
import { resumeRun, startRun } from '../mobile/engine.js';
import { course, moduleById, moduleIndex, type Module } from './sources.js';
import { recordTryIt, moduleNumber } from './progress.js';

/** The try-it plan for a module (the engine's tryItPlan), or null when the engine lacks it. */
export function tryItPlanFor(m: Module, seed: number): RunPlan | null {
  const f = (core as unknown as { tryItPlan?: (m: Module, seed: number) => RunPlan }).tryItPlan;
  try { return typeof f === 'function' ? f(m, seed) : null; } catch { return null; }
}

export function startTryIt(id: string): void {
  const m = moduleById(id); if (!m) { location.replace('#/school'); return; }
  const seed = (Date.now() % 1_000_000) + 1;
  const plan = tryItPlanFor(m, seed);
  const skills = (plan?.skills ?? [...core.SKILLS]) as RunPlan['skills'];
  const h = plan ? resumeRun(plan, []) : null;
  session.handle = h ?? startRun({ skills, seed, mode: 'practice', rung: 2, decisions: 5 });
  session.req = { skills, seed, mode: 'practice', rung: 2, decisions: 5 };
  session.dailyIndex = null; session.courseTry = m.id;
  location.replace('#/m/run');
}

/** Called by the run screen when a try-it run finishes (instead of the phone recap). */
export function finishTryIt(id: string, r: RunResult): void {
  recordTryIt(id, r.stars);
  const m = moduleById(id);
  try { for (const l of m?.covers ?? []) app.progress.markLesson(l); } catch { /* desk store unavailable */ }
}

export function renderTryItRecap(root: HTMLElement, id: string): void {
  const m = moduleById(id); const r = session.last?.result;
  if (!m) { location.replace('#/school'); return; }
  const stars = r?.stars ?? 0; const i = moduleIndex(m.id); const nextM = course()[i + 1];
  const body = el('div', { class: 's2-recap', 'data-testid': 'tryit-recap' },
    el('h1', {}, `Module ${moduleNumber(m, i)} done`),
    el('div', { class: 'mob-stars', 'data-stars': stars, 'aria-label': `${stars} of 3 stars` }, ...[0, 1, 2].map(k => el('span', { class: k < stars ? 'on' : '' }, '★'))),
    r ? el('p', { class: 'mob-sum', 'data-testid': 'recap-sum' }, `${r.correct} of ${r.total} right · ${r.secondsTotal.toFixed(1)} s off`) : el('span', {}),
    el('p', { class: 's2-youcan', 'data-testid': 'you-can-now' }, m.youCanNow));
  const again = el('a', { class: 'mob-btn big', href: `#/school/${m.id}/try`, 'data-action': 'again' }, 'Again');
  const next = nextM ? el('a', { class: 'mob-btn primary big', href: `#/school/${nextM.id}/1`, 'data-action': 'next-module' }, `Module ${moduleNumber(nextM, i + 1)}`)
    : el('a', { class: 'mob-btn primary big', href: '#/m', 'data-action': 'next-module' }, 'Home');
  root.replaceChildren(el('div', { class: 's2 s2-recapscreen', 'data-screen': 'school-recap' },
    el('header', { class: 's2-strip' }, el('a', { class: 'mob-quit', href: '#/m', 'aria-label': 'Home' }, '×'), el('span', { class: 's2-title' }, m.title), el('a', { class: 's2-modlink', href: '#/school/modules' }, 'Modules')),
    el('div', { class: 's2-main' }, body), el('footer', { class: 's2-foot' }, el('div', { class: 's2-navbtns' }, again, next))));
}
