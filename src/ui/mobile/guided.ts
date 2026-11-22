/**
 * SCH-004 guided controls on the phone run screen: while the visitor is taking the course and modules 0..6 are not all complete,
 * the controls a card uses that the course has not introduced yet are hidden (read-outs: chart cell, distance bar, TOD strip) or
 * greyed (answer controls stay tappable so no card is ever unanswerable), and the newest introduced control gets a ring and a
 * one-line pointer. Visitors who never opened the course see the full run screen (guidedState().active is false).
 * The same control -> element map places the mini-sim pointer (src/ui/school2/minisim.ts).
 */
import type { Decision, DecisionKind } from '../../core/decision/index.js';
import type { ControlId } from '../../../content/course-types.js';
import { guidedState, type GuidedState } from '../school2/progress.js';
import { pointerFor } from '../school2/sources.js';
import { el } from '../state.js';

/** Where each control lives on a card screen (card area + action zone). */
export const CONTROL_SELECTOR: Record<ControlId, string> = {
  book: '.mrow', callTurn: '.mob-opts', callSpeed: '.mob-opts', go: '[data-action=go]', watchStartStop: '[data-action=startstop]', watchLap: '[data-action=lap]',
  chartCell: '.mchart, .mchart-btn', distanceBar: '.msign', callAtMark: '.msign-calllbl, [data-action=lap], [data-action=go]', clock: '.mclock', todStrip: '[data-testid=tod-digits]',
  launch: '[data-action=go]', makeup: '.mob-opts', taCard: '.mob-opts', holdCard: '.mob-opts', desk: '[data-testid=desk-mode]',
};
/** Read-outs that are hidden (not greyed) until introduced. */
export const HIDE_UNTIL_INTRODUCED: ControlId[] = ['chartCell', 'distanceBar', 'todStrip'];

/** The answer control each kind is played with. */
const ANSWER_CONTROL: Record<DecisionKind, ControlId[]> = {
  preread: ['book'], turn: ['callTurn'], lost: ['callTurn'], checkpoint: ['book'], clock: ['clock'], makeup: ['makeup'], hazard: ['taCard'], ta: ['taCard'],
  transitOut: ['holdCard'], pause: ['go'], restart: ['launch'], timedStart: ['watchStartStop', 'watchLap'], speedChange: ['callAtMark'], watch: ['watchLap'],
};
/** The controls a decision card shows: its answer control plus the read-outs it carries. */
export function controlsOf(d: Pick<Decision, 'kind' | 'context' | 'timing' | 'prompt'>): ControlId[] {
  const out = new Set<ControlId>(ANSWER_CONTROL[d.kind] ?? []);
  if (d.kind === 'preread' && /speed/i.test(d.prompt)) out.add('callSpeed');
  if (d.context.row) out.add('book');
  if (d.context.chart) out.add('chartCell');
  if (d.timing?.signSeconds) out.add('distanceBar');
  if (d.timing) out.add('todStrip');   // every timed card carries the TOD strip under the watch
  if (d.context.clock) out.add('clock');
  return [...out];
}

/** Ring + one-line pointer on a control (the mini-sim pointer and the guided pointer share it). Returns the ringed element. */
export function pointAt(root: HTMLElement, control: ControlId, label: string, where: HTMLElement | null = null): HTMLElement | null {
  root.querySelectorAll('.s2-ring').forEach(n => n.classList.remove('s2-ring'));
  root.querySelector('[data-testid=pointer]')?.remove();
  const target = root.querySelector<HTMLElement>(CONTROL_SELECTOR[control]);
  if (target) {
    target.classList.add('s2-ring'); target.dataset['pointer'] = control;
    const det = target.closest('details'); if (det) (det as HTMLDetailsElement).open = true;
  }
  const line = el('p', { class: 's2-pointer', 'data-testid': 'pointer', 'data-control': control, role: 'note' }, label);
  (where ?? root).prepend(line);
  return target;
}

/** SCH-004: apply the guided state to a run screen showing decision `d`. Returns what it did (tests / helpers). */
export function applyGuided(page: HTMLElement, d: Decision, g: GuidedState = guidedState()): { hidden: ControlId[]; greyed: ControlId[]; pointer: ControlId | null } {
  page.classList.toggle('guided', g.active);
  const res = { hidden: [] as ControlId[], greyed: [] as ControlId[], pointer: null as ControlId | null };
  if (!g.active) return res;
  const intro = new Set(g.introduced);
  for (const c of controlsOf(d)) {
    if (intro.has(c)) continue;
    const nodes = page.querySelectorAll<HTMLElement>(CONTROL_SELECTOR[c]);
    if (!nodes.length) continue;
    const hide = HIDE_UNTIL_INTRODUCED.includes(c);
    nodes.forEach(n => n.classList.add(hide ? 'g-hide' : 'g-grey'));
    (hide ? res.hidden : res.greyed).push(c);
  }
  if (g.newest && controlsOf(d).includes(g.newest)) {
    const card = page.querySelector<HTMLElement>('.mob-cardarea') ?? page;
    pointAt(page, g.newest, `New: ${pointerFor(g.newest)}`, card);
    res.pointer = g.newest;
  }
  return res;
}
