/**
 * SCH-003 widget pages: holdSpeed (slider against the ghost), whereCheckpoint (tap when the leg ended), tapLap (LAP at three markers,
 * read a split) and readScorecard (tap the leg that cost most). DOM over the pure models in widget-models.ts (the engine's numbers).
 * Each widget calls `done()` once when the page is complete and returns a cleanup.
 */
import type { WidgetPage } from '../../../content/course-types.js';
import { el } from '../state.js';
import { formatInterval } from '../../core/griid.js';
import { HoldSpeedModel, WhereCheckpointModel, TapLapModel, sampleScorecard, worstLeg, aceLegs, cardTotal, scorecardTotal, driftText, HOLD_SECONDS, HOLD_TOLERANCE_MPH } from './widget-models.js';

export interface WidgetEnv { done(): void; /** wall clock in seconds (tests inject) */ now?: () => number }
const wall = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const raf = (f: () => void): number => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(f) : window.setTimeout(f, 50));
const caf = (h: number): void => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(h); clearTimeout(h); };

/** A road strip with the car (and optionally the ghost and markers) as positioned spans. */
function road(): { root: HTMLElement; car: HTMLElement; ghost: HTMLElement; place(node: HTMLElement, frac: number): void } {
  const car = el('span', { class: 's2-car', 'aria-hidden': 'true' }); const ghost = el('span', { class: 's2-car s2-ghost', 'aria-hidden': 'true' });
  const root = el('div', { class: 's2-road', 'data-testid': 'road' }, ghost, car);
  // PT-16 B9: a car is placed by its nose (its left edge sits one car length, 8 %, behind), a mark by its line: the nose meets a mark at
  // the same fraction
  return { root, car, ghost, place: (n, f) => { const x = Math.max(0, Math.min(1, f)) * 92; n.style.left = `${(n.classList.contains('s2-car') ? x : x + 8).toFixed(2)}%`; } };
}

export function mountHoldSpeed(host: HTMLElement, page: WidgetPage, env: WidgetEnv): () => void {
  const assigned = page.params.speed ?? 35;
  const m = new HoldSpeedModel(assigned, Math.max(10, assigned - 10));
  const r = road();
  const readout = el('b', { class: 's2-readout', 'data-testid': 'drift' }, 'on time');
  const speedLbl = el('span', { class: 's2-speed', 'data-testid': 'car-speed' }, `${Math.round(m.speed)} mph`);
  const hold = el('span', { class: 's2-hold', 'data-testid': 'hold-left' }, `Hold ${assigned} ± ${HOLD_TOLERANCE_MPH} for ${HOLD_SECONDS} s`);
  const slider = el('input', { type: 'range', min: String(Math.max(5, assigned - 20)), max: String(assigned + 20), step: '1', value: String(m.target), class: 's2-slider', 'data-testid': 'speed-slider', 'aria-label': 'your car\'s speed' }) as HTMLInputElement;
  slider.oninput = () => m.setTarget(Number(slider.value));
  host.append(el('div', { class: 's2-widget', 'data-widget': 'holdSpeed' },
    el('div', { class: 's2-wrow' }, el('span', {}, `Assigned ${assigned} mph`), speedLbl), r.root, el('div', { class: 's2-wrow' }, readout, hold), slider));
  const now = env.now ?? wall; let last = now(); let h = 0; let fired = false;
  const frame = (): void => {
    const t = now(); m.step(Math.min(0.25, t - last)); last = t;
    // the view window follows the ghost: the gap between the cars is the drift
    r.place(r.ghost, 0.6); r.place(r.car, 0.6 - m.drift() / 10);
    readout.textContent = driftText(m.drift()); readout.dataset['seconds'] = m.drift().toFixed(2);
    speedLbl.textContent = `${Math.round(m.speed)} mph`;
    hold.textContent = m.complete ? 'Held it: well done.' : Math.abs(m.speed - assigned) <= HOLD_TOLERANCE_MPH ? `Holding… ${m.holdLeft().toFixed(0)} s` : `Hold ${assigned} ± ${HOLD_TOLERANCE_MPH} for ${HOLD_SECONDS} s`;
    if (m.complete && !fired) { fired = true; host.querySelector('.s2-widget')?.classList.add('s2-done'); env.done(); }
    h = raf(frame);
  };
  frame();
  return () => caf(h);
}

