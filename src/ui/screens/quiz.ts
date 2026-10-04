/** Static drills: D09 trap quiz (CAMEO cards) and D14 mental math (generated question cards). */
import { FORD_1939, type TurnDir } from '../../core/course.js';
import { TRAPS, TRAP_QUIZ } from '../../core/generator/traps.js';
import { stopLoss } from '../../core/perf-table.js';
import { rng } from '../../core/rng.js';
import { cameoSvg, type CameoExit } from '../viewmodels/cameo.js';
import { app, el } from '../state.js';
import { allDrills } from '../../core/drills/index.js';
import { LESSONS } from '../../../content/lessons.js';
import { pathNext, startPathFromProgress, unlockBest } from '../viewmodels/curriculum.js';

export interface Card { prompt: string; svg?: string; options: string[]; answer: number; tip: string; category?: string }


/**
 * PLAY-025: 20 distinct cards from the trap library. The prompt shows the line and the scene and asks what you do ("which way?"); the options are
 * actions (TRAP_QUIZ), one right and three a rookie would really take, so the answer is a decision, never a rule to match.
 */
export function trapCards(seed: number): Card[] {
  const r = rng(seed);
  const deck = TRAPS.filter(t => TRAP_QUIZ[t.id]);
  const order = deck.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = r.int(0, i); [order[i], order[j]] = [order[j]!, order[i]!]; }
  const out: Card[] = [];
  for (const idx of order.slice(0, 20)) {
    const t = deck[idx]!; const q = TRAP_QUIZ[t.id]!;
    const all = [q.right, ...q.wrong];
    for (let i = all.length - 1; i > 0; i--) { const j = r.int(0, i); [all[i], all[j]] = [all[j]!, all[i]!]; }
    const turn = (t.turn ?? 'S') as TurnDir;
    out.push({ prompt: `Line reads: ${t.instructionText}${t.hint ? ` (Column D: ${t.hint})` : ''}. ${t.visual} ${q.ask ?? 'Which way, and what do you do?'}`, svg: t.exits.length ? cameoSvg(t.exits as never, t.control, turn, 120, { sign: t.sign ?? null }) : undefined, options: all, answer: all.indexOf(q.right), tip: `${t.tip} (${t.name})`, category: t.category });
  }
  return out;
}

/** Four distinct options: the correct one plus three distinct wrong ones (topped up with offsets when two coincide). */
function distinctOptions(correct: string, wrongs: string[], topUp: (n: number) => string): string[] {
  const out = [correct];
  for (const w of wrongs) if (!out.includes(w)) out.push(w);
  for (let n = 1; out.length < 4 && n < 60; n++) { const w = topUp(n); if (!out.includes(w)) out.push(w); }
  return out.slice(0, 4);
}

export function mathCards(seed: number): Card[] {
  const r = rng(seed);
  const out: Card[] = [];
  const speeds = [25, 30, 35, 40, 45, 50];
  const shuffle = (opts: string[]): { options: string[]; answer: number } => { const correct = opts[0]!; const all = [...opts]; for (let i = all.length - 1; i > 0; i--) { const j = r.int(0, i); [all[i], all[j]] = [all[j]!, all[i]!]; } return { options: all, answer: all.indexOf(correct) }; };
  const fmt = (t: number): string => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  for (let i = 0; i < 20; i++) {
    const kind = i % 4;
    if (kind === 0) { const p = r.pick([15, 20, 30]); const v = r.pick(speeds); const w = r.pick(speeds); const loss = Math.round(stopLoss(v, w, FORD_1939) * 10) / 10; const d = Math.max(0, Math.round((p - loss) * 10) / 10); const s = shuffle(distinctOptions(`${d.toFixed(1)} s`, [`${p} s`, `${(p + loss).toFixed(1)} s`, `${loss.toFixed(1)} s`], n => `${(d + n * 1.5).toFixed(1)} s`)); out.push({ prompt: `Pause ${p}, entering at ${v} and leaving at ${w}. The card says the stop/start loss is ${loss.toFixed(1)} s. How long do you dwell?`, ...s, tip: `dwell = pause - loss = ${p} - ${loss.toFixed(1)} = ${d.toFixed(1)} s.` }); }
    else if (kind === 1) { const v = r.pick(speeds); const spm = 3600 / v; const s = shuffle(distinctOptions(`${spm.toFixed(1)} s`, [`${(3600 / (v + 5)).toFixed(1)} s`, `${(spm * 1.1).toFixed(1)} s`, `${(v * 1.5).toFixed(1)} s`], n => `${(spm + n * 7).toFixed(1)} s`)); out.push({ prompt: `Seconds per mile at ${v} mph? (odometer-style arithmetic; the Great Race has no odometer)`, ...s, tip: `3600 / ${v} = ${spm.toFixed(1)} s per mile.` }); }
    else if (kind === 2) { const v = r.pick(speeds); const late = r.int(3, 12); const t = Math.round(late * v / 5); const s = shuffle(distinctOptions(`${t} s`, [`${Math.round(late * (v / 5 + 1))} s`, `${Math.round(late * (v / 10))} s`, `${late * 5} s`], n => `${t + n * 7} s`)); out.push({ prompt: `You are ${late} s late at an assigned ${v}. You hold +5 mph. For how many seconds on your stopwatch?`, ...s, tip: `Holding +d mph recovers E seconds after t = E x v / d = ${late} x ${v} / 5 = ${t} s (the "+1" form is ghost time, not what the watch shows).` }); }
    else { const m = r.int(0, 59); const sec = r.int(0, 59); const add = r.pick([15, 20, 30, 36, 45, 90]); const tot = m * 60 + sec + add; const s = shuffle(distinctOptions(fmt(tot), [fmt(tot + 60), fmt(tot - 10), fmt(tot + 5)], n => fmt(tot + 11 * n))); out.push({ prompt: `Stopwatch reads ${fmt(m * 60 + sec)}. Add a Pause ${add}. New target?`, ...s, tip: `${fmt(m * 60 + sec)} + ${add} s = ${fmt(tot)}.` }); }
  }
  return out;
}

