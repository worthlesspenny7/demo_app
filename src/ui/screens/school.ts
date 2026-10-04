/** School: short lessons with one check question each. Blocks (lists, call patterns, tables, the printable driver card) render from content/lessons.ts. */
import { LESSONS, lessonIntro, type LessonBlock } from '../../../content/lessons.js';
import { app, el } from '../state.js';
import { allDrills } from '../../core/drills/index.js';
import { shuffleCheck } from '../viewmodels/lessoncheck.js';
import { startPathFromProgress, pathNext, unlockBest, pathStars, START_PATH, type PathNext } from '../viewmodels/curriculum.js';

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
  const print = el('button', { class: 'noprint', id: 'print-card' }, 'Print this card');
  const card = el('div', { class: 'printcard' }, el('h3', {}, b.card.title), ol, print);
  print.onclick = () => { const undo = mountPrintCard(card); window.addEventListener('afterprint', undo, { once: true }); window.print(); };
  return card;
}

/**
 * PLAY-031: printing the driver's card prints only the card, on one page: a copy of it is mounted as the only visible child of <body>
 * (everything else is display:none in print, so no blank pages follow), in black on white. Undone after printing (afterprint) or on navigation.
 */
export function mountPrintCard(card: HTMLElement): () => void {
  document.getElementById('print-root')?.remove();
  const root = el('div', { id: 'print-root' }); const copy = card.cloneNode(true) as HTMLElement; copy.querySelectorAll('.noprint').forEach(n => n.remove()); root.append(copy);
  document.body.append(root); document.documentElement.classList.add('print-card-only');
  let done = false; const undo = (): void => { if (done) return; done = true; root.remove(); document.documentElement.classList.remove('print-card-only'); window.removeEventListener('hashchange', undo); };
  window.addEventListener('hashchange', undo, { once: true });
  return undo;
}