export function mountWhereCheckpoint(host: HTMLElement, page: WidgetPage, env: WidgetEnv): () => void {
  const m = new WhereCheckpointModel(page.params.speed ?? 30, page.params.miles ?? 0.1, page.params.seed ?? 1);
  // PT-16 B7: the strip is the leg: the green sign stands at its end, the ghost drives beside your car, both reach the sign together
  const r = road();
  const cp = el('span', { class: 's2-cp s2-greensign', 'data-testid': 'checkpoint', 'aria-label': 'green checkpoint sign' }, '');
  const tapMark = el('span', { class: 's2-tapmark', hidden: '' });
  r.root.append(cp, tapMark); cp.style.left = 'calc(100% - 12px)';
  const clock = el('b', { class: 's2-readout mono', 'data-testid': 'leg-clock' }, '0.0 s');
  const result = el('p', { class: 's2-result', 'data-testid': 'cp-result' }, '');
  const btn = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'leg-ended' }, 'At the sign!');
  host.append(el('div', { class: 's2-widget', 'data-widget': 'whereCheckpoint' },
    el('div', { class: 's2-wrow' }, el('span', {}, `Leg: ${m.miles} mi at ${m.assigned} mph`), clock), r.root, result, btn));
  const now = env.now ?? wall; const t0 = now(); let h = 0; let over = false;
  const frac = (s: number): number => s / m.legFt;
  const finish = (t: number | null): void => {
    if (over) return; over = true; caf(h);
    const at = Math.round((t ?? m.maxSeconds()) * 10) / 10;   // B24: the result quotes the time the clock showed
    m.press(at); clock.textContent = `${at.toFixed(1)} s`;
    tapMark.hidden = false; r.place(tapMark, frac(m.carS(at)));
    result.textContent = m.explain();
    result.dataset['points'] = String(m.score()!.penalty);
    btn.textContent = 'Done'; (btn as HTMLButtonElement).disabled = true;
    env.done();
  };
  btn.onclick = () => finish(now() - t0);
  const frame = (): void => {
    const t = now() - t0; const f = frac(m.carS(t)); r.place(r.car, f); r.place(r.ghost, frac(ghostS(m, t))); clock.textContent = `${t.toFixed(1)} s`;
    if (t >= m.maxSeconds()) { finish(null); return; }
    h = raf(frame);
  };
  frame();
  return () => caf(h);
}
const ghostS = (m: WhereCheckpointModel, t: number): number => Math.min(m.legFt, m.legFt * t / m.perfect);

export function mountTapLap(host: HTMLElement, page: WidgetPage, env: WidgetEnv): () => void {
  const m = new TapLapModel(page.params.markers ?? 3, page.params.seed ?? 1);
  const r = road(); r.ghost.remove();
  const span = (m.markerTimes[m.markerTimes.length - 1] ?? 10) * 1.12;
  m.markerTimes.forEach((mt, i) => { const mk = el('span', { class: 's2-marker', 'data-marker': i + 1 }, String(i + 1)); r.root.append(mk); r.place(mk, mt / span); });
  const digits = el('b', { class: 's2-readout mono', 'data-testid': 'watch-digits' }, '0:00.00');
  const laps = el('ol', { class: 's2-laps', 'data-testid': 'laps' });
  const q = el('div', { class: 's2-q' });
  const lapBtn = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'lap' }, 'LAP');
  // PT-16 B9: LAP sits right under the road and never moves; the lap list grows below it
  host.append(el('div', { class: 's2-widget', 'data-widget': 'tapLap' }, el('div', { class: 's2-wrow' }, el('span', {}, `LAP at each of ${m.markers} markers`), digits), r.root, lapBtn, q, laps));
  const now = env.now ?? wall; const t0 = now(); let h = 0;
  const ask = (): void => {
    lapBtn.hidden = true;
    q.append(el('p', { class: 's2-ask' }, `Your split at marker ${m.ask + 1}?`));
    const fb = el('p', { class: 's2-result', 'data-testid': 'split-result' });
    const opts = el('div', { class: 'mob-opts n3' });
    for (const o of m.splitOptions()) {
      const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-right': String(o.right) }, o.label);
      b.onclick = () => {
        opts.querySelectorAll('button').forEach(x => x.classList.remove('s2-right', 's2-wrong'));
        b.classList.add(o.right ? 's2-right' : 's2-wrong');
        fb.textContent = o.right ? 'Correct: the split is the total time since START.' : 'Not quite: the split is the total since START, not one lap.';
        if (o.right) env.done();
      };
      opts.append(b);
    }
    q.append(opts, fb);
  };
  lapBtn.onclick = () => {
    const t = now() - t0; if (m.lap(t) === null) return;
    const row = m.table()[m.table().length - 1]!; const err = m.errors()[m.errors().length - 1]!;
    laps.append(el('li', {}, `${formatInterval(row.interval, true)} · split ${formatInterval(row.cumulative, true)} (${Math.abs(err) < 0.05 ? 'on the marker' : `${Math.abs(err).toFixed(1)} s ${err > 0 ? 'late' : 'early'}`})`));
    if (m.done) { caf(h); digits.textContent = formatInterval(m.watch.reading(t), true); ask(); }
  };
  const frame = (): void => {
    const t = now() - t0; r.place(r.car, Math.min(1, t / span)); digits.textContent = formatInterval(m.watch.reading(t), true);
    if (t > span * 1.4 && !m.done) { while (!m.done) m.lap(t); laps.append(el('li', {}, 'The car went by: the missing laps were taken late.')); digits.textContent = formatInterval(m.watch.reading(t), true); ask(); return; }
    if (!m.done) h = raf(frame);
  };
  frame();
  return () => caf(h);
}