let quizCleanup: (() => void) | null = null;
export function renderQuiz(root: HTMLElement, kind: 'quiz' | 'math', drillId: string): () => void {
  quizCleanup?.();
  const seed = Date.now() % 1000;
  const cards = kind === 'quiz' ? trapCards(seed) : mathCards(seed);
  let i = 0, correct = 0;
  const missed: string[] = [];
  let answered = false; let onKey: ((e: KeyboardEvent) => void) | null = null;
  const page = el('div', { class: 'page quiz', style: 'max-width:760px' });
  const head = el('h1', {}, kind === 'quiz' ? `${drillId}: Trap quiz: which way, and what do you do?` : `${drillId}: Mental math`);
  const sub = el('p', { class: 'muted' });
  const box = el('div', { class: 'panel' });
  page.append(head, sub, box);
  const buttons: HTMLButtonElement[] = [];
  let nextBtn: HTMLButtonElement | null = null;
  const show = (): void => {
    const c = cards[i];
    buttons.length = 0; nextBtn = null; answered = false;
    if (!c) {
      // N3: the last card's digit handler must not survive onto the result screen
      if (onKey) { document.removeEventListener('keydown', onKey); onKey = null; }
      answered = true;
      const stars = correct >= 19 ? 3 : correct >= 16 ? 2 : correct >= 12 ? 1 : 0;
      app.progress.recordRun(drillId, { stars, aces: 0, score: 20 - correct, tier: 0, unit: 'wrong' });
      const cats = [...new Set(missed)];
      box.replaceChildren(el('h2', {}, `${correct} / 20 correct  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`), el('p', {}, stars === 3 ? 'Sharp. Take it to the cockpit.' : 'Re-run the deck until it is automatic: the car does not wait for second guesses.'), ...(cats.length ? [el('p', { class: 'muted' }, `Missed topics: ${cats.join(', ')}`)] : []));
      const again = el('button', { class: 'primary' }, 'Again'); again.onclick = () => { renderQuiz(root, kind, drillId); };
      const home = el('button', {}, 'Home'); home.onclick = () => { location.hash = '#/'; };
      const row = el('div', { class: 'actions', style: 'display:flex;gap:8px' }, again, home);
      // PLAY-023: the result page leads on along the Start-here path like every Debrief
      try { const ds = allDrills(); const prog = app.progress.load(); const ld = (id: string): boolean => app.progress.lessonDone(id); const pn = pathNext(startPathFromProgress(ds, prog, ld), ds, unlockBest(ds, prog), ld, id => LESSONS.find(l => l.id === id)?.title ?? id); if (pn && pn.kind !== 'blocked' && !(pn.kind === 'step' && pn.step.id === drillId)) { const b = el('button', { class: 'primary', id: 'next-path' }, `Next on your path: ${pn.label}`); b.onclick = () => { location.hash = pn.hash; }; row.append(b); } } catch { /* registry unavailable */ }
      box.append(row);
      sub.textContent = ''; return;
    }
    sub.textContent = `Card ${i + 1} of 20 · ${correct} correct · keys 1-${c.options.length} answer, Enter / Space next`;
    box.replaceChildren();
    if (c.svg) box.append(el('div', { html: c.svg, style: 'color:#111;background:#fff;border-radius:4px;padding:2px;display:inline-block;margin-bottom:8px' }));   // the CAMEO is printed ink on paper
    box.append(el('p', { style: 'font-size:17px' }, c.prompt));
    const fb = el('p', {});
    const answer = (k: number): void => {
      if (answered) return; answered = true;
      const b = buttons[k]; if (!b) { answered = false; return; }
      if (k === c.answer) { correct++; b.classList.add('right'); fb.textContent = `Right. ${c.tip}`; fb.className = 'ok'; }
      else { b.classList.add('wrong'); buttons[c.answer]?.classList.add('reveal'); if (c.category) missed.push(c.category); fb.textContent = `No: ${c.options[c.answer]}. ${c.tip}`; fb.className = 'danger'; }
      const next = el('button', { class: 'primary', id: 'quiz-next' }, 'Next'); next.onclick = () => { i++; show(); }; box.append(next); nextBtn = next;
    };
    c.options.forEach((o, k) => { const b = el('button', { class: 'opt' }, el('kbd', {}, String(k + 1)), o) as HTMLButtonElement; b.onclick = () => answer(k); buttons.push(b); box.append(b); });
    box.append(fb);
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (!answered && Number.isInteger(n) && n >= 1 && n <= c.options.length) { e.preventDefault(); answer(n - 1); }
      else if (answered && (e.key === 'Enter' || e.key === ' ') && nextBtn) { e.preventDefault(); nextBtn.click(); }
    };
    document.addEventListener('keydown', onKey);
  };
  const cleanup = (): void => { if (onKey) document.removeEventListener('keydown', onKey); onKey = null; if (quizCleanup === cleanup) quizCleanup = null; };
  quizCleanup = cleanup;
  show();
  root.replaceChildren(page);
  return cleanup;
}
