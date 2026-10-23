/**
 * School (Phase VIII, MOB-010): a grid of rule cards grouped by the Four S's (content/rules.ts), each with a "Try it" button, and the lessons' check
 * questions as one-tap cards. The long lessons moved to the Reference page under "Long form"; `#/school/<lesson id>` still opens one (saved progress and
 * links keep working). `#/school/dad` is Dad's card with its "Dad reads this" mode (MOB-011). The page layout is the pure model in content/school-layout.ts.
 * Blocks (lists, call patterns, tables, the printable driver card) render from content/lessons.ts.
 */
import { LESSONS, type LessonBlock } from '../../../content/lessons.js';
import { CARD_PARTS, cardPartText, checkCards, dadCard, dadPages, dadStep, dadSwipe, schoolGroups, schoolIntro, SCHOOL_TITLE, tryHash, DAD_TITLE, type CheckCard } from '../../../content/school-layout.js';
import { type RuleCard } from '../../../content/rules.js';
import { app, el } from '../state.js';
import { narrowScreen } from './reference.js';
import { allDrills } from '../../core/drills/index.js';
import { shuffleCheck } from '../viewmodels/lessoncheck.js';
import { startPathFromProgress, pathNext, beyondPathNext, unlockBest, pathStars, type PathNext } from '../viewmodels/curriculum.js';

