/**
 * SCH-005 mini-sim page: one phone decision card (the engine's miniSim: a DecisionRun with exactly one decision of the page's kind and
 * seed) rendered with the phone card renderer (src/ui/mobile/cards.ts) and the tap-stopwatch (tapwatch.ts) through the shell's RunHandle,
 * a ring and a one-line pointer on the page's control, the verdict with the page's "why" line; a wrong answer shows the rule and offers
 * a second try of the same card; the page is complete after one right answer. Nothing is saved to the run progress.
 */
import type { MinisimPage } from '../../../content/course-types.js';
import type { Decision, DecisionResponse, RunPlan, Verdict } from '../../core/decision/index.js';
import * as core from '../../core/decision/index.js';
import { RunHandle } from '../mobile/engine.js';
import { decisionCardHtml, verdictParts, signState } from '../mobile/cards.js';
import { mountTapWatch, type TapWatch } from '../mobile/tapwatch.js';
import { pointAt } from '../mobile/guided.js';
import { pointerFor } from './sources.js';
import { el } from '../state.js';

interface MiniRun { plan: RunPlan; next(): unknown; ack(): void; answer(r: DecisionResponse | null): Verdict; done(): boolean; result(): unknown; retry?(): MiniRun; guided?: { pointer?: string } }

/** The engine's mini-sim for a page (miniSim when exported; else a one-decision DecisionRun built the same way). */
export function miniRunFor(page: Pick<MinisimPage, 'decisionKind' | 'seed' | 'control'>): MiniRun | null {
  const c = core as unknown as { miniSim?: (k: string, s: number, o?: object) => MiniRun; DecisionRun?: new (p: RunPlan) => MiniRun; SKILL_OF_KIND?: Record<string, string> };
  try { if (typeof c.miniSim === 'function') return c.miniSim(page.decisionKind, page.seed, { control: page.control }); } catch { /* fall back */ }
  try {
    if (typeof c.DecisionRun !== 'function') return null;
    const skill = (c.SKILL_OF_KIND?.[page.decisionKind] ?? 'safetyCourse') as RunPlan['skills'][number];
    return new c.DecisionRun({ seed: page.seed, mode: 'practice', skills: [skill], rung: 2, items: [{ type: 'decision', micro: { kind: page.decisionKind, skill, seed: page.seed, variant: ((page.seed % 4) + 4) % 4 } }], decisionCount: 1 });
  } catch { return null; }
}

export interface MiniSimEnv { done(): void; now?: () => number }
const wall = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** window.__rally.school.mini: the card on screen (tests answer it through the oracle). */
export const miniView: { decision: Decision | null; shownAt: number; handle: RunHandle | null; attempt: number; complete: boolean; jumpAt: number | null } = { decision: null, shownAt: 0, handle: null, attempt: 0, complete: false, jumpAt: null };
export function miniCardSeconds(now: () => number = wall): number {
  const w = now() - miniView.shownAt; const k = miniView.decision?.timing?.skip;
  return k && miniView.jumpAt !== null && w >= miniView.jumpAt ? w + (k.to - miniView.jumpAt) : w;
}

