/** Debrief scorecard panel (UI-034): mirrors the official scorecard, plus TA requests (UI-031) and instrument discipline (WATCH-009). */
import type { ScorecardVm } from '../viewmodels/scorecard.js';
import { formatInterval } from '../../core/griid.js';
import { V3_KINDS, V3_LABEL, V3_NONE } from '../viewmodels/v3.js';
import { el } from '../state.js';

export function scorecardPanel(vm: ScorecardVm): HTMLElement {
  const panel = el('div', { class: 'panel scorecard', id: 'scorecard' }, el('h3', {}, 'Scorecard'));
  if (vm.dnf) panel.append(el('div', { class: 'banner dnf', id: 'dnf-banner' }, vm.banner));
  const table = el('table', { id: 'cp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Leg'), el('th', {}, 'Perfect'), el('th', {}, 'Actual'), el('th', { class: 'pen' }, 'Error'), el('th', { class: 'pen' }, 'TA credit'), el('th', { class: 'pen' }, 'Penalty'), el('th', {}, ''))));
  const tb = el('tbody', {});
  for (const l of vm.legs) {
    const note = [l.flagText, l.sightZone > 0 ? `sight zone +${l.sightZone}` : ''].filter(Boolean).join('; ');
    tb.append(el('tr', { class: `${l.flag === 'late-cap' || l.flag === 'early-cap' ? 'capped' : l.flag === 'missed' ? 'missed' : l.ace ? 'ace' : ''}`, 'data-leg': String(l.legIndex), 'data-flag': l.flag },
      el('td', {}, `${l.legIndex} (${l.cpId})`), el('td', { class: 'mono' }, l.perfect), el('td', { class: 'mono' }, l.actual), el('td', { class: 'pen' }, l.errorText), el('td', { class: 'pen' }, l.taCredit ? formatInterval(l.taCredit) : '-'),
      el('td', { class: 'pen' }, String(l.penalty)), el('td', {}, el('span', { class: l.flag === 'ace' ? 'ok' : 'flag' }, note))));
  }
  table.append(tb); panel.append(table, el('p', { class: 'muted', id: 'caps-note', style: 'margin:6px 0' }, vm.capsText));
  if (vm.taRequests.length || vm.scorecardAcked !== null) {
    const box = el('div', { id: 'ta-results' }, el('h3', { style: 'margin-top:10px' }, 'Time Allowance'));
    const ul = el('ul', {}); for (const r of vm.taRequests) ul.append(el('li', { class: r.status === 'refused' ? 'danger' : '', 'data-status': r.status }, r.text));
    if (!vm.taRequests.length) ul.append(el('li', { class: 'muted' }, 'No requests filed.'));
    box.append(ul);
    if (vm.scorecardAcked !== null) box.append(el('div', { class: 'muted' }, vm.scorecardAcked ? 'Scorecard acknowledged at the end-of-stage TA point.' : 'Scorecard not acknowledged at the end-of-stage TA point.'));
    panel.append(box);
  }
  if (vm.items.length) {
    const ul = el('ul', { id: 'penalty-items' }); for (const i of vm.items) ul.append(el('li', { 'data-kind': i.kind }, `${i.label}: +${i.seconds} s`));
    panel.append(el('h3', { style: 'margin-top:10px' }, 'Other penalty items'), ul);
  }
  panel.append(el('div', { class: 'totals' },
    el('div', { id: 'raw-score' }, 'Raw stage score', el('b', {}, `${vm.raw} s`)),
    el('div', { id: 'age-factor' }, 'Age factor', el('b', {}, vm.ageText)),
    el('div', { id: 'stage-score' }, 'Stage score', el('b', {}, `${vm.scoreText} s`)),
    el('div', {}, 'Aces', el('b', {}, String(vm.aces)))));
  // WATCH-009: instrument discipline
  const disc = el('div', { id: 'instrument-discipline', style: 'margin-top:12px' }, el('h3', {}, 'Instrument discipline'), el('p', { class: vm.discipline.clean ? 'ok' : '' }, vm.discipline.summary));
  if (!vm.discipline.clean) { const ul = el('ul', { class: 'findings' }); for (const f of vm.discipline.findings) ul.append(el('li', {}, el('span', { class: 'kind' }, f.kind), f.text)); disc.append(ul); }
  panel.append(disc);
  // INST-002 / MAKEUP-001 / START-001: the three rally school findings, each listed on its own
  const school = el('div', { id: 'start-findings', style: 'margin-top:12px' }, el('h3', {}, 'Start, clock and make-up findings'), el('p', { class: vm.v3.all.length ? '' : 'ok', id: 'start-findings-summary' }, vm.v3.summary));
  for (const k of V3_KINDS) {
    const list = vm.v3[k];
    const box = el('div', { class: `finding-group ${list.length ? 'bad' : 'clean'}`, 'data-kind': k, id: `finding-${k}` }, el('b', {}, `${V3_LABEL[k]}: `), list.length ? '' : el('span', { class: 'muted' }, V3_NONE[k]));
    if (list.length) { const ul = el('ul', { class: 'findings' }); for (const f of list) ul.append(el('li', { 'data-kind': f.kind }, f.line !== null ? `line ${f.line}: ${f.text}` : f.text)); box.append(ul); }
    school.append(box);
  }
  if (vm.startDeltas.length) { const ul = el('ul', { class: 'findings', id: 'start-deltas' }); for (const d of vm.startDeltas) ul.append(el('li', { class: d.flagged ? 'danger' : '', 'data-line': String(d.line) }, d.text)); school.append(el('b', {}, 'Starts and restarts against the launch time'), ul); }
  panel.append(school);
  return panel;
}
