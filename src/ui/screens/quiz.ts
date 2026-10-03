/** Static drills: D09 trap quiz (CAMEO cards) and D14 mental math (generated question cards). */
import { EXITS } from '../../core/builder.js';
import { FORD_1939, type TurnDir } from '../../core/course.js';
import { stopLoss } from '../../core/perf-table.js';
import { rng } from '../../core/rng.js';
import { cameoSvg, type CameoExit } from '../viewmodels/cameo.js';
import { app, el } from '../state.js';

interface Card { prompt: string; svg?: string; options: string[]; answer: number; tip: string }

function trapCards(seed: number): Card[] {
  const r = rng(seed);
  const dirWord: Record<string, string> = { L: 'Left', R: 'Right', S: 'Straight', BL: 'Bear left', BR: 'Bear right', AL: 'Acute left', AR: 'Acute right' };
  const opts = ['Left', 'Straight', 'Right', 'Bear left', 'Bear right', 'Stop and ask'];
  const mk = (exits: CameoExit[], control: string, route: TurnDir, instruction: string, tip: string, correct: string): Card => ({ prompt: instruction, svg: cameoSvg(exits as never, control, route, 120), options: opts, answer: opts.indexOf(correct), tip });
  const pool: Card[] = [
    mk(EXITS.sideRoad('R', { kind: 'driveway' }), 'none', 'S', '"Right at 1st paved road." A gravel driveway opens on the right.', 'A driveway is not a road: dashed in the CAMEO. Continue to the first real paved road.', 'Straight'),
    mk(EXITS.sideRoad('L', { surface: 'gravel' }), 'none', 'S', '"Left at 1st paved road." A gravel road opens on the left.', 'Unpaved roads are omitted or dashed; they do not count.', 'Straight'),
    mk(EXITS.tee('R'), 'STOP', 'R', 'Line reads "Right at STOP". The road ends in a T with a STOP sign.', 'A T with a control: stop, pause arithmetic, then the called direction.', 'Right'),
    mk(EXITS.tee('L'), 'none', 'L', 'Line reads only "Continue". Your road ends in a T.', 'Your road ends and no direction is given: do not guess. Stop before the leading edge and re-read; the driver will ask.', 'Stop and ask'),
    mk(EXITS.wye('BL'), 'none', 'BL', 'Line reads "Bear left at Y".', 'A Y splits at a shallow angle; bear, not turn.', 'Bear left'),
    mk(EXITS.crossroads('S', { sideControl: 'STOP' }), 'none', 'S', 'Crossroads ahead; the side roads have STOP signs facing them, you have none. Line: "Speed 35".', 'The STOP faces cross traffic, not you: no stop, no pause. Keep the speed.', 'Straight'),
    mk(EXITS.crossroads('R'), 'YIELD', 'R', '"Right at YIELD. Pause 10."', 'Yield is a control like a stop for the route book; the pause is still printed.', 'Right'),
    mk(EXITS.crossroads('L'), 'BLINKER', 'L', '"Left at blinker."', 'A flashing beacon counts as the landmark; do not wait for a full signal.', 'Left'),
    mk([{ angle: 0, kind: 'road' }, { angle: 150, kind: 'road' }], 'none', 'AR', '"Acute right."', 'Acute means sharper than 90 degrees, often a near reversal. Slow early: the car model caps acute turns at 8 mph.', 'Right'),
    mk(EXITS.sideRoad('R'), 'none', 'S', '"Right at “OAK RD”". The side road sign reads OAK DR.', 'Quoted signs must match exactly. OAK DR is not OAK RD.', 'Straight'),
  ];
  const out: Card[] = [];
  for (let i = 0; i < 20; i++) out.push(pool[r.int(0, pool.length - 1)]!);
  return out;
}