export function mountReadScorecard(host: HTMLElement, page: WidgetPage, env: WidgetEnv): () => void {
  const legs = sampleScorecard(page.params.seed ?? 1);
  const ask = page.params.ask ?? 'worst';
  const worst = worstLeg(legs); const aces = aceLegs(legs); const tot = scorecardTotal(legs, 1939);
  const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const fb = el('p', { class: 's2-result', 'data-testid': 'card-result' });
  const tbl = el('table', { class: 's2-card', 'data-testid': 'scorecard' }, el('thead', {}, el('tr', {}, el('th', {}, 'Leg'), el('th', {}, 'Perfect'), el('th', {}, 'Yours'), el('th', {}, 'Points'))));
  const tb = el('tbody', {});
  const question = ask === 'ace' ? 'Tap the leg that was an Ace.' : ask === 'total' ? 'A 1939 car. The day\'s score?' : 'Tap the leg that cost the most.';
  const mark = (node: HTMLElement, ok: boolean, text: string): void => {
    host.querySelectorAll('.s2-right, .s2-wrong').forEach(x => x.classList.remove('s2-right', 's2-wrong'));
    node.classList.add(ok ? 's2-right' : 's2-wrong'); fb.className = `s2-result ${ok ? 'ok' : 'danger'}`; fb.textContent = text; if (ok) env.done();
  };
  for (const l of legs) {
    const right = ask === 'ace' ? aces.some(a => a.index === l.index) : ask === 'worst' && l.index === worst.index;
    const tr = el('tr', { class: `s2-leg${ask === 'total' ? ' s2-static' : ''}`, 'data-leg': l.index, 'data-right': String(right) }, el('td', {}, String(l.index)), el('td', {}, fmt(l.perfect)), el('td', {}, fmt(l.actual)), el('td', {}, String(l.score.penalty)));
    if (ask !== 'total') { tr.setAttribute('role', 'button'); tr.tabIndex = 0; tr.onclick = () => mark(tr, right, right ? (ask === 'ace' ? 'Correct: zero seconds off is an Ace.' : `Correct: leg ${l.index} cost ${l.score.penalty} points, one per second.`) : (ask === 'ace' ? 'Not quite: an Ace is 0 points.' : `Not quite: leg ${worst.index} cost ${worst.score.penalty}.`)); }
    tb.append(tr);
  }
  if (ask === 'total') tb.append(el('tr', { class: 's2-sum' }, el('td', { colspan: '3' }, 'Raw total'), el('td', {}, String(tot.raw))), el('tr', { class: 's2-sum' }, el('td', { colspan: '3' }, 'Age factor 1939'), el('td', {}, tot.factor.toFixed(3))));
  tbl.append(tb);
  const box = el('div', { class: 's2-widget', 'data-widget': 'readScorecard' }, el('p', { class: 's2-ask' }, question), tbl);
  if (ask === 'total') {
    const opts = el('div', { class: 'mob-opts n3' });
    for (const o of tot.options) { const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-right': String(o.right) }, o.label); b.onclick = () => mark(b, o.right, o.right ? `Correct: ${tot.raw} x ${tot.factor.toFixed(3)} = ${o.label}.` : `Not quite: multiply the raw total by the age factor.`); opts.append(b); }
    box.append(opts);
  } else box.append(el('p', { class: 's2-total' }, `Total ${cardTotal(legs)} points`));
  box.append(fb); host.append(box);
  return () => undefined;
}

export function mountWidget(host: HTMLElement, page: WidgetPage, env: WidgetEnv): () => void {
  if (page.params.goal) host.append(el('p', { class: 's2-goal' }, page.params.goal));
  switch (page.widget) {
    case 'holdSpeed': return mountHoldSpeed(host, page, env);
    case 'whereCheckpoint': return mountWhereCheckpoint(host, page, env);
    case 'tapLap': return mountTapLap(host, page, env);
    case 'readScorecard': return mountReadScorecard(host, page, env);
    default: host.append(el('p', {}, 'This widget is not in the app yet.')); env.done(); return () => undefined;
  }
}
