/** Home: start-here path, resume, curriculum map (drills by track with per-tier stars and locks) plus free-practice built-in scenarios. */
import '../../core/drills/index.js';
import { allDrills, isUnlocked } from '../../core/drills/index.js';
import type { Drill } from '../../core/drills/types.js';
import { app, builtinScenarios, el, sourceHash, type RunSource } from '../state.js';
import { drillMinutes, formatMinutes } from '../viewmodels/estimate.js';
import { startPathFromProgress, unlockBest } from '../viewmodels/curriculum.js';
import { LIVE_KEY, loadStored, clearStored, describeSource } from '../viewmodels/resume.js';

const TRACKS: { name: string; blurb: string; ids: string[] }[] = [
  { name: 'Timing', blurb: 'stopwatch, pauses, speed changes, calibration, recovery', ids: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D08b', 'D15', 'D16', 'D17'] },
  { name: 'Course', blurb: 'reading the page, CAMEOs, traps', ids: ['D09', 'D10'] },
  { name: 'Arithmetic', blurb: 'the coffee-break track: no calculator', ids: ['D14'] },
  { name: 'Whole legs', blurb: 'put it together', ids: ['D18', 'D11', 'D12', 'D13'] },
];

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
  const steps = startPathFromProgress(drills, prog, id => app.progress.lessonDone(id));
  const ol = el('ol', {});
  for (const s of steps) {
    const li = el('li', { class: `${s.done ? 'done' : ''} ${s.current ? 'current' : ''}`, 'data-step': s.step.id }, `${s.done ? '✓ ' : ''}${s.step.label}`);
    li.style.cursor = 'pointer';
    li.onclick = () => { location.hash = s.step.kind === 'lesson' ? `#/school/${s.step.id}` : `#/cockpit/drill/${s.step.id}/0/1`; };
    ol.append(li);
  }
  const cur = steps.find(s => s.current);
  const go = cur ? el('button', { class: 'primary', id: 'starthere' }, `Next: ${cur.step.label}`) : null;
  if (go && cur) go.onclick = () => { location.hash = cur.step.kind === 'lesson' ? `#/school/${cur.step.id}` : sourceHash({ kind: 'drill', drillId: cur.step.id, tier: 0, seed: 1 }); };
  return el('section', { class: 'panel startpath', id: 'starthere-panel' },
    el('h3', {}, 'Start here'),
    el('p', {}, 'New? Take the path in order: read the first School lesson (3 minutes), then play D01 (stopwatch), D03 (pauses) and D04 (timed changes) at Bronze. Bronze shows live help; Gold is Great Race legal: analog dials, no answer sheet. Only Silver or Gold stars unlock the whole-leg drills.'),
    ol, go ? el('div', { style: 'margin-top:10px' }, go) : el('p', { class: 'ok' }, 'Path complete. Take the whole-leg drills (D11) and the full stage (D12).'));
}

function resumePanel(drills: Drill[]): HTMLElement | null {
  const live = loadStored(LIVE_KEY); if (!live) return null;
  const d = live.source.kind === 'drill' ? drills.find(x => x.id === (live.source as { drillId: string }).drillId) : null;
  const names = d ? d.tiers.map(t => t.name) : undefined;
  const src = live.source as RunSource;
  const resume = el('button', { class: 'primary', id: 'resume' }, 'Resume'); resume.onclick = () => { app.resume = true; location.hash = sourceHash(src); };
  const again = el('button', { id: 'restart-seed' }, 'Restart the same seed'); again.onclick = () => { clearStored(LIVE_KEY); location.hash = sourceHash(src); };
  const drop = el('button', { id: 'discard' }, 'Discard'); drop.onclick = () => { clearStored(LIVE_KEY); renderHome(root()); };
  const ago = Math.max(0, Math.round((Date.now() - live.savedAt) / 60000));
  return el('section', { class: 'panel resume', id: 'resume-panel' }, el('div', {}, el('b', {}, 'A run was in progress: '), `${d ? `${d.id} ${d.title}, ` : ''}${describeSource(live.source, names)} (saved ${ago} min ago, ${live.actions.length} actions).`), el('div', { style: 'display:flex;gap:8px' }, resume, again, drop));
}
const root = (): HTMLElement => document.getElementById('view') ?? document.body;

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
  let unlocked = true; try { unlocked = isUnlocked(d, best); } catch { unlocked = true; }
  const p = app.progress.get(d.id);
  const stars = p?.stars ?? 0;
  const multiTier = d.tiers.length > 1;
  const quiz = d.kind === 'quiz' || d.kind === 'math';
  const bestTxt = p ? (quiz ? `best ${p.bestScore ?? '-'} wrong` : p.bestRaw !== null && p.bestRaw !== undefined ? `best ${p.bestRaw} raw s` : p.bestScore !== null ? `best ${p.bestScore} s/leg (older run)` : '') : '';
  const card = el('div', { class: `card ${unlocked ? 'playable' : 'locked'}`, 'data-drill': d.id },
    el('div', { class: 'title' }, `${unlocked ? '' : '🔒 '}${d.id}  ${d.title}`),
    el('div', { class: 'meta' }, `${d.kind} · ${formatMinutes(drillMinutes(d))}${d.id === 'D13' ? ' per stage' : ''} at 1x · ${d.skills.join(' ')}`),
    el('div', {}, d.objective),
    multiTier ? tierPips(d, p) : el('div', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
    p ? el('div', { class: 'muted' }, `${p.runs} run${p.runs === 1 ? '' : 's'}, ${p.aces} ace${p.aces === 1 ? '' : 's'}${bestTxt ? `, ${bestTxt}` : ''}`) : el('div', { class: 'muted' }, 'not yet played'),
  );
  const actions = el('div', { class: 'actions' });
  if (!unlocked) actions.append(el('span', { class: 'lockline' }, `🔒 Locked: needs ${d.unlock.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ')} at Silver or Gold`));
  else if (d.id === 'D13') { const b = el('button', { class: 'primary' }, 'Open campaign'); b.onclick = () => { location.hash = '#/campaign'; }; actions.append(b); }
  else if (quiz) { const b = el('button', { class: 'primary' }, 'Open'); b.onclick = () => { location.hash = `#/${d.kind}/${d.id}`; }; actions.append(b); }
  else {
    const tier = el('select', {}); d.tiers.forEach((t, i) => tier.append(el('option', { value: String(i), title: t.description }, t.name))); tier.title = 'tier: Bronze = live aids, Silver = fewer aids, Gold = Great Race legal';
    const seed = el('input', { type: 'number', value: String(1 + ((p?.runs ?? 0) % 10)), min: '1', max: '9999', title: 'seed' }) as HTMLInputElement; seed.style.width = '64px';
    const play = el('button', { class: 'primary' }, 'Play');
    play.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: d.id, tier: Number(tier.value) || 0, seed: Number(seed.value) || 1 }); };
    actions.append(tier, seed, play);
  }
  card.append(actions);
  return card;
}
