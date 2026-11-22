/**
 * SCH-006 the page player at #/school (Rally School 2.0). One page at a time, never more than one screen: a top strip (Home, the module,
 * page n of N, Modules), the page, the reference chips (max 2, each opens the bottom sheet), the dot strip and Back / Next. Swipe left
 * or tap the right third of a reading page to advance; the module remembers its page. The module's last page is its try-it run
 * (SCH-007). At desk width the same pages sit in a centred column, two columns at most (figure beside the words, card beside the
 * actions). SCH-010: a brand-new visitor sees Module 0 page 1 with the first-visit line and a Start button.
 *
 * Routes: #/school (continue), #/school/modules, #/school/<module id>[/<page 1..N>], #/school/<module id>/try, #/school/<module id>/recap.
 */
import type { CheckPage, ConceptPage, ExamplePage, MinisimPage, Page, WidgetPage } from '../../../content/course-types.js';
import { el } from '../state.js';
import { COURSE_DATA, course, moduleById, moduleIndex, type Module } from './sources.js';
import { figureSvg } from './figures.js';
import { refChip, closeSheet } from './sheet.js';
import { mountWidget } from './widgets.js';
import { mountMiniSim, miniView, miniCardSeconds } from './minisim.js';
import { loadCourse, visitPage, finishPage, rememberedPage, continueTarget, isComplete, moduleNumber, coreComplete, deskUnlocked } from './progress.js';

/** The player's view of a module: its pages plus the closing try-it page. */
export type PlayerPage = Page | { kind: 'tryit'; refs: [] };
export const playerPages = (m: Module): PlayerPage[] => [...m.pages, { kind: 'tryit', refs: [] }];

/** SCH-006: the swipe that advances (left) or goes back (right): mostly horizontal, at least 50 px. */
export function swipeDir(dx: number, dy: number): -1 | 0 | 1 { if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return 0; return dx < 0 ? 1 : -1; }
/** Page index from a 1-based URL part, clamped. */
export function pageFromPart(part: string | undefined, of: number, fallback: number): number {
  const n = Number(part); return Number.isInteger(n) && n >= 1 ? Math.min(of - 1, n - 1) : Math.max(0, Math.min(of - 1, fallback));
}

export const playerState: { module: string | null; page: number; of: number; kind: string | null; complete: boolean; firstVisit: boolean } = { module: null, page: 0, of: 0, kind: null, complete: false, firstVisit: false };

let firstVisitPending = false;
/** main.ts: this load is a brand-new visitor (SCH-010); the next #/school render shows the first-visit line. */
export function markFirstVisit(): void { firstVisitPending = true; }

const plainText = (p: PlayerPage): boolean => p.kind === 'concept' || p.kind === 'example';

export function renderCourse(root: HTMLElement, parts: string[]): () => void {
  installHelpers();
  const [id, sub] = parts;
  if (id === 'modules') { renderModules(root); return () => undefined; }
  let m: Module | undefined = id ? moduleById(id) : undefined;
  if (!m) {
    const v = loadCourse(); const t = continueTarget(v);
    const last = v.pos.last ? moduleById(v.pos.last) : undefined;
    m = last && !isComplete(v.state, last.id) ? last : t?.module ?? course()[0]!;
  }
  const pages = playerPages(m);
  const v = loadCourse();
  let i = pageFromPart(sub, pages.length, rememberedPage(v, m.id));
  const first = firstVisitPending && moduleIndex(m.id) === 0; firstVisitPending = false;
  if (first) i = 0;
  playerState.firstVisit = first;
  return mountPlayer(root, m, pages, i, first);
}

