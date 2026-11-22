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
import { decisionCardHtml, verdictParts, signState, cueState } from '../mobile/cards.js';
import { mountTapWatch, type TapWatch } from '../mobile/tapwatch.js';
import { pointAt } from '../mobile/guided.js';
import { pointerFor } from './sources.js';
import { sourceChips, zoneChip } from './sheet.js';
import { el } from '../state.js';
import { moduleRule } from '../../../content/course.js';

interface MiniRun { plan: RunPlan; next(): unknown; ack(): void; answer(r: DecisionResponse | null): Verdict; done(): boolean; result(): unknown; retry?(): MiniRun; guided?: { pointer?: string } }

/** The engine's mini-sim for a page (miniSim when exported; else a one-decision DecisionRun built the same way). */
export function miniRunFor(page: Pick<MinisimPage, 'decisionKind' | 'seed' | 'control' | 'variant' | 'form' | 'pointer'>): MiniRun | null {
  const c = core as unknown as { miniSim?: (k: string, s: number, o?: object) => MiniRun; DecisionRun?: new (p: RunPlan) => MiniRun; SKILL_OF_KIND?: Record<string, string> };
  try { if (typeof c.miniSim === 'function') return c.miniSim(page.decisionKind, page.seed, { control: page.control, ...(page.variant !== undefined ? { variant: page.variant } : {}), ...(page.form ? { form: page.form } : {}), ...(page.pointer ? { pointer: page.pointer } : {}) }); } catch { /* fall back */ }
  try {
    if (typeof c.DecisionRun !== 'function') return null;
    const skill = (c.SKILL_OF_KIND?.[page.decisionKind] ?? 'safetyCourse') as RunPlan['skills'][number];
    return new c.DecisionRun({ seed: page.seed, mode: 'practice', skills: [skill], rung: 2, items: [{ type: 'decision', micro: { kind: page.decisionKind, skill, seed: page.seed, variant: page.variant ?? ((page.seed % 4) + 4) % 4, ...(page.form ? { form: page.form } : {}) } }], decisionCount: 1 });
  } catch { return null; }
}

/** PT-16 B1: "Try again" ignores taps for this long after the verdict. */
export const TRY_AGAIN_ARM_MS = 400;
export interface MiniSimEnv { done(): void; now?: () => number; /** PT-17 N9: the module the page is in (module-aware rule text) */ moduleIndex?: number }
const wall = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** window.__rally.school.mini: the card on screen (tests answer it through the oracle). */
export const miniView: { decision: Decision | null; shownAt: number; handle: RunHandle | null; attempt: number; complete: boolean; jumpAt: number | null; started: boolean; round: number; rounds: number } = { decision: null, shownAt: 0, handle: null, attempt: 0, complete: false, jumpAt: null, started: true, round: 0, rounds: 1 };
export function miniCardSeconds(now: () => number = wall): number {
  if (!miniView.started) return 0;   // SCH-022: frozen until Start
  const w = now() - miniView.shownAt; const k = miniView.decision?.timing?.skip;
  return k && miniView.jumpAt !== null && w >= miniView.jumpAt ? w + (k.to - miniView.jumpAt) : w;
}

