/**
 * The phone shell's one door into decision mode (MOB-001/005/006): it starts a run through the core Scheduler / DecisionRun
 * (src/core/decision) and keeps the current step cached so the screens can re-render (rotation, overlays) without consuming it.
 * Feature detection, in order: the core Scheduler when it plans cards ('core'); else the core DecisionRunner over a chain of real legs
 * (runner-run.ts, 'runner'); else the UI stub (stub-engine.ts, 'stub') so the shell, the tests and the build keep working whatever
 * state the core is in. `source` says which one is playing.
 */
import * as core from '../../core/decision/index.js';
import type { Decision, DecisionProgressState, DecisionResponse, RunPlan, RunResult, RunStep, Skill, Verdict } from '../../core/decision/index.js';
import { StubRun, stubPlan } from './stub-engine.js';
import { RunnerRun, runnerPlan, isRunnerPlan, withCameo } from './runner-run.js';
import type { Scenario } from '../../core/course.js';

/** What the shell needs from a run (the core DecisionRun's public surface). */
interface RunCore {
  readonly plan: RunPlan;
  next(): RunStep | null;
  ack(): void;
  answer(response: DecisionResponse | null): Verdict;
  done(): boolean;
  result(): RunResult;
}

export interface RunRequest { skills: Skill[]; seed: number; mode: RunPlan['mode']; rung: 0 | 1 | 2 | 3; decisions?: number; /** daily set: the calendar day and the run index 0..2 (MOB-030) */ day?: string; dailyIndex?: number }

export class RunHandle {
  private step: RunStep | null | undefined = undefined;
  readonly responses: (DecisionResponse | null)[] = [];
  readonly verdicts: Verdict[] = [];
  readonly rulesShown: string[] = [];
  constructor(private readonly run: RunCore, readonly source: 'core' | 'runner' | 'stub') {}
  get plan(): RunPlan { return this.run.plan; }
  /** The step on screen (cached: calling it twice does not advance the run). */
  current(): RunStep | null {
    if (this.step === undefined) {
      try { this.step = this.run.next(); } catch { this.step = null; }
      // MOB-026: the core leaves BookRowView.cameoSvg empty; draw it from the scenario on screen when the run exposes it
      const sc = (this.run as unknown as { scenario?: () => Scenario | null }).scenario;
      if (this.step?.type === 'decision' && typeof sc === 'function') { try { const scen = sc.call(this.run); if (scen) this.step = { ...this.step, decision: withCameo(this.step.decision, scen) }; } catch { /* keep the row as it is */ } }
    }
    return this.step;
  }
  ack(): void { const s = this.current(); if (s?.type === 'rule') this.rulesShown.push(s.card.id); this.run.ack(); this.step = undefined; }
  answer(response: DecisionResponse | null): Verdict {
    const v = this.run.answer(response); this.responses.push(response); this.verdicts.push(v); this.step = undefined; return v;
  }
  done(): boolean { return this.current() === null; }
  result(): RunResult { return this.run.result(); }
  /** Decisions answered so far and the run's decision count (the top strip's "card n of N"). */
  position(): { n: number; of: number } {
    const s = this.current(); const total = (this.run as unknown as { total?: unknown }).total;
    const of = typeof total === 'number' && total > 0 ? Math.max(total, this.verdicts.length + (s?.type === 'decision' ? 1 : 0)) : Math.max(s?.of ?? 0, this.plan.decisionCount, this.verdicts.length);
    return { n: Math.min(of, this.verdicts.length + (s?.type === 'decision' ? 1 : 0)), of };
  }
  /** TRUTH for bots and tests: the core's oracle when it has one, else the timing truth of a timed card. */
  oracle(d: Decision): DecisionResponse | null {
    const anyRun = this.run as unknown as { oracle?: (d: Decision) => DecisionResponse | null; runner?: { oracle?: (d: Decision) => DecisionResponse }; currentRunner?: () => { oracle?: (d: Decision) => DecisionResponse } };
    try {
      if (typeof anyRun.oracle === 'function') { const o = anyRun.oracle(d); if (o) return o; }
      const r = anyRun.runner ?? (typeof anyRun.currentRunner === 'function' ? anyRun.currentRunner() : undefined);
      if (r && typeof r.oracle === 'function') return r.oracle(d);
    } catch { /* fall through */ }
    const t = d.timing; if (!t) return null;
    return t.kind === 'startStop' ? { taps: [t.truthSeconds, t.secondTapSeconds ?? t.truthSeconds] } : { tapSeconds: t.truthSeconds };
  }
}

/** The core is usable when its Scheduler builds a non-empty plan and the run yields a first step. */
function coreRun(req: RunRequest, progress: DecisionProgressState | null): RunCore | null {
  try {
    const S = (core as unknown as { Scheduler?: typeof core.Scheduler }).Scheduler; if (typeof S !== 'function') return null;
    const sch = new S(req.skills, req.seed, progress, { mode: req.mode, rung: req.rung, ...(req.decisions ? { decisions: req.decisions } : {}), ...(req.day ? { day: req.day } : {}), ...(req.dailyIndex !== undefined ? { dailyIndex: req.dailyIndex } : {}) });
    const run = sch.start() as unknown as RunCore;
    if (!run?.plan?.items?.length) return null;
    return run;
  } catch { return null; }
}
function coreFromPlan(plan: RunPlan): RunCore | null {
  try {
    const R = (core as unknown as { DecisionRun?: typeof core.DecisionRun }).DecisionRun; if (typeof R !== 'function' || !plan.items.length) return null;
    return new R(plan) as unknown as RunCore;
  } catch { return null; }
}
const isStubPlan = (plan: RunPlan): boolean => (plan as RunPlan & { stub?: boolean }).stub === true;

export function startRun(req: RunRequest, progress: DecisionProgressState | null = null): RunHandle {
  const c = coreRun(req, progress);
  if (c) { const h = new RunHandle(c, 'core'); if (h.current()) return h; }
  try { const rp = runnerPlan(req, progress?.rulesSeen ?? []); if (rp) { const h = new RunHandle(new RunnerRun(rp), 'runner'); if (h.current()) return h; } } catch { /* fall back to the stub */ }
  const plan = { ...stubPlan(req.skills, req.seed, req.mode, req.rung, req.decisions ?? (req.mode === 'boss' ? 25 : 12), progress?.rulesSeen ?? []), stub: true };
  return new RunHandle(new StubRun(plan), 'stub');
}

/** MOB-030 "Continue": rebuild a run from its plan and replay the stored responses (rule cards are acknowledged on the way). */
export function resumeRun(plan: RunPlan, responses: (DecisionResponse | null)[]): RunHandle | null {
  let h: RunHandle;
  if (isRunnerPlan(plan)) h = new RunHandle(new RunnerRun(plan), 'runner');
  else { const c = isStubPlan(plan) ? null : coreFromPlan(plan); h = c ? new RunHandle(c, 'core') : new RunHandle(new StubRun(plan), 'stub'); }
  try {
    let i = 0;
    for (let guard = 0; guard < 400 && i < responses.length; guard++) {
      const s = h.current(); if (!s) break;
      if (s.type === 'rule') h.ack(); else h.answer(responses[i++] ?? null);
    }
    return h;
  } catch { return null; }
}
