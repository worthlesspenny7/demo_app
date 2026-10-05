/** Home: start-here path, resume, curriculum map (drills by track with per-tier stars and locks) plus free-practice built-in scenarios. */
import '../../core/drills/index.js';
import { allDrills, isUnlocked, tierNeeds } from '../../core/drills/index.js';
import { LESSONS } from '../../../content/lessons.js';
import type { Drill } from '../../core/drills/types.js';
import { app, builtinScenarios, el, sourceHash, type RunSource } from '../state.js';
import { formatMinutes } from '../viewmodels/estimate.js';
import { startPathFromProgress, unlockBest, pathStars, pathStepHash, lockText, readFirstOf, cardMinutesText, pathNext, pathCompleteText, beyondPathNext, PATH_WHY, FOUR_S_TITLE, type FourS } from '../viewmodels/curriculum.js';
import { LIVE_KEY, loadStored, clearStored, describeSource } from '../viewmodels/resume.js';

/** PLAY-023: the tracks in the handbook's Four S's order (HB p.13-14): start on time, stay on course, then stay on time. D02 is retired. */
const TRACKS: { name: string; blurb: string; ids: string[] }[] = [
  { name: 'Start on time', blurb: 'base + ASP, restarts, exact transits, the pre-read', ids: ['D16', 'D15'] },
  { name: 'Stay on course', blurb: 'reading the page, CAMEOs, traps, what to do when lost', ids: ['D09', 'D10'] },
  { name: 'Stay on time', blurb: 'stopwatch, pauses, speed changes, your charts, recovery, Time Allowance, calibration', ids: ['D01', 'D03', 'D04', 'D05', 'D06', 'D08', 'D08b', 'D07', 'D17'] },
  { name: 'Arithmetic', blurb: 'the coffee-break track: no calculator', ids: ['D14'] },
  { name: 'Whole legs', blurb: 'put it together', ids: ['D18', 'D11', 'D12', 'D13'] },
];
const lessonTitle = (id: string): string => LESSONS.find(l => l.id === id)?.title ?? id;

export function renderHome(root: HTMLElement): void {
  const page = el('div', { class: 'page' });
  const drills = safeDrills();
  const prog = app.progress.load();
  const best = unlockBest(drills, prog);          // Silver/Gold stars only (DRILL-004)
  page.append(el('h1', {}, 'Rally Trainer'), el('p', { class: 'muted' }, 'Great Race style time-speed-distance navigation: one stopwatch, one clock, a route book and a driver who does what you call. Learn in School, drill in the Cockpit, read the arithmetic in the Debrief.'));
  if (app.homeNote) { page.append(el('div', { class: 'banner', id: 'home-note' }, app.homeNote)); app.homeNote = ''; }
  const resume = resumePanel(drills); if (resume) page.append(resume);
  page.append(startHerePanel(drills, prog));
  const runs = app.progress.recentRuns(5);
  if (runs.length) page.append(el('p', { class: 'muted', id: 'lastruns' }, `Last runs: ${runs.map(runLabel).join('  ·  ')}`));
  if (drills.length) {
    for (const t of TRACKS) {
      const ds = t.ids.map(id => drills.find(d => d.id === id)).filter((d): d is Drill => !!d);
      if (!ds.length) continue;
      const sec = el('section', { class: 'track' }, el('h2', {}, t.name, el('small', {}, t.blurb)));
      const cards = el('div', { class: 'cards' });
      for (const d of ds) cards.append(drillCard(d, best));
      sec.append(cards); page.append(sec);
    }
  } else page.append(el('p', { class: 'danger' }, 'The drill registry is empty; the built-in scenarios below are playable.'));
  const free = el('section', { class: 'track' }, el('h2', {}, 'Free practice', el('small', {}, 'built-in scenarios, playable at any time')));
  const cards = el('div', { class: 'cards' });
  for (const b of builtinScenarios()) {
    const card = el('div', { class: 'card playable', 'data-scenario': `${b.name}-${b.seed}` },
      el('div', { class: 'title' }, b.title), el('div', { class: 'meta' }, `${formatMinutes(b.minutes)} at 1x`), el('div', {}, b.blurb));
    const play = el('button', { class: 'primary' }, 'Play'); play.onclick = () => { location.hash = sourceHash({ kind: 'builtin', name: b.name, seed: b.seed }); };
    card.append(el('div', { class: 'actions' }, play)); cards.append(card);
  }
  free.append(cards); page.append(free);
  root.replaceChildren(page);
}

/** "D03 66 raw s ★★" (same unit as the Debrief headline); quiz decks "D09 4 wrong". */
function runLabel(r: { id: string; score: number; stars: number; raw?: number; unit?: string }): string {
  const stars = r.stars ? ` ${'★'.repeat(r.stars)}` : '';
  if (typeof r.raw === 'number') return `${r.id} ${r.raw} raw s${stars}`;
  if (r.unit === 'wrong') return `${r.id} ${r.score} wrong${stars}`;
  return `${r.id} ${r.score} (older run, mean s/leg)${stars}`;
}