export function mountMiniSim(host: HTMLElement, page0: MinisimPage, env: MiniSimEnv): () => void {
  const now = env.now ?? wall;
  // SCH-025: a page may hold several cases, played one after another; each case's correct answer shows its own why
  const rounds: MinisimPage[] = [page0, ...(page0.rounds ?? []).map(r => ({ ...page0, ...r, rounds: undefined }))];
  let ri = 0; let page = rounds[0]!;
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
    const d = step.decision; miniView.decision = d; miniView.shownAt = now(); miniView.started = !d.timing; miniView.jumpAt = d.timing?.skip && d.timing.kind !== 'startStop' ? d.timing.skip.at : null;
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
      const maxWall = (core as unknown as { wallMaxOf?: (t: unknown) => number }).wallMaxOf;
      const limit = typeof maxWall === 'function' ? maxWall(t) : t.maxSeconds;
      // SCH-022: frozen under Start; the card's clock and its give-up timer start on the tap
      const onStart = (): void => { miniView.shownAt = now(); miniView.started = true; timers.push(window.setTimeout(() => submit(taps.length ? { taps: [...taps] } : null), Math.max(1, limit + 4) * 1000)); };
      if (t.kind === 'startStop') {
        watch = mountTapWatch(actions, { mode: 'split', gate: true, onStart, lapLabel: t.secondTapLabel ?? 'LAP', todAtZero: d.context.tod, zone: d.context.zone, now: cardNow, onTap: (s, kind) => {
          if (kind === 'start' && taps.length === 0) { taps.push(s); if (t.skip) { const at = Math.max(s, t.signSeconds ?? 0) + 2; if (t.skip.to > at + 1) miniView.jumpAt = at; } }
          else if ((kind === 'lap' || kind === 'stop') && taps.length === 1) { taps.push(s); submit({ taps: [...taps] }); }
        } });
      } else {
        watch = mountTapWatch(actions, { mode: 'go', gate: true, onStart, label: t.tapLabel, autoStart: true, todAtZero: d.context.tod, zone: d.context.zone, todPrimary: !!t.todPrimary, hideDigits: d.kind === 'speedChange', now: cardNow, onTap: s => submit({ tapSeconds: s }) });
      }
      // the sign bar shrinks to the sign (MOB-052)
      const bar = cardArea.querySelector<HTMLElement>('.msign');
      if (bar && t.signSeconds) {
        const fill = bar.querySelector<HTMLElement>('.msign-fill'); const ft = bar.querySelector<HTMLElement>('.msign-ft'); const mark = bar.querySelector<HTMLElement>('.msign-mark');
        // PT-16 SCH-015: a card with several signs (the stopwatch card) runs the bar to the next sign and names it
        const frame = (): void => { if (answered) return; const e = miniCardSeconds(now); const st = t.cues?.length ? cueState(t.cues, e) : { ...signState(t, e), label: '' }; if (fill) fill.style.width = `${(st.frac * 100).toFixed(1)}%`; if (ft) ft.textContent = st.label ? `${st.label} ${st.ft} ft` : `${st.ft} ft`; if (mark) mark.textContent = st.mark ? 'Mark!' : ''; bar.classList.toggle('marked', st.mark); raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(frame) : 0; };
        frame();
      }
    } else {
      const opts = d.options ?? [];
      const grid = el('div', { class: `mob-opts n${Math.min(4, opts.length)}` });
      for (const o of opts.slice(0, 4)) { const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-option': o.id }, o.label); b.onclick = () => submit({ optionId: o.id }); grid.append(b); }
      actions.append(grid);
    }
    pointAt(box, page.control, core.cardPointer(page.pointer ?? ((run.guided?.pointer && typeof run.guided.pointer === 'string') ? run.guided.pointer : pointerFor(page.control)), d), cardArea);
    const z = d.timing && d.context.zone ? zoneChip(d.context.zone) : null; if (z) actions.append(z);   // PT-16: "CDT" explained (time zone chip)
  }

  function verdict(v: Verdict): void {
    const vp = verdictParts(v, { noSeconds: !miniView.decision?.timing });   // PT-17 N7: no seconds on an option card's verdict
    const ov = el('div', { class: `s2-verdict ${v.correct ? 'v-ok' : 'v-bad'}`, 'data-testid': 'mini-verdict', 'data-correct': String(v.correct), role: 'status' },
      el('div', { class: 'mv-head' }, el('span', {}, vp.head), el('b', { class: 'mv-sec' }, vp.seconds)));
    if (page.form === 'lap' || (v.kind === 'watch' && /lap reads/.test(v.chosen))) ov.append(el('p', { class: 's2-lapread', 'data-testid': 'lap-read' }, vp.detail));   // PT-16 SCH-015: the lap read-off
    if (v.correct) ov.append(el('p', { class: 's2-why', 'data-testid': 'why' }, page.why));
    else ov.append(el('p', { class: 's2-rule', 'data-testid': 'mini-rule' }, moduleRule(vp.rule, v.kind, env.moduleIndex ?? 99)));
    // PT-16 B10: the source is a chip that opens the excerpt sheet, never text in the verdict
    const chips = sourceChips(v.source, v.kind); if (chips.length) ov.append(el('div', { class: 's2-vchips', 'data-testid': 'verdict-chips' }, ...chips));
    cardArea.append(ov);
    if (v.correct && ri < rounds.length - 1) {
      const nextCase = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'next-case' }, `Next case (${ri + 2} of ${rounds.length})`);
      nextCase.onclick = () => { ri++; page = rounds[ri]!; miniView.round = ri; run = miniRunFor(page); show(); };
      actions.replaceChildren(nextCase); return;
    }
    if (v.correct) { miniView.complete = true; actions.replaceChildren(el('p', { class: 's2-donemsg' }, 'Done: swipe or tap Next.')); env.done(); return; }
    // PT-16 B1: the verdict must survive the gesture that produced it: the tap-watch swallows that gesture's click, and "Try again"
    // stays disabled for TRY_AGAIN_ARM_MS, so only an explicit second tap restarts the card
    const again = el('button', { class: 'mob-btn primary big', type: 'button', 'data-action': 'try-again', disabled: '' }, 'Try again') as HTMLButtonElement;
    again.onclick = () => { if (again.disabled) return; const r = run?.retry?.(); run = r ?? miniRunFor(page); show(); };
    actions.replaceChildren(again);
    timers.push(window.setTimeout(() => { again.disabled = false; }, TRY_AGAIN_ARM_MS));
  }

  miniView.attempt = 0; miniView.complete = false; miniView.round = 0; miniView.rounds = rounds.length;
  show();
  return () => { clear(); if (miniView.handle && miniView.decision) { miniView.decision = null; miniView.handle = null; } };
}