/** One lesson block as DOM: plain paragraph, list, preformatted lines, table or the printable card. */
export function renderBlock(b: LessonBlock): HTMLElement {
  if (typeof b === 'string') return el('p', {}, b);
  if ('ref' in b) return el('p', { class: 'lesson-ref', 'data-ref': b.ref.id }, 'On the Reference page: ', el('a', { href: `#/reference/${b.ref.id}` }, b.ref.title));   // PLAY-048
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

/** Small scoped styles for the rule grid and the reader (the shared stylesheet is not touched). Buttons are 56 px tall for one-thumb use (MOBILE.md). */
const SCHOOL_CSS = `
.school-groups h2 { margin: 18px 0 2px; } .school-groups .group-note { margin: 0 0 8px; }
.rule-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.rule-card { display: flex; flex-direction: column; gap: 6px; padding: 12px; } .rule-card .rule-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.rule-card h3 { margin: 0; font-size: 17px; } .rule-card button.try-it { white-space: nowrap; } .rule-card .rule-text { margin: 0; font-size: 16px; line-height: 1.4; } .rule-card .cite { margin: 0; font-size: 13px; }
.rule-card button.try-it, .check-card button.opt, .dad-reader button { min-height: 56px; min-width: 56px; font-size: 17px; }
.check-card { padding: 12px; } .check-card .opt { display: block; width: 100%; margin: 6px 0; text-align: left; }
.dad-reader { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background: var(--bg); color: var(--text); padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom)); touch-action: pan-y; }
.dad-reader .dad-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 18px; }
.dad-reader .dad-text { flex: 1; display: flex; align-items: center; font-size: clamp(28px, 7.5vw, 52px); line-height: 1.22; font-weight: 700; overflow-y: auto; }
.dad-reader .dad-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; } .dad-reader .dad-nav button { min-height: 72px; font-size: 22px; }
/* PT-14 item 10 (BUG-10): on a phone the grid is a list, every text at least 16 px, each group a collapsible section */
@media (max-width: 700px) {
  .rule-grid { display: flex; flex-direction: column; gap: 10px; }
  .school-page, .school-page :is(p, li, a, span, div, summary, .cite, .muted, .meta, button) { font-size: max(16px, 1em); }
  .school-page .rule-card .cite, .school-page .group-note, .school-page .meta { font-size: 16px; }
  .school-page :is(h3, h4) { font-size: max(17px, 1em); }
  .school-sec > summary { display: flex; align-items: center; min-height: 52px; cursor: pointer; list-style: none; }
  .school-sec > summary::-webkit-details-marker { display: none; }
  .school-sec > summary h2 { margin: 0; font-size: 22px; } .school-sec > summary::after { content: '+'; margin-left: auto; font-size: 24px; color: var(--muted); }
  .school-sec[open] > summary::after { content: '−'; }
}
`;

/** One rule card, its parts in the order of CARD_PARTS (the "Try it" button sits in the header row, so little is read before the first tap). */
function ruleCardEl(c: RuleCard): HTMLElement {
  const card = el('div', { class: 'card rule-card', 'data-rule': c.id, 'data-skill': c.skill });
  const head = el('div', { class: 'rule-head' }); card.append(head);
  for (const part of CARD_PARTS) {
    const text = cardPartText(c, part);
    if (part === 'title') head.append(el('h3', { class: 'title' }, text));
    else if (part === 'try') { const b = el('button', { class: 'primary try-it', 'data-skill': c.skill }, text); b.onclick = () => { location.hash = tryHash(c.skill); }; head.append(b); }
    else if (part === 'text') card.append(el('p', { class: 'rule-text' }, text));
    else if (part === 'source') card.append(el('p', { class: 'cite' }, text));
    else if (part === 'long' && c.lesson) card.append(el('a', { href: `#/school/${c.lesson}`, class: 'rule-long', 'data-lesson-link': c.lesson }, text));
  }
  return card;
}

/** A lesson's check question as a one-tap card: one tap on an option answers; a right answer marks the lesson passed, as the lesson page does. */
function checkCardEl(c: CheckCard): HTMLElement {
  const done = app.progress.lessonDone(c.lessonId);
  const box = el('div', { class: `card check-card ${done ? 'done' : ''}`, 'data-check': c.lessonId }, el('div', { class: 'meta' }, `${c.title}${done ? ' · passed' : ''}`), el('p', {}, c.question));
  const fb = el('p', { class: 'muted' });
  const sh = shuffleCheck({ options: c.options, answer: c.answer }, Math.floor(Math.random() * 1e9));
  sh.options.forEach((o, i) => {
    const b = el('button', { class: 'opt' }, o);
    b.onclick = () => {
      box.querySelectorAll('.opt').forEach(x => x.classList.remove('right', 'wrong'));
      if (i === sh.answer) { b.classList.add('right'); fb.textContent = `Right. ${c.explain}`; fb.className = 'ok'; app.progress.markLesson(c.lessonId); }
      else { b.classList.add('wrong'); fb.textContent = `Not quite. ${c.explain}`; fb.className = 'danger'; }
    };
    box.append(b);
  });
  box.append(fb);
  return box;
}

function renderRuleIndex(page: HTMLElement): void {
  page.append(el('style', {}, SCHOOL_CSS), el('h1', {}, SCHOOL_TITLE), el('p', { class: 'muted', id: 'school-intro' }, schoolIntro()));
  const groups = el('div', { class: 'school-groups' });
  // PT-14 item 10: on a phone each skill group is a collapsible section (the first one open), its cards one list
  const phone = narrowScreen(); page.classList.add('school-page');
  const section = (title: HTMLElement, open: boolean, ...body: HTMLElement[]): HTMLElement[] => {
    if (!phone) return [title, ...body];
    const d = el('details', { class: 'school-sec' }) as HTMLDetailsElement; d.open = open; d.append(el('summary', {}, title), ...body); return [d];
  };
  schoolGroups().forEach((g, i) => {
    const grid = el('div', { class: 'rule-grid' }); for (const c of g.cards) grid.append(ruleCardEl(c));
    groups.append(...section(el('h2', { 'data-skill': g.skill }, g.title), i === 0, el('p', { class: 'muted group-note' }, g.fourS), grid));
  });
  page.append(groups);
  const dad = el('p', {}, el('a', { href: '#/school/dad', id: 'dad-link' }, `${DAD_TITLE}: print it, or read it while you drive`));
  const grid = el('div', { class: 'rule-grid' }); for (const c of checkCards()) grid.append(checkCardEl(c));
  const checks = el('div', { class: 'school-checks' }, ...section(el('h2', {}, 'Check yourself'), false, el('p', { class: 'muted' }, 'One tap per question. A right answer marks the reading passed.'), grid));
  page.append(dad, checks);
}

/** MOB-011: Dad's card page: the printable card (printing is unchanged) and "Dad reads this", one rule per screen in large type, swipe or arrow to the next. */
function renderDad(page: HTMLElement): void {
  const card = dadCard(); const pages = dadPages();
  const read = el('button', { class: 'primary', id: 'dad-read', style: 'min-height:56px;font-size:18px' }, 'Dad reads this');
  const back = el('button', { id: 'dad-back', style: 'min-height:48px' }, 'All rules'); back.onclick = () => { location.hash = '#/school'; };
  page.append(el('style', {}, SCHOOL_CSS), el('h1', {}, DAD_TITLE), el('p', { class: 'muted' }, `${pages.length} rules for the driver. Print the card for the car, or tap Dad reads this to see one rule per screen.`),
    el('div', { class: 'actions', style: 'display:flex;gap:8px;margin:8px 0' }, read, back), el('div', { class: 'lesson' }, renderBlock({ card })));
  read.onclick = () => openDadReader(page, pages.map(p => p.text));
}

function openDadReader(host: HTMLElement, lines: string[]): void {
  document.getElementById('dad-reader')?.remove();
  let i = 0;
  const count = el('span', { id: 'dad-count' }); const text = el('div', { class: 'dad-text', id: 'dad-text', 'aria-live': 'polite' });
  const close = el('button', { id: 'dad-close' }, 'Close'); const prev = el('button', { id: 'dad-prev' }, 'Back'); const next = el('button', { class: 'primary', id: 'dad-next' }, 'Next');
  const reader = el('div', { class: 'dad-reader', id: 'dad-reader', role: 'dialog', 'aria-label': "Dad reads this", tabindex: -1 }, el('div', { class: 'dad-bar' }, count, close), text, el('div', { class: 'dad-nav' }, prev, next));
  const show = (): void => { text.textContent = lines[i] ?? ''; count.textContent = `Rule ${i + 1} of ${lines.length}`; (prev as HTMLButtonElement).disabled = i === 0; (next as HTMLButtonElement).disabled = i === lines.length - 1; reader.dataset['page'] = String(i + 1); };
  const go = (d: -1 | 1): void => { i = dadStep(i, d, lines.length); show(); };
  const onKey = (e: KeyboardEvent): void => {
    if (!reader.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Escape') shut();
  };
  const shut = (): void => { reader.remove(); document.removeEventListener('keydown', onKey); window.removeEventListener('hashchange', shut); };
  let sx = 0, sy = 0;
  reader.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (t) { sx = t.clientX; sy = t.clientY; } }, { passive: true });
  reader.addEventListener('touchend', e => { const t = e.changedTouches[0]; if (!t) return; const d = dadSwipe(t.clientX - sx, t.clientY - sy); if (d) go(d); }, { passive: true });
  prev.onclick = () => go(-1); next.onclick = () => go(1); close.onclick = shut;
  document.addEventListener('keydown', onKey); window.addEventListener('hashchange', shut, { once: true });
  show(); host.append(reader); try { reader.focus(); } catch { /* jsdom */ }
}

