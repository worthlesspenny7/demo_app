/** Keyboard mapping for the cockpit (UI-011). Pure: feed key down/up events, get commands. */
import type { TurnDir } from '../../core/course.js';

export type KeyCommand =
  | { type: 'watch.toggle' } | { type: 'watch.lap' } | { type: 'watch.reset' }
  | { type: 'bezel'; delta: number }
  | { type: 'call.turn'; dir: TurnDir }
  | { type: 'call.go' } | { type: 'call.stop' } | { type: 'call.uturn' } | { type: 'call.pass' }
  | { type: 'ta' } | { type: 'ledger' } | { type: 'depart' }
  | { type: 'line'; delta: number } | { type: 'line.home' } | { type: 'line.end' }
  | { type: 'call.speed'; mph: number } | { type: 'nudge'; delta: number }
  | { type: 'scale'; delta: 1 | -1 } | { type: 'pause' }
  | { type: 'buffer'; text: string };

export interface KeyEventLike { key: string; code?: string; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; repeat?: boolean }

const MODS: Record<string, 'B' | 'A' | 'J'> = { b: 'B', a: 'A', j: 'J' };

export class KeyMapper {
  buffer = '';
  private held = new Set<'B' | 'A' | 'J'>();
  /** Keys held as turn modifiers (B bear, A acute, J jog). */
  get modifiers(): string[] { return [...this.held]; }

  keyup(e: KeyEventLike): void { const m = MODS[(e.key ?? '').toLowerCase()]; if (m) this.held.delete(m); }

  /** Returns a command or null. Digits accumulate in `buffer`, Enter calls them as a speed. */
  keydown(e: KeyEventLike): KeyCommand | null {
    if (!e || typeof e.key !== 'string') return null;
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    const key = e.key; const low = key.toLowerCase(); const shift = !!e.shiftKey;
    const mod = MODS[low];
    if (mod && !e.repeat) { this.held.add(mod); return null; }
    if (mod) return null;
    if (/^[0-9]$/.test(key)) { if (this.buffer.length < 4) this.buffer += key; return { type: 'buffer', text: this.buffer }; }
    if (key === '.' && this.buffer && !this.buffer.includes('.')) { this.buffer += '.'; return { type: 'buffer', text: this.buffer }; }
    if (key === 'Backspace') { this.buffer = this.buffer.slice(0, -1); return { type: 'buffer', text: this.buffer }; }
    if (key === 'Enter') {
      if (this.buffer) { const mph = Number(this.buffer); this.buffer = ''; return Number.isFinite(mph) && mph > 0 ? { type: 'call.speed', mph } : { type: 'buffer', text: '' }; }
      return { type: 'watch.lap' };
    }
    if (key === 'Escape') { if (this.buffer) { this.buffer = ''; return { type: 'buffer', text: '' }; } return { type: 'pause' }; }
    if (key === ' ' || key === 'Spacebar') return { type: 'watch.toggle' };
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp') {
      const side = key === 'ArrowLeft' ? 'L' : key === 'ArrowRight' ? 'R' : 'S';
      if (side === 'S') return { type: 'call.turn', dir: 'S' };
      const dir: TurnDir = this.held.has('A') ? (side === 'L' ? 'AL' : 'AR') : this.held.has('B') ? (side === 'L' ? 'BL' : 'BR') : this.held.has('J') ? (side === 'L' ? 'JL' : 'JR') : side;
      return { type: 'call.turn', dir };
    }
    if (key === 'ArrowDown') return { type: 'nudge', delta: -1 };
    if (key === '[' || key === '{') return { type: 'bezel', delta: shift || key === '{' ? -0.2 : -1 };
    if (key === ']' || key === '}') return { type: 'bezel', delta: shift || key === '}' ? 0.2 : 1 };
    if (key === '+' || key === '=') return { type: 'nudge', delta: 1 };
    if (key === '-' || key === '_') return { type: 'nudge', delta: -1 };
    if (key === '<' || key === ',') return { type: 'scale', delta: -1 };
    if (key === '>' ) return { type: 'scale', delta: 1 };
    if (key === 'Home') return { type: 'line.home' };
    if (key === 'End') return { type: 'line.end' };
    switch (low) {
      case 'l': return { type: 'watch.lap' };
      case 'r': return shift ? { type: 'watch.reset' } : null;        // a slip must not destroy a run
      case 'g': return { type: 'call.go' };
      case 's': return { type: 'call.stop' };
      case 'u': return { type: 'call.uturn' };
      case 'p': return { type: 'call.pass' };
      case 't': return { type: 'ta' };
      case 'n': return { type: 'line', delta: shift ? -1 : 1 };
      case 'd': return { type: 'depart' };
      case 'e': return { type: 'ledger' };
      case '.': return { type: 'scale', delta: 1 };
      default: return null;
    }
  }
}

export const KEY_HELP: { keys: string; does: string }[] = [
  { keys: 'Space', does: 'stopwatch start / stop' }, { keys: 'L or Enter', does: 'lap' }, { keys: 'Shift+R', does: 'reset (only when stopped)' },
  { keys: '[ / ]', does: 'stopwatch bezel -1 / +1 s (Shift: 0.2 s)' },
  { keys: 'Left / Right / Up', does: 'call turn left / right / straight' }, { keys: 'B + arrow', does: 'bear' }, { keys: 'A + arrow', does: 'acute' }, { keys: 'J + arrow', does: 'jog' },
  { keys: 'G', does: 'go' }, { keys: 'S', does: 'stop / hold at the next landmark' }, { keys: 'U', does: 'u-turn' }, { keys: 'P', does: 'pass the slow vehicle' },
  { keys: 'T', does: 'time allowance' }, { keys: 'N / Shift+N', does: 'next / previous line' }, { keys: 'Home / End', does: 'first / last line' },
  { keys: 'digits, Enter', does: 'call that speed' }, { keys: '+ / -', does: 'nudge speed by 1 mph' },
  { keys: 'D', does: 'depart (start the leg)' }, { keys: 'E', does: 'set the ledger (early/late)' },
  { keys: ', / .', does: 'time scale down / up' }, { keys: 'Esc', does: 'pause' },
];