export function mountMiniSim(host: HTMLElement, page: MinisimPage, env: MiniSimEnv): () => void {
  const now = env.now ?? wall;
  const cardArea = el('section', { class: 'mob-cardarea s2-minicard', 'aria-live': 'polite' });
  const actions = el('section', { class: 's2-miniacts', 'data-testid': 'mini-actions' });
  const box = el('div', { class: 's2-minisim', 'data-kind': page.decisionKind, 'data-control': page.control }, cardArea, actions);
  host.append(box);
  let watch: TapWatch | null = null; const timers: number[] = []; let raf = 0; let run: MiniRun | null = miniRunFor(page);
  const clear = (): void => { while (timers.length) clearTimeout(timers.pop()); watch?.destroy(); watch = null; if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = 0; };

  function show(): void {
    clear();
    if (!run) { cardArea.replaceChildren(el('p', { class: 'muted' }, 'This mini-sim is not available in this build.')); env.done(); return; }
    const h = new RunHandle(run as never, 'core'); miniView.handle = h; miniView.attempt += 1;
    let step = h.current();
    for (let i = 0; i < 4 && step?.type === 'rule'; i++) { h.ack(); step = h.current(); }
    if (!step || step.type !== 'decision') { cardArea.replaceChildren(el('p', { class: 'muted' }, 'No card came up for this mini-sim.')); env.done(); return; }
    const d = step.decision; miniView.decision = d; miniView.shownAt = now(); miniView.jumpAt = d.timing?.skip && d.timing.kind !== 'startStop' ? d.timing.skip.at : null;
    cardArea.innerHTML = decisionCardHtml(d, h.plan.rung ?? 2);
    actions.replaceChildren();
    let answered = false;
    const submit = (resp: DecisionResponse | null): void => {
      if (answered) return; answered = true; clear();
      let v: Verdict; try { v = h.answer(resp); } catch (e) { cardArea.append(el('p', { class: 'danger' }, String((e as Error).message ?? e))); return; }
      verdict(v);
    };
    const t = d.timing;
    if (t) {
      const cardNow = (): number => miniView.shownAt + miniCardSeconds(now);
      const taps: number[] = [];
      if (t.kind === 'startStop') {
        watch = mountTapWatch(actions, { mode: 'split', lapLabel: t.secondTapLabel ?? 'LAP', todAtZero: d.context.tod, zone: d.context.zone, now: cardNow, onTap: (s, kind) => {
          if (kind === 'start' && taps.length === 0) { taps.push(s); if (t.skip) { const at = Math.max(s, t.signSeconds ?? 0) + 2; if (t.skip.to > at + 1) miniView.jumpAt = at; } }
          else if ((kind === 'lap' || kind === 'stop') && taps.length === 1) { taps.push(s); submit({ taps: [...taps] }); }
        } });
      } else {
        watch = mountTapWatch(actions, { mode: 'go', label: t.tapLabel, autoStart: true, todAtZero: d.context.tod, zone: d.context.zone, todPrimary: !!t.todPrimary, hideDigits: d.kind === 'speedChange', now: cardNow, onTap: s => submit({ tapSeconds: s }) });
      }
      // the sign bar shrinks to the sign (MOB-052)
      const bar = cardArea.querySelector<HTMLElement>('.msign');
      if (bar && t.signSeconds) {
        const fill = bar.querySelector<HTMLElement>('.msign-fill'); const ft = bar.querySelector<HTMLElement>('.msign-ft'); const mark = bar.querySelector<HTMLElement>('.msign-mark');
        const frame = (): void => { if (answered) return; const st = signState(t, miniCardSeconds(now)); if (fill) fill.style.width = `${(st.frac * 100).toFixed(1)}%`; if (ft) ft.textContent = `${st.ft} ft`; if (mark) mark.textContent = st.mark ? 'Mark!' : ''; bar.classList.toggle('marked', st.mark); raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(frame) : 0; };
        frame();
      }
      const maxWall = (core as unknown as { wallMaxOf?: (t: unknown) => number }).wallMaxOf;
      const limit = typeof maxWall === 'function' ? maxWall(t) : t.maxSeconds;
      timers.push(window.setTimeout(() => submit(taps.length ? { taps: [...taps] } : null), Math.max(1, limit + 4) * 1000));
    } else {
      const opts = d.options ?? [];
      const grid = el('div', { class: `mob-opts n${Math.min(4, opts.length)}` });
      for (const o of opts.slice(0, 4)) { const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-option': o.id }, o.label); b.onclick = () => submit({ optionId: o.id }); grid.append(b); }
      actions.append(grid);
    }
    pointAt(box, page.control, (run.guided?.pointer && typeof run.guided.pointer === 'string') ? run.guided.pointer : pointerFor(page.control), cardArea);
  }

  function verdict(v: Verdict): void {
    const vp = verdictParts(v);
    const ov = el('div', { class: `s2-verdict ${v.correct ? 'v-ok' : 'v-bad'}`, 'data-testid': 'mini-verdict', 'data-correct': String(v.correct), role: 'status' },
      el('div', { class: 'mv-head' }, el('span', {}, vp.head), el('b', { class: 'mv-sec' }, vp.seconds)));
    if (v.correct) ov.append(el('p', { class: 's2-why', 'data-testid': 'why' }, page.why));
    else ov.append(el('p', { class: 's2-rule', 'data-testid': 'mini-rule' }, v.rule));
    cardArea.append(ov);
    if (v.correct) { miniView.complete = true; actions.replaceChildren(el('p', { class: 's2-donemsg' }, 'Done: swipe or tap Next.')); env.done(); return; }
    const again = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'try-again' }, 'Try again');
    again.onclick = () => { const r = run?.retry?.(); run = r ?? miniRunFor(page); show(); };
    actions.replaceChildren(again);
  }

  miniView.attempt = 0; miniView.complete = false;
  show();
  return () => { clear(); if (miniView.handle && miniView.decision) { miniView.decision = null; miniView.handle = null; } };
}
