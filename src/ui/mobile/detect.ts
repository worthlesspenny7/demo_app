/**
 * MOB-020: which shell opens. `?mode=mobile` / `?mode=desk` force a shell and are remembered; a remembered choice (the Home's
 * "Desk mode" link, the Desk nav's "Phone mode" link) wins next; otherwise a viewport narrower than 700 px opens the phone shell.
 * Pure apart from the storage helpers; no DOM.
 */
export type ShellMode = 'mobile' | 'desk';
export const MODE_KEY = 'rally-trainer.mode.v1';
/** The phone shell opens below this viewport width (CSS px). */
export const MOBILE_MAX_WIDTH = 700;

export interface ModeInputs { search: string; width: number; stored: string | null; standalone?: boolean }

/** The forced mode of a query string (`?mode=mobile`, `?mode=phone`, `?mode=desk`), or null. */
export function modeFromSearch(search: string): ShellMode | null {
  let v: string | null = null;
  try { v = new URLSearchParams(search).get('mode'); } catch { v = null; }
  if (v === 'mobile' || v === 'phone') return 'mobile';
  if (v === 'desk' || v === 'desktop') return 'desk';
  return null;
}

export function chooseMode(i: ModeInputs): ShellMode {
  const forced = modeFromSearch(i.search); if (forced) return forced;
  if (i.stored === 'mobile' || i.stored === 'desk') return i.stored;
  return i.width > 0 && i.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desk';
}

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem?(k: string): void }
function ls(): KV | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
export function storedMode(store: KV | null = ls()): string | null { try { return store?.getItem(MODE_KEY) ?? null; } catch { return null; } }
export function rememberMode(m: ShellMode | null, store: KV | null = ls()): void {
  try { if (m) store?.setItem(MODE_KEY, m); else store?.removeItem?.(MODE_KEY); } catch { /* storage blocked */ }
}

/** The mode for this page load in the browser (remembers a forced `?mode=`). */
export function currentMode(): ShellMode {
  const search = typeof location === 'undefined' ? '' : location.search;
  const forced = modeFromSearch(search);
  if (forced) rememberMode(forced);
  const width = typeof window === 'undefined' ? 1024 : (window.innerWidth || 1024);
  return chooseMode({ search, width, stored: storedMode() });
}
