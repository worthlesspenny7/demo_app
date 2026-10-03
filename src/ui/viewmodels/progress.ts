/** Progress store (UI-008): drill stars / aces / best score in localStorage with an in-memory fallback. */
export interface DrillProgress {
  /** Best stars over all tiers (what unlocks use). */
  stars: 0 | 1 | 2 | 3; aces: number; bestScore: number | null; runs: number; lastScore: number | null; lastPlayed: number;
  /** Best stars per tier index (0 Bronze, 1 Silver, 2 Gold). Absent in progress saved before tiers were tracked. */
  tierStars?: number[];
}
export interface RunRecord {
  id: string; at: number;
  /** Rubric score (drive drills: mean |leg error| in s; quiz/math: wrong answers). */
  score: number; stars: number; aces: number; scale: number; errors?: Partial<Record<string, number[]>>;
  /** Raw stage points in seconds, the same number the Debrief headline shows (drive drills and built-ins only). */
  raw?: number; tier?: number; unit?: 'raw' | 'wrong';
}
export interface ProgressData { version: 1; drills: Record<string, DrillProgress>; lessons: Record<string, boolean>; runs?: RunRecord[]; maneuvers?: Record<string, number[]> }

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

export const PROGRESS_KEY = 'rally-trainer.progress.v1';

function empty(): ProgressData { return { version: 1, drills: {}, lessons: {}, runs: [], maneuvers: {} }; }
export const HISTORY_RUNS = 10;

export interface ProgressStore {
  load(): ProgressData;
  save(data: ProgressData): boolean;
  get(drillId: string): DrillProgress | undefined;
  /** Merge a finished run: stars keep the max, aces accumulate, best score keeps the min. Returns the merged entry. */
  recordRun(drillId: string, run: { stars: number; aces: number; score: number; scale?: number; errors?: Partial<Record<string, number[]>>; raw?: number; tier?: number; unit?: 'raw' | 'wrong' }): DrillProgress;
  /** Per-maneuver-type errors from the last HISTORY_RUNS runs (DEBRIEF-003). */
  maneuverHistory(): Record<string, number[]>;
  recentRuns(limit?: number): RunRecord[];
  markLesson(id: string, done?: boolean): void;
  lessonDone(id: string): boolean;
  reset(): void;
  readonly persistent: boolean;
}

export function createProgressStore(storage?: StorageLike | null, key = PROGRESS_KEY): ProgressStore {
  let memory: ProgressData | null = null;
  let persistent = false; let probed = false;
  const store: StorageLike | null = storage ?? defaultStorage();
  const read = (): ProgressData => {
    if (store) {
      probed = true;
      try {
        const raw = store.getItem(key);
        persistent = true;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ProgressData>;
          if (parsed && typeof parsed === 'object') {
            memory = { version: 1, drills: isRecord(parsed.drills) ? parsed.drills as Record<string, DrillProgress> : {}, lessons: isRecord(parsed.lessons) ? parsed.lessons as Record<string, boolean> : {}, runs: Array.isArray(parsed.runs) ? parsed.runs as RunRecord[] : [], maneuvers: isRecord(parsed.maneuvers) ? parsed.maneuvers as Record<string, number[]> : {} };
            return memory;
          }
        }
      } catch { persistent = false; }
    }
    memory ??= empty();
    return memory;
  };
  const write = (data: ProgressData): boolean => {
    memory = data;
    if (!store) return false;
    try { store.setItem(key, JSON.stringify(data)); persistent = true; return true; } catch { persistent = false; return false; }
  };
  const api: ProgressStore = {
    load: read,
    save: write,
    get: id => read().drills[id],
    recordRun(id, run) {
      const d = read();
      const prev = d.drills[id];
      const stars = clampStars(Math.max(prev?.stars ?? 0, run.stars));
      const score = Number.isFinite(run.score) ? run.score : null;
      const tierStars = [...(prev?.tierStars ?? [])];
      if (typeof run.tier === 'number' && run.tier >= 0 && run.tier < 3) { while (tierStars.length < 3) tierStars.push(0); tierStars[run.tier] = Math.max(tierStars[run.tier] ?? 0, clampStars(run.stars)); }
      const entry: DrillProgress = {
        tierStars, stars, aces: (prev?.aces ?? 0) + Math.max(0, Math.round(run.aces || 0)),
        bestScore: prev?.bestScore === null || prev?.bestScore === undefined ? score : score === null ? prev.bestScore : Math.min(prev.bestScore, score),
        runs: (prev?.runs ?? 0) + 1, lastScore: score, lastPlayed: Date.now(),
      };
      d.drills[id] = entry;
      d.runs = [...(d.runs ?? []), { id, at: entry.lastPlayed, score: score ?? 0, stars, aces: Math.max(0, Math.round(run.aces || 0)), scale: Number.isFinite(run.scale) ? run.scale! : 1, errors: run.errors, raw: Number.isFinite(run.raw) ? run.raw : undefined, tier: run.tier, unit: run.unit }].slice(-50);
      write(d);
      return entry;
    },
    maneuverHistory() {
      const runs = (read().runs ?? []).slice(-HISTORY_RUNS);
      const out: Record<string, number[]> = {};
      for (const r of runs) for (const [k, v] of Object.entries(r.errors ?? {})) if (Array.isArray(v)) out[k] = [...(out[k] ?? []), ...v.filter(x => typeof x === 'number' && Number.isFinite(x))];
      return out;
    },
    recentRuns: (limit = HISTORY_RUNS) => (read().runs ?? []).slice(-limit),
    markLesson(id, done = true) { const d = read(); d.lessons[id] = done; write(d); },
    lessonDone: id => !!read().lessons[id],
    reset() { write(empty()); try { store?.removeItem?.(key); } catch { /* ignore */ } memory = empty(); },
    get persistent() { if (!probed && store) read(); return persistent || (!store ? false : !probed); },
  };
  return api;
}

function clampStars(n: number): 0 | 1 | 2 | 3 { const s = Math.max(0, Math.min(3, Math.round(n))); return s as 0 | 1 | 2 | 3; }
function isRecord(x: unknown): x is Record<string, unknown> { return !!x && typeof x === 'object' && !Array.isArray(x); }
function defaultStorage(): StorageLike | null {
  try { if (typeof localStorage !== 'undefined') { localStorage.getItem(PROGRESS_KEY); return localStorage; } } catch { /* blocked */ }
  return null;
}