export function renderSchool(root: HTMLElement, lessonId?: string): void {
  const page = el('div', { class: 'page' });
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (lessonId === 'dad') {
    renderDad(page);
  } else if (!lesson) {
    renderRuleIndex(page);
  } else {
    const idx = LESSONS.indexOf(lesson);
    const box = el('div', { class: 'lesson panel' }, el('h3', {}, `Lesson ${idx + 1} of ${LESSONS.length}`), el('h1', {}, lesson.title), el('p', { class: 'muted', id: 'lesson-longform' }, 'This reading is also on the Reference page, under ', el('a', { href: `#/reference/long-${lesson.id}` }, 'Long form'), '.'));
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
    {   // PT-11 N-D9: every lesson (a "Read first" lesson the path sent you to included) offers the path's next step
      try { const ds = allDrills(); const prog = app.progress.load(); const done = (id: string): boolean => id === lesson.id || app.progress.lessonDone(id); const title = (id: string): string => LESSONS.find(l => l.id === id)?.title ?? id; onPath = pathNext(startPathFromProgress(ds, prog, done), ds, unlockBest(ds, prog), done, title, pathStars(prog)) ?? beyondPathNext(ds, unlockBest(ds, prog), done, title, pathStars(prog)); if (onPath && onPath.kind === 'step' && onPath.step.kind === 'lesson' && onPath.step.id === lesson.id) onPath = null; } catch { onPath = null; }
    }
    if (onPath && onPath.kind !== 'blocked') { const p = el('button', { class: 'primary', id: 'next-path' }, `Next on your path: ${onPath.label}`); const h = onPath.hash; p.onclick = () => { location.hash = h; }; nav.append(p); }
    if (LESSONS[idx + 1]) { const n = el('button', { class: onPath ? '' : 'primary', id: 'next-lesson' }, `Next lesson: ${LESSONS[idx + 1]!.title}`); n.onclick = () => { location.hash = `#/school/${LESSONS[idx + 1]!.id}`; }; nav.append(n); }
    else { const n = el('button', { class: 'primary' }, 'To the drills'); n.onclick = () => { location.hash = '#/'; }; nav.append(n); }
    rest.append(nav); page.append(box);
  }
  root.replaceChildren(page);
}
