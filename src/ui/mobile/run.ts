/**
 * The run screen (MOB-020..026): top strip (skill, streak, card n of N), the card, the action zone in the bottom 40 % (1-4 buttons,
 * or the tap-stopwatch face), the verdict overlay (seconds, one-sentence rule, haptic) and then the next card. Landscape phones get the
 * mini cockpit (MOB-022) by CSS on the same DOM, so rotating never touches the run. Every answer is saved as the unfinished run
 * (MOB-030 Continue) until the recap.
 */
import { SKILL_TITLE, type Decision, type DecisionResponse, type Verdict } from '../../core/decision/index.js';
import { el } from '../state.js';
import { app } from '../state.js';
import { decisionCardHtml, ruleCardHtml, verdictParts, driverLine, signState } from './cards.js';
import { mountTapWatch, type TapWatch } from './tapwatch.js';
import { loadProgress, saveProgress, setUnfinished, recordRun } from './progress.js';
import { haptic, speak } from './pwa.js';
import { speechOn } from './prefs.js';
import { session, wallSeconds } from './session.js';

export interface RunView { screen: 'run'; phase: 'rule' | 'decision' | 'verdict' | 'done'; decision: Decision | null; shownAt: number; verdict: Verdict | null }
export const view: RunView = { screen: 'run', phase: 'done', decision: null, shownAt: 0, verdict: null };

/** Persist the run so far (Continue survives a reload). */
function persist(): void {
  const h = session.handle; if (!h) return;
  saveProgress(setUnfinished(loadProgress(), { ...h.plan }, h.responses));
}

