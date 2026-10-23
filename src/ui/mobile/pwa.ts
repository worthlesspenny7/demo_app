/**
 * MOB-023: service worker registration and the "Add to Home Screen" hint (shown once). The worker is public/sw.js (hand-written);
 * the build writes its precache list. Registration is skipped in the Vite dev server (no built shell to cache).
 */
export const A2HS_KEY = 'rally-trainer.a2hs-hint.v1';

export interface PwaStatus { supported: boolean; registered: boolean; error: string | null }
export const pwaStatus: PwaStatus = { supported: false, registered: false, error: null };

export function registerServiceWorker(): Promise<PwaStatus> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(pwaStatus);
    pwaStatus.supported = true;
    if (import.meta.env.DEV) return Promise.resolve(pwaStatus);
    return navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(() => { pwaStatus.registered = true; return pwaStatus; })
      .catch(e => { pwaStatus.error = String((e as Error)?.message ?? e); return pwaStatus; });
  } catch (e) { pwaStatus.error = String(e); return Promise.resolve(pwaStatus); }
}

/** Running from the home screen already (no hint needed). */
export function isStandalone(): boolean {
  try { return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
}

/** The one-time hint text for this browser, or null when it was shown before or the app is installed. */
export function a2hsHint(opts: { seen: boolean; standalone: boolean; ua: string }): string | null {
  if (opts.seen || opts.standalone) return null;
  if (/iPhone|iPad|iPod/i.test(opts.ua)) return 'Play offline: tap Share, then "Add to Home Screen".';
  return 'Play offline: open the browser menu and choose "Add to Home screen" (or "Install app").';
}
export function hintSeen(): boolean { try { return localStorage.getItem(A2HS_KEY) === '1'; } catch { return true; } }
export function markHintSeen(): void { try { localStorage.setItem(A2HS_KEY, '1'); } catch { /* ignore */ } }

/** MOB-024: haptics on verdicts (short for right, double for wrong); a no-op without navigator.vibrate. */
export function hapticPattern(correct: boolean): number[] { return correct ? [30] : [60, 80, 60]; }
export function haptic(correct: boolean): boolean {
  try { const v = (navigator as Navigator & { vibrate?: (p: number[]) => boolean }).vibrate; if (typeof v === 'function') return v.call(navigator, hapticPattern(correct)); } catch { /* unsupported */ }
  return false;
}
/** MOB-024: speak a driver line when speech is on and supported; silent otherwise. */
export function speak(text: string, enabled: boolean): boolean {
  try {
    if (!enabled || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
    speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); return true;
  } catch { return false; }
}
