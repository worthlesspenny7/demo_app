/** App state: settings (persisted), the current run, scenario sources (drills or built-ins). */
import type { Scenario, DriverSkill } from '../core/course.js';
import { DRIVER_DAD_ROOKIE, DRIVER_DAD_SPORTSMAN, DRIVER_EXPERT } from '../core/course.js';
import type { Simulator, StageResult } from '../core/sim.js';
import type { Drill } from '../core/drills/types.js';
import { createProgressStore, type ProgressStore } from './viewmodels/progress.js';
import { builtinScenario } from '../agent/scenarios.js';

export interface Settings { watch: 'analog' | 'digital'; timeScale: number; driverSkill: DriverSkill | 'scenario'; theme: 'dusk' | 'light'; muted: boolean; speech: boolean; showHelp: boolean }
export const DEFAULT_SETTINGS: Settings = { watch: 'analog', timeScale: 1, driverSkill: 'scenario', theme: 'dusk', muted: false, speech: true, showHelp: false };
const SETTINGS_KEY = 'rally-trainer.settings.v1';

export function loadSettings(): Settings {
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) { const p = JSON.parse(raw) as Partial<Settings>; return { ...DEFAULT_SETTINGS, ...p }; } } catch { /* blocked */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: Settings): void { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } applyTheme(s); }
export function applyTheme(s: Settings): void { try { document.documentElement.dataset.theme = s.theme === 'light' ? 'light' : 'dusk'; } catch { /* ssr */ } }

/** What is being played: a drill (id/tier/seed) or a built-in scenario. */
export type RunSource = { kind: 'drill'; drillId: string; tier: number; seed: number } | { kind: 'builtin'; name: string; seed: number };

export interface Run { source: RunSource; scenario: Scenario; sim: Simulator; drill: Drill | null; result: StageResult | null; scaleMax: number; watch: 'analog' | 'digital'; annotations: string | null }

export const app: { settings: Settings; progress: ProgressStore; run: Run | null; lastResult: { run: Run; result: StageResult } | null } = {
  settings: loadSettings(), progress: createProgressStore(), run: null, lastResult: null,
};

export function withDriver(sc: Scenario, skill: Settings['driverSkill']): Scenario {
  if (skill === 'scenario') return sc;
  const driver = skill === 'expert' ? DRIVER_EXPERT : skill === 'sportsman' ? DRIVER_DAD_SPORTSMAN : DRIVER_DAD_ROOKIE;
  return { ...sc, driver };
}

export function builtinScenarios(): { name: string; seed: number; title: string; blurb: string; minutes: number }[] {
  return [
    ...[1, 2, 3, 4, 5].map(seed => ({ name: 'varied', seed, title: `Varied leg #${seed}`, blurb: 'Two stops, a speed sign, a timed segment, a T, a driveway trap, two hidden checkpoints. Great Race legal aids, sportsman driver, occasional cross traffic.', minutes: 9 })),
    { name: 'onestop', seed: 1, title: 'One stop', blurb: 'Half a mile, one STOP with Pause 15, half a mile, checkpoint. The purest pause-arithmetic exercise.', minutes: 3 },
    { name: 'straight', seed: 1, title: 'One mile straight', blurb: 'Start on time, hold 30, cross the checkpoint. Learn the standing-start loss.', minutes: 3 },
  ];
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