export function renderRun(root: HTMLElement): () => void {
  const h = session.handle;
  if (!h) { location.replace('#/m'); return () => undefined; }
  const strip = el('header', { class: 'mob-strip', 'data-testid': 'strip' });
  const card = el('section', { class: 'mob-cardarea', 'aria-live': 'polite' });
  const driver = el('p', { class: 'mob-driver', 'data-testid': 'driver-line' }, '');
  const actions = el('section', { class: 'mob-actions', 'data-testid': 'actions' });
  const page = el('div', { class: 'mob mob-run', 'data-screen': 'run', 'data-source': h.source });
  page.append(strip, el('div', { class: 'mob-main' }, card, driver), actions);
  root.replaceChildren(page);

  let watch: TapWatch | null = null;
  const timers: number[] = [];
  let signRaf = 0;
  const clearTimers = (): void => { while (timers.length) clearTimeout(timers.pop()); if (watch) { watch.destroy(); watch = null; } if (signRaf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(signRaf); signRaf = 0; };

  /** MOB-052: the sign arrives: the bar shrinks to zero at the sign and Dad says "Mark!" (text, speech, a short buzz) as it lines up. */
  function animateSign(d: Decision): void {
    const t = d.timing; const bar = card.querySelector<HTMLElement>('.msign'); if (!t?.signSeconds || !bar) return;
    const fill = bar.querySelector<HTMLElement>('.msign-fill'); const ft = bar.querySelector<HTMLElement>('.msign-ft'); const mark = bar.querySelector<HTMLElement>('.msign-mark');
    let marked = false;
    const frame = (): void => {
      if (view.decision !== d || view.phase !== 'decision') return;
      const st = signState(t, wallSeconds() - view.shownAt);
      if (fill) fill.style.width = `${(st.frac * 100).toFixed(1)}%`;
      if (ft) ft.textContent = `${st.ft} ft`;
      if (st.mark && !marked) {
        marked = true; bar.classList.add('marked'); if (mark) mark.textContent = 'Mark!';
        driver.textContent = 'Dad: "Mark!"'; speak('Mark', speechOn());
        try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(40); } catch { /* no haptics */ }
      } else if (marked && !st.mark && mark) { mark.textContent = ''; bar.classList.remove('marked'); }
      signRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(frame) : 0;
    };
    frame();
  }

  const quit = el('a', { class: 'mob-quit', href: '#/m', 'aria-label': 'Home (the run is kept for Continue)' }, '×');
  function renderStrip(skill: string): void {
    const pos = h!.position(); const p = loadProgress();
    // MOB-061: a 3-5 word strip (skill, streak, n/N); the long forms are the accessible names
    strip.replaceChildren(quit, el('span', { class: 'mob-skill', 'data-testid': 'strip-skill' }, skill), el('span', { class: 'mob-streak', 'aria-label': `Streak ${p.streak.current}`, title: 'Streak (days in a row)' }, `★${p.streak.current}`), el('span', { class: 'mob-count', 'data-testid': 'card-count', 'aria-label': `Card ${Math.max(1, pos.n)} of ${pos.of}` }, `${Math.max(1, pos.n)}/${pos.of}`));
  }

  function submit(resp: DecisionResponse | null): void {
    if (view.phase !== 'decision' || !view.decision) return;
    const laps = watch && watch.watch.laps.length ? watch.root.querySelector('.mw-laps')?.cloneNode(true) as HTMLElement | undefined : undefined;   // MOB-021: the lap table stays with the verdict
    clearTimers();
    let v: Verdict;
    try { v = h!.answer(resp); } catch (e) { card.insertAdjacentHTML('beforeend', `<p class="danger">${String((e as Error).message ?? e)}</p>`); return; }
    view.phase = 'verdict'; view.verdict = v;
    persist();
    haptic(v.correct);
    showVerdict(v);
    if (laps) card.querySelector('.mob-verdict')?.append(laps);
  }

  function showVerdict(v: Verdict): void {
    const vp = verdictParts(v);
    const ov = el('div', { class: `mob-verdict ${v.correct ? 'v-ok' : 'v-bad'}`, role: 'status', 'data-testid': 'verdict', 'data-correct': String(v.correct) },
      el('div', { class: 'mv-head' }, el('span', {}, vp.head), el('b', { class: 'mv-sec' }, vp.seconds)),
      el('p', { class: 'mv-rule' }, vp.rule), el('p', { class: 'mv-detail' }, vp.detail));
    card.append(ov);
    const next = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'next' }, h!.done() ? 'See the run' : 'Next card');
    next.onclick = () => advance();
    actions.replaceChildren(next);
  }

  function advance(): void {
    clearTimers();
    if (view.phase === 'rule') h!.ack();
    persist();
    show();
  }

  function finish(): void {
    view.phase = 'done'; view.decision = null;
    const result = h!.result();
    const p = recordRun(loadProgress(), result, { dailyIndex: session.dailyIndex });
    saveProgress(p);
    try { app.progress.recordRun(`M-${result.mode}`, { stars: result.stars, aces: 0, score: result.total - result.correct, unit: 'wrong' }); } catch { /* desk store unavailable */ }   // MOB-032: the Desk's recent runs list it too
    session.last = { result, req: session.req!, dailyIndex: session.dailyIndex, source: h!.source };
    session.handle = null;
    location.replace('#/m/recap');
  }

  function show(): void {
    clearTimers();
    const step = h!.current();
    if (!step) { finish(); return; }
    if (step.type === 'rule') {
      view.phase = 'rule'; view.decision = null; view.verdict = null;
      renderStrip(SKILL_TITLE[step.card.skill]);
      card.innerHTML = ruleCardHtml(step.card); driver.textContent = '';
      const ok = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'ack' }, 'Got it');
      ok.onclick = () => advance();
      actions.replaceChildren(ok);
      return;
    }
    const d = step.decision;
    view.phase = 'decision'; view.decision = d; view.verdict = null; view.shownAt = wallSeconds();
    renderStrip(SKILL_TITLE[d.skill]);
    card.innerHTML = decisionCardHtml(d, h!.plan.rung);
    const line = driverLine(d); driver.textContent = line; speak(line.replace(/^Dad: /, '').replace(/"/g, ''), speechOn());
    actions.replaceChildren();
    const t = d.timing;
    if (t) {
      const taps: number[] = [];
      if (t.kind === 'startStop') {
        watch = mountTapWatch(actions, { mode: 'split', lapLabel: t.secondTapLabel ?? 'LAP', todAtZero: d.context.tod, now: wallSeconds, onTap: (s, kind) => {
          if (kind === 'start' && taps.length === 0) taps.push(s);
          else if ((kind === 'lap' || kind === 'stop') && taps.length === 1) { taps.push(s); submit({ taps: [...taps] }); }
        } });
      } else {
        watch = mountTapWatch(actions, { mode: 'go', label: t.tapLabel, autoStart: true, todAtZero: d.context.tod, todPrimary: !!t.todPrimary, now: wallSeconds, onTap: s => submit({ tapSeconds: s }) });
      }
      animateSign(d);
      // no tap by maxSeconds: answer with what was tapped (a late or missing call)
      timers.push(window.setTimeout(() => submit(taps.length ? { taps: [...taps] } : null), Math.max(1, t.maxSeconds) * 1000));
    } else {
      const opts = d.options ?? [];
      const grid = el('div', { class: `mob-opts n${Math.min(4, opts.length)}` });
      for (const o of opts.slice(0, 4)) {
        const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-option': o.id }, o.label);
        b.onclick = () => submit({ optionId: o.id });
        grid.append(b);
      }
      actions.append(grid);
      if (d.deadlineSeconds && d.deadlineSeconds > 0) {
        const bar = el('div', { class: 'mob-deadline', 'aria-hidden': 'true' }, el('span', { style: `animation-duration:${d.deadlineSeconds}s` }));
        actions.prepend(bar);
        timers.push(window.setTimeout(() => submit(null), d.deadlineSeconds * 1000));
      }
    }
  }

  show();
  return () => { clearTimers(); };
}

/** For the window.__rally.decision helpers: answer the card on screen now (no-op unless a decision is waiting). */
export function answerNow(resp: DecisionResponse | null): Verdict | null {
  if (view.phase !== 'decision') return null;
  const btn = resp?.optionId !== undefined ? document.querySelector<HTMLButtonElement>(`.mob-actions [data-option="${CSS.escape(resp.optionId)}"]`) : null;
  if (btn) { btn.click(); return view.verdict; }
  return null;
}
