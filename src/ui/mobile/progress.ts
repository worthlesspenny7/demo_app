/**
 * Decision-mode progress on the phone (MOB-030/031/032): skill meters, streak, the daily set (three runs re-randomised per calendar
 * day), the unfinished run for "Continue", the legal-rung and Boss unlocks. The state is the core's DecisionProgressState, kept in
 * localStorage next to the Desk progress (an in-memory fallback when storage is blocked). Feature detection: when the core exports
 * its own Progress helpers (src/core/decision/progress.ts, pending) this module defers to them for meters and unlocks.
 */
import * as core from '../../core/decision/index.js';
import { SKILLS, type DecisionProgressState, type DecisionResponse, type RunPlan, type RunResult, type Skill, type SkillMeter } from '../../core/decision/index.js';

export const DECISION_PROGRESS_KEY = 'rally-trainer.decision.v1';
export const DAILY_RUNS = 3;
export const LEGAL_AT = 0.8;
export const BOSS_AT = 0.6;

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }

const meter = (): SkillMeter => ({ value: 0, correct: 0, total: 0, lastDay: null, passed: false });
export function emptyProgress(): DecisionProgressState {
  return { version: 1, meters: Object.fromEntries(SKILLS.map(s => [s, meter()])) as Record<Skill, SkillMeter>, streak: { current: 0, best: 0, lastDay: null }, daily: { day: null, completed: [], best: {} }, rulesSeen: [], unfinished: null, runs: 0 };
}

/** Local calendar day "2026-10-23". */
export function dayKey(d: Date = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function prevDay(day: string): string { const [y, m, d] = day.split('-').map(Number); const t = new Date(y!, (m ?? 1) - 1, (d ?? 1) - 1); return dayKey(t); }
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }
/** MOB-030: the three daily-set seeds of a calendar day (the same all day, new the next day). */
export function dailySeeds(day: string): number[] {
  const coreSeed = (core as unknown as { dailySeed?: (day: string, i: number) => number }).dailySeed;   // the core's seeds when it exports them (src/core/decision/scheduler.ts)
  return Array.from({ length: DAILY_RUNS }, (_, i) => { if (typeof coreSeed === 'function') { try { return coreSeed(day, i); } catch { /* fall back */ } } return hash(`daily:${day}:${i}`) % 1_000_000 + 1; });
}
/** The skill plan of daily run i: run 0 all five, run 1 the two weakest, run 2 all five again. */
export function dailySkills(p: DecisionProgressState, i: number): Skill[] {
  if (i !== 1) return [...SKILLS];
  return [...SKILLS].sort((a, b) => p.meters[a].value - p.meters[b].value).slice(0, 2);
}

export function normalize(raw: unknown): DecisionProgressState {
  const e = emptyProgress(); if (!raw || typeof raw !== 'object') return e;
  const r = raw as Partial<DecisionProgressState>;
  const meters = { ...e.meters };
  for (const s of SKILLS) { const m = r.meters?.[s]; if (m && typeof m.value === 'number') meters[s] = { ...meter(), ...m, value: Math.max(0, Math.min(1, m.value)) }; }
  return {
    version: 1, meters,
    streak: { ...e.streak, ...(r.streak ?? {}) },
    daily: { day: r.daily?.day ?? null, completed: Array.isArray(r.daily?.completed) ? r.daily!.completed.filter(n => typeof n === 'number') : [], best: r.daily?.best ?? {} },
    rulesSeen: Array.isArray(r.rulesSeen) ? r.rulesSeen.filter(x => typeof x === 'string') : [],
    unfinished: r.unfinished && Array.isArray(r.unfinished.plan?.items) && Array.isArray(r.unfinished.responses) ? r.unfinished : null,
    runs: typeof r.runs === 'number' ? r.runs : 0,
  };
}

function ls(): KV | null { try { if (typeof localStorage === 'undefined') return null; localStorage.getItem(DECISION_PROGRESS_KEY); return localStorage; } catch { return null; } }
let memory: DecisionProgressState | null = null;
export function loadProgress(store: KV | null = ls()): DecisionProgressState {
  try { const raw = store?.getItem(DECISION_PROGRESS_KEY); if (raw) return (memory = normalize(JSON.parse(raw))); } catch { /* corrupt or blocked */ }
  return memory ?? (memory = emptyProgress());
}
export function saveProgress(p: DecisionProgressState, store: KV | null = ls()): boolean {
  memory = p; try { store?.setItem(DECISION_PROGRESS_KEY, JSON.stringify(p)); return !!store; } catch { return false; }
}

