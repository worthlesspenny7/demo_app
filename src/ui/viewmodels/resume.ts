/**
 * Resilience (UI-018): serialisable run specs and deterministic restore through the engine's action log.
 * A run is fully described by its scenario spec (drill id / seed / tier or built-in name / seed), the driver and watch
 * settings it started with, and result().actions; replaying those reproduces the simulator exactly (SIM-022).
 */
import { Simulator, replay, ENGINE_VERSION, type Action } from '../../core/sim.js';
import type { Scenario } from '../../core/course.js';

export type StoredSource = { kind: 'drill'; drillId: string; tier: number; seed: number } | { kind: 'builtin'; name: string; seed: number };
export type StoredAction = { tick: number; action: Action };

export interface StoredRun {
  v: 1;
  engineVersion: string;
  source: StoredSource;
  driverSkill: string;
  watch: 'analog' | 'digital';
  actions: StoredAction[];
  /** Simulator tick when saved (live runs); for finished runs the replay simply runs to the end. */
  tick: number;
  annotations: string | null;
  scaleMax: number;
  aborted?: boolean;
  savedAt: number;
}

export const LIVE_KEY = 'rally-trainer.live-run.v1';
export const LAST_KEY = 'rally-trainer.last-run.v1';

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
function defaultStore(): KeyValueStore | null { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(LIVE_KEY); return localStorage; } } catch { /* blocked */ } return null; }

export function saveStored(key: string, run: StoredRun, store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try { store.setItem(key, JSON.stringify(run)); return true; } catch { return false; }
}
export function loadStored(key: string, store: KeyValueStore | null = defaultStore()): StoredRun | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key); if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredRun>;
    if (!p || p.v !== 1 || !p.source || !Array.isArray(p.actions)) return null;
    return p as StoredRun;
  } catch { return null; }
}
export function clearStored(key: string, store: KeyValueStore | null = defaultStore()): void { try { store?.removeItem(key); } catch { /* ignore */ } }

export function snapshotRun(sim: Simulator, source: StoredSource, extra: { driverSkill: string; watch: 'analog' | 'digital'; annotations: string | null; scaleMax: number; aborted?: boolean }, now = Date.now()): StoredRun {
  return { v: 1, engineVersion: ENGINE_VERSION, source, driverSkill: extra.driverSkill, watch: extra.watch, actions: sim.actions.map(a => ({ tick: a.tick, action: a.action })), tick: sim.tick, annotations: extra.annotations, scaleMax: extra.scaleMax, aborted: extra.aborted, savedAt: now };
}

/** Rebuild a live simulator at `toTick` by re-applying the logged actions at their ticks. Throws if the engine version differs. */
export function restoreSim(scenario: Scenario, run: Pick<StoredRun, 'actions' | 'tick' | 'engineVersion' | 'watch'>): Simulator {
  if (run.engineVersion !== ENGINE_VERSION) throw new Error(`run recorded with engine ${run.engineVersion}, current ${ENGINE_VERSION}`);
  const sim = new Simulator(scenario, { watch: run.watch });
  const sorted = [...run.actions].sort((a, b) => a.tick - b.tick);
  let i = 0;
  const apply = (): void => { while (i < sorted.length && sorted[i]!.tick <= sim.tick) { sim.act(sorted[i]!.action); i++; } };
  while (sim.tick < run.tick && sim.phase !== 'finished') { apply(); sim.step(0.1); }
  apply();
  return sim;
}

/** Re-run a finished (or aborted) run to its end so the Debrief can be rebuilt after a reload. */
export function replayFinished(scenario: Scenario, run: Pick<StoredRun, 'actions' | 'engineVersion' | 'watch'>): Simulator {
  return replay(scenario, run.actions, { watch: run.watch, engineVersion: run.engineVersion });
}

/** Short human label, e.g. "D11 Bronze seed 3". */
export function describeSource(s: StoredSource, tierNames: string[] = ['Bronze', 'Silver', 'Gold']): string {
  return s.kind === 'drill' ? `${s.drillId} ${tierNames[s.tier] ?? `tier ${s.tier}`} seed ${s.seed}` : `${s.name} #${s.seed}`;
}
