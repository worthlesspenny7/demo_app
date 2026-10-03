/** School: six short lessons with one check question each. */
import { LESSONS } from '../../../content/lessons.js';
import { app, el } from '../state.js';

export function renderSchool(root: HTMLElement, lessonId?: string): void {
  const page = el('div', { class: 'page' });
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) {
    page.append(el('h1', {}, 'School'), el('p', { class: 'muted' }, `${LESSONS.length} readings, three or four minutes each, one check question at the end. Then go drive.`));
    const cards = el('div', { class: 'cards' });
    for (const l of LESSONS) {
      const done = app.progress.lessonDone(l.id);
      const b = el('button', { class: 'primary' }, done ? 'Read again' : 'Read'); b.onclick = () => { location.hash = `#/school/${l.id}`; };
      cards.append(el('div', { class: `card ${done ? 'done' : ''}`, 'data-lesson': l.id }, el('div', { class: 'title' }, l.title), el('div', { class: 'meta' }, `${l.minutes} min${done ? ' · passed' : ''}`), el('div', { class: 'muted' }, l.body[0]!.slice(0, 140) + '…'), el('div', { class: 'actions' }, b)));
    }
    page.append(cards);
  } else {
    const idx = LESSONS.indexOf(lesson);
    const box = el('div', { class: 'lesson panel' }, el('h3', {}, `Lesson ${idx + 1} of ${LESSONS.length}`), el('h1', {}, lesson.title));
    const body = el('div', { class: 'body' }); for (const p of lesson.body) body.append(el('p', {}, p)); box.append(body);
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
