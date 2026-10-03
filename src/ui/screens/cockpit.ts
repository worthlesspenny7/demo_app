/** Cockpit (UI-009..UI-013): road view, instruments, GRIID book, lapboard drawer, keyboard, adaptive time scale, audio. */
import { Simulator, type Observation, type Action, type DriverMessage, type StageResult } from '../../core/sim.js';
import type { Scenario, Node } from '../../core/course.js';
import { accelLoss } from '../../core/perf-table.js';
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
import { cpCards, debriefViewModel, type CpCard } from '../viewmodels/debrief.js';
import { instrumentPolicy, perfCardFor, stopCardFor, cardDwell, waitMore, restartLabel, restartLines, focusLine, lineSpeeds, type PerfCard, type StopCard } from '../viewmodels/cockpitinfo.js';
import { drillHint, hintBarText } from '../viewmodels/hints.js';
import { LIVE_KEY, LAST_KEY, snapshotRun, saveStored, loadStored, clearStored, restoreSim, type StoredSource } from '../viewmodels/resume.js';
import { recordCampaignStage } from '../viewmodels/campaign.js';
import { drawStopwatch } from '../render/stopwatch.js';
import { drawClock } from '../render/clock.js';
import { drawSpeedo } from '../render/speedo.js';
import { drawRoad } from '../render/road.js';
import { prepare, themeFromCss } from '../render/common.js';
import { app, buildScenario, withDriver, el, escapeHtml, type RunSource, type Run, type Settings } from '../state.js';

declare global { interface Window { __rally?: { sim: Simulator; advance(seconds: number): Observation; act(a: Action): Observation; observe(): Observation; result(): StageResult; finish(): void } } }

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const sameSource = (a: StoredSource, b: RunSource): boolean => a.kind === b.kind && (a.kind === 'drill' ? b.kind === 'drill' && a.drillId === b.drillId && a.tier === b.tier && a.seed === b.seed : b.kind === 'builtin' && a.name === b.name && a.seed === b.seed);

