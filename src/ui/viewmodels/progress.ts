/** Progress store (UI-008): drill stars / aces / best score in localStorage with an in-memory fallback. */
export interface DrillProgress { stars: 0 | 1 | 2 | 3; aces: number; bestScore: number | null; runs: number; lastScore: number | null; lastPlayed: number }
export interface ProgressData { version: 1; drills: Record<string, DrillProgress>; lessons: Record<string, boolean> }

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

export const PROGRESS_KEY = 'rally-trainer.progress.v1';

function empty(): ProgressData { return { version: 1, drills: {}, lessons: {} }; }

export interface ProgressStore {
  load(): ProgressData;
  save(data: ProgressData): boolean;
  get(drillId: string): DrillProgress | undefined;
  /** Merge a finished run: stars keep the max, aces accumulate, best score keeps the min. Returns the merged entry. */
  recordRun(drillId: string, run: { stars: number; aces: number; score: number }): DrillProgress;
  markLesson(id: string, done?: boolean): void;
  lessonDone(id: string): boolean;
  reset(): void;
  readonly persistent: boolean;
}

export function createProgressStore(storage?: StorageLike | null, key = PROGRESS_KEY): ProgressStore {
  let memory: ProgressData | null = null;
  let persistent = false;
  const store: StorageLike | null = storage ?? defaultStorage();
  const read = (): ProgressData => {
    if (store) {
      try {
        const raw = store.getItem(key);
        persistent = true;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<ProgressData>;
          if (parsed && typeof parsed === 'object') {
            memory = { version: 1, drills: isRecord(parsed.drills) ? parsed.drills as Record<string, DrillProgress> : {}, lessons: isRecord(parsed.lessons) ? parsed.lessons as Record<string, boolean> : {} };
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
      const entry: DrillProgress = {
        stars, aces: (prev?.aces ?? 0) + Math.max(0, Math.round(run.aces || 0)),
        bestScore: prev?.bestScore === null || prev?.bestScore === undefined ? score : score === null ? prev.bestScore : Math.min(prev.bestScore, score),
        runs: (prev?.runs ?? 0) + 1, lastScore: score, lastPlayed: Date.now(),
      };
      d.drills[id] = entry;
      write(d);
      return entry;
    },
    markLesson(id, done = true) { const d = read(); d.lessons[id] = done; write(d); },
    lessonDone: id => !!read().lessons[id],
    reset() { write(empty()); try { store?.removeItem?.(key); } catch { /* ignore */ } memory = empty(); },
    get persistent() { return persistent; },
  };
  return api;
}

function clampStars(n: number): 0 | 1 | 2 | 3 { const s = Math.max(0, Math.min(3, Math.round(n))); return s as 0 | 1 | 2 | 3; }
function isRecord(x: unknown): x is Record<string, unknown> { return !!x && typeof x === 'object' && !Array.isArray(x); }
function defaultStorage(): StorageLike | null {
  try { if (typeof localStorage !== 'undefined') { localStorage.getItem(PROGRESS_KEY); return localStorage; } } catch { /* blocked */ }
  return null;
}
