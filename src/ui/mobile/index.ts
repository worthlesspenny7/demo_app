/**
 * Phone shell entry (MOB-020): `#/m...` routes, the landscape switch (MOB-022) and the test helpers on window.__rally.decision.
 *   #/m                         Home (MOB-025)
 *   #/m/play/daily/<i>          daily-set run i (MOB-030)
 *   #/m/play/skill/<s>[/legal]  practice one skill; /legal = the no-hints rung (MOB-031)
 *   #/m/play/boss               the Boss run (about 25 cards)
 *   #/m/play/practice           a mixed practice run on a fresh seed
 *   #/m/play/again              the last run again (same seed)
 *   #/m/continue                resume the unfinished run (MOB-030)
 *   #/m/run                     the run in play;  #/m/recap  its recap
 */
import { SKILLS, type DecisionResponse, type Skill, type Verdict } from '../../core/decision/index.js';
import { renderMobileHome } from './home.js';
import { renderRun, view } from './run.js';
import { renderRecap } from './recap.js';
import { startRun, resumeRun, type RunRequest } from './engine.js';
import { loadProgress, dailyState, dailySkills, saveProgress, clearUnfinished } from './progress.js';
import { session, wallSeconds } from './session.js';
import { pwaStatus } from './pwa.js';

export { currentMode, rememberMode, MOBILE_MAX_WIDTH } from './detect.js';
export { registerServiceWorker } from './pwa.js';

function begin(req: RunRequest, dailyIndex: number | null): void {
  const p = loadProgress();
  session.req = req; session.dailyIndex = dailyIndex;
  session.handle = startRun(req, p);
  saveProgress(clearUnfinished(p));
  location.replace('#/m/run');
}

function play(parts: string[]): void {
  const p = loadProgress();
  const what = parts[0] ?? 'practice';
  const fresh = (Date.now() % 1_000_000) + 1;
  if (what === 'daily') {
    const d = dailyState(p); const i = Math.max(0, Math.min(2, Number(parts[1] ?? d.next ?? 0) || 0));
    return begin({ skills: dailySkills(p, i), seed: d.seeds[i]!, mode: 'daily', rung: 2, day: d.day, dailyIndex: i }, i);
  }
  if (what === 'skill' && SKILLS.includes(parts[1] as Skill)) {
    const legal = parts[2] === 'legal';
    return begin({ skills: [parts[1] as Skill], seed: fresh, mode: 'practice', rung: legal ? 0 : 2 }, null);
  }
  if (what === 'boss') return begin({ skills: [...SKILLS], seed: fresh, mode: 'boss', rung: 1, decisions: 25 }, null);
  if (what === 'again' && session.last) return begin(session.last.req, session.last.dailyIndex);
  return begin({ skills: [...SKILLS], seed: fresh, mode: 'practice', rung: 2 }, null);
}

function resume(): void {
  const p = loadProgress();
  if (!p.unfinished) { location.replace('#/m'); return; }
  const h = resumeRun(p.unfinished.plan, p.unfinished.responses);
  if (!h) { saveProgress(clearUnfinished(p)); location.replace('#/m'); return; }
  session.handle = h; session.req = { skills: h.plan.skills, seed: h.plan.seed, mode: h.plan.mode, rung: h.plan.rung, decisions: h.plan.decisionCount, ...(h.plan.day ? { day: h.plan.day } : {}), ...(h.plan.dailyIndex !== undefined ? { dailyIndex: h.plan.dailyIndex } : {}) };
  session.dailyIndex = h.plan.mode === 'daily' ? (h.plan.dailyIndex ?? Math.max(0, dailyState(p).seeds.indexOf(h.plan.seed))) : null;
  location.replace('#/m/run');
}

/** Render a `#/m...` route; returns a cleanup. */
export function renderMobile(root: HTMLElement, parts: string[]): (() => void) | null {
  installHelpers();
  const screen = parts[0] ?? '';
  switch (screen) {
    case 'play': play(parts.slice(1)); return null;
    case 'continue': resume(); return null;
    case 'run': {
      if (!session.handle) { const p = loadProgress(); if (p.unfinished) { resume(); return null; } location.replace('#/m'); return null; }
      return renderRun(root);
    }
    case 'recap': renderRecap(root); return null;
    default: renderMobileHome(root); return null;
  }
}

/** MOB-022: the landscape mini cockpit is a class on <body> driven by the orientation of a short viewport (CSS does the layout). */
export function watchOrientation(): void {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(orientation: landscape) and (max-height: 520px)') : null;
  const apply = (): void => { document.body.classList.toggle('mob-landscape', !!mq?.matches); };
  apply();
  try { mq?.addEventListener('change', apply); } catch { /* old Safari */ }
  window.addEventListener('resize', apply);
}

export interface DecisionHelpers {
  source(): 'core' | 'runner' | 'stub' | null;
  state(): { screen: string; phase: string; kind: string | null; id: string | null; timing: unknown; options: string[]; elapsed: number; n: number; of: number; correct: number; answered: number };
  oracle(): DecisionResponse | null;
  /** Seconds since the card on screen was shown (the TimingSpec time base). */
  elapsed(): number;
  /** Move the shell's clock forward (skips waiting; tests only). */
  advance(seconds: number): void;
  verdicts(): Verdict[];
  pwa(): typeof pwaStatus;
}

function installHelpers(): void {
  const w = window as unknown as { __rally?: Record<string, unknown> };
  if (w.__rally && (w.__rally as { decision?: unknown }).decision) return;
  const helpers: DecisionHelpers = {
    source: () => session.handle?.source ?? session.last?.source ?? null,
    state: () => {
      const h = session.handle; const pos = h?.position() ?? { n: 0, of: 0 };
      const d = view.phase === 'decision' ? view.decision : null;
      const screen = (document.querySelector('[data-screen]') as HTMLElement | null)?.dataset.screen ?? '';
      return { screen, phase: screen === 'run' ? view.phase : screen, kind: d?.kind ?? null, id: d?.id ?? null, timing: d?.timing ?? null, options: d?.options?.map(o => o.id) ?? [], elapsed: d ? wallSeconds() - view.shownAt : 0, n: pos.n, of: pos.of, correct: (h?.verdicts ?? session.last?.result.verdicts ?? []).filter(v => v.correct).length, answered: (h?.verdicts ?? session.last?.result.verdicts ?? []).length };
    },
    oracle: () => (view.phase === 'decision' && view.decision && session.handle ? session.handle.oracle(view.decision) : null),
    elapsed: () => (view.phase === 'decision' ? wallSeconds() - view.shownAt : 0),
    advance: (s: number) => { if (Number.isFinite(s) && s > 0) session.skew += s; },
    verdicts: () => [...(session.handle?.verdicts ?? session.last?.result.verdicts ?? [])],
    pwa: () => ({ ...pwaStatus }),
  };
  w.__rally = Object.assign(w.__rally ?? {}, { decision: helpers });
}
