/** MOB-006 recap: stars, per-skill tallies, the three worst cards with their rule, then "Again" and "Next run". */
import { SKILLS, SKILL_TITLE } from '../../core/decision/index.js';
import { el } from '../state.js';
import { KIND_TITLE } from './cards.js';
import { session } from './session.js';
import { dailyState, loadProgress } from './progress.js';

export function renderRecap(root: HTMLElement): void {
  const last = session.last;
  if (!last) { location.replace('#/m'); return; }
  const r = last.result;
  const page = el('div', { class: 'mob mob-recap', 'data-screen': 'recap' });
  const stars = el('div', { class: 'mob-stars', 'data-stars': r.stars, 'aria-label': `${r.stars} of 3 stars` }, ...[0, 1, 2].map(i => el('span', { class: i < r.stars ? 'on' : '' }, '★')));
  const body = el('div', { class: 'mob-recap-body' },
    el('h1', {}, 'Run complete'), stars,
    el('p', { class: 'mob-sum', 'data-testid': 'recap-sum' }, `${r.correct} of ${r.total} right · ${r.secondsTotal.toFixed(1)} s off`));
  const tbl = el('table', { class: 'mob-tally' });
  for (const s of SKILLS) { const t = r.tallies[s]; if (!t || !t.total) continue; tbl.append(el('tr', { 'data-skill': s }, el('th', {}, SKILL_TITLE[s]), el('td', {}, `${t.correct}/${t.total}`), el('td', {}, `${t.seconds.toFixed(1)} s`))); }
  body.append(tbl);
  if (r.worst.length) {
    const w = el('ol', { class: 'mob-worst', 'data-testid': 'worst' });
    for (const x of r.worst.slice(0, 3)) w.append(el('li', {}, el('b', {}, `${KIND_TITLE[x.verdict.kind]}: ${x.verdict.correct ? 'right' : 'missed'}, ${Math.abs(x.verdict.secondsDelta).toFixed(1)} s`), el('span', {}, x.rule)));
    body.append(el('h2', {}, 'Worst three'), w);
  }
  const again = el('a', { class: 'mob-btn big', href: '#/m/play/again', 'data-action': 'again' }, 'Again');
  const daily = dailyState(loadProgress());
  const nextHref = last.dailyIndex !== null && daily.next !== null ? `#/m/play/daily/${daily.next}` : '#/m/play/practice';
  const next = el('a', { class: 'mob-btn primary big', href: nextHref, 'data-action': 'next-run' }, 'Next run');
  page.append(el('header', { class: 'mob-strip' }, el('a', { class: 'mob-quit', href: '#/m', 'aria-label': 'Home' }, '×'), el('span', { class: 'mob-skill' }, 'Recap')), el('div', { class: 'mob-main' }, body), el('section', { class: 'mob-actions' }, el('div', { class: 'mob-opts n2' }, again, next)));
  root.replaceChildren(page);
}