/** Today's daily set: which of the three runs are done (a new day clears the list). */
export function dailyState(p: DecisionProgressState, day = dayKey()): { day: string; seeds: number[]; completed: number[]; next: number | null } {
  const completed = p.daily.day === day ? p.daily.completed : [];
  const next = [0, 1, 2].find(i => !completed.includes(i)) ?? null;
  return { day, seeds: dailySeeds(day), completed, next };
}

/** Core helper names this module defers to when the core publishes them. */
type CoreProgress = { applyRunResult?: (p: DecisionProgressState, r: RunResult, day: string) => DecisionProgressState; legalUnlocked?: (p: DecisionProgressState, s: Skill) => boolean; bossUnlocked?: (p: DecisionProgressState) => boolean };
const coreP = (): CoreProgress => core as unknown as CoreProgress;

/** MOB-031: meters fill with correct decisions and are decayed by misses (each card moves the meter 15 % of the way to 1 or to 0). */
export function updateMeter(m: SkillMeter, correct: boolean, day: string): SkillMeter {
  const value = Math.max(0, Math.min(1, correct ? m.value + (1 - m.value) * 0.15 : m.value * 0.85));
  return { value: Math.round(value * 1000) / 1000, correct: m.correct + (correct ? 1 : 0), total: m.total + 1, lastDay: day, passed: m.passed || value >= LEGAL_AT };
}

/** Fold a finished run into the progress: meters, streak, daily completion, rules seen; clears the unfinished run. */
export function recordRun(p0: DecisionProgressState, r: RunResult, opts: { day?: string; dailyIndex?: number | null } = {}): DecisionProgressState {
  const day = opts.day ?? dayKey();
  const fn = coreP().applyRunResult;
  let p: DecisionProgressState;
  if (typeof fn === 'function') { try { p = normalize(fn(structuredClone(p0), r, day)); } catch { p = structuredClone(p0); } }
  else {
    p = structuredClone(p0);
    for (const v of r.verdicts) p.meters[v.skill] = updateMeter(p.meters[v.skill], v.correct, day);
    p.rulesSeen = [...new Set([...p.rulesSeen, ...r.ruleCardsShown])];
    p.runs += 1;
  }
  // streak: one per calendar day with a finished run
  if (p.streak.lastDay !== day) { p.streak.current = p.streak.lastDay === prevDay(day) ? p.streak.current + 1 : 1; p.streak.lastDay = day; p.streak.best = Math.max(p.streak.best, p.streak.current); }
  if (opts.dailyIndex !== undefined && opts.dailyIndex !== null) {
    if (p.daily.day !== day) p.daily = { day, completed: [], best: p.daily.best };
    if (!p.daily.completed.includes(opts.dailyIndex)) p.daily.completed = [...p.daily.completed, opts.dailyIndex].sort();
    const k = `${day}:${opts.dailyIndex}`; p.daily.best = { ...p.daily.best, [k]: Math.max(p.daily.best[k] ?? 0, r.stars) };
  }
  p.unfinished = null;
  return p;
}

export function setUnfinished(p: DecisionProgressState, plan: RunPlan, responses: (DecisionResponse | null)[]): DecisionProgressState {
  return { ...p, unfinished: { plan, responses: responses.map(x => x ?? null) } };
}
export function clearUnfinished(p: DecisionProgressState): DecisionProgressState { return { ...p, unfinished: null }; }

/** MOB-031: a skill offers its legal-rung runs at 80 %. */
export function legalUnlocked(p: DecisionProgressState, s: Skill): boolean {
  const fn = coreP().legalUnlocked; if (typeof fn === 'function') { try { return fn(p, s); } catch { /* fall back */ } }
  return p.meters[s].value >= LEGAL_AT || p.meters[s].passed;
}
/** MOB-031: the Boss run (a full generated leg, about 25 cards) opens when all five meters are at 60 % or more. */
export function bossUnlocked(p: DecisionProgressState): boolean {
  const fn = coreP().bossUnlocked; if (typeof fn === 'function') { try { return fn(p); } catch { /* fall back */ } }
  return SKILLS.every(s => p.meters[s].value >= BOSS_AT);
}
