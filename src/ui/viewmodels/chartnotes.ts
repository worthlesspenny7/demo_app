/** PLAY-027: D06 chart notes survive a retry of the same seed, so each pair can be driven more than once and the notes build up like the real chart. */
import { parseChartRuns, parseRawRuns } from '../../core/drills/d06.js';

export const CHART_NOTES_KEY = 'rally.chartnotes.v1';
const MAX_NOTES = 200;
type Store = Record<string, string[]>;
const keyOf = (tier: number, seed: number): string => `D06:${tier}:${seed}`;

/** The notes of a run that are chart notes ("stopgo 30>40 = 8.4", "const 25 runs ..."), in order. */
export function chartNoteLines(notes: string[]): string[] {
  return notes.filter(n => typeof n === 'string' && (parseChartRuns([n]).size > 0 || parseRawRuns([n]).size > 0));
}
function read(storage: Pick<Storage, 'getItem'> | null): Store {
  try { const raw = storage?.getItem(CHART_NOTES_KEY); const v = raw ? JSON.parse(raw) as unknown : null; return v && typeof v === 'object' && !Array.isArray(v) ? v as Store : {}; } catch { return {}; }
}
/** The chart notes kept from the last run of this tier and seed (empty when none or storage is unavailable). */
export function loadChartNotes(tier: number, seed: number, storage: Pick<Storage, 'getItem'> | null = safeStorage()): string[] {
  const v = read(storage)[keyOf(tier, seed)]; return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX_NOTES) : [];
}
/** Keep this run's chart notes (the carried ones are part of the run, so the list grows with each retry, newest last). */
export function saveChartNotes(tier: number, seed: number, notes: string[], storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): void {
  const lines = chartNoteLines(notes).slice(-MAX_NOTES); if (!storage) return;
  try { const all = read(storage); all[keyOf(tier, seed)] = lines; storage.setItem(CHART_NOTES_KEY, JSON.stringify(all)); } catch { /* storage full or blocked */ }
}
function safeStorage(): Storage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
