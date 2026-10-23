/**
 * Decision-mode progress (MOB-030 / MOB-031 / MOB-032): five skill meters that fill with correct decisions and drain with misses and idle
 * days, a streak by calendar day, the daily set (three runs per date, seeds from the date), the legal-rung unlock per skill at 80 % and
 * the boss run when every meter is at 60 %. Persisted as JSON through the same Storage-like interface as the Desk progress
 * (src/ui/viewmodels/progress.ts; the caller passes it in, the core never touches localStorage), under its own key so the Desk data (drill stars, aces, runs) is never rewritten; a run that stands in
 * for a Desk drill records its stars there through `desk.recordRun`.
 */
import { SKILLS, type DecisionProgressState, type DecisionResponse, type RunPlan, type RunResult, type Skill, type SkillMeter } from './types.js';
import { dailySeed, Scheduler } from './scheduler.js';

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }
/** The Desk progress store's recordRun (src/ui/viewmodels/progress.ts ProgressStore), for MOB-032. */
export interface DeskRecorder { recordRun(drillId: string, run: { stars: number; aces: number; score: number; raw?: number; unit?: 'raw' | 'wrong' }): unknown }

export const DECISION_PROGRESS_KEY = 'rally-trainer.decision.v1';
/** A meter gains this share of the way to full on a correct decision ... */
export const METER_GAIN = 0.12;
/** ... and loses this share of its value on a miss. */
export const METER_LOSS = 0.2;
/** Idle decay: after this many idle days a meter drops IDLE_DECAY per further day. */
export const IDLE_GRACE_DAYS = 3;
export const IDLE_DECAY = 0.02;
export const LEGAL_UNLOCK = 0.8;
export const BOSS_UNLOCK = 0.6;
/** A passed skill whose meter falls below this is failing again: its rule cards come back. */
export const FAILING_BELOW = 0.5;
export const DAILY_RUNS = 3;

const emptyMeter = (): SkillMeter => ({ value: 0, correct: 0, total: 0, lastDay: null, passed: false });
export function emptyProgress(): DecisionProgressState {
  return { version: 1, meters: Object.fromEntries(SKILLS.map(s => [s, emptyMeter()])) as Record<Skill, SkillMeter>, streak: { current: 0, best: 0, lastDay: null }, daily: { day: null, completed: [], best: {} }, rulesSeen: [], unfinished: null, runs: 0 };
}

