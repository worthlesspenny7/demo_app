/** Entry: hash router and top navigation. */
import { app, applyTheme, el, parseSource } from './state.js';
import { renderHome } from './screens/home.js';
import { renderSchool, renderRules, renderLongLesson } from './screens/school.js';
import { markFirstVisit } from './school2/player.js';
import { PROGRESS_KEY } from './viewmodels/progress.js';
import { DECISION_PROGRESS_KEY } from './mobile/progress.js';
import { COURSE_POS_KEY } from './school2/progress.js';
import { renderCockpit } from './screens/cockpit.js';
import { renderDebrief } from './screens/debrief.js';
import { renderReference } from './screens/reference.js';
import { renderSettings } from './screens/settings.js';
import { renderQuiz } from './screens/quiz.js';
import { renderCampaign } from './screens/campaign.js';
import { renderBookPage } from './screens/book.js';
import { campaignGate } from './viewmodels/campaign-gate.js';
import { currentMode, renderMobile, registerServiceWorker, watchOrientation } from './mobile/index.js';

const root = document.getElementById('app') ?? document.body.appendChild(el('div', { id: 'app', class: 'app' }));
applyTheme(app.settings);
/** MOB-020: the phone shell opens below 700 px (or with ?mode=mobile); Desk mode is the cockpit app below. */
const shellMode = currentMode();
document.body.classList.toggle('mobile', shellMode === 'mobile');
watchOrientation();
const nav = el('nav', { class: 'nav' });
const links: [string, string][] = [['#/', 'Home'], ['#/school', 'School'], ['#/debrief', 'Debrief'], ['#/reference', 'Reference'], ['#/settings', 'Settings']];
nav.append(el('a', { class: 'brand', href: '#/' }, 'RALLY TRAINER'));
for (const [href, text] of links) nav.append(el('a', { href, 'data-nav': href }, text));
const campaignLink = el('a', { href: '#/campaign', 'data-nav': '#/campaign', id: 'nav-campaign' }, 'Campaign'); campaignLink.style.display = 'none'; nav.append(campaignLink);
nav.append(el('a', { href: '?mode=mobile#/m', id: 'nav-phone', title: 'the phone shell: one decision every few seconds' }, 'Phone mode'));
nav.append(el('span', { class: 'spacer' }), el('span', { class: 'muted', id: 'navnote', style: 'font-size:12px' }, ''));
const view = el('main', { id: 'view', tabindex: '-1' });
/** In the phone shell a Desk screen (Reference, Driver's card) gets a slim bar back to the phone Home instead of the Desk nav. */
const mobBack = el('a', { class: 'mob-back', href: '#/m' }, '‹ Home');
root.replaceChildren(nav, mobBack, view);

/** SCH-010: a brand-new visitor (no saved progress of any kind) landing on the bare page opens the School's Module 0, page 1. */
function brandNew(): boolean {
  try { return [PROGRESS_KEY, DECISION_PROGRESS_KEY, COURSE_POS_KEY].every(k => localStorage.getItem(k) === null); } catch { return false; }
}
let firstVisit = false;
if (!location.hash && brandNew()) { firstVisit = true; markFirstVisit(); history.replaceState(null, '', `${location.pathname}${location.search}#/school`); }

/** SCH-008: the Reference page gains a "Rules" entry (the rule-card grid that used to be the School). */
function addRulesLink(): void {
  const page = view.querySelector('.page'); if (!page || page.querySelector('#ref-rules-link')) return;
  const p = el('p', { id: 'ref-rules-link', class: 'ref-rules-link' }, el('a', { href: '#/reference/rules', class: 'btn' }, 'Rules'), ' the short rule cards, each with Try it. ', el('a', { href: '#/school' }, 'Rally School'), ' is the course.');
  const h1 = page.querySelector('h1'); if (h1) h1.after(p); else page.prepend(p);
}

let cleanup: (() => void) | null = null;
function route(): void {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const screen = parts[0] ?? '';
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  nav.querySelectorAll('a[data-nav]').forEach(a => a.classList.toggle('active', (a as HTMLAnchorElement).dataset.nav === `#/${screen}` || (screen === '' && (a as HTMLAnchorElement).dataset.nav === '#/')));
  document.body.classList.toggle('in-cockpit', screen === 'cockpit');
  // School "Try it" links (content/school-layout.ts tryHash): `#/run?skill=<skill>` starts a decision-mode run on that skill
  if (/^run(\?|$)/.test(screen)) { const skill = new URLSearchParams(screen.replace(/^run\??/, '')).get('skill'); location.replace(skill ? `#/m/play/skill/${encodeURIComponent(skill)}` : '#/m/play/practice'); return; }
  const mobileRoute = screen === 'm' || (shellMode === 'mobile' && screen === '');
  // the School player is full-screen in the phone shell (its own strip) and on a first visit (SCH-010: nothing else first)
  const schoolFull = screen === 'school' && parts[1] !== 'driver-card' && (shellMode === 'mobile' || firstVisit);
  document.body.classList.toggle('mob-route', mobileRoute || schoolFull);
  document.body.classList.toggle('s2-route', screen === 'school' && parts[1] !== 'driver-card');
  if (screen !== 'school') firstVisit = false;
  try {
    if (mobileRoute) { cleanup = renderMobile(view, screen === 'm' ? parts.slice(1) : []); return; }
    switch (screen) {
      case '': renderHome(view); break;
      case 'school': cleanup = renderSchool(view, parts.slice(1)); break;
      case 'lesson': renderLongLesson(view, parts[1]); break;
      case 'cockpit': { const src = parseSource(parts.slice(1)); if (!src) { renderHome(view); break; } cleanup = renderCockpit(view, src); view.focus(); break; }
      case 'debrief': renderDebrief(view); break;
      case 'book': renderBookPage(view, parts.slice(1)); break;
      case 'reference': if (parts[1] === 'rules') renderRules(view); else { renderReference(view, parts[1]); addRulesLink(); } break;
      case 'settings': renderSettings(view); break;
      case 'campaign': {
        // N9: the campaign follows the D13 lock (D12 needs Silver/Gold stars like every other unlock)
        const gate = campaignGate();
        if (!gate.open) { app.homeNote = gate.note; location.replace('#/'); break; }
        renderCampaign(view); break;
      }
      case 'quiz': cleanup = renderQuiz(view, 'quiz', parts[1] ?? 'D09'); break;
      case 'math': cleanup = renderQuiz(view, 'math', parts[1] ?? 'D14'); break;
      default: renderHome(view);
    }
  } catch (e) {
    view.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Something went wrong'), el('pre', { class: 'danger' }, String((e as Error).stack ?? e)), el('a', { href: '#/' }, 'Home')));
  }
  campaignLink.style.display = campaignGate().open ? '' : 'none';   // N9: only offered once D13 is unlocked
  const note = document.getElementById('navnote'); if (note) note.textContent = app.progress.persistent ? '' : 'progress is not being saved (storage blocked)';
}
window.addEventListener('hashchange', route);
route();
void registerServiceWorker();   // MOB-023: offline play after one visit
