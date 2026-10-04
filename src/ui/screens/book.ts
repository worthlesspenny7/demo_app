/**
 * Printable full-page book (UI-029, GRIID-014): `#/book/<runId>`. Pages are laid out by content (row heights from the rows, 5 to 10 rows a page; 6, 7 or 8 fixed on request,
 * a hand-laid-out drill book keeps its own), no page header, and the real sheet's three-block footer: "(c) year, Great Race" | "Hemmings Motor News Great Race / Page n of N" | "stage / date".
 */
import type { Scenario } from '../../core/course.js';
import { bookPages, rowCameo, stageDisplayName, PAGE_ROW_CHOICES } from '../viewmodels/book.js';
import { griidRowHtml, sheetFootHtml, esc } from '../render/griid.js';
import { placeRowMarks } from '../render/handmarks.js';
import { createAnnotations, type Annotations } from '../viewmodels/annotations.js';
import { LIVE_KEY, LAST_KEY, loadStored, type StoredSource } from '../viewmodels/resume.js';
import { app, buildScenario, parseSource, el, restoreLastRun, type RunSource } from '../state.js';
import { allDrills } from '../../core/drills/index.js';

/** runId: `current` (the live run), `last` (the last finished run), or a source path `drill/D18/0/1` / `builtin/stage/1`. */
const sameRun = (a: StoredSource, b: RunSource): boolean => a.kind === b.kind && a.seed === b.seed && (a.kind === 'drill' ? b.kind === 'drill' && a.drillId === b.drillId && a.tier === b.tier : b.kind === 'builtin' && a.name === b.name);
/** The hand marks of the run this book belongs to: the live tab's run, else the saved live run, else the last finished run of the same source (null when there are none). */
function marksFor(src: RunSource): string | null {
  if (app.run && sameRun(app.run.source as StoredSource, src) && app.run.annotations) return app.run.annotations;
  for (const k of [LIVE_KEY, LAST_KEY]) { const st = loadStored(k); if (st && sameRun(st.source, src) && st.annotations) return st.annotations; }
  return null;
}

export function scenarioForRunId(parts: string[]): { scenario: Scenario; title: string; annotations: string | null } | null {
  const first = parts[0] ?? 'current';
  if (first === 'current' || first === 'last') {
    const r = first === 'current' ? (app.run ?? restoreLastRun()?.run) : (restoreLastRun()?.run ?? app.run);
    return r ? { scenario: r.scenario, title: r.drill ? `${r.drill.id} ${r.drill.title}` : stageDisplayName(r.scenario.name), annotations: r.annotations ?? marksFor(r.source) } : null;
  }
  const src = parseSource(parts); if (!src) return null;
  let drills: ReturnType<typeof allDrills> = []; try { drills = allDrills(); } catch { drills = []; }
  const built = buildScenario(src, drills); if (!built) return null;
  return { scenario: built.scenario, title: built.drill ? `${built.drill.id} ${built.drill.title}` : stageDisplayName(built.scenario.name), annotations: marksFor(src) };
}

/**
 * PREREAD-001: the hand marks the navigator wrote in the cockpit, drawn onto the printed sheets (the same drawing as the cockpit's book): beside the struck pause, circled under the OUT
 * speed, in Column D, with the speed carried at the top centre of a page and the "comes quick" note at the bottom of the page before.
 */
export function applyBookMarks(sheets: HTMLElement, ann: Annotations): void {
  const pageSheets = [...sheets.querySelectorAll('.book-sheet')] as HTMLElement[];
  pageSheets.forEach((sheet, pi) => {
    const rows = [...sheet.querySelectorAll('.grow[data-n]')] as HTMLElement[];
    rows.forEach((row, i) => {
      const n = Number(row.dataset.n);
      placeRowMarks(row, ann.marks(n), { pause: (row.dataset.pause ? Number(row.dataset.pause) : undefined), pageTop: pi > 0 && i === 0, lastOnPage: i === rows.length - 1 && pi < pageSheets.length - 1 });
    });
    const first = rows[0], last = rows[rows.length - 1];
    const carry = pi > 0 && first ? ann.marks(Number(first.dataset.n)).find(m => m.kind === 'carry') : undefined;
    const quick = last && pi < pageSheets.length - 1 ? ann.marks(Number(last.dataset.n)).find(m => m.kind === 'quick') : undefined;
    if (carry) sheet.querySelector('.colheads')?.insertAdjacentHTML('afterend', `<div class="page-mark top"><span class="hand carry-top" data-mark="carry">${esc(carry.text)}</span></div>`);
    if (quick) sheet.querySelector('.sheet-foot')?.insertAdjacentHTML('beforebegin', `<div class="page-mark bottom"><span class="hand quick-note" data-mark="quick">${esc(quick.text)}</span></div>`);
  });
}

/** The whole book as printable page markup (also used by tests). `perPage` undefined = laid out by content (or the scenario's own `rowsPerPage`). */
export function bookSheetsHtml(sc: Scenario, title: string, perPage?: number): string {
  const nodes = new Map(sc.course.nodes.map(n => [n.id, n] as const));
  return bookPages(sc.book, title, { timeZone: sc.timeZone, style: sc.bookStyle, scenario: sc, ...(perPage !== undefined ? { perPage } : {}) }).map(pg => {
    const rows = pg.rows.map(r => {
      const ins = sc.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      return griidRowHtml(r, { svg: rowCameo(node, ins) });
    }).join('');
    return `<section class="book-sheet" data-page="${pg.page}">`
      + `<div class="colheads"><span></span><span>A</span><span>B</span><span>C</span><span>D</span></div>${rows}`
      + `${sheetFootHtml(pg.foot)}</section>`;
  }).join('');
}

export function renderBookPage(root: HTMLElement, parts: string[]): void {
  const found = scenarioForRunId(parts);
  if (!found) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Book'), el('p', {}, 'No such book. Start a run first, or use #/book/drill/D18/0/1 or #/book/builtin/stage/1. '), el('a', { href: '#/' }, 'Home'))); return; }
  const { scenario, title, annotations } = found;
  const ann = createAnnotations(annotations);
  const print = el('button', { class: 'primary', id: 'book-do-print' }, 'Print'); print.onclick = () => window.print();
  const wrap = el('div', { class: 'book-page-wrap', id: 'book-pages' },
    el('div', { class: 'book-toolbar' }, el('h1', { style: 'margin:0' }, title), el('span', { class: 'muted' }, `${scenario.book.length} lines, ${scenario.bookStyle === 'race' ? 'race style (remarks only in Column D)' : 'example style (sentences in Column D)'}`), print));
  const sheets = el('div', { id: 'book-sheets', html: bookSheetsHtml(scenario, title) }); applyBookMarks(sheets, ann);
  if (scenario.rowsPerPage === undefined) {   // laid out by content (5 to 10 rows a page on the real sheets), or a fixed 6 / 7 / 8
    const sel = el('select', { id: 'rows-per-page', title: 'rows per printed page' }) as HTMLSelectElement;
    sel.append(el('option', { value: 'auto', selected: true }, 'laid out by content'));
    for (const n of PAGE_ROW_CHOICES) sel.append(el('option', { value: String(n) }, `${n} rows a page`));
    sel.onchange = () => { sheets.innerHTML = bookSheetsHtml(scenario, title, sel.value === 'auto' ? undefined : Number(sel.value)); applyBookMarks(sheets, ann); };
    wrap.querySelector('.book-toolbar')!.append(sel);
  }
  wrap.append(sheets);
  root.replaceChildren(wrap);
}