function safeDrills(): Drill[] { try { return allDrills(); } catch { return []; } }

function startHerePanel(drills: Drill[], prog: ReturnType<typeof app.progress.load>): HTMLElement {
  const lessonDone = (id: string): boolean => app.progress.lessonDone(id);
  const steps = startPathFromProgress(drills, prog, lessonDone);
  const best = unlockBest(drills, prog);
  // PLAY-023: the four headings in the handbook's order; PLAY-024: a locked drill shows its lock and what it needs
  const list = el('div', { class: 'pathlist' });
  let ol: HTMLElement | null = null; let lastS: FourS | null = null; let n = 0;
  for (const s of steps) {
    if (s.step.s !== lastS) { lastS = s.step.s; list.append(el('div', { class: 'path-s muted', 'data-s': s.step.s }, FOUR_S_TITLE[s.step.s])); ol = el('ol', { start: String(n + 1) }); list.append(ol); }
    n++;
    const li = el('li', { class: `${s.done ? 'done' : ''} ${s.current ? 'current' : ''} ${s.locked ? 'locked' : ''}`, 'data-step': s.step.id, ...(s.locked ? { title: `Locked: needs ${s.needs}` } : {}) }, `${s.done ? '✓ ' : s.locked ? '🔒 ' : ''}${s.step.label}${s.locked && !s.done ? ` (needs ${s.needs})` : ''}`);
    li.style.cursor = s.locked ? 'not-allowed' : 'pointer';
    if (!s.locked) li.onclick = () => { location.hash = pathStepHash(s.step); };
    ol!.append(li);
  }
  const nx = pathNext(steps, drills, best, lessonDone, lessonTitle, pathStars(prog));
  let go: HTMLElement | null = null;
  if (nx && nx.kind !== 'blocked') { const b = el('button', { class: 'primary', id: 'starthere', 'data-next': nx.kind }, `Next: ${nx.label}`); b.onclick = () => { location.hash = nx.hash; }; go = b; }
  else if (nx) go = el('p', { class: 'lockline', id: 'starthere-locked' }, nx.label);
  return el('section', { class: 'panel startpath', id: 'starthere-panel' },
    el('h3', {}, 'Start here'),
    el('p', {}, "New? Take the path in order. It follows the handbook's Four S's in the handbook's order: safety, start on time, stay on course, stay on time. Each drill comes after the lessons on its \"Read first\" line. Lessons tick when you pass their check question; a drill ticks with one star at any tier. Bronze shows live help; Gold is Great Race legal: analog dials, no answer sheet. Only Silver or Gold stars unlock the miniature leg and the whole legs."),
    el('p', { class: 'muted', id: 'path-why' }, PATH_WHY),
    list, go ? el('div', { style: 'margin-top:10px' }, go) : el('div', {}, el('p', { class: 'ok', id: 'path-complete' }, pathCompleteText(drills, best)), beyondButton(drills, best, lessonDone, lessonTitle, pathStars(prog))));
}
/** PT-11 N-D9: "Path complete" keeps a button: the way on to the full stage (D12). */
function beyondButton(drills: Drill[], best: Record<string, number>, lessonDone: (id: string) => boolean, lessonTitle: (id: string) => string, played: Record<string, number>): HTMLElement | null {
  const bx = beyondPathNext(drills, best, lessonDone, lessonTitle, played); if (!bx) return null;
  const b = el('button', { class: 'primary', id: 'beyond-path', 'data-next': bx.kind }, `Next: ${bx.label}`); b.onclick = () => { location.hash = bx.hash; }; return b;
}

function resumePanel(drills: Drill[]): HTMLElement | null {
  const live = loadStored(LIVE_KEY); if (!live) return null;
  const d = live.source.kind === 'drill' ? drills.find(x => x.id === (live.source as { drillId: string }).drillId) : null;
  const names = d ? d.tiers.map(t => t.name) : undefined;
  const src = live.source as RunSource;
  const resume = el('button', { class: 'primary', id: 'resume' }, 'Resume'); resume.onclick = () => { app.resume = true; location.hash = sourceHash(src); };
  const again = el('button', { id: 'restart-seed' }, 'Restart the same seed'); again.onclick = () => { clearStored(LIVE_KEY); location.hash = sourceHash(src); };
  const drop = el('button', { id: 'discard' }, 'Discard'); drop.onclick = () => { if (!confirm('Discard the saved run? It cannot be resumed afterwards.')) return; clearStored(LIVE_KEY); renderHome(root()); };   // PLAY-010: Discard asks first
  const ago = Math.max(0, Math.round((Date.now() - live.savedAt) / 60000));
  return el('section', { class: 'panel resume', id: 'resume-panel' }, el('div', {}, el('b', {}, 'A run was in progress: '), `${d ? `${d.id} ${d.title}, ` : ''}${describeSource(live.source, names)} (saved ${ago} min ago, ${live.actions.length} actions).`), el('div', { style: 'display:flex;gap:8px' }, resume, again, drop));
}
const root = (): HTMLElement => document.getElementById('view') ?? document.body;