function mountPlayer(root: HTMLElement, m: Module, pages: PlayerPage[], start: number, firstVisit: boolean): () => void {
  const mi = moduleIndex(m.id); const num = moduleNumber(m, mi);
  const count = el('span', { class: 's2-count', 'data-testid': 'page-count' });
  const strip = el('header', { class: 's2-strip' },
    el('a', { class: 'mob-quit', href: '#/m', 'aria-label': 'Home', 'data-testid': 's2-home' }, '×'),
    el('span', { class: 's2-title', 'data-testid': 'module-title' }, `${num}. ${m.title}`), count,
    el('a', { class: 's2-modlink', href: '#/school/modules', 'data-testid': 'modules-link' }, 'Modules'));
  const body = el('section', { class: 's2-page', 'data-testid': 'page' });
  const chips = el('div', { class: 's2-chips', 'data-testid': 'chips' });
  const dots = el('div', { class: 's2-dots', role: 'tablist', 'aria-label': 'pages' });
  const back = el('button', { class: 'mob-btn s2-back', type: 'button', 'data-action': 'back' }, 'Back') as HTMLButtonElement;
  const next = el('button', { class: 'mob-btn primary s2-next', type: 'button', 'data-action': 'next' }, 'Next') as HTMLButtonElement;
  const foot = el('footer', { class: 's2-foot' }, dots, el('div', { class: 's2-navbtns' }, back, next));
  const rotate = el('div', { class: 's2-rotate', 'data-testid': 'rotate', role: 'note' }, 'Turn your phone upright: the School is made for portrait.');
  const shell = el('div', { class: `s2${firstVisit ? ' s2-first' : ''}`, 'data-screen': 'school', 'data-module': m.id }, strip, rotate, el('div', { class: 's2-main' }, body, chips), foot);
  root.replaceChildren(shell);
  let i = start; let cleanup: (() => void) | null = null; const doneHere = new Set<number>(loadCourse().state.pages[m.id] ? Array.from({ length: loadCourse().state.pages[m.id]! }, (_, k) => k) : []);

  const go = (to: number): void => {
    if (to < 0 || to >= pages.length || to === i) return;
    if (to > i && plainText(pages[i]!)) { finishPage(m.id, i); doneHere.add(i); }
    i = to; history.replaceState(null, '', `#/school/${m.id}/${i + 1}`); show();
  };
  back.onclick = () => go(i - 1);
  next.onclick = () => { if (pages[i]!.kind === 'tryit') { location.hash = `#/school/${m.id}/try`; return; } go(i + 1); };
  // swipe and tap-right
  let sx = 0, sy = 0, touching = false;
  body.addEventListener('touchstart', e => { const t = e.changedTouches[0]; const tgt = e.target as HTMLElement; touching = !!t && !tgt.closest('input,button,.mw-face,.s2-road'); if (t) { sx = t.clientX; sy = t.clientY; } }, { passive: true });
  body.addEventListener('touchend', e => { const t = e.changedTouches[0]; if (!t || !touching) return; const d = swipeDir(t.clientX - sx, t.clientY - sy); if (d) go(i + d); }, { passive: true });
  body.addEventListener('click', e => {
    const tgt = e.target as HTMLElement; if (tgt.closest('button,a,input,details,.s2-widget,.s2-minisim')) return;
    const r = body.getBoundingClientRect(); if (plainText(pages[i]!) && e.clientX > r.left + r.width * 2 / 3) go(i + 1);
  });
  const onKey = (e: KeyboardEvent): void => { if (!shell.isConnected) { document.removeEventListener('keydown', onKey); return; } if ((e.target as HTMLElement)?.closest?.('input')) return; if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); };
  document.addEventListener('keydown', onKey);

  function complete(): void {
    playerState.complete = true; doneHere.add(i); finishPage(m.id, i);
    shell.querySelector(`.s2-dot[data-page="${i}"]`)?.classList.add('done');
    next.classList.add('s2-pulse');
  }

  function show(): void {
    if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
    closeSheet();
    const p = pages[i]!;
    visitPage(m.id, i);
    playerState.module = m.id; playerState.page = i; playerState.of = pages.length; playerState.kind = p.kind; playerState.complete = plainText(p) || doneHere.has(i);
    count.textContent = `${i + 1}/${pages.length}`; count.setAttribute('aria-label', `Page ${i + 1} of ${pages.length}`);
    body.replaceChildren(); body.dataset['kind'] = p.kind; body.dataset['page'] = String(i + 1);
    shell.dataset['kind'] = p.kind;
    next.classList.remove('s2-pulse');
    if (firstVisit && i === 0) body.append(el('p', { class: 's2-firstline', 'data-testid': 'first-visit' }, COURSE_DATA.firstVisit));
    cleanup = renderPage(body, m, p, complete);
    chips.replaceChildren(...(p.refs ?? []).slice(0, 2).map(refChip));
    dots.replaceChildren(...pages.map((pp, k) => {
      const d = el('button', { class: `s2-dot${k === i ? ' on' : ''}${doneHere.has(k) || isComplete(loadCourse().state, m.id) ? ' done' : ''}${pp.kind === 'tryit' ? ' try' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(k === i), 'aria-label': `page ${k + 1}`, 'data-page': k });
      d.onclick = () => go(k); return d;
    }));
    back.disabled = i === 0; back.style.visibility = i === 0 ? 'hidden' : '';
    next.textContent = firstVisit && i === 0 ? 'Start' : p.kind === 'tryit' ? 'Start the run' : i === pages.length - 2 ? 'Try it' : 'Next';
    next.dataset['action'] = p.kind === 'tryit' ? 'start-tryit' : 'next';
    if (firstVisit && i === 0) next.dataset['testid'] = 'start'; else delete next.dataset['testid'];
  }
  show();
  return () => { if (cleanup) cleanup(); document.removeEventListener('keydown', onKey); closeSheet(); };
}

/** One page's content (no navigation). Returns a cleanup. */
export function renderPage(body: HTMLElement, m: Module, p: PlayerPage, complete: () => void): (() => void) | null {
  switch (p.kind) {
    case 'concept': return concept(body, p), null;
    case 'example': return example(body, p), null;
    case 'check': return check(body, p, complete), null;
    case 'minisim': return mountMiniSim(body, p as MinisimPage, { done: complete, moduleIndex: moduleIndex(m.id) });
    case 'widget': return mountWidget(body, p as WidgetPage, { done: complete });
    case 'tryit': return tryitPage(body, m), null;
    default: body.append(el('p', {}, 'This page kind is not in the player yet.')); return null;
  }
}

function concept(body: HTMLElement, p: ConceptPage): void {
  const fig = figureSvg(p.figure);
  const text = el('div', { class: 's2-text' }, el('h1', { class: 's2-h' }, p.title), el('p', { class: 's2-words' }, p.words));
  const wrap = el('div', { class: `s2-concept${fig ? ' has-fig' : ''}` }, text);
  if (fig) { const f = el('div', { class: 's2-figwrap' }); f.innerHTML = fig; wrap.append(f); }
  body.append(wrap);
}
function example(body: HTMLElement, p: ExamplePage): void {
  const ol = el('ol', { class: 's2-lines' }); for (const l of p.lines) ol.append(el('li', {}, l));
  body.append(el('div', { class: 's2-example' }, el('h1', { class: 's2-h' }, p.title), ol));
}
function check(body: HTMLElement, p: CheckPage, complete: () => void): void {
  const fb = el('p', { class: 's2-result', 'data-testid': 'check-result' });
  const opts = el('div', { class: 's2-checkopts' });
  const rule = (p as CheckPage & { rule?: string; explain?: string; why?: string }).rule ?? (p as { explain?: string }).explain ?? (p as { why?: string }).why;
  p.options.forEach((o, k) => {
    const b = el('button', { class: 'mob-btn opt', type: 'button', 'data-option': k, 'data-right': String(k === p.answer) }, o);
    b.onclick = () => {
      opts.querySelectorAll('button').forEach(x => x.classList.remove('s2-right', 's2-wrong'));
      const ok = k === p.answer; b.classList.add(ok ? 's2-right' : 's2-wrong');
      fb.className = `s2-result ${ok ? 'ok' : 'danger'}`;
      fb.textContent = `${ok ? 'Correct.' : `Not quite: ${p.options[p.answer]}.`}${rule ? ` ${rule}` : ''}`;
      if (ok) complete();
    };
    opts.append(b);
  });
  body.append(el('div', { class: 's2-check' }, el('h1', { class: 's2-h s2-q' }, p.question), opts, fb));
}
function tryitPage(body: HTMLElement, m: Module): void {
  const stars = loadCourse().state.tryItStars[m.id];
  body.append(el('div', { class: 's2-tryit' }, el('h1', { class: 's2-h' }, 'Try it: 5 cards'),
    el('p', { class: 's2-words' }, 'A one-minute run using only what this module taught. Answer each card; the recap gives you stars.'),
    stars !== undefined ? el('p', { class: 's2-stars-line' }, `Best so far: ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`) : el('span', {})));
}

/** The module list (#/school/modules): progress per module, the course state. */
export function renderModules(root: HTMLElement): void {
  const v = loadCourse(); const mods = course();
  const list = el('ol', { class: 's2-modlist', 'data-testid': 'module-list' });
  mods.forEach((m, k) => {
    const done = isComplete(v.state, m.id); const reached = v.state.pages[m.id] ?? 0; const stars = v.state.tryItStars[m.id];
    list.append(el('li', { class: `s2-mod${done ? ' done' : ''}`, 'data-module': m.id },
      el('a', { href: `#/school/${m.id}`, class: 's2-modbtn' }, el('b', {}, `${moduleNumber(m, k)}. ${m.title}`),
        el('span', { class: 's2-modmeta' }, done ? `Done ${stars !== undefined ? '★'.repeat(stars) : ''}` : reached ? `Page ${Math.min(reached + 1, m.pages.length + 1)} of ${m.pages.length + 1}` : `${m.pages.length + 1} pages`))));
  });
  const note = coreComplete(v.state, mods) ? (deskUnlocked(v.state, mods) ? 'Course complete. Desk mode is open.' : 'Core done: every run is open.') : 'Modules 0 to 6 are the core.';
  root.replaceChildren(el('div', { class: 's2 s2-modules', 'data-screen': 'school-modules' },
    el('header', { class: 's2-strip' }, el('a', { class: 'mob-quit', href: '#/m', 'aria-label': 'Home' }, '×'), el('span', { class: 's2-title' }, 'Rally School'), el('a', { class: 's2-modlink', href: '#/reference/rules' }, 'Rules')),
    el('div', { class: 's2-main s2-scroll' }, el('p', { class: 'muted' }, note), list,
      el('p', { class: 's2-more' }, el('a', { href: '#/reference/rules' }, 'Rules'), ' · ', el('a', { href: '#/reference' }, 'Reference (long form)'), ' · ', el('a', { href: '#/school/driver-card' }, "Driver's card")))));
}

function installHelpers(): void {
  const w = window as unknown as { __rally?: Record<string, unknown> };
  if (w.__rally && (w.__rally as { school?: unknown }).school) return;
  const school = {
    state: () => ({ ...playerState }),
    course: () => course().map(m => ({ id: m.id, pages: m.pages.length + 1, kinds: playerPages(m).map(p => p.kind) })),
    mini: () => ({ kind: miniView.decision?.kind ?? null, timing: miniView.decision?.timing ?? null, options: miniView.decision?.options?.map(o => o.id) ?? [], attempt: miniView.attempt, started: miniView.started, round: miniView.round, rounds: miniView.rounds, complete: miniView.complete, elapsed: miniView.decision ? miniCardSeconds() : 0 }),
    oracle: () => (miniView.handle && miniView.decision ? miniView.handle.oracle(miniView.decision) : null),
    source: () => COURSE_DATA.source,
  };
  w.__rally = Object.assign(w.__rally ?? {}, { school });
}