/** "2026-10-23" for a Date in local time (the caller supplies the date: the core never reads the clock). */
export function dayKey(d: Date): string { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
/** Whole calendar days from `a` to `b` ("YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string): number => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y!, (m ?? 1) - 1, d ?? 1); };
  return Math.round((t(b) - t(a)) / 86400000);
}

function sanitize(x: unknown): DecisionProgressState {
  const base = emptyProgress();
  if (!x || typeof x !== 'object') return base;
  const o = x as Partial<DecisionProgressState>;
  const num = (v: unknown, lo: number, hi: number, d: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const str = (v: unknown): string | null => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  for (const s of SKILLS) {
    const m = (o.meters as Record<string, Partial<SkillMeter>> | undefined)?.[s];
    if (m && typeof m === 'object') base.meters[s] = { value: num(m.value, 0, 1, 0), correct: Math.round(num(m.correct, 0, 1e9, 0)), total: Math.round(num(m.total, 0, 1e9, 0)), lastDay: str(m.lastDay), passed: m.passed === true };
  }
  if (o.streak && typeof o.streak === 'object') base.streak = { current: Math.round(num(o.streak.current, 0, 1e6, 0)), best: Math.round(num(o.streak.best, 0, 1e6, 0)), lastDay: str(o.streak.lastDay) };
  if (o.daily && typeof o.daily === 'object') {
    base.daily.day = str(o.daily.day);
    base.daily.completed = Array.isArray(o.daily.completed) ? [...new Set(o.daily.completed.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < DAILY_RUNS))] : [];
    if (o.daily.best && typeof o.daily.best === 'object') for (const [k, v] of Object.entries(o.daily.best)) if (/^\d{4}-\d{2}-\d{2}(:\d)?$/.test(k) && typeof v === 'number' && Number.isFinite(v)) base.daily.best[k] = Math.max(0, Math.min(3, Math.round(v)));
  }
  base.rulesSeen = Array.isArray(o.rulesSeen) ? o.rulesSeen.filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(-200) : [];
  if (o.unfinished && typeof o.unfinished === 'object' && o.unfinished.plan && Array.isArray(o.unfinished.plan.items) && Array.isArray(o.unfinished.responses)) base.unfinished = { plan: o.unfinished.plan, responses: o.unfinished.responses.slice(0, 60) as (DecisionResponse | null)[] };
  base.runs = Math.round(num(o.runs, 0, 1e9, 0));
  return base;
}

/** Meter value 0..1 on `day` after the idle decay (IDLE_DECAY per day beyond IDLE_GRACE_DAYS). */
export function meterValue(p: DecisionProgressState, skill: Skill, day?: string): number {
  const m = p.meters[skill]; if (!m) return 0; if (!m.lastDay || !day) return m.value;
  const idle = daysBetween(m.lastDay, day) - IDLE_GRACE_DAYS;
  return idle > 0 ? Math.max(0, m.value - idle * IDLE_DECAY) : m.value;
}
/** MOB-031: the legal rung is offered per skill at 80 %. */
export function legalUnlocked(p: DecisionProgressState, skill: Skill, day?: string): boolean { return meterValue(p, skill, day) >= LEGAL_UNLOCK; }
/** MOB-031: the boss run unlocks when every meter is at 60 % or more. */
export function bossUnlocked(p: DecisionProgressState, day?: string): boolean { return SKILLS.every(s => meterValue(p, s, day) >= BOSS_UNLOCK); }
/**
 * Fold a finished run into the state (pure; returns a new state): idle decay made real, each verdict moves its meter (a correct one
 * METER_GAIN of the way to 1, a miss loses METER_LOSS of it), `passed` at 80 % (lost again below 50 %), the streak by calendar day,
 * the rule cards seen, the run count; clears the unfinished run. The daily set is recorded by Progress.recordRun (it needs the plan).
 */
export function applyRunResult(p0: DecisionProgressState, result: RunResult, day: string): DecisionProgressState {
  const d = sanitize(p0);
  for (const s of SKILLS) d.meters[s].value = meterValue(d, s, day);
  for (const v of result.verdicts) {
    const m = d.meters[v.skill]; if (!m) continue;
    m.total++; if (v.correct) { m.correct++; m.value = m.value + METER_GAIN * (1 - m.value); } else m.value = m.value * (1 - METER_LOSS);
    m.value = Math.round(m.value * 1000) / 1000; m.lastDay = day;
    if (m.value >= LEGAL_UNLOCK) m.passed = true; else if (m.value < FAILING_BELOW) m.passed = false;
  }
  const st = d.streak;
  if (st.lastDay !== day) { st.current = st.lastDay && daysBetween(st.lastDay, day) === 1 ? st.current + 1 : 1; st.lastDay = day; st.best = Math.max(st.best, st.current); }
  d.rulesSeen = [...new Set([...d.rulesSeen, ...result.ruleCardsShown])].slice(-200);
  d.unfinished = null; d.runs++;
  return d;
}

export class Progress {
  private data: DecisionProgressState;
  private readonly store: StorageLike | null;
  constructor(storage: StorageLike | null = null, readonly key = DECISION_PROGRESS_KEY, private readonly desk: DeskRecorder | null = null) {
    this.store = storage;
    let parsed: unknown = null;
    try { const raw = this.store?.getItem(key); if (raw) parsed = JSON.parse(raw); } catch { parsed = null; }
    this.data = sanitize(parsed);
  }
  /** A copy of the stored state. */
  state(): DecisionProgressState { return JSON.parse(JSON.stringify(this.data)) as DecisionProgressState; }
  private save(): boolean { try { this.store?.setItem(this.key, JSON.stringify(this.data)); return !!this.store; } catch { return false; } }

  /** Meter value 0..1 on `day`, after idle decay (no decay is stored until the next run). */
  meter(skill: Skill, day?: string): number { return meterValue(this.data, skill, day); }
  meters(day?: string): Record<Skill, number> { return Object.fromEntries(SKILLS.map(s => [s, this.meter(s, day)])) as Record<Skill, number>; }
  /** MOB-031: the legal rung (no hints, no chart cell, clock minute withheld) is offered per skill at 80 %. */
  legalUnlocked(skill: Skill, day?: string): boolean { return legalUnlocked(this.data, skill, day); }
  /** MOB-031: the boss run unlocks when every meter is at 60 % or more. */
  bossUnlocked(day?: string): boolean { return bossUnlocked(this.data, day); }
  /** A skill whose rule cards the Scheduler still shows (not passed, or passed and failing again). */
  needsRules(skill: Skill, day?: string): boolean { return !this.data.meters[skill].passed || this.meter(skill, day) < FAILING_BELOW; }
  /** The weakest skill (for "next"). */
  weakest(day?: string): Skill { return [...SKILLS].sort((a, b) => this.meter(a, day) - this.meter(b, day))[0]!; }

  /** MOB-030: the three daily-set seeds for `day` (the same all day). */
  dailySeeds(day: string): number[] { return Array.from({ length: DAILY_RUNS }, (_, i) => dailySeed(day, i)); }
  dailyPlan(index: number, day: string, rung: 0 | 1 | 2 | 3 = 2): RunPlan { return Scheduler.daily(day, index, this.schedulerView(day), rung).plan(); }
  /** Which daily runs are done today (indexes 0..2). */
  dailyDone(day: string): number[] { return this.data.daily.day === day ? this.data.daily.completed.slice() : []; }
  /** The state the Scheduler reads: rule cards come back for a skill that is failing again. */
  schedulerView(day: string): DecisionProgressState {
    const v = this.state();
    for (const s of SKILLS) v.meters[s] = { ...v.meters[s], value: this.meter(s, day), passed: !this.needsRules(s, day) };
    return v;
  }
  /** Start a practice run on `skills` (the School's "try it"). */
  practicePlan(skills: Skill[], seed: number, day: string, rung?: 0 | 1 | 2 | 3): RunPlan {
    const r = rung ?? (skills.length > 0 && skills.every(s => this.legalUnlocked(s, day)) ? 0 : 2);
    return new Scheduler(skills, seed, this.schedulerView(day), { mode: 'practice', rung: r }).plan();
  }

  /** Record a finished run: meters, streak, daily set, rule cards seen; clears "Continue"; the Desk drill stars when the run was a drill. */
  recordRun(result: RunResult, plan: Pick<RunPlan, 'mode' | 'day' | 'dailyIndex' | 'drillId'> | null, day: string): DecisionProgressState {
    const d = this.data = applyRunResult(this.data, result, day);
    if (plan?.mode === 'daily' && typeof plan.dailyIndex === 'number' && (plan.day ?? day) === day) {
      if (d.daily.day !== day) d.daily = { day, completed: [], best: d.daily.best };
      if (!d.daily.completed.includes(plan.dailyIndex)) d.daily.completed = [...d.daily.completed, plan.dailyIndex].sort();
      const k = `${day}:${plan.dailyIndex}`; d.daily.best[k] = Math.max(d.daily.best[k] ?? 0, result.stars);
      const keys = Object.keys(d.daily.best).sort(); while (keys.length > 90) delete d.daily.best[keys.shift()!];
    }
    if (plan?.drillId && this.desk) { try { this.desk.recordRun(plan.drillId, { stars: result.stars, aces: 0, score: result.secondsTotal, raw: result.secondsTotal, unit: 'raw' }); } catch { /* the Desk store is optional */ } }
    this.save();
    return this.state();
  }
  markRuleSeen(id: string): void { if (!this.data.rulesSeen.includes(id)) { this.data.rulesSeen.push(id); this.save(); } }
  /** MOB-030 "Continue": the unfinished run (plan + answers so far); DecisionRun.restore(plan, responses) rebuilds it. */
  saveUnfinished(plan: RunPlan, responses: (DecisionResponse | null)[]): void { this.data.unfinished = { plan, responses: responses.slice() }; this.save(); }
  unfinished(): DecisionProgressState['unfinished'] { return this.data.unfinished ? JSON.parse(JSON.stringify(this.data.unfinished)) as DecisionProgressState['unfinished'] : null; }
  clearUnfinished(): void { this.data.unfinished = null; this.save(); }
  reset(): void { this.data = emptyProgress(); try { this.store?.removeItem?.(this.key); } catch { /* ignore */ } }
}
