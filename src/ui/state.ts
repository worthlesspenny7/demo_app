/** App state: settings (persisted), the current run, scenario sources (drills or built-ins). */
import type { Scenario, DriverSkill } from '../core/course.js';
import { DRIVER_DAD_ROOKIE, DRIVER_DAD_SPORTSMAN, DRIVER_EXPERT } from '../core/course.js';
import type { Simulator, StageResult } from '../core/sim.js';
import type { Drill } from '../core/drills/types.js';
import { createProgressStore, type ProgressStore } from './viewmodels/progress.js';
import { builtinScenario as agentBuiltin } from '../agent/scenarios.js';
import { generateStage } from '../core/generator/generate.js';
import { allDrills } from '../core/drills/index.js';
import { scenarioMinutes } from './viewmodels/estimate.js';
import { loadStored, replayFinished, LAST_KEY, type StoredSource } from './viewmodels/resume.js';

export interface Settings { watch: 'analog' | 'digital'; /** UI-033: the time-of-day clock; analog by default, a digital readout is optional. The stopwatch defaults to digital (HB p.5); analog stays selectable. */ clock: 'analog' | 'digital'; timeScale: number; driverSkill: DriverSkill | 'scenario'; theme: 'dusk' | 'light'; muted: boolean; speech: boolean; showHelp: boolean }
export const DEFAULT_SETTINGS: Settings = { watch: 'digital', clock: 'analog', timeScale: 1, driverSkill: 'scenario', theme: 'dusk', muted: false, speech: true, showHelp: false };
const SETTINGS_KEY = 'rally-trainer.settings.v1';

export function loadSettings(): Settings {
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) { const p = JSON.parse(raw) as Partial<Settings>; return { ...DEFAULT_SETTINGS, ...p }; } } catch { /* blocked */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } applyTheme(s); }
export function applyTheme(s: Settings): void { try { document.documentElement.dataset.theme = s.theme === 'light' ? 'light' : 'dusk'; } catch { /* ssr */ } }

/** What is being played: a drill (id/tier/seed) or a built-in scenario. */
export type RunSource = { kind: 'drill'; drillId: string; tier: number; seed: number } | { kind: 'builtin'; name: string; seed: number };

export interface Run { source: RunSource; scenario: Scenario; sim: Simulator; drill: Drill | null; result: StageResult | null; scaleMax: number; watch: 'analog' | 'digital'; annotations: string | null; aborted?: boolean }

export const app: { settings: Settings; progress: ProgressStore; run: Run | null; lastResult: { run: Run; result: StageResult } | null; /** Home asked the cockpit to restore the saved live run. */ resume: boolean; /** One-shot note shown on Home (e.g. a locked route redirected here). */ homeNote: string } = {
  settings: loadSettings(), progress: createProgressStore(), run: null, lastResult: null, resume: false, homeNote: '',
};

/** Rebuild the last finished run from its stored action log (the Debrief survives a reload). */
export function restoreLastRun(): { run: Run; result: StageResult } | null {
  if (app.lastResult) return app.lastResult;
  const st = loadStored(LAST_KEY); if (!st) return null;
  try {
    let drills: Drill[] = []; try { drills = allDrills(); } catch { drills = []; }
    const source: RunSource = st.source as StoredSource;
    const built = buildScenario(source, drills); if (!built) return null;
    const scenario = withDriver(built.scenario, st.driverSkill as Settings['driverSkill']);
    const sim = replayFinished(scenario, st);
    const result = sim.result();
    const run: Run = { source, scenario, sim, drill: built.drill, result, scaleMax: st.scaleMax, watch: st.watch, annotations: st.annotations, aborted: !!st.aborted };
    app.lastResult = { run, result };
    return app.lastResult;
  } catch { return null; }
}

export function withDriver(sc: Scenario, skill: Settings['driverSkill']): Scenario {
  if (skill === 'scenario') return sc;
  const driver = skill === 'expert' ? DRIVER_EXPERT : skill === 'sportsman' ? DRIVER_DAD_SPORTSMAN : DRIVER_DAD_ROOKIE;
  return { ...sc, driver };
}

export function builtinScenarios(): { name: string; seed: number; title: string; blurb: string; minutes: number }[] {
  return withComputedMinutes([
    ...[1, 2, 3, 4, 5].map(seed => ({ name: 'varied', seed, title: `Varied leg #${seed}`, blurb: 'Two stops, a speed sign, a timed segment, a T, a driveway trap, two hidden checkpoints. Great Race legal aids, sportsman driver, occasional cross traffic.', minutes: 9 })),
    { name: 'onestop', seed: 1, title: 'One stop', blurb: 'Half a mile, one STOP with a 0m15s pause, half a mile, checkpoint. The purest pause-arithmetic exercise.', minutes: 3 },
    { name: 'stage', seed: 1, title: 'A full day stage', blurb: 'A generated day in the Great Race format: tire warm-up, speedometer calibration run, ASP restarts, transits, a free zone, TA points and the finish. Long: use the 8x time scale between hazards.', minutes: 240 },
    { name: 'straight', seed: 1, title: 'One mile straight', blurb: 'Start on time, hold 30, cross the checkpoint. Learn the standing-start loss.', minutes: 3 },
  ]);
}
/** Built-in scenarios plus the generated full day stage (`stage`): tire warm-up, calibration, restarts with ASP, transits, TA points, finish. */
export function builtinScenario(name: string, seed = 1): Scenario { return name === 'stage' ? generateStage(seed) : agentBuiltin(name, seed); }

const minutesCache = new Map<string, number>();
/** Replace the hand-typed guesses with the 1x ghost time of each built-in scenario (falls back to the guess). */
function withComputedMinutes<T extends { name: string; seed: number; minutes: number }>(list: T[]): T[] {
  return list.map(b => { const key = `${b.name}:${b.seed}`; try { let m = minutesCache.get(key); if (m === undefined) { m = scenarioMinutes(builtinScenario(b.name, b.seed)); minutesCache.set(key, m); } return { ...b, minutes: m }; } catch { return b; } });
}

export function buildScenario(src: RunSource, drills: Drill[]): { scenario: Scenario; drill: Drill | null } | null {
  try {
    if (src.kind === 'builtin') return { scenario: builtinScenario(src.name, src.seed), drill: null };
    const d = drills.find(x => x.id === src.drillId); if (!d) return null;
    return { scenario: d.scenario(src.seed, src.tier), drill: d };
  } catch { return null; }
}

export function parseSource(parts: string[]): RunSource | null {
  // #/cockpit/drill/D03/0/7   or   #/cockpit/builtin/varied/3
  const [kind, a, b, c] = parts;
  if (kind === 'drill' && a) return { kind: 'drill', drillId: a, tier: Number(b ?? 0) || 0, seed: Number(c ?? 1) || 1 };
  if (kind === 'builtin' && a) return { kind: 'builtin', name: a, seed: Number(b ?? 1) || 1 };
  return null;
}
export function sourceHash(src: RunSource): string { return src.kind === 'drill' ? `#/cockpit/drill/${src.drillId}/${src.tier}/${src.seed}` : `#/cockpit/builtin/${src.name}/${src.seed}`; }

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | boolean | null | undefined> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v); else if (k === 'html') e.innerHTML = String(v); else if (k.startsWith('on') && typeof v === 'function') { /* not used */ } else e.setAttribute(k, String(v === true ? '' : v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
export function escapeHtml(s: unknown): string { return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch)); }
