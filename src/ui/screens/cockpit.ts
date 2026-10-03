/** Cockpit (UI-009..UI-013): road view, instruments, GRIID book, lapboard drawer, keyboard, adaptive time scale, audio. */
import { Simulator, type Observation, type Action, type DriverMessage, type StageResult } from '../../core/sim.js';
import type { Scenario, Instruction, Node } from '../../core/course.js';
import { stopLoss, dwellFor, rampLead } from '../../core/perf-table.js';
import { formatClock, formatElapsed } from '../../core/units.js';
import { allDrills } from '../../core/drills/index.js';
import { stopwatchViewModel } from '../viewmodels/stopwatch.js';
import { clockViewModel } from '../viewmodels/clock.js';
import { speedoViewModel } from '../viewmodels/speedo.js';
import { cameoSvg } from '../viewmodels/cameo.js';
import { bookRows } from '../viewmodels/book.js';
import { effectiveScale, simAdvance, nextScale, SCALE_STEPS } from '../viewmodels/timescale.js';
import { KeyMapper, KEY_HELP, type KeyCommand } from '../viewmodels/keys.js';
import { audioCues, AudioPlayer } from '../viewmodels/audio.js';
import { createAnnotations, HIGHLIGHTS, type Highlight } from '../viewmodels/annotations.js';
import { cockpitLayout } from '../viewmodels/layout.js';
import { cpCards, aidsRung, debriefViewModel, type CpCard } from '../viewmodels/debrief.js';
import { drawStopwatch } from '../render/stopwatch.js';
import { drawClock } from '../render/clock.js';
import { drawSpeedo } from '../render/speedo.js';
import { drawRoad } from '../render/road.js';
import { prepare, themeFromCss } from '../render/common.js';
import { app, buildScenario, withDriver, el, escapeHtml, type RunSource, type Run } from '../state.js';

declare global { interface Window { __rally?: { sim: Simulator; advance(seconds: number): Observation; act(a: Action): Observation; observe(): Observation; result(): StageResult; finish(): void } } }

