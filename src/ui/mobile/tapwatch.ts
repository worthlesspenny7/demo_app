/**
 * MOB-021: the tap-stopwatch face, the handbook's digital lap/split watch on a phone (HB p.5, REG II.H.1.d(3)). Big 1/100 s digits,
 * the left half START/STOP, the right half LAP, a TOD strip and a lap table of interval / cumulative pairs below. In a pause, restart
 * or speed-call card the whole face is one GO / LAUNCH / CALL button. It drives the real Stopwatch model (src/core/stopwatch.ts)
 * on a wall-clock time base measured from the moment the card was shown, which is the time base of the decision's TimingSpec.
 */
import { Stopwatch } from '../../core/stopwatch.js';
import { chronoText, todText } from '../viewmodels/digitalwatch.js';
import { formatInterval } from '../../core/griid.js';
import { el } from '../state.js';

export type FaceMode = 'split' | 'go';
export interface TapWatchOptions {
  mode: FaceMode;
  /** Label of the whole-face button (go mode): "GO", "LAUNCH", "CALL 45". */
  label?: string;
  /** split mode: the right half's label after START ("CALL 45"); "LAP" by default. */
  lapLabel?: string;
  /** Rally time of day at the card's moment (the TOD strip). */
  todAtZero?: number;
  /** MOB-058: the big digits show the time of day (restart / launch cards); the elapsed count is small. */
  todPrimary?: boolean;
  /** Start the watch at the card's moment (a pause: the car has just stopped). */
  autoStart?: boolean;
  /** Called with the seconds since the card's moment for every scoring tap (GO, or START then LAP in split mode). */
  onTap(seconds: number, kind: 'go' | 'start' | 'stop' | 'lap'): void;
  /** Wall clock in seconds (tests inject a fake). */
  now?: () => number;
}

export interface TapWatch { root: HTMLElement; watch: Stopwatch; elapsed(): number; tick(): void; destroy(): void }

const wall = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** Lap rows newest first, at most `max`, in the book's calibration-box shape. */
export function lapRows(w: Stopwatch, max = 3): { n: number; interval: string; cumulative: string }[] {
  return w.lapTable().map((l, i) => ({ n: i + 1, interval: formatInterval(l.interval, true), cumulative: formatInterval(l.cumulative, true) })).slice(-max).reverse();
}

export function mountTapWatch(host: HTMLElement, o: TapWatchOptions): TapWatch {
  const now = o.now ?? wall;
  const t0 = now();
  const elapsed = (): number => Math.max(0, now() - t0);
  const watch = new Stopwatch('digital', 60, 0);
  if (o.autoStart) watch.start(0);
  const digits = el('div', { class: `mw-digits${o.todPrimary ? ' mw-small' : ''}`, 'aria-live': 'off', 'data-testid': 'watch-digits' }, '0:00.00');
  const tod = el('div', { class: `mw-tod${o.todPrimary ? ' mw-big' : ''}`, 'data-testid': 'tod-digits' }, '');
  const laps = el('table', { class: 'mw-laps', 'aria-label': 'laps: interval and cumulative' });
  const root = el('div', { class: `mw-face mw-${o.mode}`, 'data-face': o.mode });
  let stopped = false;
  const fire = (kind: 'go' | 'start' | 'stop' | 'lap'): void => { if (!stopped) o.onTap(Math.round(elapsed() * 100) / 100, kind); };
  if (o.mode === 'go') {
    const btn = el('button', { class: 'mw-go', type: 'button', 'data-action': 'go', 'aria-label': `${o.label ?? 'GO'}: tap at the second` }, el('span', { class: 'mw-go-label' }, o.label ?? 'GO'));
    if (o.todPrimary) root.classList.add('mw-todprimary');
    btn.prepend(tod, digits);
    btn.addEventListener('pointerdown', ev => { ev.preventDefault(); const t = elapsed(); watch.lap(t); render(); fire('go'); });
    btn.addEventListener('click', ev => { if ((ev as MouseEvent).detail === 0) { const t = elapsed(); watch.lap(t); render(); fire('go'); } });   // keyboard / synthetic activation
    root.append(btn);
  } else {
    const left = el('button', { class: 'mw-half mw-left', type: 'button', 'data-action': 'startstop' }, 'START');
    const right = el('button', { class: 'mw-half mw-right', type: 'button', 'data-action': 'lap' }, o.lapLabel ?? 'LAP');
    const press = (fn: () => void) => (ev: Event): void => { ev.preventDefault(); fn(); };
    const doLeft = (): void => { const t = elapsed(); const wasRunning = watch.running; watch.toggle(t); left.textContent = watch.running ? 'STOP' : 'START'; render(); fire(wasRunning ? 'stop' : 'start'); };
    const doRight = (): void => { const t = elapsed(); if (watch.running) watch.lap(t); render(); fire('lap'); };
    left.addEventListener('pointerdown', press(doLeft)); right.addEventListener('pointerdown', press(doRight));
    left.addEventListener('click', ev => { if ((ev as MouseEvent).detail === 0) doLeft(); });
    right.addEventListener('click', ev => { if ((ev as MouseEvent).detail === 0) doRight(); });
    root.append(el('div', { class: 'mw-display' }, tod, digits), el('div', { class: 'mw-halves' }, left, right));
  }
  root.append(laps);
  let lastLaps = -1;
  function render(): void {
    const t = elapsed();
    digits.textContent = chronoText(watch.reading(t));
    if (o.todAtZero !== undefined) tod.textContent = `TOD ${todText(o.todAtZero + t).replace(/\.\d\d$/, '')}`;
    if (watch.laps.length !== lastLaps) {
      lastLaps = watch.laps.length;
      laps.replaceChildren(...(lastLaps ? [el('tr', {}, el('th', {}, '#'), el('th', {}, 'interval'), el('th', {}, 'cumulative'))] : []), ...lapRows(watch).map(r => el('tr', {}, el('td', {}, String(r.n)), el('td', {}, r.interval), el('td', {}, r.cumulative))));
    }
  }
  let raf = 0;
  const loop = (): void => { render(); raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : 0; };
  loop();
  host.append(root);
  return { root, watch, elapsed, tick: render, destroy() { stopped = true; if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); } };
}
