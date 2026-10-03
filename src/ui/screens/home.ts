/** Home: curriculum map (drills by track with stars and locks) plus free-practice built-in scenarios. */
import '../../core/drills/index.js';
import { allDrills, isUnlocked } from '../../core/drills/index.js';
import type { Drill } from '../../core/drills/types.js';
import { app, builtinScenarios, el, sourceHash } from '../state.js';

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
  const best: Record<string, number> = {}; for (const [id, p] of Object.entries(prog.drills)) best[id] = p.stars;
  page.append(el('h1', {}, 'Rally Trainer'), el('p', { class: 'muted' }, 'Great Race style time-speed-distance navigation: one stopwatch, one clock, a route book and a driver who does what you call. Learn in School, drill in the Cockpit, read the arithmetic in the Debrief.'));
  const runs = app.progress.recentRuns(5);
  if (runs.length) page.append(el('p', { class: 'muted' }, `Last runs: ${runs.map(r => `${r.id} ${r.score} pts ${'★'.repeat(r.stars)}`).join('  ·  ')}`));
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
      el('div', { class: 'title' }, b.title), el('div', { class: 'meta' }, `about ${b.minutes} min`), el('div', {}, b.blurb));
    const play = el('button', { class: 'primary' }, 'Play'); play.onclick = () => { location.hash = sourceHash({ kind: 'builtin', name: b.name, seed: b.seed }); };
    card.append(el('div', { class: 'actions' }, play)); cards.append(card);
  }
  free.append(cards); page.append(free);
  root.replaceChildren(page);
}

function safeDrills(): Drill[] { try { return allDrills(); } catch { return []; } }

function drillCard(d: Drill, best: Record<string, number>): HTMLElement {
  let unlocked = true; try { unlocked = isUnlocked(d, best); } catch { unlocked = true; }
  const p = app.progress.get(d.id);
  const stars = p?.stars ?? 0;
  const card = el('div', { class: `card ${unlocked ? 'playable' : 'locked'}`, 'data-drill': d.id },
    el('div', { class: 'title' }, `${d.id}  ${d.title}`),
    el('div', { class: 'meta' }, `${d.kind} · ~${d.minutes} min · ${d.skills.join(' ')}`),
    el('div', {}, d.objective),
    el('div', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars), p ? el('span', { class: 'muted' }, `  ${p.runs} run${p.runs === 1 ? '' : 's'}, ${p.aces} ace${p.aces === 1 ? '' : 's'}, best ${p.bestScore ?? '-'}`) : el('span', { class: 'muted' }, '  not yet played')),
  );
  const actions = el('div', { class: 'actions' });
  if (!unlocked) actions.append(el('span', { class: 'muted' }, `Locked: needs ${d.unlock.map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ')}`));
  else if (d.kind === 'quiz' || d.kind === 'math') { const b = el('button', { class: 'primary' }, 'Open'); b.onclick = () => { location.hash = `#/${d.kind}/${d.id}`; }; actions.append(b); }
  else {
    const tier = el('select', {}); d.tiers.forEach((t, i) => tier.append(el('option', { value: String(i) }, t.name))); tier.title = 'tier';
    const seed = el('input', { type: 'number', value: String(1 + ((p?.runs ?? 0) % 10)), min: '1', max: '9999', title: 'seed' }) as HTMLInputElement; seed.style.width = '64px';
    const play = el('button', { class: 'primary' }, 'Play');
    play.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: d.id, tier: Number(tier.value) || 0, seed: Number(seed.value) || 1 }); };
    actions.append(tier, seed, play);
  }
  card.append(actions);
  return card;
}
