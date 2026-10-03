/** Entry: hash router and top navigation. */
import { app, applyTheme, el, parseSource } from './state.js';
import { renderHome } from './screens/home.js';
import { renderSchool } from './screens/school.js';
import { renderCockpit } from './screens/cockpit.js';
import { renderDebrief } from './screens/debrief.js';
import { renderReference } from './screens/reference.js';
import { renderSettings } from './screens/settings.js';
import { renderQuiz } from './screens/quiz.js';

const root = document.getElementById('app') ?? document.body.appendChild(el('div', { id: 'app', class: 'app' }));
applyTheme(app.settings);
const nav = el('nav', { class: 'nav' });
const links: [string, string][] = [['#/', 'Home'], ['#/school', 'School'], ['#/debrief', 'Debrief'], ['#/reference', 'Reference'], ['#/settings', 'Settings']];
nav.append(el('a', { class: 'brand', href: '#/' }, 'RALLY TRAINER'));
for (const [href, text] of links) nav.append(el('a', { href, 'data-nav': href }, text));
nav.append(el('span', { class: 'spacer' }), el('span', { class: 'muted', id: 'navnote', style: 'font-size:12px' }, ''));
const view = el('main', { id: 'view', tabindex: '-1' });
root.replaceChildren(nav, view);

let cleanup: (() => void) | null = null;
function route(): void {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const screen = parts[0] ?? '';
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  nav.querySelectorAll('a[data-nav]').forEach(a => a.classList.toggle('active', (a as HTMLAnchorElement).dataset.nav === `#/${screen}` || (screen === '' && (a as HTMLAnchorElement).dataset.nav === '#/')));
  document.body.classList.toggle('in-cockpit', screen === 'cockpit');
  try {
    switch (screen) {
      case '': renderHome(view); break;
      case 'school': renderSchool(view, parts[1]); break;
      case 'cockpit': { const src = parseSource(parts.slice(1)); if (!src) { renderHome(view); break; } cleanup = renderCockpit(view, src); view.focus(); break; }
      case 'debrief': renderDebrief(view); break;
      case 'reference': renderReference(view); break;
      case 'settings': renderSettings(view); break;
      case 'quiz': renderQuiz(view, 'quiz', parts[1] ?? 'D09'); break;
      case 'math': renderQuiz(view, 'math', parts[1] ?? 'D14'); break;
      default: renderHome(view);
    }
  } catch (e) {
    view.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Something went wrong'), el('pre', { class: 'danger' }, String((e as Error).stack ?? e)), el('a', { href: '#/' }, 'Home')));
  }
  const note = document.getElementById('navnote'); if (note) note.textContent = app.progress.persistent ? '' : 'progress is not being saved (storage blocked)';
}
window.addEventListener('hashchange', route);
route();
