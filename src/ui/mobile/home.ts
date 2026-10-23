/**
 * MOB-025: Home on a phone. Daily set (three runs), Continue (the last unfinished run), the five skill meters (tap one to practise it;
 * the legal-rung run appears at 80 %, MOB-031), streak, the Boss run when all meters are at 50 %, the School, Dad's card, Reference and Desk mode. MOB-060: Continue is the primary button while a run is unfinished.
 */
import { SKILLS, SKILL_TITLE } from '../../core/decision/index.js';
import { el } from '../state.js';
import { loadProgress, dailyState, legalUnlocked, bossUnlocked } from './progress.js';
import { a2hsHint, hintSeen, markHintSeen, isStandalone } from './pwa.js';
import { speechOn, setSpeech } from './prefs.js';

export function renderMobileHome(root: HTMLElement): void {
  const p = loadProgress();
  const daily = dailyState(p);
  const page = el('div', { class: 'mob mob-home', 'data-screen': 'home' });
  const head = el('header', { class: 'mob-head' }, el('h1', {}, 'Rally Trainer'), el('span', { class: 'mob-streak', 'data-testid': 'streak', title: 'days in a row' }, `Streak ${p.streak.current}`));
  page.append(head);
  const hint = a2hsHint({ seen: hintSeen(), standalone: isStandalone(), ua: navigator.userAgent });
  if (hint) {
    const close = el('button', { class: 'mob-hint-x', type: 'button', 'aria-label': 'dismiss' }, 'OK');
    const box = el('div', { class: 'mob-hint', role: 'note', 'data-testid': 'a2hs-hint' }, el('span', {}, hint), close);
    close.onclick = () => box.remove();
    markHintSeen();          // shown once
    page.append(box);
  }
  // Daily set
  const pills = el('div', { class: 'mob-pills' }, ...[0, 1, 2].map(i => el('span', { class: `mob-pill${daily.completed.includes(i) ? ' done' : ''}`, 'data-daily': i }, daily.completed.includes(i) ? `Run ${i + 1} done` : `Run ${i + 1}`)));
  // MOB-060: while a run is unfinished, Continue is the primary button (above the daily set); starting another run asks first
  if (p.unfinished) {
    const n = p.unfinished.responses.length;
    page.append(el('a', { class: 'mob-btn primary big', href: '#/m/continue', 'data-testid': 'continue' }, `Continue run (${n} of ${p.unfinished.plan.decisionCount} done)`));
  }
  const dailyBtn = el('a', { class: `mob-btn${p.unfinished ? '' : ' primary'} big`, href: daily.next === null ? '#/m/play/practice' : `#/m/play/daily/${daily.next}`, 'data-testid': 'play-daily' }, daily.next === null ? 'Daily set done: practise' : `Play daily run ${daily.next + 1} of 3`);
  page.append(el('section', { class: 'mob-sec mob-daily' }, el('h2', {}, 'Daily set'), pills, dailyBtn));
  // Skill meters
  const meters = el('section', { class: 'mob-sec mob-meters' }, el('h2', {}, 'Skills'));
  for (const s of SKILLS) {
    const m = p.meters[s]; const pct = Math.round(m.value * 100);
    const bar = el('span', { class: 'mob-bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': SKILL_TITLE[s] }, el('span', { class: 'mob-bar-fill', style: `width:${pct}%` }));
    const row = el('div', { class: 'mob-meter', 'data-skill': s },
      el('a', { class: 'mob-meter-main', href: `#/m/play/skill/${s}` }, el('span', { class: 'mob-meter-name' }, SKILL_TITLE[s]), el('span', { class: 'mob-meter-pct' }, `${pct} %`), bar));
    if (legalUnlocked(p, s)) row.append(el('a', { class: 'mob-btn small legal', href: `#/m/play/skill/${s}/legal`, 'data-legal': s }, 'Legal'));
    meters.append(row);
  }
  page.append(meters);
  const boss = bossUnlocked(p);
  page.append(boss ? el('a', { class: 'mob-btn big boss', href: '#/m/play/boss', 'data-testid': 'boss' }, 'Boss run: a full leg')
    : el('p', { class: 'mob-locked', 'data-testid': 'boss-locked' }, 'Boss run opens when every skill is at 50 %.'));
  // links
  const voice = el('button', { class: 'mob-btn', type: 'button', 'aria-pressed': speechOn() ? 'true' : 'false' }, speechOn() ? "Dad's voice: on" : "Dad's voice: off");
  voice.onclick = () => { setSpeech(!speechOn()); voice.textContent = speechOn() ? "Dad's voice: on" : "Dad's voice: off"; voice.setAttribute('aria-pressed', String(speechOn())); };
  page.append(el('nav', { class: 'mob-links' },
    el('a', { class: 'mob-btn', href: '#/school', 'data-testid': 'school' }, 'School'),
    el('a', { class: 'mob-btn', href: '#/school/dad', 'data-testid': 'dads-card' }, "Dad's card"),
    el('a', { class: 'mob-btn', href: '#/reference' }, 'Reference'),
    voice,
    el('a', { class: 'mob-btn', href: '?mode=desk#/', 'data-testid': 'desk-mode' }, 'Desk mode')));
  root.replaceChildren(page);
}