export function renderCockpit(root: HTMLElement, src: RunSource): () => void {
  let drills: ReturnType<typeof allDrills> = []; try { drills = allDrills(); } catch { drills = []; }
  const built = buildScenario(src, drills);
  if (!built) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Scenario not found'), el('p', {}, 'That drill or scenario does not exist. ', el('a', { href: '#/' }, 'Back to Home')))); return () => undefined; }
  const scenario = withDriver(built.scenario, app.settings.driverSkill);
  const watch = app.settings.watch;
  let sim: Simulator;
  try { sim = new Simulator(scenario, { watch }); } catch (e) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Could not start the simulator'), el('p', { class: 'danger' }, String((e as Error).message)))); return () => undefined; }
  const drill = built.drill;
  const run: Run = { source: src, scenario, sim, drill, result: null, scaleMax: 1, watch, annotations: null };
  app.run = run;
  const lockedTo1x = drill?.id === 'D01' || drill?.id === 'D03';
  const ann = createAnnotations();
  const keys = new KeyMapper();
  const audio = new AudioPlayer(app.settings.muted);
  const nodes = new Map<string, Node>(); for (const n of scenario.course.nodes) nodes.set(n.id, n);
  const speeds = speedsBefore(scenario.book);

  // ---------- DOM ----------
  const L = cockpitLayout(root.clientWidth || window.innerWidth, (window.innerHeight || 800) - 45);
  const cockpit = el('div', { class: 'cockpit', id: 'cockpit' }); cockpit.style.setProperty('--book-w', `${L.book.w}px`); cockpit.style.setProperty('--road-h', `${Math.round(L.roadFraction * 100)}%`);
  const roadCanvas = el('canvas', { id: 'road' }); const roadWrap = el('div', { class: 'road' }, roadCanvas);
  const hud = el('div', { class: 'hud' }); roadWrap.append(hud);
  const chipPhase = el('span', { class: 'chip', id: 'phase' }); const chipScale = el('span', { class: 'chip', id: 'scale' }); const chipClock = el('span', { class: 'chip mono', id: 'tod' }); const chipLeg = el('span', { class: 'chip' }); const chipMsg = el('span', { class: 'chip alert', id: 'alert' }); chipMsg.style.display = 'none';
  const scaleBtns = el('span', { class: 'chip' });
  for (const s of SCALE_STEPS) { const b = el('button', { 'data-scale': String(s), style: 'padding:1px 6px;margin-left:3px;font-size:12px' }, `${s}x`); b.onclick = () => { requested = s; }; scaleBtns.append(b); }
  const pauseBtn = el('button', { id: 'pause', style: 'padding:1px 6px;margin-left:3px;font-size:12px' }, 'Pause'); pauseBtn.onclick = () => { paused = !paused; }; scaleBtns.append(pauseBtn);
  const helpBtn = el('button', { style: 'padding:1px 6px;margin-left:3px;font-size:12px' }, 'Keys'); helpBtn.onclick = () => { showHelp = !showHelp; helpBox.style.display = showHelp ? '' : 'none'; }; scaleBtns.append(helpBtn);
  const muteBtn = el('button', { style: 'padding:1px 6px;margin-left:3px;font-size:12px' }, app.settings.muted ? 'Unmute' : 'Mute'); muteBtn.onclick = () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute'; }; scaleBtns.append(muteBtn);
  const abortBtn = el('button', { class: 'danger', style: 'padding:1px 6px;margin-left:3px;font-size:12px' }, 'End run'); abortBtn.onclick = () => { if (confirm('End this run now and go to the debrief?')) { try { sim.act({ type: 'abort' } as Action); } catch { /* older engine */ } finish(); } }; scaleBtns.append(abortBtn);
  hud.append(chipPhase, chipClock, chipLeg, chipScale, scaleBtns, chipMsg);
  const helpBox = el('div', { class: 'help' }); for (const k of KEY_HELP) helpBox.append(el('div', { html: `<kbd>${escapeHtml(k.keys)}</kbd> ${escapeHtml(k.does)}` })); let showHelp = app.settings.showHelp; helpBox.style.display = showHelp ? '' : 'none'; roadWrap.append(helpBox);
  const cpCardBox = el('div', { class: 'cpcard', id: 'cpcard' }); cpCardBox.style.display = 'none'; roadWrap.append(cpCardBox);
  const preread = el('div', { class: 'preread', id: 'preread' }); roadWrap.append(preread);

  const clockCanvas = el('canvas', { id: 'clock' }); const swCanvas = el('canvas', { id: 'stopwatch' }); const spCanvas = el('canvas', { id: 'speedo' });
  const clockCap = el('div', { class: 'caption' }); const swCap = el('div', { class: 'caption' }); const spCap = el('div', { class: 'caption' }); const laps = el('div', { class: 'laps', id: 'laps' });
  const instruments = el('div', { class: 'instruments' },
    el('div', { class: 'instrument' }, clockCanvas, clockCap),
    el('div', { class: 'instrument' }, swCanvas, swCap, laps),
    el('div', { class: 'instrument' }, spCanvas, spCap));
  const left = el('div', { class: 'left' }, roadWrap, instruments);
  const bookHead = el('div', { class: 'book-head' }, el('b', {}, 'GRIID'), el('span', { class: 'muted' }, `${scenario.name} · ${scenario.book.length} lines · N / Shift+N move, click to set`));
  const rows = el('div', { class: 'rows', id: 'book' });
  const book = el('div', { class: 'book' }, bookHead, rows);
  // drawer
  const callout = el('span', { class: 'callout', id: 'callout' });
  const promptWrap = el('span', { id: 'prompt' });
  const notesBox = el('div', { class: 'box' }, el('h4', {}, 'Lapboard notes'));
  const noteInput = el('input', { type: 'text', placeholder: 'note… Enter to keep', style: 'width:100%' }) as HTMLInputElement;
  noteInput.onkeydown = e => { if (e.key === 'Enter' && noteInput.value.trim()) { act({ type: 'note', text: noteInput.value.trim() }); noteInput.value = ''; } if (e.key === 'Escape') noteInput.blur(); e.stopPropagation(); };
  const notesList = el('div', { class: 'mono', style: 'font-size:12px' }); notesBox.append(noteInput, notesList);
  const cardBox = el('div', { class: 'box' }, el('h4', {}, 'Perf card for the next line')); const cardBody = el('div', {}); cardBox.append(cardBody);
  const ledgerBox = el('div', { class: 'box' }, el('h4', {}, 'Ledger (E) and time allowance (T)')); const ledgerBody = el('div', {}); ledgerBox.append(ledgerBody);
  const logBox = el('div', { class: 'box log' }, el('h4', {}, 'Driver')); const logBody = el('div', { id: 'driverlog' }); logBox.append(logBody);
  const drawer = el('div', { class: 'drawer' },
    el('div', { class: 'bar' }, el('span', { class: 'muted' }, 'Callout:'), callout, promptWrap, el('span', { class: 'muted', style: 'margin-left:auto' }, `${scenario.car.name} · ${scenario.driver.name} (${scenario.driver.skill}) · ${scenario.speedo.kind} speedo · aids rung ${aidsRung(scenario.aids)}`)),
    el('div', { class: 'lapboard' }, ledgerBox, cardBox, notesBox, logBox));
  cockpit.append(left, book, drawer);
  root.replaceChildren(cockpit);

  // ---------- state ----------
  let requested = lockedTo1x ? 1 : (app.settings.timeScale || 1);
  let paused = false;
  let last = performance.now();
  let raf = 0; let alive = true;
  let obs: Observation = sim.observe();
  let prevObs: Observation | null = null;
  const driverLog: DriverMessage[] = [];
  let lastBookKey = ''; let lastExecuted: number | null = null;
  let seenEvents = sim.events.length; let activeCard: CpCard | null = null;
  let finished = false;
  let flashUntil = 0;
  const theme = themeFromCss();

  function act(a: Action): void { try { sim.act(a); } catch (e) { flash(String((e as Error).message)); } }
  function flash(msg: string): void { chipMsg.textContent = msg; chipMsg.style.display = ''; flashUntil = performance.now() + 2500; }

  // ---------- keyboard ----------
  function onKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const cmd = keys.keydown(e);
    if (!cmd) { if (e.key === ' ') e.preventDefault(); return; }
    e.preventDefault();
    handle(cmd);
  }
  function onKeyUp(e: KeyboardEvent): void { keys.keyup(e); }
  function handle(cmd: KeyCommand): void {
    switch (cmd.type) {
      case 'watch.toggle': act({ type: 'watch.toggle' }); break;
      case 'watch.lap': act({ type: 'watch.lap' }); break;
      case 'watch.reset': { const before = sim.observe().stopwatch.reading; act({ type: 'watch.reset' }); if (sim.observe().stopwatch.running && before > 0) flash('Analog crown: stop the watch before resetting'); else { swCanvas.classList.add('flash'); setTimeout(() => swCanvas.classList.remove('flash'), 600); } break; }
      case 'bezel': act({ type: 'watch.bezel', seconds: (obs.stopwatch.bezel ?? 0) + cmd.delta }); break;
      case 'call.turn': act({ type: 'call.turn', dir: cmd.dir }); break;
      case 'call.go': if (sim.phase === 'preread') act({ type: 'start' }); else act({ type: 'call.go' }); break;
      case 'call.stop': act({ type: 'call.stop' }); break;
      case 'call.uturn': act({ type: 'call.uturn' }); break;
      case 'call.pass': act({ type: 'call.pass' }); break;
      case 'depart': act({ type: 'start' }); break;
      case 'call.speed': act({ type: 'call.speed', mph: cmd.mph }); break;
      case 'nudge': { const cur = obs.driver.targetIndicated ?? speeds.get(obs.currentLine)?.vOut ?? 30; act({ type: 'call.speed', mph: Math.max(5, Math.round((cur + cmd.delta) * 10) / 10) }); break; }
      case 'line': act({ type: 'line.set', n: Math.max(1, Math.min(scenario.book.length, obs.currentLine + cmd.delta)) }); break;
      case 'line.home': act({ type: 'line.set', n: 1 }); break;
      case 'line.end': act({ type: 'line.set', n: scenario.book.length }); break;
      case 'scale': if (!lockedTo1x) requested = nextScale(requested, cmd.delta); break;
      case 'pause': paused = !paused; break;
      case 'ta': promptFor('Time allowance (seconds)', v => act({ type: 'ta.declare', seconds: v })); break;
      case 'ledger': promptFor('Ledger: seconds late (+) / early (-)', v => act({ type: 'ledger.set', seconds: v })); break;
      case 'buffer': break;
    }
    renderNow();
  }
  function promptFor(labelText: string, cb: (v: number) => void): void {
    const inp = el('input', { type: 'text', inputmode: 'decimal', placeholder: labelText, style: 'width:260px' }) as HTMLInputElement;
    inp.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = Number(inp.value.replace(',', '.')); if (Number.isFinite(v)) cb(v); promptWrap.replaceChildren(); root.focus(); renderNow(); }
      if (e.key === 'Escape') { promptWrap.replaceChildren(); root.focus(); }
    };
    promptWrap.replaceChildren(inp); inp.focus();
  }
  document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

  // ---------- book ----------
  rows.onclick = e => { const r = (e.target as HTMLElement).closest('.row') as HTMLElement | null; if (r && !(e.target as HTMLElement).closest('input,button')) { act({ type: 'line.set', n: Number(r.dataset.n) }); renderNow(); } };
  function renderBook(o: Observation): void {
    const key = `${o.currentLine}|${o.driver.lastExecutedLine ?? ''}|${o.phase}|${ann.serialize().length}|${Object.keys(o.annotations ?? {}).length}`;
    if (key === lastBookKey) return; lastBookKey = key; lastExecuted = o.driver.lastExecutedLine ?? lastExecuted;
    const frag = document.createDocumentFragment();
    for (const r of bookRows(scenario.book, o.currentLine)) {
      const ins = scenario.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      const hls = ann.highlights(r.n);
      const row = el('div', { class: `row ${r.state}${lastExecuted !== null && r.n <= lastExecuted ? ' executed' : ''} ${hls.map(h => `hl-${h}`).join(' ')}`, 'data-n': String(r.n) });
      const svg = node?.exits ? cameoSvg(node.exits, node.control, ins?.turn ?? null, 64) : node?.sign || node?.control && node.control !== 'none' ? cameoSvg([{ angle: 0, kind: 'road', isRoute: true }], node.control, 'S', 64) : '';
      row.append(el('div', { class: 'n' }, String(r.n)), el('div', { class: 'cameo', html: svg }),
        el('div', { class: 'text' }, r.colB ? el('span', { class: 'colb' }, r.colB) : null, r.text, r.colD ? el('span', { class: 'cold' }, r.colD) : null, o.aids.cumulativePerfectAtNextLine !== undefined && r.isCurrent ? el('span', { class: 'cold accent' }, `perfect cumulative ${formatElapsed(o.aids.cumulativePerfectAtNextLine, 0)}`) : null, r.perfectCumulative !== undefined ? el('span', { class: 'cold' }, `Col C perfect: ${formatElapsed(r.perfectCumulative, 0)}`) : null),
        el('div', { class: 'colc' }, r.colC));
      // annotation strip: highlighters + GO-time for pause lines (UI-013)
      const strip = el('div', { class: 'ann' });
      for (const h of HIGHLIGHTS) { const b = el('button', { class: `hl-btn ${h}`, title: `highlight ${h}` }); b.onclick = ev => { ev.stopPropagation(); ann.toggleHighlight(r.n, h as Highlight); lastBookKey = ''; renderBook(sim.observe()); }; strip.append(b); }
      if (r.pause) {
        const go = el('input', { class: 'go-time', placeholder: 'GO at', value: ann.goTime(r.n) || (o.annotations?.[r.n] ?? '') }) as HTMLInputElement;
        go.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') go.blur(); };
        go.onchange = () => { ann.setGoTime(r.n, go.value); try { sim.act({ type: 'line.annotate', n: r.n, text: go.value } as Action); } catch { /* older engine */ } };
        strip.append(el('span', { class: 'muted' }, 'P' + r.pause), go);
        const sp = speeds.get(r.n); if (sp && sp.vOut && scenario.car) { try { const d = dwellFor(r.pause, sp.vIn ?? sp.vOut, sp.vOut, scenario.car); strip.append(el('span', { class: 'muted', title: 'card dwell = pause - stop/start loss' }, `card ${d.toFixed(1)} s`)); } catch { /* ignore */ } }
      }
      row.append(strip); frag.append(row);
    }
    rows.replaceChildren(frag);
    const cur = rows.querySelector('.row.current') as HTMLElement | null; if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ---------- render ----------
  function renderNow(): void { obs = sim.observe(); for (const m of obs.driver.messages) driverLog.push(m); draw(obs); }
  function draw(o: Observation): void {
    const w = roadWrap.clientWidth || L.road.w, h = roadWrap.clientHeight || L.road.h;
    const rctx = prepare(roadCanvas, w, h);
    const lastLine = driverLog.length ? driverLog[driverLog.length - 1]! : null;
    const pending = o.driver.pendingTurn ? `turn ${o.driver.pendingTurn}` : keys.buffer ? `speed ${keys.buffer}…` : null;
    if (rctx) drawRoad(rctx, o, w, h, theme, { pendingCallout: pending, driverLine: lastLine ? lastLine.text : null, pace: o.aids.earlyLate ?? null, countdown: o.aids.countdown ?? null, offCourseHint: o.offCourseHint });
    // instruments
    const instH = instruments.clientHeight || L.instruments.h; const instW = instruments.clientWidth || L.instruments.w;
    const lay = cockpitLayout(instW + L.book.w, instH / (1 - L.roadFraction) + 44);
    const swSize = Math.max(240, Math.min(lay.stopwatch.dial, instH - 70)); const clSize = Math.min(lay.clock.dial, instH - 30); const spSize = Math.min(lay.speedo.dial, instH - 30);
    const sw = o.stopwatch;
    const swVm = stopwatchViewModel(sw.reading, sw.kind, { dialSeconds: sw.dialSeconds === 30 ? 30 : 60, registerMinutes: 30, bezel: sw.bezel, running: sw.running, laps: sw.laps });
    const sctx = prepare(swCanvas, swSize, swSize); if (sctx) drawStopwatch(sctx, swVm, swSize, theme);
    swCap.innerHTML = `<b>${escapeHtml(swVm.digital)}</b> ${sw.running ? '<span class="ok">running</span>' : 'stopped'} · bezel ${escapeHtml(sw.bezel.toFixed(1))} s (${escapeHtml(sw.bezelRemaining.toFixed(1))} to go)`;
    laps.replaceChildren(...swVm.lapRows.flatMap((r, i) => [el('span', { class: i === 0 ? 'cur' : '' }, `L${r.n}`), el('span', { class: i === 0 ? 'cur' : '' }, r.text), el('span', {}, `+${r.split}`)]));
    const cvm = clockViewModel(o.tod, o.bezel);
    const cctx = prepare(clockCanvas, clSize, clSize); if (cctx) drawClock(cctx, cvm, clSize, theme);
    clockCap.innerHTML = `<b>${escapeHtml(cvm.digital)}</b> · start ${escapeHtml(formatClock(o.startTime))}`;
    const svm = speedoViewModel(o.speedo.reading, 100);
    const pctx = prepare(spCanvas, spSize, spSize); if (pctx) drawSpeedo(pctx, svm, spSize, theme, o.driver.targetIndicated);
    spCap.innerHTML = `<b>${escapeHtml(svm.text)}</b> mph · ${o.driver.targetIndicated !== null ? `holding ${escapeHtml(String(o.driver.targetIndicated))}` : 'no speed called'}`;
    // HUD
    chipPhase.textContent = o.phase === 'preread' ? `PRE-READ · start in ${formatElapsed(Math.max(0, o.secondsToStart), 0)}` : o.phase === 'running' ? `${o.driver.state}` : 'FINISHED';
    chipPhase.className = `chip ${o.driver.waitingForGo ? 'warn' : o.phase === 'running' ? 'live' : ''}`;
    chipClock.textContent = cvm.digital;
    chipLeg.textContent = o.legIndex === null ? 'leg ?' : `leg ${o.legIndex}`;
    const scale = currentScale(o);
    chipScale.textContent = paused ? 'PAUSED' : `${scale}x${scale !== requested && !paused ? ` (asked ${requested}x)` : ''}${lockedTo1x ? ' locked' : ''}`;
    chipScale.className = `chip ${paused ? 'alert' : scale > 1 ? 'warn' : ''}`;
    scaleBtns.querySelectorAll('button[data-scale]').forEach(b => { (b as HTMLButtonElement).style.outline = Number((b as HTMLElement).dataset.scale) === requested ? '2px solid var(--accent)' : ''; });
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (flashUntil && performance.now() > flashUntil) { chipMsg.style.display = 'none'; flashUntil = 0; }
    // pre-read overlay
    if (o.phase === 'preread') {
      preread.style.display = '';
      if (!preread.firstChild) {
        const dep = el('button', { class: 'primary', id: 'depart' }, 'Depart now (D)'); dep.onclick = () => { act({ type: 'start' }); renderNow(); };
        const skip = el('button', { id: 'skip' }, 'Fast-forward to the start time'); skip.onclick = () => { act({ type: 'skipPreread' }); renderNow(); };
        preread.append(el('div', { class: 'box' }, el('h2', {}, 'Pre-read'), el('p', {}, `Official start ${formatClock(scenario.startTime)}. Read the book on the right: highlight pauses, write the GO time (pause minus the card loss) next to each one. The ghost leaves exactly on the second; your car loses about 4 s getting up to speed, so depart a few seconds early.`), el('div', { class: 'big', id: 'countdown' }), el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' }, dep, skip), el('p', { class: 'muted', style: 'margin-top:8px' }, 'Space starts the stopwatch; most navigators start it on the official second and run it as time-of-day all day.')));
      }
      const cd = preread.querySelector('#countdown'); if (cd) cd.textContent = `T ${o.secondsToStart >= 0 ? '-' : '+'} ${formatElapsed(Math.abs(o.secondsToStart), 1)}`;
    } else preread.style.display = 'none';
    // drawer
    callout.textContent = keys.buffer ? `${keys.buffer}_ (Enter calls it)` : o.driver.pendingTurn ? `turn ${o.driver.pendingTurn} pending` : o.driver.targetIndicated !== null ? `holding ${o.driver.targetIndicated}` : '-';
    if (keys.modifiers.length) callout.textContent += `  [${keys.modifiers.join('')}+arrow]`;
    ledgerBody.innerHTML = `<div>Ledger: <b class="mono">${o.ledger === null ? 'not set' : escapeHtml((o.ledger > 0 ? '+' : '') + o.ledger + ' s')}</b> <span class="muted">(E)</span></div><div class="muted">Hazard held you? Time it on the watch and press T to declare a TA before the checkpoint.</div>${o.aids.earlyLate !== undefined ? `<div>Pace aid: <b class="mono">${o.aids.earlyLate > 0 ? '+' : ''}${o.aids.earlyLate.toFixed(1)} s</b></div>` : ''}`;
    cardBody.innerHTML = perfCardHtml(o.currentLine);
    notesList.innerHTML = o.notes.slice(-4).map(n => `<div>· ${escapeHtml(n)}</div>`).join('');
    logBody.innerHTML = driverLog.slice(-6).map(m => `<div class="${m.kind === 'question' ? 'q' : ''}"><span class="muted mono">${escapeHtml(formatClock(m.tod))}</span> ${escapeHtml(m.text)}</div>`).join('') || '<div class="muted">Dad has not said anything yet.</div>';
    renderBook(o);
    // CP card (DEBRIEF-004)
    if (sim.events.length > seenEvents) {
      const fresh = sim.events.slice(seenEvents); seenEvents = sim.events.length;
      if (fresh.some(e => e.type === 'checkpoint' && e.detail?.kind === 'timing')) { try { const r = sim.result(); const cards = cpCards(r.events, r.attribution, scenario.aids, scenario); activeCard = cards[cards.length - 1] ?? null; } catch { activeCard = null; } }
    }
    if (activeCard && o.tod <= activeCard.showUntil) { cpCardBox.style.display = ''; cpCardBox.innerHTML = `Checkpoint ${escapeHtml(activeCard.cpId)}: <b>${activeCard.error > 0 ? '+' : ''}${activeCard.error}</b> s${activeCard.largestBucket ? `<div class="muted">largest: ${escapeHtml(activeCard.largestBucket)} ${activeCard.largestBucketSeconds > 0 ? '+' : ''}${activeCard.largestBucketSeconds} s${activeCard.largestEvent ? ` · ${escapeHtml(activeCard.largestEvent)}` : ''}</div>` : ''}`; }
    else cpCardBox.style.display = 'none';
  }
  function perfCardHtml(line: number): string {
    const ins = scenario.book[line - 1]; if (!ins) return '';
    const sp = speeds.get(line); const node = nodes.get(ins.nodeId);
    const parts: string[] = [`<div><b>Line ${line}</b>: ${escapeHtml(ins.text)}</div>`];
    try {
      if (ins.pause && sp?.vOut) { const vi = sp.vIn ?? sp.vOut; const loss = stopLoss(vi, sp.vOut, scenario.car); parts.push(`<div>Stop ${vi} in / ${sp.vOut} out: loss <b class="mono">${loss.toFixed(1)}</b> s → dwell <b class="mono">${Math.max(0, ins.pause - loss).toFixed(1)}</b> s after "Stopped" <span class="muted">(set the bezel with ] )</span></div>`); }
      else if (node?.control === 'STOP' && sp?.vOut) { const vi = sp.vIn ?? sp.vOut; parts.push(`<div>STOP without pause: loss ${stopLoss(vi, sp.vOut, scenario.car).toFixed(1)} s is yours to recover.</div>`); }
      if (ins.timed) { const lead = rampLead(ins.timed.holdSpeed, ins.timed.thenSpeed, scenario.car); parts.push(`<div>Timed: hold ${ins.timed.holdSpeed} for ${ins.timed.seconds} s, call ${ins.timed.thenSpeed} at <b class="mono">${(ins.timed.seconds - lead).toFixed(1)}</b> s (lead ${lead.toFixed(1)})</div>`); }
      else if (sp && sp.vIn !== null && sp.vOut !== null && sp.vIn !== sp.vOut && !ins.pause && node?.control !== 'STOP') { const lead = rampLead(sp.vIn, sp.vOut, scenario.car); parts.push(`<div>Speed ${sp.vIn} → ${sp.vOut}: call it <b class="mono">${lead.toFixed(1)}</b> s before the landmark (${Math.round(sp.vIn * 1.4667 * lead)} ft)</div>`); }
      if (ins.section === 'start' && ins.speed) parts.push(`<div>Standing start to ${ins.speed}: leave ~<b class="mono">${(stopLoss(ins.speed, ins.speed, scenario.car) * 0.55).toFixed(1)}</b> s early</div>`);
    } catch { /* ignore */ }
    return parts.join('');
  }
  function currentScale(o: Observation): number {
    const nearest = o.ahead.length ? Math.min(...o.ahead.map(f => f.approxDistanceFt)) : null;
    const hazard = o.ahead.some(f => f.kind === 'slow' || f.kind === 'construction' || f.gateDown || f.signalColor === 'red');
    return effectiveScale({ requested, paused, phase: o.phase, carStopped: o.carStopped, waitingForGo: o.driver.waitingForGo, nearestFeatureFt: nearest, hazardActive: hazard, countdownSeconds: o.aids.countdown ?? null, bezelRemaining: o.stopwatch.running ? o.stopwatch.bezelRemaining : null, lockedTo1x });
  }

  // ---------- loop ----------
  function frame(now: number): void {
    if (!alive) return;
    const dt = Math.min(1, (now - last) / 1000); last = now;
    const scale = currentScale(obs);
    const adv = simAdvance(dt, scale, 2);
    if (adv > 0) { try { sim.step(adv); } catch (e) { flash(`engine: ${(e as Error).message}`); } run.scaleMax = Math.max(run.scaleMax, scale); }
    prevObs = obs; renderNow();
    try { audio.play(audioCues(prevObs, obs, { muted: audio.muted, countdownAid: !!scenario.aids.countdown, speech: app.settings.speech })); } catch { /* ignore */ }
    if (sim.phase === 'finished' && !finished) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  function finish(): void {
    if (finished) return; finished = true;
    let result: StageResult | null = null; try { result = sim.result(); } catch { result = null; }
    run.result = result; run.annotations = ann.serialize();
    if (result) {
      app.lastResult = { run, result };
      try {
        const vm = debriefViewModel(result, scenario);
        let stars = 0; let score = result.score.raw;
        if (drill) { try { const rb = drill.rubric(result, scenario); stars = rb.stars; score = rb.score; } catch { stars = 0; } }
        else stars = result.score.raw <= 3 ? 3 : result.score.raw <= 13 ? 2 : result.score.raw <= 25 ? 1 : 0;
        const id = drill ? drill.id : `builtin:${src.kind === 'builtin' ? src.name : ''}`;
        app.progress.recordRun(id, { stars, aces: result.score.aces, score, scale: run.scaleMax, errors: vm.bias.errors });
      } catch { /* progress is best effort */ }
    }
    cleanup();
    setTimeout(() => { location.hash = '#/debrief'; }, 0);
  }
  function cleanup(): void { alive = false; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); }

  window.__rally = {
    sim,
    advance(seconds: number) { const s = Math.max(0, Number(seconds) || 0); let left = s; while (left > 0 && sim.phase !== 'finished') { const d = Math.min(60, left); sim.step(d); left -= d; } renderNow(); if (sim.phase === 'finished') finish(); return obs; },
    act(a: Action) { act(a); renderNow(); return obs; },
    observe: () => sim.observe(),
    result: () => sim.result(),
    finish,
  };
  renderNow();
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return () => { cleanup(); if (window.__rally?.sim === sim) delete window.__rally; };
}

/** Assigned speed before/after each line (line number -> speeds). */
function speedsBefore(book: Instruction[]): Map<number, { vIn: number | null; vOut: number | null }> {
  const m = new Map<number, { vIn: number | null; vOut: number | null }>(); let v: number | null = null;
  for (const ins of book) { const vIn = v; if (ins.timed) v = ins.timed.holdSpeed; else if (typeof ins.speed === 'number') v = ins.speed; m.set(ins.n, { vIn, vOut: v }); if (ins.timed) v = ins.timed.thenSpeed; }
  return m;
}
export type { Scenario };