function mathCards(seed: number): Card[] {
  const r = rng(seed);
  const out: Card[] = [];
  const speeds = [25, 30, 35, 40, 45, 50];
  const shuffle = (correct: string, wrongs: string[]): { options: string[]; answer: number } => { const all = [correct, ...wrongs]; for (let i = all.length - 1; i > 0; i--) { const j = r.int(0, i); [all[i], all[j]] = [all[j]!, all[i]!]; } return { options: all, answer: all.indexOf(correct) }; };
  for (let i = 0; i < 20; i++) {
    const kind = i % 4;
    if (kind === 0) { const p = r.pick([15, 20, 30]); const v = r.pick(speeds); const w = r.pick(speeds); const loss = Math.round(stopLoss(v, w, FORD_1939) * 10) / 10; const d = Math.max(0, Math.round((p - loss) * 10) / 10); const s = shuffle(`${d.toFixed(1)} s`, [`${p} s`, `${(p + loss).toFixed(1)} s`, `${loss.toFixed(1)} s`]); out.push({ prompt: `Pause ${p}, entering at ${v} and leaving at ${w}. The card says the stop/start loss is ${loss.toFixed(1)} s. How long do you dwell?`, ...s, tip: `dwell = pause - loss = ${p} - ${loss.toFixed(1)} = ${d.toFixed(1)} s.` }); }
    else if (kind === 1) { const v = r.pick(speeds); const spm = 3600 / v; const s = shuffle(`${spm.toFixed(1)} s`, [`${(3600 / (v + 5)).toFixed(1)} s`, `${(spm * 1.1).toFixed(1)} s`, `${(v * 1.5).toFixed(1)} s`]); out.push({ prompt: `Seconds per mile at ${v} mph?`, ...s, tip: `3600 / ${v} = ${spm.toFixed(1)} s per mile.` }); }
    else if (kind === 2) { const v = r.pick(speeds); const late = r.int(3, 12); const f = v / 5 + 1; const t = Math.round(late * f); const s = shuffle(`${t} s`, [`${Math.round(late * (v / 10 + 1))} s`, `${late * 5} s`, `${Math.round(late * f * 1.5)} s`]); out.push({ prompt: `You are ${late} s late at an assigned ${v}. You will run +5 mph. For how many seconds (ghost time)?`, ...s, tip: `Factor at +5 is v/5 + 1 = ${f}; ${late} x ${f} = ${t} s.` }); }
    else { const m = r.int(0, 59); const sec = r.int(0, 59); const add = r.pick([15, 20, 30, 36, 45, 90]); const tot = m * 60 + sec + add; const fmt = (t: number): string => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; const s = shuffle(fmt(tot), [fmt(tot + 60), fmt(tot - 10), fmt(tot + 5)]); out.push({ prompt: `Stopwatch reads ${fmt(m * 60 + sec)}. Add a Pause ${add}. New target?`, ...s, tip: `${fmt(m * 60 + sec)} + ${add} s = ${fmt(tot)}.` }); }
  }
  return out;
}

export function renderQuiz(root: HTMLElement, kind: 'quiz' | 'math', drillId: string): void {
  const seed = Date.now() % 1000;
  const cards = kind === 'quiz' ? trapCards(seed) : mathCards(seed);
  let i = 0, correct = 0;
  const page = el('div', { class: 'page quiz', style: 'max-width:760px' });
  const head = el('h1', {}, kind === 'quiz' ? `${drillId}: Trap quiz - which way?` : `${drillId}: Mental math`);
  const sub = el('p', { class: 'muted' });
  const box = el('div', { class: 'panel' });
  page.append(head, sub, box);
  const show = (): void => {
    const c = cards[i];
    if (!c) {
      const stars = correct >= 19 ? 3 : correct >= 16 ? 2 : correct >= 12 ? 1 : 0;
      app.progress.recordRun(drillId, { stars, aces: 0, score: 20 - correct });
      box.replaceChildren(el('h2', {}, `${correct} / 20 correct  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`), el('p', {}, stars === 3 ? 'Sharp. Take it to the cockpit.' : 'Re-run the deck until it is automatic: the car does not wait for second guesses.'));
      const again = el('button', { class: 'primary' }, 'Again'); again.onclick = () => renderQuiz(root, kind, drillId);
      const home = el('button', {}, 'Home'); home.onclick = () => { location.hash = '#/'; };
      box.append(el('div', { class: 'actions', style: 'display:flex;gap:8px' }, again, home));
      sub.textContent = ''; return;
    }
    sub.textContent = `Card ${i + 1} of 20 · ${correct} correct`;
    box.replaceChildren();
    if (c.svg) box.append(el('div', { html: c.svg, style: 'color:var(--text);margin-bottom:8px' }));
    box.append(el('p', { style: 'font-size:17px' }, c.prompt));
    const fb = el('p', {});
    c.options.forEach((o, k) => {
      const b = el('button', { class: 'opt' }, o);
      b.onclick = () => {
        if (fb.textContent) return;
        if (k === c.answer) { correct++; b.classList.add('right'); fb.textContent = `Right. ${c.tip}`; fb.className = 'ok'; }
        else { b.classList.add('wrong'); fb.textContent = `No: ${c.options[c.answer]}. ${c.tip}`; fb.className = 'danger'; }
        const next = el('button', { class: 'primary' }, 'Next'); next.onclick = () => { i++; show(); }; box.append(next);
      };
      box.append(b);
    });
    box.append(fb);
  };
  show();
  root.replaceChildren(page);
}
