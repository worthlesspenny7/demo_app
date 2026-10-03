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
import { bookRows, signBox, landmarkLabel, ROWS_PER_PAGE } from '../viewmodels/book.js';
import { columnAHtml, columnBHtml, columnCHtml, columnDHtml, esc } from '../render/griid.js';
import { chartGrids, type ChartGrid } from '../viewmodels/charts.js';
import { holdCardFor, type HoldCard } from '../viewmodels/cockpitinfo.js';
import { digitalWatchViewModel, SplitTracker } from '../viewmodels/digitalwatch.js';
import { taFormVm, taNoteText, taRounding } from '../viewmodels/ta.js';
import { formatInterval } from '../../core/griid.js';
import { effectiveScale, simAdvance, nextScale, SCALE_STEPS } from '../viewmodels/timescale.js';
import { KeyMapper, KEY_HELP, type KeyCommand } from '../viewmodels/keys.js';
import { audioCues, AudioPlayer } from '../viewmodels/audio.js';
import { createAnnotations, HIGHLIGHTS, type Highlight } from '../viewmodels/annotations.js';
import { cockpitLayout } from '../viewmodels/layout.js';
import { cpCards, debriefViewModel, type CpCard } from '../viewmodels/debrief.js';
import { instrumentPolicy, paceAidText, perfCardFor, stopCardFor, cardDwell, waitMore, restartLabel, restartLines, focusLine, lineSpeeds, finishPrompt, type PerfCard, type StopCard } from '../viewmodels/cockpitinfo.js';
import { drillHint, hintBarText, scaleHintText } from '../viewmodels/hints.js';
import { LIVE_KEY, LAST_KEY, snapshotRun, saveStored, loadStored, clearStored, restoreSim, describeSource, sameDrillSource, type StoredSource } from '../viewmodels/resume.js';
import { recordCampaignStage } from '../viewmodels/campaign.js';
import { drawStopwatch } from '../render/stopwatch.js';
import { drawClock } from '../render/clock.js';
import { drawSpeedo } from '../render/speedo.js';
import { drawRoad } from '../render/road.js';
import { prepare, themeFromCss } from '../render/common.js';
import { app, buildScenario, withDriver, el, escapeHtml, sourceHash, type RunSource, type Run, type Settings } from '../state.js';

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
  // N4: a saved run of this drill that the player has not chosen to resume or discard yet (never overwritten silently)
  let pendingSave: ReturnType<typeof loadStored> = null;
  if (!resuming) { const other = loadStored(LIVE_KEY); if (other && sameDrillSource(other.source, src)) pendingSave = other; }
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
  for (const s of SCALE_STEPS) {
    const b = el('button', { 'data-scale': String(s), title: lockedTo1x ? 'This drill is locked to 1x' : `run at ${s}x` }, `${s}x`);
    if (lockedTo1x) b.setAttribute('disabled', ''); else b.onclick = () => { requested = s; };   // N8: really disabled, not just styled
    scaleBtns.append(b);
  }
  const pauseBtn = el('button', { id: 'pause' }, 'Pause'); pauseBtn.onclick = () => { paused = !paused; }; scaleBtns.append(pauseBtn);
  const helpBtn = el('button', { id: 'keys-btn' }, 'Keys'); helpBtn.onclick = () => setHelp(!showHelp); scaleBtns.append(helpBtn);
  const muteBtn = el('button', {}, app.settings.muted ? 'Unmute' : 'Mute'); muteBtn.onclick = () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute'; }; scaleBtns.append(muteBtn);
  const abortBtn = el('button', { class: 'danger', id: 'abort' }, 'End run'); abortBtn.onclick = () => { if (confirm('End this run now and go to the debrief? An ended run is not recorded.')) { try { sim.act({ type: 'abort' } as Action); } catch { /* older engine */ } finish(); } }; scaleBtns.append(abortBtn);
  hud.append(chipPhase, chipClock, chipLeg, chipScale, scaleBtns, chipMsg);
  // Keys overlay: a centered, scrollable modal above the HUD; closes on Esc, on a click outside the panel, or on its Close button
  const helpPanel = el('div', { class: 'help', id: 'keys-panel', role: 'dialog', 'aria-label': 'Keyboard shortcuts' });
  helpPanel.append(el('h3', {}, 'Keyboard shortcuts'));
  const helpList = el('div', { class: 'help-list' }); for (const k of KEY_HELP) helpList.append(el('div', { html: `<kbd>${escapeHtml(k.keys)}</kbd> ${escapeHtml(k.does)}` }));
  const helpClose = el('button', { id: 'keys-close' }, 'Close (Esc)'); helpClose.onclick = () => setHelp(false);
  helpPanel.append(helpList, helpClose);
  const helpBox = el('div', { class: 'help-backdrop', id: 'keys-overlay' }, helpPanel);
  helpBox.onclick = e => { if (e.target === helpBox) setHelp(false); };
  let showHelp = app.settings.showHelp; helpBox.style.display = showHelp ? '' : 'none';
  function setHelp(on: boolean): void { showHelp = on; helpBox.style.display = on ? '' : 'none'; }
  // UI-030: the three handbook charts (IN x OUT grids) with the current pair highlighted
  const chartsPanel = el('div', { class: 'help charts-panel', id: 'charts-panel', role: 'dialog', 'aria-label': 'Performance charts' });
  const chartsClose = el('button', { id: 'charts-close' }, 'Close (C or Esc)'); chartsClose.onclick = () => setCharts(false);
  const chartsBody = el('div', { id: 'charts-body' });
  chartsPanel.append(el('h3', {}, `Your car's charts: ${scenario.car.name}`), chartsBody, chartsClose);
  const chartsBox = el('div', { class: 'help-backdrop', id: 'charts-overlay' }, chartsPanel); chartsBox.style.display = 'none';
  chartsBox.onclick = e => { if (e.target === chartsBox) setCharts(false); };
  let showCharts = false; let chartsKey = '';
  function setCharts(on: boolean): void { showCharts = on; chartsBox.style.display = on ? '' : 'none'; chartsKey = ''; if (on) renderCharts(obs); }
  function chartHtml(g: ChartGrid): string {
    const head = `<tr><th>IN \\ OUT</th>${g.speeds.map(v => `<th class="${g.highlight?.out === v ? 'cur' : ''}">${v}</th>`).join('')}</tr>`;
    const body = g.rows.map(r => `<tr><th class="${g.highlight?.in === r.in ? 'cur' : ''}">${r.in}</th>${r.cells.map(c => `<td class="${c.hi ? 'cur' : ''}" data-in="${r.in}" data-out="${c.out}">${c.text}</td>`).join('')}</tr>`).join('');
    return `<div class="chart" id="chart-${g.id}"><h4>(${g.letter}) ${esc(g.title.toUpperCase())}</h4><p class="muted">${esc(g.note)}</p><div class="charttable-wrap"><table class="charttable"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
  }
  function renderCharts(o: Observation): void {
    if (!showCharts) return;
    const line = o.stoppedAtLine ?? focusLine(o, rung, bookLen).line;
    const key = `${line}|${policy.computedCard}`; if (key === chartsKey) return; chartsKey = key;
    const sp = lineSpeeds(scenario, line);
    const grids = chartGrids(scenario.car, policy.computedCard ? sp : null);
    chartsBody.innerHTML = `<p class="muted">${policy.computedCard ? `Line ${line}: ${sp.vIn ?? 0} in / ${sp.vOut ?? '?'} out is highlighted.` : 'Legal mode: find your own pair.'}</p>${grids.map(chartHtml).join('')}`;
  }
  // UI-031: the Time Allowance point form (TA-005)
  let taCollapsed = false; let taBuiltFor: string | null = null; let taSig = '';
  const taPanel = el('div', { class: 'ta-panel', id: 'ta-panel' }); taPanel.style.display = 'none';
  const taField = (id: string): HTMLInputElement | null => taPanel.querySelector(`#${id}`) as HTMLInputElement | null;
  const cpCardBox = el('div', { class: 'cpcard', id: 'cpcard' }); cpCardBox.style.display = 'none'; roadWrap.append(cpCardBox);
  const preread = el('div', { class: 'preread', id: 'preread' });

  // UI-033: the stopwatch follows Settings.watch (digital lap/split by default), the dash clock follows Settings.clock (analog by default)
  const digitalSw = watch === 'digital'; const digitalClock = app.settings.clock === 'digital';
  const clockCanvas = el('canvas', { id: digitalClock ? 'clock-dial' : 'clock' }); const swCanvas = el('canvas', { id: digitalSw ? 'stopwatch-dial' : 'stopwatch' }); const spCanvas = el('canvas', { id: 'speedo' });
  const clockDigital = el('div', { class: 'dclock lcd', id: 'clock', title: 'Click (or K) to note a clock read' }, '00:00:00');
  clockDigital.onclick = () => { act({ type: 'clock.read' }); flash('Clock read noted'); };
  const clockCap = el('div', { class: 'caption' }); const swCap = el('div', { class: 'caption' }); const spCap = el('div', { class: 'caption' }); const laps = el('div', { class: 'laps', id: 'laps' });
  // WATCH-008: digital lap/split watch: big 1/100 s display, CHRONO / TOD chip, lap table of interval-over-cumulative boxes, split-frozen indicator
  const noFocus = (b: HTMLElement): void => { b.onmousedown = e => e.preventDefault(); };
  const dwMode = el('button', { id: 'dw-mode', class: 'modechip', title: 'M: chrono / time of day' }, 'CHRONO'); noFocus(dwMode);
  const dwInd = el('span', { class: 'dw-ind', id: 'dw-ind' });
  const lcdEl = el('div', { class: 'dw-lcd lcd', id: 'lcd' }, '0:00.00');
  const dwBtn = (id: string, label: string, title: string, cmd: KeyCommand): HTMLButtonElement => { const b = el('button', { id, title }, label) as HTMLButtonElement; noFocus(b); b.onclick = () => handle(cmd); return b; };
  const dwStart = dwBtn('dw-start', 'Start', 'Space: start / stop', { type: 'watch.toggle' }); const dwLap = dwBtn('dw-lap', 'Lap', 'L: lap (split)', { type: 'watch.lap' });
  const dwRecall = dwBtn('dw-recall', 'Recall', 'R: release the split, then cycle the last 10 laps', { type: 'watch.recall' }); const dwReset = dwBtn('dw-reset', 'Reset', 'only while stopped (Shift+R forces)', { type: 'watch.reset' });
  dwMode.onclick = () => handle({ type: 'watch.mode' });
  const dwLaps = el('div', { class: 'dw-laps', id: 'laps' });
  const dwatch = el('div', { class: 'dwatch', id: 'stopwatch' }, el('div', { class: 'dw-top' }, dwMode, dwInd), lcdEl, el('div', { class: 'dw-btns' }, dwStart, dwLap, dwRecall, dwReset), dwLaps);
  const splitTracker = new SplitTracker();
  const instruments = el('div', { class: 'instruments' },
    el('div', { class: 'instrument' }, digitalClock ? clockDigital : clockCanvas, clockCap),
    el('div', { class: 'instrument' }, ...(digitalSw ? [dwatch, swCap] : [swCanvas, swCap, laps])),
    el('div', { class: 'instrument' }, spCanvas, spCap));
  if (!digitalClock) clockCanvas.onclick = () => { act({ type: 'clock.read' }); flash('Clock read noted'); };
  const left = el('div', { class: 'left' }, roadWrap, instruments, preread, taPanel);   // the TA form floats over the road and the clock; its header collapses it
  const hintScale = el('span', { class: 'chip', id: 'hint-scale' }, '1x');
  const hintBar = el('div', { class: 'hintbar', id: 'hintbar', title: 'objective and the keys that matter' },
    el('span', { class: 'hint-text' }, el('b', {}, drill ? `${drill.id}: ` : ''), hintBarText(objective, hint)),
    el('span', { class: 'hint-scale', id: 'hint-scalekeys', title: 'time scale keys; ? lists every key' }, el('kbd', {}, '?'), ' keys  ·  ', scaleHintText(lockedTo1x), ' ', hintScale));
  const printHref = `#/book/${src.kind === 'drill' ? `drill/${src.drillId}/${src.tier}/${src.seed}` : `builtin/${src.name}/${src.seed}`}`;
  const bookHead = el('div', { class: 'book-head' }, el('b', {}, 'GRIID'), el('span', { class: 'muted' }, `${scenario.name} · ${scenario.book.length} lines · N / Shift+N move, click to set`),
    el('a', { id: 'book-print', href: printHref, target: '_blank', rel: 'noopener', title: 'the whole book, six rows a page, printable', style: 'margin-left:auto' }, 'Print book'));
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
  const cardTitle = el('h4', {}, 'Perf card'); const chartsBtn = el('button', { id: 'charts-btn', class: 'mini', title: 'C: the three handbook charts' }, 'Charts'); chartsBtn.onclick = () => setCharts(!showCharts);
  const cardBox = el('div', { class: 'box', id: 'perfcard' }, el('div', { class: 'cardhead' }, cardTitle, chartsBtn)); const cardBody = el('div', {}); cardBox.append(cardBody);
  const ledgerBox = el('div', { class: 'box', id: 'ledgerbox' }, el('h4', {}, 'Ledger (E) and time allowance (T)')); const ledgerBody = el('div', {}); ledgerBox.append(ledgerBody);
  const logBox = el('div', { class: 'box log' }, el('h4', {}, 'Driver')); const logBody = el('div', { id: 'driverlog' }); logBox.append(logBody);
  const lapboard = el('div', { class: `lapboard${hasCal ? ' with-cal' : ''}` }, ledgerBox, cardBox, notesBox, logBox);
  if (hasCal) lapboard.append(calibrationBox());
  const drawer = el('div', { class: 'drawer' },
    el('div', { class: 'bar' }, el('span', { class: 'muted' }, 'Callout:'), callout, promptWrap, el('span', { class: 'muted', style: 'margin-left:auto' }, `${scenario.car.name} · ${scenario.driver.name} (${scenario.driver.skill}) · ${scenario.speedo.kind} speedo · aids rung ${rung}${rung <= 1 ? ' (legal: no digital readouts)' : ''}`)),
    lapboard);
  cockpit.append(hintBar, left, book, drawer, helpBox, chartsBox);
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
  let stopCalledTod: number | null = null;
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
    if (showHelp && e.key === 'Escape') { e.preventDefault(); setHelp(false); return; }
    if (showCharts && e.key === 'Escape') { e.preventDefault(); setCharts(false); return; }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setHelp(!showHelp); return; }
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
      case 'watch.reset': {
        // WATCH-008: reset only while stopped; Shift+R forces it
        const before = sim.observe({ peek: true }).stopwatch.reading; const force = cmd.force === true;
        act(force ? { type: 'watch.reset', force: true } : { type: 'watch.reset' });
        if (!force && sim.observe({ peek: true }).stopwatch.running && before > 0) flash('Stop the watch before resetting (Shift+R forces the reset)');
        else { const f = digitalSw ? dwatch : swCanvas; f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 600); }
        break;
      }
      case 'watch.recall': if (digitalSw) act({ type: 'watch.recall' }); else flash('Recall is a digital-watch key'); break;
      case 'watch.mode': if (digitalSw) act({ type: 'watch.mode' }); else flash('The analog stopwatch has no time-of-day mode: read the dash clock'); break;
      case 'clock.read': act({ type: 'clock.read' }); flash('Clock read noted'); break;
      case 'charts': setCharts(!showCharts); break;
      case 'bezel': act({ type: 'watch.bezel', seconds: (obs.stopwatch.bezel ?? 0) + cmd.delta }); break;   // the digital watch keeps the index too: the road view's countdown aid uses it
      case 'call.turn': act({ type: 'call.turn', dir: cmd.dir }); break;
      case 'call.go': if (sim.phase === 'preread') { if (blockedBySave()) break; act({ type: 'start' }); } else act({ type: 'call.go' }); break;
      case 'call.stop': act({ type: 'call.stop' }); stopCalledTod = sim.tod; break;
      case 'call.uturn': act({ type: 'call.uturn' }); break;
      case 'call.pass': act({ type: 'call.pass' }); break;
      case 'depart': if (blockedBySave()) break; act({ type: 'start' }); break;
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
      case 'ta': {
        if (obs.ta.hasTaPoints) { if (obs.ta.windowOpen) { taCollapsed = false; taField('ta-request')?.focus(); } else flash('No Time Allowance window: requests are taken for 15 minutes after a TA point (the yellow box)'); }
        else promptFor('Time allowance (seconds)', v => act({ type: 'ta.declare', seconds: v }));
        break;
      }
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
  function liveWorthSaving(): boolean { return !pendingSave && !finished && sim.phase !== 'finished' && (sim.actions.length > 0 || sim.phase === 'running'); }
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
    const pages = Math.max(1, Math.ceil(bookLen / ROWS_PER_PAGE));
    for (const r of bookRows(scenario.book, o.currentLine, { timeZone: scenario.timeZone, style: scenario.bookStyle })) {
      if (r.n > 1 && (r.n - 1) % ROWS_PER_PAGE === 0) frag.append(el('div', { class: 'page-break' }, el('span', {}, scenario.name), el('span', {}, `Page ${(r.n - 1) / ROWS_PER_PAGE + 1} of ${pages}`)));
      const ins = scenario.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      const hls = ann.highlights(r.n);
      const stopped = o.stoppedAtLine === r.n;
      const row = el('div', { class: `row ${r.state}${stopped ? ' stopped' : ''}${lastExecuted !== null && r.n <= lastExecuted ? ' executed' : ''}${r.omitted ? ' omitted' : ''} ${hls.map(h => `hl-${h}`).join(' ')}`, 'data-n': String(r.n) });
      const svg = node?.exits ? cameoSvg(node.exits, node.control, ins?.turn ?? null, 64) : node?.sign || node?.control && node.control !== 'none' ? cameoSvg([{ angle: 0, kind: 'road', isRoute: true }], node.control, 'S', 64) : '';
      const dCell = el('div', { class: 'gd' });
      dCell.innerHTML = `${stopped ? '<span class="stoptag">STOPPED HERE </span>' : ''}${columnDHtml(r)}${r.omitted ? ' <em>(omitted)</em>' : ''}${o.aids.cumulativePerfectAtNextLine !== undefined && r.isCurrent ? `<span class="cold accent">perfect cumulative ${esc(formatElapsed(o.aids.cumulativePerfectAtNextLine, 0))}</span>` : ''}`;
      row.append(el('div', { class: 'gn' }, r.printed), el('div', { class: 'ga', html: columnAHtml({ svg, sign: signBox(node), landmark: landmarkLabel(node) }) }),
        el('div', { class: 'gb', html: columnBHtml(r) }), el('div', { class: 'gc', html: columnCHtml(r), title: r.colC }), dCell);
      // annotation strip: highlighters + GO-time for pause lines (UI-013)
      const strip = el('div', { class: 'ann' });
      for (const h of HIGHLIGHTS) { const b = el('button', { class: `hl-btn ${h}`, title: `highlight ${h}` }); b.onclick = ev => { ev.stopPropagation(); ann.toggleHighlight(r.n, h as Highlight); lastBookKey = ''; renderBook(sim.observe({ peek: true })); }; strip.append(b); }
      if (r.pause) {
        const go = el('input', { class: 'go-time', placeholder: 'GO at', value: ann.goTime(r.n) || (o.annotations?.[r.n] ?? '') }) as HTMLInputElement;
        go.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') go.blur(); };
        go.onchange = () => { ann.setGoTime(r.n, go.value); try { sim.act({ type: 'line.annotate', n: r.n, text: go.value } as Action); } catch { /* older engine */ } };
        strip.append(el('span', { class: 'muted' }, `0 MPH / ${formatInterval(r.pause)}`), go);
        // the answer sheet (same turn-capped loss as the Debrief) only where the aids ladder allows it
        if (policy.computedCard) { const d = cardDwell(scenario, r.n); if (d !== null) strip.append(el('span', { class: 'muted', title: 'card dwell = pause - stop/start loss (turn-capped)' }, `card ${d.toFixed(1)} s`)); }
      }
      row.append(strip); frag.append(row);
    }
    rows.replaceChildren(frag);
    const cur = (rows.querySelector('.row.stopped') ?? rows.querySelector('.row.current')) as HTMLElement | null; if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ---------- UI-031 Time Allowance point form ----------
  function buildTaPanel(vm: ReturnType<typeof taFormVm>): void {
    const first = vm.legs.find(l => l.measured > 0) ?? vm.legs[0];
    taPanel.innerHTML = `<div class="ta-head"><b>${esc(vm.title)}</b><span class="mono" id="ta-count"></span><button id="ta-toggle" class="mini" title="collapse / expand">_</button></div>
      <div class="ta-body" id="ta-body">
        <p class="muted ta-help">Requests are taken for 15 minutes after the TA point, in multiples of 0m10s (up to 29m30s). Example: <i>${esc(vm.example)}</i></p>
        <table class="ta-legs" id="ta-legs"></table>
        <div class="ta-form">
          <label>Leg <select id="ta-leg">${vm.legs.map(l => `<option value="${l.legIndex}">${l.legIndex}</option>`).join('')}</select></label>
          <label>Delay (s) <input id="ta-delay" type="number" min="0" step="1" value="${first ? Math.round(first.measured) : ''}"></label>
          <label>Made up (s) <input id="ta-madeup" type="number" min="0" step="1" value="${first ? Math.round(first.recoverable) : ''}"></label>
          <label>Request (s) <input id="ta-request" type="number" min="0" step="1" value="${first ? first.suggested : ''}"></label>
          <span id="ta-round" class="ta-round"></span>
          <label>From instruction <input id="ta-from" type="number" min="1" step="1" value="${first?.fromLine ?? ''}"></label>
          <label>to <input id="ta-to" type="number" min="1" step="1" value="${first?.toLine ?? ''}"></label>
          <label class="wide">Cause <input id="ta-cause" type="text" placeholder="a farm tractor, a train, an accident scene"></label>
          <label class="wide">Witness <input id="ta-witness" type="text" placeholder="name or car number"></label>
          <div class="ta-pattern mono" id="ta-pattern"></div>
          <button id="ta-submit" class="primary">File request</button>
        </div>
        <div id="ta-filed" class="ta-filed"></div>
        <div id="ta-ack"></div>
      </div>`;
    const legSel = taField('ta-leg') as unknown as HTMLSelectElement;
    if (first) legSel.value = String(first.legIndex);
    const num = (id: string): number => Number(taField(id)?.value ?? '');
    const measuredOf = (leg: number): number => taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)).legs.find(l => l.legIndex === leg)?.measured ?? 0;
    const refresh = (): void => {
      const leg = Number(legSel.value); const req = num('ta-request');
      const rd = taRounding(req, measuredOf(leg));
      const r = taPanel.querySelector('#ta-round'); if (r) { r.textContent = rd.text; r.classList.toggle('adj', rd.changed); }
      const pat = taPanel.querySelector('#ta-pattern'); if (pat) pat.textContent = taNoteText({ delay: num('ta-delay') || 0, madeUp: num('ta-madeup') || 0, request: rd.adjusted, cause: taField('ta-cause')?.value, witness: taField('ta-witness')?.value });
    };
    const fillFor = (leg: number): void => {
      const l = taFormVm(sim.observe({ peek: true }).ta, x => sim.taAdvice(x)).legs.find(x => x.legIndex === leg); if (!l) return;
      legSel.value = String(leg);
      (taField('ta-delay') as HTMLInputElement).value = String(Math.round(l.measured)); (taField('ta-madeup') as HTMLInputElement).value = String(Math.round(l.recoverable)); (taField('ta-request') as HTMLInputElement).value = String(l.suggested);
      (taField('ta-from') as HTMLInputElement).value = l.fromLine === null ? '' : String(l.fromLine); (taField('ta-to') as HTMLInputElement).value = l.toLine === null ? '' : String(l.toLine);
      refresh();
    };
    for (const id of ['ta-delay', 'ta-madeup', 'ta-request', 'ta-from', 'ta-to', 'ta-cause', 'ta-witness']) {
      const f = taField(id)!; f.addEventListener('input', refresh);
      f.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') f.blur(); if (e.key === 'Enter') (taPanel.querySelector('#ta-submit') as HTMLButtonElement).click(); });
    }
    legSel.addEventListener('change', () => fillFor(Number(legSel.value))); legSel.addEventListener('keydown', e => e.stopPropagation());
    (taPanel.querySelector('#ta-legs') as HTMLElement).onclick = e => { const b = (e.target as HTMLElement).closest('button[data-leg]') as HTMLElement | null; if (b) fillFor(Number(b.dataset.leg)); };
    (taPanel.querySelector('#ta-toggle') as HTMLElement).onclick = () => { taCollapsed = !taCollapsed; };
    (taPanel.querySelector('#ta-submit') as HTMLButtonElement).onclick = () => {
      const leg = Number(legSel.value), seconds = num('ta-request'), fromLine = Math.round(num('ta-from')), toLine = Math.round(num('ta-to'));
      if (!(seconds > 0) || !(fromLine >= 1) || !(toLine >= fromLine)) { flash('Fill in the request (seconds) and the instruction numbers it happened between'); return; }
      act({ type: 'ta.request', legIndex: leg, seconds, fromLine, toLine, note: taNoteText({ delay: num('ta-delay') || 0, madeUp: num('ta-madeup') || 0, request: seconds, cause: taField('ta-cause')?.value, witness: taField('ta-witness')?.value }) });
      renderNow();
    };
    refresh();
  }
  function renderTa(o: Observation): void {
    const vm = taFormVm(o.ta, leg => sim.taAdvice(leg));
    if (!vm.visible) { taPanel.style.display = 'none'; taBuiltFor = null; return; }
    taPanel.style.display = ''; taPanel.classList.toggle('collapsed', taCollapsed);
    const built = `${o.ta.windowEndsTod}|${vm.legs.map(l => l.legIndex).join(',')}`;
    if (taBuiltFor !== built) { taBuiltFor = built; taSig = ''; buildTaPanel(vm); }
    const count = taPanel.querySelector('#ta-count'); if (count) count.textContent = `window ${vm.countdown} left`;
    const sig = JSON.stringify([vm.legs.map(l => [l.measured, l.recoverable, l.suggested, l.fromLine, l.toLine, l.filed?.adjusted ?? null]), vm.requests.length, vm.ackAvailable, vm.acked]);
    if (sig === taSig) return; taSig = sig;
    const legsEl = taPanel.querySelector('#ta-legs'); if (legsEl) legsEl.innerHTML = `<thead><tr><th>Leg</th><th>Measured delay</th><th>Recoverable</th><th>Suggested</th><th>Lines</th><th></th></tr></thead><tbody>${vm.legs.map(l => `<tr data-leg="${l.legIndex}"><td>${l.legIndex}</td><td class="mono">${formatInterval(l.measured)}</td><td class="mono">${formatInterval(l.recoverable)}</td><td class="mono"><b>${formatInterval(l.suggested)}</b></td><td>${l.fromLine !== null ? `${l.fromLine}-${l.toLine}` : '-'}</td><td><button class="mini" data-leg="${l.legIndex}">Use</button></td></tr>`).join('')}</tbody>`;
    const filed = taPanel.querySelector('#ta-filed'); if (filed) filed.innerHTML = vm.requests.length ? `<b>Filed</b>${vm.requests.map(r => `<div class="${r.status === 'refused' ? 'danger' : ''}">Leg ${r.legIndex}: ${formatInterval(r.requested)}${r.adjustment ? ` (${esc(r.adjustment)})` : ''} ${r.status === 'refused' ? `refused: ${esc(r.reason ?? '')}` : 'filed'}</div>`).join('')}` : '';
    const ack = taPanel.querySelector('#ta-ack') as HTMLElement | null;
    if (ack) {
      if (vm.endOfStage) {
        ack.innerHTML = vm.acked ? '<div class="ok">Scorecard acknowledged.</div>' : '<p class="muted">End of the stage: check the scoring crew\'s scorecard and acknowledge it before the window closes.</p><button id="ta-ack-btn" class="primary">Acknowledge scorecard</button>';
        const b = ack.querySelector('#ta-ack-btn') as HTMLButtonElement | null; if (b) b.onclick = () => { act({ type: 'scorecard.ack' }); renderNow(); };
      } else ack.innerHTML = '';
    }
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
    const stopCalled = stopCalledTod !== null || sim.events.some(e => e.type === 'call.stop');
    const finishAsk = o.phase === 'running' ? finishPrompt(o.ahead, scenario, stopCalled) : null;
    const pending = o.driver.pendingTurn ? `turn ${o.driver.pendingTurn}` : keys.buffer ? `speed ${keys.buffer}…` : finishAsk;
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
    if (digitalSw) {
      // WATCH-008: the digital lap/split watch
      splitTracker.update(!!sw.frozen, sw.laps.length, o.tod);
      const dvm = digitalWatchViewModel(sw, { holdSeconds: o.rules.splitHoldSeconds, tod: o.tod, tracker: splitTracker });
      const dwW = Math.round(clamp(Math.min(instW * 0.42, (instH - 40) * 1.7), 250, 400)); dwatch.style.width = `${dwW}px`; dwatch.style.maxHeight = `${Math.max(120, instH - 4)}px`;
      lcdEl.style.fontSize = `${Math.round(clamp(dwW / 6.4, 28, 60))}px`;
      lcdEl.textContent = dvm.display; lcdEl.className = `dw-lcd lcd${dvm.frozen ? ' frozen' : ''}${dvm.mode === 'tod' ? ' tod' : ''}`;
      dwMode.textContent = dvm.modeLabel; dwMode.className = `modechip ${dvm.mode}`; dwInd.textContent = dvm.indicator; dwInd.className = `dw-ind${dvm.frozen ? ' frozen' : ''}`;
      dwStart.textContent = sw.running ? 'Stop' : 'Start'; dwReset.disabled = !dvm.canReset;
      const lapKey = `${dvm.laps.map(l => `${l.n}${l.recalled ? '*' : ''}`).join(',')}`;
      if (lapKey !== dwLaps.dataset.key) { dwLaps.dataset.key = lapKey; dwLaps.innerHTML = dvm.laps.length ? dvm.laps.map(l => `<div class="dw-lap${l.recalled ? ' recalled' : ''}" data-lap="${l.n}"><span class="ln">L${l.n}</span><span class="cbox"><span>${l.interval}</span><span>${l.cumulative}</span></span></div>`).join('') : '<span class="muted">no laps yet: L takes a split</span>'; }
      swCap.innerHTML = `${sw.running ? '<span class="ok">running</span>' : 'stopped'} · ${dvm.modeLabel}${sw.laps.length ? ` · ${sw.laps.length} lap${sw.laps.length === 1 ? '' : 's'}` : ''}`;
    } else {
      const swVm = stopwatchViewModel(sw.reading, sw.kind, { dialSeconds: sw.dialSeconds === 30 ? 30 : 60, registerMinutes: 30, bezel: sw.bezel, running: sw.running, laps: sw.laps });
      const sctx = prepare(swCanvas, swSize, swSize); if (sctx) drawStopwatch(sctx, swVm, swSize, theme);
      swCap.innerHTML = `${policy.digitalReadouts ? `<b id="lcd">${escapeHtml(swVm.digital)}</b> ` : ''}${sw.running ? '<span class="ok">running</span>' : 'stopped'} · bezel ${escapeHtml(sw.bezel.toFixed(1))} s${policy.digitalReadouts ? ` (${escapeHtml(sw.bezelRemaining.toFixed(1))} to go)` : ''}`;
      laps.replaceChildren(...swVm.lapRows.flatMap((r, i) => [el('span', { class: i === 0 ? 'cur' : '' }, `L${r.n}`), el('span', { class: i === 0 ? 'cur' : '' }, r.text), el('span', {}, `+${r.split}`)]));
    }
    const cvm = clockViewModel(o.tod, o.bezel);
    if (digitalClock) { clockDigital.textContent = cvm.digital; clockDigital.style.fontSize = `${Math.round(clamp(clSize / 3.2, 22, 56))}px`; }
    else { const cctx = prepare(clockCanvas, clSize, clSize); if (cctx) drawClock(cctx, cvm, clSize, theme); }
    clockCap.innerHTML = policy.digitalReadouts || digitalClock ? `<b>${digitalClock ? '' : escapeHtml(cvm.digital)}</b> ${digitalClock ? '' : '· '}start ${escapeHtml(formatClock(o.startTime))}` : `official start ${escapeHtml(formatClock(o.startTime))}`;
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
    hintScale.textContent = paused ? 'PAUSED' : `${scale}x${scale !== requested && !lockedTo1x ? ` (asked ${requested}x)` : ''}${lockedTo1x ? ' locked' : ''}`;
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
    if (finishAsk) callout.textContent = `${finishAsk}`;
    if (keys.modifiers.length) callout.textContent += `  [${keys.modifiers.join('')}+arrow]`;
    ledgerBody.innerHTML = `<div>Ledger: <b class="mono">${o.ledger === null ? 'not set' : escapeHtml((o.ledger > 0 ? '+' : '') + o.ledger + ' s')}</b> <span class="muted">(E)</span></div><div class="muted">${o.ta.hasTaPoints ? (o.ta.windowOpen ? 'TA window open: file the request in the form on the road view (T).' : 'Held by a train, an accident scene or emergency speed? At the yellow TA box press T for the form (15 minutes).') : 'Hazard held you? Time it on the watch and press T to declare a TA before the checkpoint.'}</div>${o.aids.earlyLate !== undefined ? `<div>Pace aid: <b class="mono">${escapeHtml(paceAidText(o.aids.earlyLate, sim.waitReason))}</b></div>` : ''}`;
    renderPerfCard(o, dwellSoFar);
    renderTa(o); renderCharts(o);
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
    const dep = el('button', { class: 'primary', id: 'depart' }, 'Depart now (D)'); dep.onclick = () => { if (blockedBySave()) return; act({ type: 'start' }); renderNow(); };
    const skip = el('button', { id: 'skip' }, 'Fast-forward to the start time'); skip.onclick = () => { if (blockedBySave()) return; act({ type: 'skipPreread' }); renderNow(); };
    const v0 = scenario.book[0]?.speed; let accel = ''; if (v0) { try { accel = ` Your car loses about ${accelLoss(v0, scenario.car).toFixed(1)} s getting up to ${v0} mph, so depart a few seconds early.`; } catch { accel = ''; } }
    const generic = `Official start ${formatClock(scenario.startTime)}. Read the book on the right: highlight pauses, write the GO time (pause minus your car's stop/start loss) next to each one. The ghost leaves exactly on the second.${accel}`;
    const keysRow = el('div', { class: 'keys3' }); for (const [k, d] of hint.keys) keysRow.append(el('div', {}, el('kbd', {}, k), ' ', d));
    const rs = restartLines(scenario);
    preread.append(el('div', { class: 'box' },
      resumeBanner(),
      el('h2', {}, drill ? `${drill.id}: ${drill.title}` : scenario.name),
      el('p', { class: 'objective' }, el('b', {}, 'Objective: '), objective),
      el('div', { class: 'keys-title muted' }, 'The keys that matter'), keysRow,
      el('p', {}, hint.preread ?? generic),
      rs.length ? el('p', { class: 'accent' }, rs.map(r => `Line ${r.line}: ${r.label}`).join(' · ')) : null,
      el('div', { class: 'big', id: 'countdown' }),
      el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' }, dep, skip),
      el('p', { class: 'muted', style: 'margin-top:8px' }, 'Space starts the stopwatch; most navigators start it on the official second and run it as time-of-day all day.')));
  }
  /** N4: the cockpit pre-read offers the saved run of this drill: Resume restores it exactly as Home does, Start fresh discards it. */
  function resumeBanner(): HTMLElement | null {
    if (!pendingSave) return null;
    const sv = pendingSave;
    const names = drill ? drill.tiers.map(t => t.name) : undefined;
    const ago = Math.max(0, Math.round((Date.now() - sv.savedAt) / 60000));
    const res = el('button', { class: 'primary', id: 'resume-run' }, 'Resume');
    res.onclick = () => {
      app.resume = true; pendingSave = null; const h = sourceHash(sv.source as RunSource);
      if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h;
    };
    const fresh = el('button', { id: 'start-fresh' }, 'Start fresh');
    fresh.onclick = () => { clearStored(LIVE_KEY); pendingSave = null; banner.remove(); flash('Saved run discarded'); renderNow(); };
    const banner = el('div', { class: 'resume-banner', id: 'resume-banner' },
      el('div', {}, el('b', {}, 'You have an unfinished run of this drill: '), `${describeSource(sv.source, names)} (saved ${ago} min ago, ${sv.actions.length} actions).`),
      el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:6px' }, res, fresh));
    return banner;
  }
  /** Starting a new run while a saved one is waiting would overwrite it: ask first. */
  function blockedBySave(): boolean {
    if (!pendingSave) return false;
    flash('You have an unfinished run: choose Resume or Start fresh first');
    return true;
  }
  function renderPerfCard(o: Observation, dwellSoFar: number): void {
    const fl = focusLine(o, rung, bookLen);
    const line = o.stoppedAtLine ?? (fl.line);
    const card = cachedCard(line);
    cardTitle.textContent = o.stoppedAtLine ? `Stopped: line ${line}` : policy.computedCard ? 'Perf card for the next line' : 'Your notes for this line';
    if (!card) { cardBody.innerHTML = ''; return; }
    const parts: string[] = [`<div><b>Line ${line}</b>: ${escapeHtml(card.text)}</div>`];
    const hold: HoldCard | null = policy.computedCard ? holdCardFor(scenario, sim, line, o.asp) : null;
    if (hold) parts.push(`<div class="holdcard ${hold.kind}" id="holdcard"><b>${escapeHtml(hold.title)}</b><div class="mono">${escapeHtml(hold.text)}</div></div>`);
    if (card.restart) {
      parts.push(`<div class="accent">Not a stop: call go so the car leaves at the out-time${card.restart.accel !== null ? ` minus the standing-start loss (${card.restart.accel.toFixed(1)} s)` : ''}.</div>`);
    } else if (card.mode === 'answers') {
      if (card.stop) {
        const s = card.stop; const more = waitMore(s, dwellSoFar);
        if (s.chart) parts.push(`<div class="chartline" id="chartline">Chart (b) Stop &amp; Go: ${s.vIn} in / ${s.vOut} out = sit <b class="mono">${s.chart.chart.toFixed(1)}</b> s for a 15 s stop${s.pause !== 15 ? `; this pause is ${s.pause} s: sit <b class="mono">${s.chart.sit.toFixed(1)}</b> s` : ''}</div>`);
        parts.push(`<div>Stop ${s.vIn} in / ${s.vOut} out${s.cap !== undefined ? ` (turn capped at ${s.cap} mph)` : ''}: loss <b class="mono">${s.loss.toFixed(1)}</b> s → dwell <b class="mono">${s.dwell.toFixed(1)}</b> s after "Stopped" <span class="muted">(set the bezel with ] )</span></div>`);
        if (o.stoppedAtLine === line && more !== null) parts.push(`<div class="stopnow">dwell so far <b class="mono">${Math.max(0, dwellSoFar).toFixed(1)}</b> s · ${more > 0.05 ? `wait <b class="mono">${more.toFixed(1)}</b> more s` : '<b class="ok">go now (G)</b>'}</div>`);
      } else if (card.stopNoPause) parts.push(`<div>STOP without pause: loss ${card.stopNoPause.loss.toFixed(1)} s is yours to recover.</div>`);
      if (card.timed) parts.push(`<div>Timed: hold ${card.timed.hold} for ${card.timed.seconds} s, call ${card.timed.then} at <b class="mono">${card.timed.call.toFixed(1)}</b> s (lead ${card.timed.lead.toFixed(1)})</div>`);
      else if (card.speedChange) parts.push(`<div>Speed ${card.speedChange.from} → ${card.speedChange.to}: call it <b class="mono">${card.speedChange.lead.toFixed(1)}</b> s before the landmark (${card.speedChange.ft} ft)</div>`);
      if (card.turnLoss) {
        const t = card.turnLoss;
        parts.push(`<div class="turnloss"><b>Turn loss</b> <span class="muted">(s lost slowing and re-accelerating, no stop)</span>${t.here ? `<div class="thisturn">This turn ${t.here.turn} ${t.here.vIn}${t.here.vIn !== t.here.vOut ? ` &rarr; ${t.here.vOut}` : ''} mph: <b class="mono">this turn: ${t.here.loss.toFixed(1)} s</b></div><div class="muted">${escapeHtml(t.here.rule.text)}</div>` : ''}${t.rows.map(r => `<div class="mono">${r.angle}&deg;: ${t.speeds.map((v, i) => `${v} <b>${r.losses[i]!.toFixed(1)}</b>`).join(' · ')}</div>`).join('')}</div>`);
      }
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
    return effectiveScale({ requested, paused, phase: o.phase, carStopped: o.carStopped, waitingForGo: o.driver.waitingForGo, nearestFeatureFt: nearest, hazardActive: hazard, countdownSeconds: o.aids.countdown ?? null, bezelRemaining: o.stopwatch.running && o.stopwatch.kind === 'analog' ? o.stopwatch.bezelRemaining : null, lockedTo1x });
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
          if (src.kind === 'drill' && src.drillId === 'D13') recordCampaignStage({ stage: src.seed, tier: src.tier, raw: result.score.raw, score: result.score.score, aces: result.score.aces, penaltyItems: result.score.penaltyItems, dnf: result.score.dnf });
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
