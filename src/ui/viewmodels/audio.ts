/** Audio cues (UI-012), decided as pure data from consecutive observations; the player plays them. */
import type { Observation } from '../../core/sim.js';

export type Cue =
  | { kind: 'click' }
  | { kind: 'speech'; text: string }
  | { kind: 'beep'; n: 3 | 2 | 1 | 0 }
  | { kind: 'train' } | { kind: 'signal' };

export interface CueOptions { muted?: boolean; countdownAid?: boolean; speech?: boolean }

export function audioCues(prev: Observation | null | undefined, next: Observation | null | undefined, opts: CueOptions = {}): Cue[] {
  const out: Cue[] = [];
  if (opts.muted || !next) return out;
  const pw = prev?.stopwatch, nw = next.stopwatch;
  if (nw && pw && (pw.running !== nw.running || (nw.laps?.length ?? 0) !== (pw.laps?.length ?? 0))) out.push({ kind: 'click' });
  if (nw && pw && pw.reading > 0 && nw.reading === 0 && (pw.laps?.length ?? 0) > 0 && (nw.laps?.length ?? 0) === 0) out.push({ kind: 'click' });
  if (opts.speech !== false) for (const m of next.driver?.messages ?? []) if (m && typeof m.text === 'string' && m.text) out.push({ kind: 'speech', text: m.text });
  if (opts.countdownAid) {
    const a = prev?.aids?.countdown, b = next.aids?.countdown;
    if (typeof b === 'number' && typeof a === 'number') for (const n of [3, 2, 1, 0] as const) if (a > n && b <= n) out.push({ kind: 'beep', n });
  }
  const seen = (o: Observation | null | undefined, pred: (f: Observation['ahead'][number]) => boolean): boolean => !!o?.ahead?.some(pred);
  if (!seen(prev, f => f.gateDown === true) && seen(next, f => f.gateDown === true)) out.push({ kind: 'train' });
  if (!seen(prev, f => f.signalColor === 'red') && seen(next, f => f.signalColor === 'red')) out.push({ kind: 'signal' });
  return out;
}

/** Browser player: WebAudio clicks/beeps and speechSynthesis read-back. Safe when neither API exists. */
export class AudioPlayer {
  muted = false;
  private ctx: AudioContext | null = null;
  constructor(muted = false) { this.muted = muted; }
  private audio(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try { const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (AC) this.ctx = new AC(); } catch { this.ctx = null; }
    return this.ctx;
  }
  private tone(freq: number, dur: number, gain = 0.08, type: OscillatorType = 'square'): void {
    const ctx = this.audio(); if (!ctx) return;
    try {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = gain;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime; o.start(t); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }
  play(cues: Cue[]): void {
    if (this.muted) return;
    for (const c of cues) {
      switch (c.kind) {
        case 'click': this.tone(1800, 0.03, 0.12, 'square'); break;
        case 'beep': this.tone(c.n === 0 ? 1320 : 880, c.n === 0 ? 0.25 : 0.1, 0.1, 'sine'); break;
        case 'train': this.tone(330, 0.6, 0.08, 'sawtooth'); this.tone(392, 0.6, 0.08, 'sawtooth'); break;
        case 'signal': this.tone(660, 0.12, 0.06, 'triangle'); break;
        case 'speech': this.speak(c.text); break;
      }
    }
  }
  speak(text: string): void {
    try {
      const ss = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
      const U = (globalThis as unknown as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
      if (!ss || !U) return;
      const u = new U(text); u.rate = 1.1; u.pitch = 0.8; ss.speak(u);
    } catch { /* no speech */ }
  }
}