/** EDU-005: "Read first: <lesson>" links on every drill card; a lesson that gates the drill says so. */
function readFirstLine(d: Drill, lessonDone: (id: string) => boolean): HTMLElement | null {
  const ls = readFirstOf(d); if (!ls.length) return null;
  const line = el('div', { class: 'readfirst muted', 'data-readfirst': d.id }, 'Read first: ');
  ls.forEach((l, i) => {
    const a = el('a', { href: `#/school/${l.id}`, 'data-lesson-link': l.id }, `${lessonTitle(l.id)}${lessonDone(l.id) ? ' ✓' : ''}`);
    line.append(...(i ? [', '] : []), a, ...(l.gate && !lessonDone(l.id) ? [' (pass it to unlock)'] : []));
  });
  return line;
}

function tierPips(d: Drill, p: ReturnType<typeof app.progress.get>): HTMLElement {
  const wrap = el('div', { class: 'pips', 'data-pips': d.id });
  d.tiers.forEach((t, i) => {
    const n = p?.tierStars?.[i] ?? 0;
    const gold = d.tiers.length === 3 && i === 2;
    wrap.append(el('span', { class: `tier ${gold ? 'gold' : ''}`, title: t.description }, el('b', {}, t.name), el('span', {}, ...[0, 1, 2].map(k => el('span', { class: k < n ? 'on' : '' }, k < n ? '★' : '☆')))));
  });
  return wrap;
}

function drillCard(d: Drill, best: Record<string, number>): HTMLElement {
  const lessonDone = (id: string): boolean => { try { return app.progress.lessonDone(id); } catch { return false; } };
  let unlocked = true; try { unlocked = isUnlocked(d, best, lessonDone); } catch { unlocked = true; }
  const p = app.progress.get(d.id);
  const stars = p?.stars ?? 0;
  const multiTier = d.tiers.length > 1;
  const quiz = d.kind === 'quiz' || d.kind === 'math';
  const bestTxt = p ? (quiz ? `best ${p.bestScore ?? '-'} wrong` : p.bestRaw !== null && p.bestRaw !== undefined ? `best ${p.bestRaw} raw s` : p.bestScore !== null ? `best ${p.bestScore} s/leg (older run)` : '') : '';
  const card = el('div', { class: `card ${unlocked ? 'playable' : 'locked'}`, 'data-drill': d.id },
    el('div', { class: 'title' }, `${unlocked ? '' : '🔒 '}${d.id}  ${d.title}`),
    el('div', { class: 'meta' }, `${d.kind} · ${cardMinutesText(d)} · ${d.skills.join(' ')}`),
    el('div', {}, d.objective),
    readFirstLine(d, lessonDone),
    multiTier ? tierPips(d, p) : el('div', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
    p ? el('div', { class: 'muted' }, `${p.runs} run${p.runs === 1 ? '' : 's'}, ${p.aces} ace${p.aces === 1 ? '' : 's'}${bestTxt ? `, ${bestTxt}` : ''}`) : el('div', { class: 'muted' }, 'not yet played'),
  );
  const actions = el('div', { class: 'actions' });
  if (!unlocked) { const miss = d.unlock.filter(u => (best[u.drill] ?? 0) < u.stars); const text = lockText(miss, (d.lessonGate ?? []).filter(l => !lessonDone(l)), lessonTitle) || lockText(d.unlock); actions.append(el('span', { class: 'lockline' }, `🔒 Locked: ${miss.length || !text.startsWith('pass') ? 'needs ' : ''}${text}`)); }
  else if (d.id === 'D13') { const b = el('button', { class: 'primary' }, 'Open campaign'); b.onclick = () => { location.hash = '#/campaign'; }; actions.append(b); }
  else if (quiz) { const b = el('button', { class: 'primary' }, 'Open'); b.onclick = () => { location.hash = `#/${d.kind}/${d.id}`; }; actions.append(b); }
  else {
    // EDU-005: a tier with its own prerequisite (Gold D03/D04/D05 need the D06 chart) is listed but disabled, with what it needs
    const tier = el('select', {}); d.tiers.forEach((t, i) => { const need = tierNeeds(d, i, best); const o = el('option', { value: String(i), title: need.length ? `${t.name} needs ${lockText(need)} (build your chart first)` : t.description }, need.length ? `${t.name} (needs ${need.map(u => u.drill).join(', ')})` : t.name); if (need.length) o.setAttribute('disabled', ''); tier.append(o); }); tier.title = 'tier: Bronze = live aids, Silver = fewer aids, Gold = Great Race legal';
    const seed = el('input', { type: 'number', value: String(1 + ((p?.runs ?? 0) % 10)), min: '1', max: '9999', title: 'seed' }) as HTMLInputElement; seed.style.width = '64px';
    const play = el('button', { class: 'primary' }, 'Play');
    play.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: d.id, tier: Number(tier.value) || 0, seed: Number(seed.value) || 1 }); };
    actions.append(tier, seed, play);
  }
  card.append(actions);
  return card;
}