export function renderCockpit(root: HTMLElement, src: RunSource): () => void {
  let drills: ReturnType<typeof allDrills> = []; try { drills = allDrills(); } catch { drills = []; }
  const built = buildScenario(src, drills);
  if (!built) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Scenario not found'), el('p', {}, 'That drill or scenario does not exist. ', el('a', { href: '#/' }, 'Back to Home')))); return () => undefined; }
  // resume a saved live run when Home asked for it (the saved spec carries the driver and watch it started with)
  const saved = app.resume ? loadStored(LIVE_KEY) : null; app.resume = false;
  const resuming = saved && sameSource(saved.source, src) ? saved : null;
  const driverSkill = (resuming?.driverSkill ?? app.settings.driverSkill) as Settings['driverSkill'];
  const scenario = withDriver(built.scenario, driverSkill);
  const watch = resuming?.watch ?? app.settings.watch;
  let sim: Simulator; let startNote = '';
  try {
    if (resuming) { try { sim = restoreSim(scenario, resuming); startNote = 'Resumed your saved run.'; } catch (e) { startNote = `Could not restore the saved run (${(e as Error).message}); started the same seed again.`; sim = new Simulator(scenario, { watch }); } }
    else sim = new Simulator(scenario, { watch });
  } catch (e) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Could not start the simulator'), el('p', { class: 'danger' }, String((e as Error).message)))); return () => undefined; }
  const drill = built.drill;
  const run: Run = { source: src, scenario, sim, drill, result: null, scaleMax: resuming?.scaleMax ?? 1, watch, annotations: null };
  app.run = run;
  const lockedTo1x = drill?.id === 'D01' || drill?.id === 'D03';
  const policy = instrumentPolicy(scenario.aids);
  const rung = policy.rung;
  const bookLen = scenario.book.length;
  const hint = drillHint(drill?.id ?? null);
  const objective = drill ? drill.objective : scenario.name;
  const ann = createAnnotations(resuming?.annotations ?? undefined);
  const keys = new KeyMapper();
  const audio = new AudioPlayer(app.settings.muted);
  const nodes = new Map<string, Node>(); for (const n of scenario.course.nodes) nodes.set(n.id, n);
  const hasCal = scenario.book.some(i => i.section === 'calibration') || drill?.id === 'D07';
  const stopCache = new Map<number, StopCard | null>();
  const cachedStop = (line: number): StopCard | null => { if (!stopCache.has(line)) stopCache.set(line, stopCardFor(scenario, line)); return stopCache.get(line) ?? null; };
  const cardCache = new Map<number, PerfCard | null>();
  const cachedCard = (line: number): PerfCard | null => { if (!cardCache.has(line)) cardCache.set(line, perfCardFor(scenario, line, policy)); return cardCache.get(line) ?? null; };

  // ---------- DOM ----------
  const cockpit = el('div', { class: 'cockpit', id: 'cockpit' });
  const sizeCockpit = (): void => {
    const L = cockpitLayout(root.clientWidth || window.innerWidth, (window.innerHeight || 800) - 46);
    cockpit.style.setProperty('--book-w', `${L.book.w}px`);
    const short = (window.innerHeight || 800) < 820;
    cockpit.style.setProperty('--road-h', `${short ? 42 : Math.round(L.roadFraction * 100)}%`);
    cockpit.classList.toggle('compact', short);
  };
  sizeCockpit();
  const roadCanvas = el('canvas', { id: 'road' }); const roadWrap = el('div', { class: 'road' }, roadCanvas);
  const hud = el('div', { class: 'hud' }); roadWrap.append(hud);
  const chipPhase = el('span', { class: 'chip', id: 'phase' }); const chipScale = el('span', { class: 'chip', id: 'scale' }); const chipClock = el('span', { class: 'chip mono', id: 'tod' }); const chipLeg = el('span', { class: 'chip' }); const chipMsg = el('span', { class: 'chip alert', id: 'alert' }); chipMsg.style.display = 'none';
  if (!policy.digitalReadouts) chipClock.style.display = 'none';
  const scaleBtns = el('span', { class: 'chip btns' });
  for (const s of SCALE_STEPS) { const b = el('button', { 'data-scale': String(s) }, `${s}x`); b.onclick = () => { requested = s; }; scaleBtns.append(b); }
  const pauseBtn = el('button', { id: 'pause' }, 'Pause'); pauseBtn.onclick = () => { paused = !paused; }; scaleBtns.append(pauseBtn);
  const helpBtn = el('button', {}, 'Keys'); helpBtn.onclick = () => { showHelp = !showHelp; helpBox.style.display = showHelp ? '' : 'none'; }; scaleBtns.append(helpBtn);
  const muteBtn = el('button', {}, app.settings.muted ? 'Unmute' : 'Mute'); muteBtn.onclick = () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute'; }; scaleBtns.append(muteBtn);
  const abortBtn = el('button', { class: 'danger', id: 'abort' }, 'End run'); abortBtn.onclick = () => { if (confirm('End this run now and go to the debrief? An ended run is not recorded.')) { try { sim.act({ type: 'abort' } as Action); } catch { /* older engine */ } finish(); } }; scaleBtns.append(abortBtn);
  hud.append(chipPhase, chipClock, chipLeg, chipScale, scaleBtns, chipMsg);
  const helpBox = el('div', { class: 'help' }); for (const k of KEY_HELP) helpBox.append(el('div', { html: `<kbd>${escapeHtml(k.keys)}</kbd> ${escapeHtml(k.does)}` })); let showHelp = app.settings.showHelp; helpBox.style.display = showHelp ? '' : 'none'; roadWrap.append(helpBox);
  const cpCardBox = el('div', { class: 'cpcard', id: 'cpcard' }); cpCardBox.style.display = 'none'; roadWrap.append(cpCardBox);
  const preread = el('div', { class: 'preread', id: 'preread' });

  const clockCanvas = el('canvas', { id: 'clock' }); const swCanvas = el('canvas', { id: 'stopwatch' }); const spCanvas = el('canvas', { id: 'speedo' });
  const clockCap = el('div', { class: 'caption' }); const swCap = el('div', { class: 'caption' }); const spCap = el('div', { class: 'caption' }); const laps = el('div', { class: 'laps', id: 'laps' });
  const instruments = el('div', { class: 'instruments' },
    el('div', { class: 'instrument' }, clockCanvas, clockCap),
    el('div', { class: 'instrument' }, swCanvas, swCap, laps),
    el('div', { class: 'instrument' }, spCanvas, spCap));
  const left = el('div', { class: 'left' }, roadWrap, instruments, preread);
  const hintBar = el('div', { class: 'hintbar', id: 'hintbar', title: 'objective and the keys that matter' }, el('b', {}, drill ? `${drill.id}: ` : ''), hintBarText(objective, hint));
  const bookHead = el('div', { class: 'book-head' }, el('b', {}, 'GRIID'), el('span', { class: 'muted' }, `${scenario.name} · ${scenario.book.length} lines · N / Shift+N move, click to set`));
  const rows = el('div', { class: 'rows', id: 'book' });
  const book = el('div', { class: 'book' }, bookHead, rows);
  // drawer
  const callout = el('span', { class: 'callout', id: 'callout' });
  const promptWrap = el('span', { id: 'prompt' });
  const notesBox = el('div', { class: 'box' }, el('h4', {}, 'Lapboard notes'));
  const noteInput = el('input', { type: 'text', placeholder: 'note… Enter to keep', style: 'width:100%' }) as HTMLInputElement;
  noteInput.onkeydown = e => {
    if (e.key === 'Enter') { if (noteInput.value.trim()) { act({ type: 'note', text: noteInput.value.trim() }); noteInput.value = ''; } noteInput.blur(); }
    if (e.key === 'Escape') noteInput.blur();
    e.stopPropagation();
  };
  const notesList = el('div', { class: 'mono', style: 'font-size:12px' }); notesBox.append(noteInput, notesList);
  const cardTitle = el('h4', {}, 'Perf card'); const cardBox = el('div', { class: 'box', id: 'perfcard' }, cardTitle); const cardBody = el('div', {}); cardBox.append(cardBody);
  const ledgerBox = el('div', { class: 'box' }, el('h4', {}, 'Ledger (E) and time allowance (T)')); const ledgerBody = el('div', {}); ledgerBox.append(ledgerBody);
  const logBox = el('div', { class: 'box log' }, el('h4', {}, 'Driver')); const logBody = el('div', { id: 'driverlog' }); logBox.append(logBody);
  const lapboard = el('div', { class: `lapboard${hasCal ? ' with-cal' : ''}` }, ledgerBox, cardBox, notesBox, logBox);
  if (hasCal) lapboard.append(calibrationBox());
  const drawer = el('div', { class: 'drawer' },
    el('div', { class: 'bar' }, el('span', { class: 'muted' }, 'Callout:'), callout, promptWrap, el('span', { class: 'muted', style: 'margin-left:auto' }, `${scenario.car.name} · ${scenario.driver.name} (${scenario.driver.skill}) · ${scenario.speedo.kind} speedo · aids rung ${rung}${rung <= 1 ? ' (legal: no digital readouts)' : ''}`)),
    lapboard);
  cockpit.append(hintBar, left, book, drawer);
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
  let followedExec: number | null = null;
  let stopWaitTod: number | null = null;
  let lastSave = performance.now();
  const theme = themeFromCss();
  if (startNote) setTimeout(() => flash(startNote), 0);

  function act(a: Action): void { try { sim.act(a); } catch (e) { flash(String((e as Error).message)); } }
  function flash(msg: string): void { chipMsg.textContent = msg; chipMsg.style.display = ''; flashUntil = performance.now() + 3500; }

  // ---------- calibration controls (D07: speedo.setFactor and card.set) ----------
  function calibrationBox(): HTMLElement {
    const box = el('div', { class: 'box cal', id: 'calbox' }, el('h4', {}, 'Calibration: factor and cheat card'));
    const k = el('input', { type: 'number', step: '0.001', min: '0.8', max: '1.25', value: '1.000', id: 'cal-k', title: 'k = perfect time / your time' }) as HTMLInputElement; k.style.width = '78px';
    const setK = el('button', { id: 'cal-setk' }, 'Set factor'); const timewise = scenario.speedo.kind === 'timewise'; if (!timewise) { setK.setAttribute('disabled', ''); k.setAttribute('disabled', ''); }
    setK.onclick = () => { const v = Number(k.value); if (Number.isFinite(v) && v > 0) { act({ type: 'speedo.setFactor', k: v }); flash(`Timewise factor set to ${v.toFixed(3)}`); } };
    box.append(el('div', {}, el('span', { class: 'muted' }, 'Timewise k = perfect / actual: '), k, setK, timewise ? null : el('span', { class: 'muted' }, ' (stock speedo: use the card)')));
    const cardRow = el('div', { class: 'cardrow' }, el('span', { class: 'muted' }, 'Card: call → hold'));
    const inputs = new Map<number, HTMLInputElement>();
    for (const v of [25, 30, 35, 40, 45, 50]) { const i = el('input', { type: 'number', step: '0.1', placeholder: String(v), title: `indicated speed to hold when you want a true ${v}`, 'data-v': String(v) }) as HTMLInputElement; inputs.set(v, i); cardRow.append(el('label', {}, el('span', {}, String(v)), i)); }
    const setC = el('button', { id: 'cal-setcard' }, 'Set card');
    setC.onclick = () => {
      const card: Record<string, number> = {};
      for (const [v, i] of inputs) { const n = Number(i.value); if (i.value !== '' && Number.isFinite(n) && n > 0 && n <= 80) card[String(v)] = n; }
      if (!Object.keys(card).length) { flash('Fill in at least one card entry'); return; }
      ann.setCard(card); act({ type: 'card.set', card }); flash(`Card set (${Object.keys(card).length} speeds): calls are now mapped through it`);
    };
    cardRow.append(setC); box.append(cardRow);
    for (const i of [k, ...inputs.values()]) i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') i.blur(); };
    return box;
  }

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
      case 'watch.reset': { const before = sim.observe({ peek: true }).stopwatch.reading; act({ type: 'watch.reset' }); if (sim.observe({ peek: true }).stopwatch.running && before > 0) flash('Analog crown: stop the watch before resetting'); else { swCanvas.classList.add('flash'); setTimeout(() => swCanvas.classList.remove('flash'), 600); } break; }
      case 'bezel': act({ type: 'watch.bezel', seconds: (obs.stopwatch.bezel ?? 0) + cmd.delta }); break;
      case 'call.turn': act({ type: 'call.turn', dir: cmd.dir }); break;
      case 'call.go': if (sim.phase === 'preread') act({ type: 'start' }); else act({ type: 'call.go' }); break;
      case 'call.stop': act({ type: 'call.stop' }); break;
      case 'call.uturn': act({ type: 'call.uturn' }); break;
      case 'call.pass': act({ type: 'call.pass' }); break;
      case 'depart': act({ type: 'start' }); break;
      case 'call.speed': act({ type: 'call.speed', mph: cmd.mph }); break;
      case 'nudge': { const cur = obs.driver.targetIndicated ?? lineSpeeds(scenario, obs.currentLine).vOut ?? 30; act({ type: 'call.speed', mph: Math.max(5, Math.round((cur + cmd.delta) * 10) / 10) }); break; }
      case 'line':
        // at a STOP, N jumps to the stopped line first (C1)
        if (cmd.delta > 0 && obs.stoppedAtLine && obs.currentLine !== obs.stoppedAtLine) act({ type: 'line.set', n: obs.stoppedAtLine });
        else act({ type: 'line.set', n: Math.max(1, Math.min(bookLen, obs.currentLine + cmd.delta)) });
        break;
      case 'line.home': act({ type: 'line.set', n: 1 }); break;
      case 'line.end': act({ type: 'line.set', n: bookLen }); break;
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
      if (e.key === 'Enter') { const v = Number(inp.value.replace(',', '.')); if (inp.value.trim() !== '' && Number.isFinite(v)) cb(v); else flash('Not a number: nothing set'); promptWrap.replaceChildren(); root.focus(); renderNow(); }
      if (e.key === 'Escape') { promptWrap.replaceChildren(); root.focus(); }
    };
    promptWrap.replaceChildren(inp); inp.focus();
  }
  document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

  // ---------- resilience ----------
  function liveWorthSaving(): boolean { return !finished && sim.phase !== 'finished' && (sim.actions.length > 0 || sim.phase === 'running'); }
  function saveLive(): void { if (!liveWorthSaving()) return; run.annotations = ann.serialize(); saveStored(LIVE_KEY, snapshotRun(sim, src as StoredSource, { driverSkill, watch, annotations: run.annotations, scaleMax: run.scaleMax })); }
  function onBeforeUnload(e: BeforeUnloadEvent): void { if (!liveWorthSaving()) return; saveLive(); e.preventDefault(); e.returnValue = 'A run is in progress.'; }
  function onResize(): void { sizeCockpit(); lastBookKey = ''; renderNow(); }
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', saveLive);
  window.addEventListener('resize', onResize);

  // ---------- book ----------
  rows.onclick = e => { const r = (e.target as HTMLElement).closest('.row') as HTMLElement | null; if (r && !(e.target as HTMLElement).closest('input,button')) { act({ type: 'line.set', n: Number(r.dataset.n) }); renderNow(); } };
  function renderBook(o: Observation): void {
    const key = `${o.currentLine}|${o.stoppedAtLine ?? ''}|${o.driver.lastExecutedLine ?? ''}|${o.phase}|${ann.serialize().length}|${Object.keys(o.annotations ?? {}).length}`;
    if (key === lastBookKey) return; lastBookKey = key; lastExecuted = o.driver.lastExecutedLine ?? lastExecuted;
    const frag = document.createDocumentFragment();
    for (const r of bookRows(scenario.book, o.currentLine)) {
      const ins = scenario.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      const hls = ann.highlights(r.n);
      const stopped = o.stoppedAtLine === r.n;
      const row = el('div', { class: `row ${r.state}${stopped ? ' stopped' : ''}${lastExecuted !== null && r.n <= lastExecuted ? ' executed' : ''} ${hls.map(h => `hl-${h}`).join(' ')}`, 'data-n': String(r.n) });
      const svg = node?.exits ? cameoSvg(node.exits, node.control, ins?.turn ?? null, 64) : node?.sign || node?.control && node.control !== 'none' ? cameoSvg([{ angle: 0, kind: 'road', isRoute: true }], node.control, 'S', 64) : '';
      // the section tag and the text both start with START / FINISH: print the tag only when the text does not
      const showColB = r.colB && !r.text.toUpperCase().startsWith(r.colB.toUpperCase());
      const rl = restartLabel(ins);
      row.append(el('div', { class: 'n' }, String(r.n)), el('div', { class: 'cameo', html: svg }),
        el('div', { class: 'text' }, showColB ? el('span', { class: 'colb' }, r.colB) : null, stopped ? el('span', { class: 'stoptag' }, 'STOPPED HERE ') : null, r.text, rl ? el('span', { class: 'cold accent' }, rl) : null, r.colD ? el('span', { class: 'cold' }, r.colD) : null, o.aids.cumulativePerfectAtNextLine !== undefined && r.isCurrent ? el('span', { class: 'cold accent' }, `perfect cumulative ${formatElapsed(o.aids.cumulativePerfectAtNextLine, 0)}`) : null, r.perfectCumulative !== undefined ? el('span', { class: 'cold' }, `Col C perfect: ${formatElapsed(r.perfectCumulative, 0)}`) : null),
        el('div', { class: 'colc' }, r.colC));
      // annotation strip: highlighters + GO-time for pause lines (UI-013)
      const strip = el('div', { class: 'ann' });
      for (const h of HIGHLIGHTS) { const b = el('button', { class: `hl-btn ${h}`, title: `highlight ${h}` }); b.onclick = ev => { ev.stopPropagation(); ann.toggleHighlight(r.n, h as Highlight); lastBookKey = ''; renderBook(sim.observe({ peek: true })); }; strip.append(b); }
      if (r.pause) {
        const go = el('input', { class: 'go-time', placeholder: 'GO at', value: ann.goTime(r.n) || (o.annotations?.[r.n] ?? '') }) as HTMLInputElement;
        go.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') go.blur(); };
        go.onchange = () => { ann.setGoTime(r.n, go.value); try { sim.act({ type: 'line.annotate', n: r.n, text: go.value } as Action); } catch { /* older engine */ } };
        strip.append(el('span', { class: 'muted' }, 'P' + r.pause), go);
        // the answer sheet (same turn-capped loss as the Debrief) only where the aids ladder allows it
        if (policy.computedCard) { const d = cardDwell(scenario, r.n); if (d !== null) strip.append(el('span', { class: 'muted', title: 'card dwell = pause - stop/start loss (turn-capped)' }, `card ${d.toFixed(1)} s`)); }
      }
      row.append(strip); frag.append(row);
    }
    rows.replaceChildren(frag);
    const cur = (rows.querySelector('.row.stopped') ?? rows.querySelector('.row.current')) as HTMLElement | null; if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ---------- render ----------
  /** Keep the book on the line being executed: at rung >= 1 the pointer follows the driver's check-off (C1). */
  function autoFollow(): void {
    if (rung < 1 || scenario.aids.autoAdvanceLine) return;
    const p = sim.observe({ peek: true }); const le = p.driver.lastExecutedLine;
    if (le === null || le === followedExec) return;
    followedExec = le;
    const n = Math.min(bookLen, le + 1);
    if (p.currentLine !== n) act({ type: 'line.set', n });
  }
  function renderNow(): void { autoFollow(); obs = sim.observe(); for (const m of obs.driver.messages) driverLog.push(m); if (obs.stoppedAtLine && stopWaitTod === null) stopWaitTod = obs.tod; else if (!obs.stoppedAtLine) stopWaitTod = null; draw(obs); }
  function draw(o: Observation): void {
    const w = roadWrap.clientWidth || 600, h = roadWrap.clientHeight || 240;
    const rctx = prepare(roadCanvas, w, h);
    const lastLine = driverLog.length ? driverLog[driverLog.length - 1]! : null;
    const pending = o.driver.pendingTurn ? `turn ${o.driver.pendingTurn}` : keys.buffer ? `speed ${keys.buffer}…` : null;
    // pace aid: at a STOP show how long to wait (rung 3) or only early / late (rung 2), not the raw count to zero (PT-02 BUG-10)
    const dwellSoFar = stopWaitTod !== null ? o.tod - stopWaitTod : 0;
    let pace: number | null = o.aids.earlyLate ?? null; let paceMode: 'seconds' | 'arrow' | 'wait' = 'seconds'; let waitMoreS: number | null = null;
    if (o.stoppedAtLine && pace !== null) {
      if (rung >= 3) {
        const pc = cachedCard(o.stoppedAtLine);
        if (pc?.restart) { const ins = scenario.book[o.stoppedAtLine - 1]; waitMoreS = ins?.restartTime !== undefined ? Math.round((ins.restartTime - (pc.restart.accel ?? 0) - o.tod) * 10) / 10 : null; }
        else waitMoreS = waitMore(cachedStop(o.stoppedAtLine), dwellSoFar);
        paceMode = waitMoreS === null ? 'arrow' : 'wait';
      } else paceMode = 'arrow';
    }
    if (rctx) drawRoad(rctx, o, w, h, theme, { pendingCallout: pending, driverLine: lastLine ? lastLine.text : null, pace, paceMode, waitMore: waitMoreS, countdown: o.aids.countdown ?? null, offCourseHint: o.offCourseHint, showDistances: policy.digitalReadouts });
    // instruments: sized from the pane they live in, so a window resize re-lays them out
    const instH = instruments.clientHeight || 240; const instW = instruments.clientWidth || 600;
    const swSize = Math.round(clamp(Math.min(instH - 96, instW * 0.36), 110, 400)); const clSize = Math.round(clamp(Math.min(swSize * 0.8, (instW - swSize) / 2 - 18, instH - 56), 80, 300)); const spSize = Math.round(clamp(Math.min(swSize * 0.7, (instW - swSize) / 2 - 18, instH - 56), 70, 260));
    const sw = o.stopwatch;
    const swVm = stopwatchViewModel(sw.reading, sw.kind, { dialSeconds: sw.dialSeconds === 30 ? 30 : 60, registerMinutes: 30, bezel: sw.bezel, running: sw.running, laps: sw.laps });
    const sctx = prepare(swCanvas, swSize, swSize); if (sctx) drawStopwatch(sctx, swVm, swSize, theme);
    const lcd = sw.kind === 'digital';
    swCap.innerHTML = `${lcd || policy.digitalReadouts ? `<b class="${lcd ? 'lcd' : ''}" id="lcd">${escapeHtml(swVm.digital)}</b> ` : ''}${sw.running ? '<span class="ok">running</span>' : 'stopped'} · bezel ${escapeHtml(sw.bezel.toFixed(1))} s${policy.digitalReadouts ? ` (${escapeHtml(sw.bezelRemaining.toFixed(1))} to go)` : ''}`;
    laps.replaceChildren(...swVm.lapRows.flatMap((r, i) => [el('span', { class: i === 0 ? 'cur' : '' }, `L${r.n}`), el('span', { class: i === 0 ? 'cur' : '' }, r.text), el('span', {}, `+${r.split}`)]));
    const cvm = clockViewModel(o.tod, o.bezel);
    const cctx = prepare(clockCanvas, clSize, clSize); if (cctx) drawClock(cctx, cvm, clSize, theme);
    clockCap.innerHTML = policy.digitalReadouts ? `<b>${escapeHtml(cvm.digital)}</b> · start ${escapeHtml(formatClock(o.startTime))}` : `official start ${escapeHtml(formatClock(o.startTime))}`;
    const svm = speedoViewModel(o.speedo.reading, 100);
    const pctx = prepare(spCanvas, spSize, spSize); if (pctx) drawSpeedo(pctx, svm, spSize, theme, o.driver.targetIndicated);
    spCap.innerHTML = `${policy.digitalReadouts ? `<b>${escapeHtml(svm.text)}</b> mph · ` : ''}${o.driver.targetIndicated !== null ? `holding ${escapeHtml(String(o.driver.targetIndicated))}` : 'no speed called'}`;
    // HUD
    chipPhase.textContent = o.phase === 'preread' ? (policy.digitalReadouts ? `PRE-READ · start in ${formatElapsed(Math.max(0, o.secondsToStart), 0)}` : 'PRE-READ') : o.phase === 'running' ? `${o.stoppedAtLine ? 'stopped' : o.driver.state}` : 'FINISHED';
    chipPhase.className = `chip ${o.driver.waitingForGo ? 'warn' : o.phase === 'running' ? 'live' : ''}`;
    if (policy.digitalReadouts) chipClock.textContent = cvm.digital;
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
      if (!preread.firstChild) buildPreread();
      const cd = preread.querySelector('#countdown'); if (cd) cd.textContent = policy.digitalReadouts ? `T ${o.secondsToStart >= 0 ? '-' : '+'} ${formatElapsed(Math.abs(o.secondsToStart), 1)}` : '';
    } else preread.style.display = 'none';
    // drawer
    callout.textContent = keys.buffer ? `${keys.buffer}_ (Enter calls it)` : o.driver.pendingTurn ? `turn ${o.driver.pendingTurn} pending` : o.driver.targetIndicated !== null ? `holding ${o.driver.targetIndicated}` : '-';
    if (keys.modifiers.length) callout.textContent += `  [${keys.modifiers.join('')}+arrow]`;
    ledgerBody.innerHTML = `<div>Ledger: <b class="mono">${o.ledger === null ? 'not set' : escapeHtml((o.ledger > 0 ? '+' : '') + o.ledger + ' s')}</b> <span class="muted">(E)</span></div><div class="muted">Hazard held you? Time it on the watch and press T to declare a TA before the checkpoint.</div>${o.aids.earlyLate !== undefined ? `<div>Pace aid: <b class="mono">${o.aids.earlyLate > 0 ? '+' : ''}${o.aids.earlyLate.toFixed(1)} s</b></div>` : ''}`;
    renderPerfCard(o, dwellSoFar);
    notesList.innerHTML = o.notes.slice(-4).map(n => `<div>· ${escapeHtml(n)}</div>`).join('');
    logBody.innerHTML = driverLog.slice(-6).map(m => `<div class="${m.kind === 'question' ? 'q' : ''}"><span class="muted mono">${policy.digitalReadouts ? escapeHtml(formatClock(m.tod)) : ''}</span> ${escapeHtml(m.text)}</div>`).join('') || '<div class="muted">Dad has not said anything yet.</div>';
    renderBook(o);
    // CP card (DEBRIEF-004)
    if (sim.events.length > seenEvents) {
      const fresh = sim.events.slice(seenEvents); seenEvents = sim.events.length;
      if (fresh.some(e => e.type === 'checkpoint' && e.detail?.kind === 'timing')) { try { const r = sim.result(); const cards = cpCards(r.events, r.attribution, scenario.aids, scenario); activeCard = cards[cards.length - 1] ?? null; } catch { activeCard = null; } }
    }
    if (activeCard && o.tod <= activeCard.showUntil) { cpCardBox.style.display = ''; cpCardBox.innerHTML = `Checkpoint ${escapeHtml(activeCard.cpId)}: <b>${activeCard.error > 0 ? '+' : ''}${activeCard.error}</b> s${activeCard.largestBucket ? `<div class="muted">largest: ${escapeHtml(activeCard.largestBucket)} ${activeCard.largestBucketSeconds > 0 ? '+' : ''}${activeCard.largestBucketSeconds} s${activeCard.largestEvent ? ` · ${escapeHtml(activeCard.largestEvent)}` : ''}</div>` : ''}`; }
    else cpCardBox.style.display = 'none';
  }
  function buildPreread(): void {
    const dep = el('button', { class: 'primary', id: 'depart' }, 'Depart now (D)'); dep.onclick = () => { act({ type: 'start' }); renderNow(); };
    const skip = el('button', { id: 'skip' }, 'Fast-forward to the start time'); skip.onclick = () => { act({ type: 'skipPreread' }); renderNow(); };
    const v0 = scenario.book[0]?.speed; let accel = ''; if (v0) { try { accel = ` Your car loses about ${accelLoss(v0, scenario.car).toFixed(1)} s getting up to ${v0} mph, so depart a few seconds early.`; } catch { accel = ''; } }
    const generic = `Official start ${formatClock(scenario.startTime)}. Read the book on the right: highlight pauses, write the GO time (pause minus your car's stop/start loss) next to each one. The ghost leaves exactly on the second.${accel}`;
    const keysRow = el('div', { class: 'keys3' }); for (const [k, d] of hint.keys) keysRow.append(el('div', {}, el('kbd', {}, k), ' ', d));
    const rs = restartLines(scenario);
    preread.append(el('div', { class: 'box' },
      el('h2', {}, drill ? `${drill.id}: ${drill.title}` : scenario.name),
      el('p', { class: 'objective' }, el('b', {}, 'Objective: '), objective),
      el('div', { class: 'keys-title muted' }, 'The keys that matter'), keysRow,
      el('p', {}, hint.preread ?? generic),
      rs.length ? el('p', { class: 'accent' }, rs.map(r => `Line ${r.line}: ${r.label}`).join(' · ')) : null,
      el('div', { class: 'big', id: 'countdown' }),
      el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' }, dep, skip),
      el('p', { class: 'muted', style: 'margin-top:8px' }, 'Space starts the stopwatch; most navigators start it on the official second and run it as time-of-day all day.')));
  }
  function renderPerfCard(o: Observation, dwellSoFar: number): void {
    const fl = focusLine(o, rung, bookLen);
    const line = o.stoppedAtLine ?? (fl.line);
    const card = cachedCard(line);
    cardTitle.textContent = o.stoppedAtLine ? `Stopped: line ${line}` : policy.computedCard ? 'Perf card for the next line' : 'Your notes for this line';
    if (!card) { cardBody.innerHTML = ''; return; }
    const parts: string[] = [`<div><b>Line ${line}</b>: ${escapeHtml(card.text)}</div>`];
    if (card.restart) {
      parts.push(`<div class="accent"><b>${escapeHtml(card.restart.label)}</b>: not a stop. Call go so the car leaves at the out-time${card.restart.accel !== null ? ` minus the standing-start loss (${card.restart.accel.toFixed(1)} s)` : ''}.</div>`);
    } else if (card.mode === 'answers') {
      if (card.stop) {
        const s = card.stop; const more = waitMore(s, dwellSoFar);
        parts.push(`<div>Stop ${s.vIn} in / ${s.vOut} out${s.cap !== undefined ? ` (turn capped at ${s.cap} mph)` : ''}: loss <b class="mono">${s.loss.toFixed(1)}</b> s → dwell <b class="mono">${s.dwell.toFixed(1)}</b> s after "Stopped" <span class="muted">(set the bezel with ] )</span></div>`);
        if (o.stoppedAtLine === line && more !== null) parts.push(`<div class="stopnow">dwell so far <b class="mono">${Math.max(0, dwellSoFar).toFixed(1)}</b> s · ${more > 0.05 ? `wait <b class="mono">${more.toFixed(1)}</b> more s` : '<b class="ok">go now (G)</b>'}</div>`);
      } else if (card.stopNoPause) parts.push(`<div>STOP without pause: loss ${card.stopNoPause.loss.toFixed(1)} s is yours to recover.</div>`);
      if (card.timed) parts.push(`<div>Timed: hold ${card.timed.hold} for ${card.timed.seconds} s, call ${card.timed.then} at <b class="mono">${card.timed.call.toFixed(1)}</b> s (lead ${card.timed.lead.toFixed(1)})</div>`);
      else if (card.speedChange) parts.push(`<div>Speed ${card.speedChange.from} → ${card.speedChange.to}: call it <b class="mono">${card.speedChange.lead.toFixed(1)}</b> s before the landmark (${card.speedChange.ft} ft)</div>`);
      if (card.start) parts.push(`<div>Standing start to ${card.start.speed}: leave ~<b class="mono">${card.start.early.toFixed(1)}</b> s early</div>`);
    } else {
      const go = ann.goTime(line) || o.annotations?.[line] || '';
      parts.push(`<div class="muted">Legal mode: no computed card. Work it out on the lapboard${scenario.book[line - 1]?.pause ? ' and write the GO time on the line' : ''}.</div>`);
      if (scenario.book[line - 1]?.pause) parts.push(`<div>Your GO at: <b class="mono">${go ? escapeHtml(go) : 'not written'}</b></div>`);
      const hl = ann.highlights(line); if (hl.length) parts.push(`<div class="muted">highlighted: ${hl.join(', ')}</div>`);
    }
    if (o.stoppedAtLine && o.currentLine !== o.stoppedAtLine) parts.push(`<div class="hintline">Book is on line ${o.currentLine}: press <kbd>N</kbd> to jump to line ${o.stoppedAtLine}.</div>`);
    cardBody.innerHTML = parts.join('');
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
    if (now - lastSave > 3000) { lastSave = now; saveLive(); }
    raf = requestAnimationFrame(frame);
  }
  function finish(): void {
    if (finished) return;
    const aborted = sim.events.some(e => e.type === 'abort');
    finished = true;
    let result: StageResult | null = null; try { result = sim.result(); } catch { result = null; }
    run.result = result; run.annotations = ann.serialize(); run.aborted = aborted;
    clearStored(LIVE_KEY);
    if (result) {
      app.lastResult = { run, result };
      saveStored(LAST_KEY, snapshotRun(sim, src as StoredSource, { driverSkill, watch, annotations: run.annotations, scaleMax: run.scaleMax, aborted }));
      // an ended (aborted) run is shown in the Debrief but never counts as a play: no stars, history or bias entries
      if (!aborted) {
        try {
          const vm = debriefViewModel(result, scenario);
          let stars = 0; let score = result.score.raw;
          if (drill) { try { const rb = drill.rubric(result, scenario); stars = rb.stars; score = rb.score; } catch { stars = 0; } }
          else stars = result.score.raw <= 3 ? 3 : result.score.raw <= 13 ? 2 : result.score.raw <= 25 ? 1 : 0;
          const id = drill ? drill.id : `builtin:${src.kind === 'builtin' ? src.name : ''}`;
          app.progress.recordRun(id, { stars, aces: result.score.aces, score, scale: run.scaleMax, errors: vm.bias.errors, raw: result.score.raw, tier: src.kind === 'drill' ? src.tier : undefined, unit: 'raw' });
          if (src.kind === 'drill' && src.drillId === 'D13') recordCampaignStage({ stage: src.seed, tier: src.tier, raw: result.score.raw, score: result.score.score, aces: result.score.aces });
        } catch { /* progress is best effort */ }
      }
    }
    cleanup();
    setTimeout(() => { location.hash = '#/debrief'; }, 0);
  }
  function cleanup(): void {
    alive = false; cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('pagehide', saveLive); window.removeEventListener('resize', onResize);
  }

  window.__rally = {
    sim,
    advance(seconds: number) { const s = Math.max(0, Number(seconds) || 0); let left = s; while (left > 0 && sim.phase !== 'finished') { const d = Math.min(60, left); sim.step(d); left -= d; } renderNow(); if (sim.phase === 'finished') finish(); return obs; },
    act(a: Action) { act(a); renderNow(); return obs; },
    observe: () => sim.observe({ peek: true }),
    result: () => sim.result(),
    finish,
  };
  renderNow();
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return () => { if (!finished) saveLive(); cleanup(); if (window.__rally?.sim === sim) delete window.__rally; };
}
export type { Scenario };
