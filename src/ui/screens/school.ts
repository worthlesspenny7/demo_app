/** School: short lessons with one check question each. Blocks (lists, call patterns, tables, the printable driver card) render from content/lessons.ts. */
import { LESSONS, lessonIntro, type LessonBlock } from '../../../content/lessons.js';
import { app, el } from '../state.js';

/** One lesson block as DOM: plain paragraph, list, preformatted lines, table or the printable card. */
export function renderBlock(b: LessonBlock): HTMLElement {
  if (typeof b === 'string') return el('p', {}, b);
  if ('heading' in b) return el('h3', { class: 'lesson-h' }, b.heading);
  if ('list' in b) { const l = el(b.ordered ? 'ol' : 'ul', { class: 'lesson-list' }); for (const t of b.list) l.append(el('li', {}, t)); return l; }
  if ('pre' in b) return el('figure', { class: 'lesson-pre' }, el('pre', {}, b.pre.join('\n')), b.caption ? el('figcaption', { class: 'cite' }, b.caption) : null);
  if ('table' in b) {
    const t = el('table', { class: 'lesson-table' }, el('thead', {}, el('tr', {}, ...b.table.head.map(h => el('th', {}, h)))));
    const tb = el('tbody', {}); for (const r of b.table.rows) tb.append(el('tr', {}, ...r.map((c, i) => el('td', { class: i === 0 ? 'mono' : '' }, c)))); t.append(tb);
    return el('figure', { class: 'lesson-fig' }, t, b.caption ? el('figcaption', { class: 'cite' }, b.caption) : null);
  }
  const ol = el('ol', {}); for (const t of b.card.lines) ol.append(el('li', {}, t));
  const print = el('button', { class: 'noprint' }, 'Print this card');
  print.onclick = () => { const root = document.documentElement; root.classList.add('print-card-only'); try { window.print(); } finally { root.classList.remove('print-card-only'); } };
  return el('div', { class: 'printcard' }, el('h3', {}, b.card.title), ol, print);
}

export function renderSchool(root: HTMLElement, lessonId?: string): void {
  const page = el('div', { class: 'page' });
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) {
    page.append(el('h1', {}, 'School'), el('p', { class: 'muted' }, `${LESSONS.length} readings, three to six minutes each, one check question at the end. Then go drive.`));
    const cards = el('div', { class: 'cards' });
    for (const l of LESSONS) {
      const done = app.progress.lessonDone(l.id);
      const b = el('button', { class: 'primary' }, done ? 'Read again' : 'Read'); b.onclick = () => { location.hash = `#/school/${l.id}`; };
      cards.append(el('div', { class: `card ${done ? 'done' : ''}`, 'data-lesson': l.id }, el('div', { class: 'title' }, l.title), el('div', { class: 'meta' }, `${l.minutes} min${done ? ' · passed' : ''}`), el('div', { class: 'muted' }, lessonIntro(l).slice(0, 140) + '…'), el('div', { class: 'actions' }, b)));
    }
    page.append(cards);
  } else {
    const idx = LESSONS.indexOf(lesson);
    const box = el('div', { class: 'lesson panel' }, el('h3', {}, `Lesson ${idx + 1} of ${LESSONS.length}`), el('h1', {}, lesson.title));
    const body = el('div', { class: 'body' }); for (const b of lesson.body) body.append(renderBlock(b)); box.append(body);
    box.append(el('p', { class: 'cite' }, `Source: ${lesson.source}`));
    const quiz = el('div', { class: 'quiz' }, el('h3', {}, 'Check'), el('p', {}, lesson.check.question));
    const fb = el('p', { class: 'muted' });
    lesson.check.options.forEach((o, i) => {
      const b = el('button', { class: 'opt' }, o);
      b.onclick = () => {
        quiz.querySelectorAll('.opt').forEach(x => x.classList.remove('right', 'wrong'));
        if (i === lesson.check.answer) { b.classList.add('right'); fb.textContent = `Right. ${lesson.check.explain}`; fb.className = 'ok'; app.progress.markLesson(lesson.id); }
        else { b.classList.add('wrong'); fb.textContent = `Not quite. ${lesson.check.explain}`; fb.className = 'danger'; }
      };
      quiz.append(b);
    });
    quiz.append(fb); box.append(quiz);
    const nav = el('div', { class: 'actions', style: 'display:flex;gap:8px;margin-top:12px' });
    const back = el('button', {}, 'All lessons'); back.onclick = () => { location.hash = '#/school'; }; nav.append(back);
    if (LESSONS[idx + 1]) { const n = el('button', { class: 'primary' }, `Next: ${LESSONS[idx + 1]!.title}`); n.onclick = () => { location.hash = `#/school/${LESSONS[idx + 1]!.id}`; }; nav.append(n); }
    else { const n = el('button', { class: 'primary' }, 'To the drills'); n.onclick = () => { location.hash = '#/'; }; nav.append(n); }
    box.append(nav); page.append(box);
  }
  root.replaceChildren(page);
}
