/** Printable full-page book (UI-029): `#/book/<runId>`. Seven rows a page (7 or 8 on request; a hand-laid-out drill book keeps its own), each page headed by the stage title and footed "Page n of m". */
import type { Scenario } from '../../core/course.js';
import { bookPages, signBox, landmarkLabel, ROWS_PER_PAGE, PAGE_ROW_CHOICES } from '../viewmodels/book.js';
import { cameoSvg } from '../viewmodels/cameo.js';
import { griidRowHtml, esc } from '../render/griid.js';
import { app, buildScenario, parseSource, el, restoreLastRun } from '../state.js';
import { allDrills } from '../../core/drills/index.js';

/** runId: `current` (the live run), `last` (the last finished run), or a source path `drill/D18/0/1` / `builtin/stage/1`. */
export function scenarioForRunId(parts: string[]): { scenario: Scenario; title: string } | null {
  const first = parts[0] ?? 'current';
  if (first === 'current' || first === 'last') {
    const r = first === 'current' ? (app.run ?? restoreLastRun()?.run) : (restoreLastRun()?.run ?? app.run);
    return r ? { scenario: r.scenario, title: r.drill ? `${r.drill.id} ${r.drill.title}` : r.scenario.name } : null;
  }
  const src = parseSource(parts); if (!src) return null;
  let drills: ReturnType<typeof allDrills> = []; try { drills = allDrills(); } catch { drills = []; }
  const built = buildScenario(src, drills); if (!built) return null;
  return { scenario: built.scenario, title: built.drill ? `${built.drill.id} ${built.drill.title}` : built.scenario.name };
}

/** The whole book as printable page markup (also used by tests). */
export function bookSheetsHtml(sc: Scenario, title: string, perPage: number = sc.rowsPerPage ?? ROWS_PER_PAGE): string {
  const nodes = new Map(sc.course.nodes.map(n => [n.id, n] as const));
  return bookPages(sc.book, title, { timeZone: sc.timeZone, style: sc.bookStyle, perPage }).map(pg => {
    const rows = pg.rows.map(r => {
      const ins = sc.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      const svg = node?.exits ? cameoSvg(node.exits, node.control, ins?.turn ?? null, 64) : node?.sign || (node?.control && node.control !== 'none') ? cameoSvg([{ angle: 0, kind: 'road', isRoute: true }], node!.control, 'S', 64) : '';
      return griidRowHtml(r, { svg, sign: signBox(node), landmark: landmarkLabel(node) });
    }).join('');
    return `<section class="book-sheet" data-page="${pg.page}"><div class="sheet-head"><span>${esc(pg.title)}</span><span>Course Instructions · ${esc(sc.timeZone)} · ASP ${sc.asp}</span></div>`
      + `<div class="colheads"><span></span><span>A</span><span>B</span><span>C</span><span>D</span></div>${rows}`
      + `<div class="sheet-foot"><span>Rally Trainer</span><span class="pageno">${esc(pg.footer)}</span><span>${esc(pg.title)}</span></div></section>`;
  }).join('');
}

export function renderBookPage(root: HTMLElement, parts: string[]): void {
  const found = scenarioForRunId(parts);
  if (!found) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Book'), el('p', {}, 'No such book. Start a run first, or use #/book/drill/D18/0/1 or #/book/builtin/stage/1. '), el('a', { href: '#/' }, 'Home'))); return; }
  const { scenario, title } = found;
  const print = el('button', { class: 'primary', id: 'book-do-print' }, 'Print'); print.onclick = () => window.print();
  const wrap = el('div', { class: 'book-page-wrap', id: 'book-pages' },
    el('div', { class: 'book-toolbar' }, el('h1', { style: 'margin:0' }, title), el('span', { class: 'muted' }, `${scenario.book.length} lines, ${scenario.bookStyle === 'race' ? 'race style (remarks only in Column D)' : 'example style (sentences in Column D)'}`), print));
  const sheets = el('div', { id: 'book-sheets', html: bookSheetsHtml(scenario, title) });
  if (scenario.rowsPerPage === undefined) {   // 7-8 rows a page (real sheets carry 6-9)
    const sel = el('select', { id: 'rows-per-page', title: 'rows per printed page' }) as HTMLSelectElement;
    for (const n of PAGE_ROW_CHOICES) sel.append(el('option', { value: String(n), selected: n === ROWS_PER_PAGE ? true : null }, `${n} rows a page`));
    sel.onchange = () => { sheets.innerHTML = bookSheetsHtml(scenario, title, Number(sel.value) || ROWS_PER_PAGE); };
    wrap.querySelector('.book-toolbar')!.append(sel);
  }
  wrap.append(sheets);
  root.replaceChildren(wrap);
}