export function renderSchool(root: HTMLElement, lessonId?: string): void {
  const page = el('div', { class: 'page' });
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) {
    page.append(el('h1', {}, 'School'), el('p', { class: 'muted' }, `${LESSONS.length} readings, ${Math.min(...LESSONS.map(l => l.minutes))} to ${Math.max(...LESSONS.map(l => l.minutes))} minutes each (${LESSONS.reduce((a, l) => a + l.minutes, 0)} minutes in all; every card shows its own), one check question at the end. Then go drive.`));
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
    // PT-10: a long lesson is read as two pages (page 2 holds the source, the check and the Next buttons)
    const split = lesson.splitAt !== undefined && lesson.splitAt > 0 && lesson.splitAt < lesson.body.length ? lesson.splitAt : null;
    const body = el('div', { class: 'body', id: 'lesson-page-1' }); for (const b of lesson.body.slice(0, split ?? lesson.body.length)) body.append(renderBlock(b)); box.append(body);
    const rest = el('div', { class: 'lesson-rest' });
    if (split !== null) {
      const body2 = el('div', { class: 'body', id: 'lesson-page-2' }); for (const b of lesson.body.slice(split)) body2.append(renderBlock(b)); body2.style.display = 'none';
      const pageNote = el('p', { class: 'muted', id: 'lesson-pageno' }, 'Page 1 of 2');
      const nextPage = el('button', { class: 'primary', id: 'lesson-next-page' }, 'Next page'); const prevPage = el('button', { id: 'lesson-prev-page' }, 'Previous page'); prevPage.style.display = 'none';
      const show = (n: 1 | 2): void => { body.style.display = n === 1 ? '' : 'none'; body2.style.display = n === 2 ? '' : 'none'; rest.style.display = n === 2 ? '' : 'none'; nextPage.style.display = n === 1 ? '' : 'none'; prevPage.style.display = n === 2 ? '' : 'none'; pageNote.textContent = `Page ${n} of 2`; window.scrollTo(0, 0); };
      nextPage.onclick = () => show(2); prevPage.onclick = () => show(1);
      box.append(body2, el('div', { class: 'actions', style: 'display:flex;gap:8px;align-items:center;margin:10px 0' }, prevPage, nextPage, pageNote)); rest.style.display = 'none';
    }
    box.append(rest);
    rest.append(el('p', { class: 'cite' }, `Source: ${lesson.source}`));
    // EDU-005: the drills that read this lesson first, one click away
    try {
      const ds = allDrills().filter(d => (d.readFirst ?? []).includes(lesson.id) || (d.lessonGate ?? []).includes(lesson.id));
      if (ds.length) { const p = el('p', { class: 'muted', id: 'lesson-drills' }, 'Practise it: '); ds.forEach((d, i) => p.append(...(i ? [', '] : []), el('a', { href: d.kind === 'drive' ? `#/cockpit/drill/${d.id}/0/1` : `#/${d.kind}/${d.id}`, 'data-drill-link': d.id }, `${d.id} ${d.title}`), ...((d.lessonGate ?? []).includes(lesson.id) ? [' (this lesson unlocks it)'] : []))); rest.append(p); }
    } catch { /* registry unavailable */ }
    const quiz = el('div', { class: 'quiz' }, el('h3', {}, 'Check'), el('p', {}, lesson.check.question));
    const fb = el('p', { class: 'muted' });
    const sh = shuffleCheck(lesson.check, Math.floor(Math.random() * 1e9));   // PT-10 N-C4: a fresh order each time the lesson is drawn; the answer follows the right option
    sh.options.forEach((o, i) => {
      const b = el('button', { class: 'opt' }, o);
      b.onclick = () => {
        quiz.querySelectorAll('.opt').forEach(x => x.classList.remove('right', 'wrong'));
        if (i === sh.answer) { b.classList.add('right'); fb.textContent = `Right. ${lesson.check.explain}`; fb.className = 'ok'; app.progress.markLesson(lesson.id); }
        else { b.classList.add('wrong'); fb.textContent = `Not quite. ${lesson.check.explain}`; fb.className = 'danger'; }
      };
      quiz.append(b);
    });
    quiz.append(fb); rest.append(quiz);
    const nav = el('div', { class: 'actions', style: 'display:flex;gap:8px;margin-top:12px' });
    const back = el('button', {}, 'All lessons'); back.onclick = () => { location.hash = '#/school'; }; nav.append(back);
    // PLAY-001 / PLAY-023: a lesson on the Start-here path leads to the path's next step (the next lesson when one is due, else the drill); the next lesson in the School stays one click away
    let onPath: PathNext | null = null;
    if (START_PATH.some(s => s.kind === 'lesson' && s.id === lesson.id)) {
      try { const ds = allDrills(); const prog = app.progress.load(); const done = (id: string): boolean => id === lesson.id || app.progress.lessonDone(id); onPath = pathNext(startPathFromProgress(ds, prog, done), ds, unlockBest(ds, prog), done, id => LESSONS.find(l => l.id === id)?.title ?? id, pathStars(prog)); } catch { onPath = null; }
    }
    if (onPath && onPath.kind !== 'blocked') { const p = el('button', { class: 'primary', id: 'next-path' }, `Next on your path: ${onPath.label}`); const h = onPath.hash; p.onclick = () => { location.hash = h; }; nav.append(p); }
    if (LESSONS[idx + 1]) { const n = el('button', { class: onPath ? '' : 'primary', id: 'next-lesson' }, `Next lesson: ${LESSONS[idx + 1]!.title}`); n.onclick = () => { location.hash = `#/school/${LESSONS[idx + 1]!.id}`; }; nav.append(n); }
    else { const n = el('button', { class: 'primary' }, 'To the drills'); n.onclick = () => { location.hash = '#/'; }; nav.append(n); }
    rest.append(nav); page.append(box);
  }
  root.replaceChildren(page);
}
