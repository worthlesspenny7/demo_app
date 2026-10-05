/** Cockpit (UI-009..UI-013): road view, instruments, GRIID book, lapboard drawer, keyboard, adaptive time scale, audio. */
import { Simulator, type Observation, type Action, type DriverMessage, type StageResult, type TaWitness, type TaRequestType } from '../../core/sim.js';
import type { Scenario, Node } from '../../core/course.js';
import { isMeasureRun } from '../../core/course.js';
import { loadChartNotes, saveChartNotes } from '../viewmodels/chartnotes.js';
import { accelLoss } from '../../core/perf-table.js';
import { formatClock, formatElapsed } from '../../core/units.js';
import { allDrills } from '../../core/drills/index.js';
import { stopwatchViewModel } from '../viewmodels/stopwatch.js';
import { clockViewModel, type EngineClock } from '../viewmodels/clock.js';
import { speedoViewModel } from '../viewmodels/speedo.js';
import { bookRows, bookLayout, rowCameo, stageDisplayName } from '../viewmodels/book.js';
import { columnAHtml, columnBHtml, columnCHtml, columnDHtml, taBannerHtml, infoBoxHtml, arrowClass, esc } from '../render/griid.js';
import { placeRowMarks } from '../render/handmarks.js';
import { chartGrids, simpleChart, leadSource, type ChartGrid, type SimpleChart } from '../viewmodels/charts.js';
import { holdCardFor, openTransitCard, clockReadPrompt, secondsToReach, alertExpired, ledgerTaHint, type HoldCard } from '../viewmodels/cockpitinfo.js';
import { digitalWatchViewModel, SplitTracker } from '../viewmodels/digitalwatch.js';
import { taFormVm, taNoteText, taRounding, taHelper, ownLappedDelay, buildTaRequest, allowanceSeconds, taStageOf, type TaFormMode } from '../viewmodels/ta.js';
import { taWebHtml, taPaperHtml, type TaFormState } from '../render/taform.js';
import { FULL_START_FF_LEAD } from '../viewmodels/curriculum.js';
import { inTimedInterval, startQueueVm, startLaunchFor, withheldLaunchText, launchPlanFromInfo, startCount, makeUpPlan, assignedAfter, scheduleCorrection, inCalibrationRun, nextCallPrompt, driverLineKind, paceCarsFrom, inTransitRun, type LaunchPlan, type StartCountVm } from '../viewmodels/v3.js';
import { formatInterval } from '../../core/griid.js';
import { effectiveScale, simAdvance, nextScale, defaultScaleFor, SCALE_STEPS } from '../viewmodels/timescale.js';
import { KeyMapper, KEY_HELP, type KeyCommand } from '../viewmodels/keys.js';
import { audioCues, AudioPlayer } from '../viewmodels/audio.js';
import { createAnnotations, HIGHLIGHTS, MARK_PRESETS, markRow, markAnnotation, formatPauseMark, formatLossMark, formatCarryMark, formatQuickMark, formatTodMark, formatTrainMark, type Highlight, type Mark, type MarkKind } from '../viewmodels/annotations.js';
import { chartLossFor } from '../../core/drills/preread.js';
import { cockpitLayout } from '../viewmodels/layout.js';
import { cpCards, debriefViewModel, type CpCard } from '../viewmodels/debrief.js';
import { instrumentPolicy, chartsHidden, HIDDEN_CHARTS_TEXT, HIDDEN_CAR_LINE_TEXT, paceAidText, perfCardFor, stopCardFor, cardDwell, waitMore, restartLabel, restartLines, focusLine, lineSpeeds, finishPrompt, type PerfCard, type StopCard } from '../viewmodels/cockpitinfo.js';
import { drillHint, hintBarText, scaleHintText } from '../viewmodels/hints.js';
import { LIVE_KEY, LAST_KEY, snapshotRun, saveStored, loadStored, clearStored, restoreSim, describeSource, sameDrillSource, type StoredSource } from '../viewmodels/resume.js';
import { recordCampaignStage } from '../viewmodels/campaign.js';
import { drawStopwatch } from '../render/stopwatch.js';
import { drawClock } from '../render/clock.js';
import { drawSpeedo } from '../render/speedo.js';
import { drawRoad } from '../render/road.js';
import { prepare, themeFromCss } from '../render/common.js';
import { app, buildScenario, withDriver, el, escapeHtml, sourceHash, saveSettings, type RunSource, type Run, type Settings } from '../state.js';

declare global { interface Window { __rally?: { sim: Simulator; advance(seconds: number): Observation; act(a: Action): Observation; observe(): Observation; result(): StageResult; finish(): void } } }

const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));
const sameSource = (a: StoredSource, b: RunSource): boolean => a.kind === b.kind && (a.kind === 'drill' ? b.kind === 'drill' && a.drillId === b.drillId && a.tier === b.tier && a.seed === b.seed && (a.attempt ?? 0) === (b.attempt ?? 0) : b.kind === 'builtin' && a.name === b.name && a.seed === b.seed);

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
  // PLAY-027: D06 notes of the last run of this seed are kept, so each pair can be driven again and the chart builds up
  if (!resuming && drill?.id === 'D06' && src.kind === 'drill' && src.tier >= 1 && src.attempt) startNote = `Attempt ${src.attempt + 1} of this seed: a new hidden car, so measure every pair again (notes from the last car do not carry over).`;   // PT-11 N-D2
  if (!resuming && drill?.id === 'D06' && src.kind === 'drill' && src.tier === 0) { const kept = loadChartNotes(src.tier, src.seed); if (kept.length) { for (const t of kept) { try { sim.act({ type: 'note', text: t }); } catch { /* skip */ } } startNote = `Your ${kept.length} chart note${kept.length === 1 ? ' is' : 's are'} kept from the last run of this seed: drive any pair again and add a new note for it (the last one per pair counts).`; } }
  const run: Run = { source: src, scenario, sim, drill, result: null, scaleMax: resuming?.scaleMax ?? 1, watch, annotations: null };
  app.run = run;
  const lockedTo1x = drill?.id === 'D01' || drill?.id === 'D03';
  const policy = instrumentPolicy(scenario.aids);
  const rung = policy.rung;
  const hiddenCharts = chartsHidden(scenario);   // PT-10 N-C1: D06 at Silver / Gold: the car's charts are what the player measures
  const withheldTimes = policy.computedCard && !policy.printsTimes;   // PT-11 N-D7: Silver prints no launch second
  const showTimes = policy.printsTimes && !hiddenCharts;   // PT-10 N-C7: the dwell and call times are printed at Bronze only (and never for a hidden car)
  const bookLen = scenario.book.length;
  const legalAsp = rung <= 1 && (scenario.asp ?? 0) > 0;   // N15: at the legal rungs the clock caption does not do the base + ASP arithmetic
  const hint = drillHint(drill?.id ?? null, watch);
  const objective = drill ? (drill.objectiveFor && src.kind === 'drill' ? drill.objectiveFor(src.tier) : drill.objective) : stageDisplayName(scenario.name);   // PLAY-032: never "fullStage #1"
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
    cockpit.style.setProperty('--road-h', `${short ? 46 : Math.round(L.roadFraction * 100)}%`);
    cockpit.classList.toggle('compact', short);
  };
  sizeCockpit();
  const roadCanvas = el('canvas', { id: 'road' }); const roadWrap = el('div', { class: 'road' }, roadCanvas);
  const hud = el('div', { class: 'hud' }); roadWrap.append(hud);
  const chipPhase = el('span', { class: 'chip', id: 'phase' }); const chipScale = el('span', { class: 'chip', id: 'scale' }); const chipLeg = el('span', { class: 'chip' }); const chipMsg = el('span', { class: 'chip alert', id: 'alert' }); chipMsg.style.display = 'none';
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
  hud.append(chipPhase, chipLeg, chipScale, scaleBtns, chipMsg);
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
  chartsPanel.append(el('h3', {}, hiddenCharts ? "Your car's charts" : `Your car's charts: ${scenario.car.name}`), chartsBody, chartsClose);
  const chartsBox = el('div', { class: 'help-backdrop', id: 'charts-overlay' }, chartsPanel); chartsBox.style.display = 'none';
  chartsBox.onclick = e => { if (e.target === chartsBox) setCharts(false); };
  let showCharts = false; let chartsKey = '';
  function setCharts(on: boolean): void { showCharts = on; chartsBox.style.display = on ? '' : 'none'; chartsKey = ''; if (on) renderCharts(obs); }
  function chartHtml(g: ChartGrid): string {
    // CHART-001: the printed axis labels (BRAKING down the side and ACCELERATION across the top on chart (a); IN speed / OUT speed on (b) and (c)), a blank grey diagonal on (a),
    // blanks for unmeasured cells, negatives in the warning colour, and the sheet's footnotes verbatim
    const head = `<tr><th class="axis-corner" colspan="2"></th><th class="axis axis-top" colspan="${g.speeds.length}">${esc(g.colAxis)}</th></tr><tr><th class="axis-corner" colspan="2"></th>${g.speeds.map(v => `<th class="${g.highlight?.out === v ? 'cur' : ''}">${v}</th>`).join('')}</tr>`;
    const body = g.rows.map((r, k) => `<tr>${k === 0 ? `<th class="axis axis-side" rowspan="${g.rows.length}">${esc(g.rowAxis)}</th>` : ''}<th class="${g.highlight?.in === r.in ? 'cur' : ''}">${r.in}</th>${r.cells.map(c => `<td class="${[c.hi ? 'cur' : '', c.blank ? 'blank' : '', c.unmeasured ? 'unmeasured' : '', c.neg ? 'neg' : ''].filter(Boolean).join(' ')}" data-in="${r.in}" data-out="${c.out}">${c.text}</td>`).join('')}</tr>`).join('');
    return `<div class="chart" id="chart-${g.id}"><h4>(${g.letter}) ${esc(g.title.toUpperCase())}</h4><p class="muted">${esc(g.note)}</p><div class="charttable-wrap"><table class="charttable"><thead>${head}</thead><tbody>${body}</tbody></table></div>${g.footnotes.map(f => `<p class="chart-foot">${esc(f)}</p>`).join('')}</div>`;
  }
  function renderCharts(o: Observation): void {
    if (!showCharts) return;
    const line = o.stoppedAtLine ?? manualLine ?? focusLine(o, rung, bookLen).line;
    const key = `${line}|${policy.computedCard}`; if (key === chartsKey) return; chartsKey = key;
    if (hiddenCharts) { chartsBody.innerHTML = `<p class="hidden-charts accent" id="charts-hidden">${esc(HIDDEN_CHARTS_TEXT)}</p>`; return; }
    const sp = lineSpeeds(scenario, line);
    const grids = chartGrids(scenario.car, policy.computedCard ? sp : null);
    chartsBody.innerHTML = `<p class="muted">${policy.computedCard ? `Line ${line}: ${sp.vIn ?? 0} in / ${sp.vOut ?? '?'} out is highlighted.` : 'Legal mode: find your own pair.'}</p>${grids.map(chartHtml).join('')}`;
  }
  // UI-031: the Time Allowance point form (TA-005)
  let taFocusPending = false;   // N11: T focuses the form's first field once the panel is drawn
  let taCollapsed = false; let taBuiltFor: string | null = null; let taSig = ''; let taMode: TaFormMode = scenario.rules.taMode === 'paper' ? 'paper' : 'web'; const taDraft: Record<string, string> = {};
  const taPanel = el('div', { class: 'ta-panel', id: 'ta-panel' }); taPanel.style.display = 'none';
  const taField = (id: string): HTMLInputElement | null => taPanel.querySelector(`#${id}`) as HTMLInputElement | null;
  const cpCardBox = el('div', { class: 'cpcard', id: 'cpcard' }); cpCardBox.style.display = 'none'; roadWrap.append(cpCardBox);
  // UI-037 / START-001: the start card (your time, launch time), the 30-second warning banner and the visible count; one on the road at a restart, one in the pre-read box
  // PLAY-004: the restart card and its count live at the top of the book column, outside the 155-px road view, so the count is never clipped at 1366x768
  const roadStart = el('div', { class: 'startcard road-start book-start', id: 'startcard-road' }); roadStart.style.display = 'none';
  type StartParts = { plan: HTMLElement; queue: HTMLElement; warn: HTMLElement; count: HTMLElement };
  const startCardParts = (host: HTMLElement): StartParts => {
    const sfx = host === roadStart ? '-road' : '';
    const plan = el('div', { class: 'launch-plan mono', id: `launch-plan${sfx}` });
    const queue = el('div', { class: 'start-queue', id: `start-queue${sfx}` });
    const warn = el('div', { class: 'start-warning', id: `start-warning${sfx}`, role: 'status' }); warn.style.display = 'none';
    const count = el('div', { class: 'start-count', id: `start-count${sfx}`, 'aria-live': 'assertive' }); count.style.display = 'none';
    host.append(plan, queue, warn, count); return { plan, queue, warn, count };
  };
  const roadStartParts = startCardParts(roadStart);
  let preStartParts: StartParts | null = null;
  const preread = el('div', { class: 'preread', id: 'preread' });

  // UI-033: the stopwatch follows Settings.watch (digital lap/split by default), the dash clock is always analog with no numeric time of day (REG II.H.1.d(1))
  const digitalSw = watch === 'digital';
  const clockCanvas = el('canvas', { id: 'clock' }); const swCanvas = el('canvas', { id: digitalSw ? 'stopwatch-dial' : 'stopwatch' }); const spCanvas = el('canvas', { id: 'speedo' });
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
  lcdEl.onclick = () => handle({ type: 'clock.read' });   // click the LCD in TOD mode: read the time of day off the watch
  lcdEl.title = 'in TOD mode: click (or K) to note a time-of-day read';
  const dwLaps = el('div', { class: 'dw-laps', id: 'laps' });
  const dwHint = el('div', { class: 'dw-hint muted', id: 'dw-hint' }, 'TOD (M) is your time of day: the director\'s source. The clock is for its second hand.');
  const dwLanyard = el('div', { class: 'dw-lanyard', 'aria-hidden': 'true', html: '<svg viewBox="0 0 74 16" preserveAspectRatio="xMidYMax meet"><path d="M10 16C10 2 64 2 64 16" fill="none" stroke="#1d4fb8" stroke-width="3" stroke-linecap="round"/><circle cx="37" cy="6" r="2.4" fill="#c9ccd3"/></svg>' });
  const dwatch = el('div', { class: 'dwatch', id: 'stopwatch' }, dwLanyard, el('div', { class: 'dw-top' }, dwMode, dwInd), lcdEl, dwHint, el('div', { class: 'dw-btns' }, dwStart, dwLap, dwRecall, dwReset), dwLaps);
  const splitTracker = new SplitTracker();
  const instruments = el('div', { class: 'instruments' },
    el('div', { class: 'instrument' }, clockCanvas, clockCap),
    el('div', { class: 'instrument' }, ...(digitalSw ? [dwatch, swCap] : [swCanvas, swCap, laps])),
    el('div', { class: 'instrument' }, spCanvas, spCap));
  clockCanvas.onclick = () => { act({ type: 'clock.read', source: 'clock' }); flash('Clock read noted'); };
  const left = el('div', { class: 'left' }, roadWrap, instruments, preread, taPanel);   // the TA form floats over the road and the clock; its header collapses it
  const hintScale = el('span', { class: 'chip', id: 'hint-scale' }, '1x');
  const hintBar = el('div', { class: 'hintbar', id: 'hintbar', title: 'objective and the keys that matter' },
    el('span', { class: 'hint-text' }, el('b', {}, drill ? `${drill.id}: ` : ''), hintBarText(objective, hint)),
    el('span', { class: 'hint-scale', id: 'hint-scalekeys', title: 'time scale keys; ? lists every key' }, el('kbd', {}, '?'), ' keys  ·  ', scaleHintText(lockedTo1x), ' ', hintScale));
  const printHref = `#/book/${src.kind === 'drill' ? `drill/${src.drillId}/${src.tier}/${src.seed}` : `builtin/${src.name}/${src.seed}`}`;
  const bookHead = el('div', { class: 'book-head' }, el('b', {}, 'GRIID'), el('span', { class: 'muted' }, `${stageDisplayName(scenario.name)} · ${scenario.book.length} lines · N / Shift+N move, click to set`),
    el('a', { id: 'book-print', href: printHref, target: '_blank', rel: 'noopener', title: 'the whole book, six rows a page, printable', style: 'margin-left:auto' }, 'Print book'));
  (bookHead.querySelector('#book-print') as HTMLAnchorElement).addEventListener('click', () => { try { saveLive(); } catch { /* best effort: the printable page reads the saved run's hand marks */ } });
  const rows = el('div', { class: 'rows', id: 'book' });
  const book = el('div', { class: 'book' }, bookHead, roadStart, rows);
  // drawer
  const callout = el('span', { class: 'callout', id: 'callout' });
  const promptWrap = el('span', { id: 'prompt' });
  const nextCallEl = el('span', { class: 'next-call', id: 'next-call', title: 'the next call to make (aids rung 2 and 3)' });
  const notesBox = el('div', { class: 'box' }, el('h4', {}, 'Lapboard notes'));
  const noteInput = el('input', { type: 'text', placeholder: 'note… Enter to keep', style: 'width:100%' }) as HTMLInputElement;
  noteInput.onkeydown = e => {
    if (e.key === 'Enter') { if (noteInput.value.trim()) { act({ type: 'note', text: noteInput.value.trim() }); noteInput.value = ''; } noteInput.blur(); }
    if (e.key === 'Escape') noteInput.blur();
    e.stopPropagation();
  };
  const notesList = el('div', { class: 'mono', style: 'font-size:12px' }); notesBox.append(noteInput, notesList);
  const cardTitle = el('h4', {}, 'Perf card'); const chartsBtn = el('button', { id: 'charts-btn', class: 'mini', title: 'C: the three handbook charts' }, 'Charts'); chartsBtn.onclick = () => setCharts(!showCharts);
  // CHART-007: a selectable card view: the simple chart (Speed | Dec | Acc | S/G | T@15 | T@20, default) or the three matrices behind the Charts overlay
  const chartViewSel = el('select', { id: 'chart-view', class: 'mini', title: 'what the card shows: the simple chart, or a pointer to the three matrices' }) as HTMLSelectElement;
  for (const [v, t] of [['simple', 'Simple chart'], ['matrices', 'Three charts']] as const) chartViewSel.append(el('option', { value: v, selected: app.settings.chartView === v ? true : null }, t));
  chartViewSel.onchange = () => { app.settings.chartView = chartViewSel.value === 'matrices' ? 'matrices' : 'simple'; saveSettings(app.settings); simpleKey = ''; renderNow(); };
  chartViewSel.onkeydown = e => e.stopPropagation();
  const cardBox = el('div', { class: 'box', id: 'perfcard' }, el('div', { class: 'cardhead' }, cardTitle, chartViewSel, chartsBtn)); const cardBody = el('div', {});
  const simpleBox = el('div', { class: 'simplechart', id: 'simplechart', title: simpleChart(scenario.car).note }); let simpleKey = '';
  const simple: SimpleChart = simpleChart(scenario.car);
  cardBox.append(cardBody, simpleBox);
  function renderSimpleChart(line: number): void {
    const view = app.settings.chartView; const sp = policy.computedCard ? lineSpeeds(scenario, line) : { vIn: null as number | null, vOut: null as number | null };
    const key = `${view}|${line}|${policy.computedCard}`; if (key === simpleKey) return; simpleKey = key;
    if (hiddenCharts) { simpleBox.innerHTML = `<div class="muted" id="simplechart-hidden">${esc(HIDDEN_CHARTS_TEXT)}</div>`; return; }
    if (view !== 'simple') { simpleBox.innerHTML = '<div class="muted" id="matrices-note">The three matrices (accel/decel, stop &amp; go, turns) are behind the Charts button (C).</div>'; return; }
    const near = (v: number | null): number | null => (v === null || v <= 0 ? null : simple.speeds.reduce((b, s) => (Math.abs(s - v) < Math.abs(b - v) ? s : b), simple.speeds[0]!));
    const hl = new Set([near(sp.vIn), near(sp.vOut)].filter((x): x is number => x !== null));
    const cls: Record<string, string> = { Dec: 'c-dec', Acc: 'c-acc', 'S/G': 'c-sg', 'TS/G': 'c-ts', 'T@15': 'c-t15', 'T@20': 'c-t20', Lead: 'c-lead' };
    simpleBox.innerHTML = `<table id="simplechart-table"><thead><tr><th>Speed</th>${simple.columns.map(c => `<th class="${cls[c]}">${c}</th>`).join('')}</tr></thead><tbody>${simple.rows.map(r => `<tr data-speed="${r.speed}" class="${hl.has(r.speed) ? 'cur' : ''}"><th>${r.speed}</th>${simple.columns.map(c => `<td class="${cls[c]}">${esc(r.text[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const cur = simpleBox.querySelector('tr.cur') as HTMLElement | null; if (cur) simpleBox.scrollTop = Math.max(0, cur.offsetTop - 40);   // keep the highlighted speed in view inside the small box
  }
  const ledgerBox = el('div', { class: 'box', id: 'ledgerbox' }, el('h4', {}, 'Ledger (E) and time allowance (T)')); const ledgerBody = el('div', {});
  // MAKEUP-001: log each chunk you make up; the running total falls with it
  const chunkIn = el('input', { type: 'number', step: '1', min: '0', placeholder: 's', id: 'makeup-chunk', style: 'width:64px', title: 'seconds you have just made up' }) as HTMLInputElement;
  const chunkBtn = el('button', { id: 'makeup-log', class: 'mini' }, 'Log chunk');
  const chunkRow = el('div', { class: 'chunkrow', id: 'makeup-chunkrow' }, el('span', { class: 'muted' }, 'Made up a chunk: '), chunkIn, chunkBtn); chunkRow.style.display = 'none';
  chunkIn.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') chunkBtn.click(); if (e.key === 'Escape') chunkIn.blur(); };
  chunkBtn.onclick = () => { const n = Number(chunkIn.value); if (!(n > 0)) { flash('Enter the seconds you made up'); return; } const cur = sim.observe({ peek: true }); const base = cur.ledgerEntries?.length ? cur.ledgerEntries : (cur.ledger ? [{ seconds: cur.ledger, source: 'ledger' }] : []); act({ type: 'ledger.set', entries: [...base, { seconds: -n, source: 'made up' }] }); chunkIn.value = ''; renderNow(); };
  ledgerBox.append(ledgerBody, chunkRow);
  const logBox = el('div', { class: 'box log' }, el('h4', {}, 'Driver')); const logBody = el('div', { id: 'driverlog' }); logBox.append(logBody);
  const lapboard = el('div', { class: `lapboard${hasCal ? ' with-cal' : ''}` }, ledgerBox, cardBox, notesBox, logBox);
  if (hasCal) lapboard.append(calibrationBox());
  const drawer = el('div', { class: 'drawer' },
    el('div', { class: 'bar' }, el('span', { class: 'muted' }, 'Callout:'), callout, promptWrap, nextCallEl, el('span', { class: 'muted', style: 'margin-left:auto' }, `${scenario.car.name} · ${scenario.driver.name} (${scenario.driver.skill}) · ${scenario.speedo.kind} speedo · aids rung ${rung}${rung <= 1 ? ' (legal: no digital readouts)' : ''}`)),
    lapboard);
  cockpit.append(hintBar, left, book, drawer, helpBox, chartsBox);
  root.replaceChildren(cockpit);

  // ---------- state ----------
  let requested = defaultScaleFor(drill?.id ?? null, app.settings.timeScale, lockedTo1x);   // PT-10: D16's transits and holds run at 8x by default
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
  let followedExec: number | null = null; let stoppedFollowed: number | null = null;
  /** PLAY-008: a line the player put the book on by hand (key, click, line.set); cleared at the next check-off. */
  let manualLine: number | null = null; let manualAtExec: number | null = null;
  let stopCalledTod: number | null = null;
  let stopWaitTod: number | null = null;
  let lastSave = performance.now();
  const theme = themeFromCss();
  if (startNote) setTimeout(() => flash(startNote), 0);

  function act(a: Action): void { try { sim.act(a); } catch (e) { flash(String((e as Error).message)); } }
  let flashTod = 0;
  function flash(msg: string): void { chipMsg.textContent = msg; chipMsg.style.display = ''; flashUntil = performance.now() + 3500; flashTod = sim.tod; }

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
    // CAL-006: a stock speedometer cannot be adjusted: correct by schedule from the measured error ("1 s per N minutes")
    const errIn = el('input', { type: 'number', step: '0.1', placeholder: 'error s (+late)', id: 'cal-err', style: 'width:96px', title: 'seconds late (+) or early (-) at the end of the run' }) as HTMLInputElement;
    const runIn = el('input', { type: 'number', step: '0.1', placeholder: 'run min', id: 'cal-run', style: 'width:70px', value: '28', title: 'length of the run in minutes' }) as HTMLInputElement;
    const sched = el('span', { class: 'mono', id: 'cal-schedule' }, '');
    const calcSched = (): void => {
      const e = Number(errIn.value), m = Number(runIn.value);
      sched.textContent = errIn.value === '' ? 'Schedule correction (stock speedometer): enter the error and the run length.' : scheduleCorrection(e, m).text;
    };
    errIn.oninput = calcSched; runIn.oninput = calcSched; calcSched();
    for (const i of [errIn, runIn]) i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') i.blur(); };
    box.append(el('div', { class: 'schedrow' }, el('span', { class: 'muted' }, 'Schedule: '), errIn, runIn, sched));
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
      case 'clock.read': { const fromWatch = digitalSw && obs.stopwatch.mode === 'tod'; act(fromWatch ? { type: 'clock.read', source: 'stopwatch' } : { type: 'clock.read' }); flash(fromWatch ? 'Watch TOD read noted' : 'Clock read noted'); break; }   // INST-002: a read of the watch's TOD mode counts as a clock read
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
        else { const n = Math.max(1, Math.min(bookLen, obs.currentLine + cmd.delta)); setManual(n); act({ type: 'line.set', n }); }
        break;
      case 'line.home': setManual(1); act({ type: 'line.set', n: 1 }); break;
      case 'line.end': setManual(bookLen); act({ type: 'line.set', n: bookLen }); break;
      case 'scale': if (!lockedTo1x) requested = nextScale(requested, cmd.delta); break;
      case 'pause': paused = !paused; break;
      case 'ta': {
        if (obs.ta.hasTaPoints) { if (obs.ta.windowOpen) { taCollapsed = false; taFocusPending = true; } else flash('No Time Allowance window: requests are taken for 15 minutes after a TA point (the yellow box)'); }
        else promptFor('Time allowance (seconds)', v => act({ type: 'ta.declare', seconds: v }));
        break;
      }
      case 'count': { countingStop = !countingStop; lastCountSent = null; flash(countingStop ? 'Counting the stop out loud: 9 ... 1, GO, and on 0, 1, 2 until the car goes' : 'Stop count off'); break; }
      case 'call.warn': { act({ type: 'call.warn' }); flash('Told the driver: about 30 seconds'); break; }
      case 'pullUp': {
        const sq = startQueueVm(obs.startQueue, obs.tod, rung);
        act({ type: 'pullUp' });   // the engine refuses it while the car ahead is still at the sign and counts the refusal
        flash(sq.state === 'waiting' ? 'Refused: the car ahead is still at the sign. Wait until it leaves on its minute.' : sq.state === 'none' ? 'There is no start sign here.' : 'Pulled up to the sign: wait for your launch time.');
        break;
      }
      case 'identify': promptText('Identify: what to look for (the driver answers "I see it too")', obs.nextCall?.call ?? '', t => act({ type: 'call.identify', text: t })); break;
      case 'ledger': promptFor('Ledger: seconds late (+) / early (-)', v => act({ type: 'ledger.set', seconds: v })); break;
      case 'buffer': break;
    }
    renderNow();
  }
  /** N13: a mark's prompt opens beside the row it writes on (in the row's strip), not in the drawer bar; the book is not rebuilt while it is open. */
  let markPromptOpen = false;
  function promptText(labelText: string, dflt: string, cb: (t: string) => void, opts: { host?: HTMLElement | null; empty?: string } = {}): void {
    const inp = el('input', { type: 'text', placeholder: labelText, value: dflt, class: opts.host ? 'mark-input' : '', id: opts.host ? 'mark-input' : '', style: opts.host ? 'width:210px' : 'width:300px' }) as HTMLInputElement;
    const close = (): void => { if (opts.host) { markPromptOpen = false; lastBookKey = ''; } else promptWrap.replaceChildren(); root.focus(); };
    inp.onkeydown = e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = inp.value.trim(); if (v) cb(v); else flash(opts.empty ?? 'Nothing to identify: type what to look for'); close(); renderNow(); }
      if (e.key === 'Escape') { close(); if (opts.host) renderNow(); }
    };
    if (opts.host) { markPromptOpen = true; opts.host.append(inp); } else promptWrap.replaceChildren(inp);
    inp.focus(); inp.select();
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
  rows.onclick = e => { const r = (e.target as HTMLElement).closest('.row') as HTMLElement | null; if (r && !(e.target as HTMLElement).closest('input,button')) { setManual(Number(r.dataset.n)); act({ type: 'line.set', n: Number(r.dataset.n) }); renderNow(); } };
  function setManual(n: number): void { manualLine = Math.max(1, Math.min(bookLen, n)); manualAtExec = sim.observe({ peek: true }).driver.lastExecutedLine; }
  /** PREREAD-001: write a preset hand mark on the book. The text typed is formatted as the real mark ("10.2" -> "P10.2", "2.9" -> "-2.9", "3:47" -> "TRAIN Delay 3:47" with a star). */
  function writeMark(kind: MarkKind, n: number, pageTop: boolean): void {
    const ins = scenario.book[n - 1]; if (!ins) return;
    const sp = lineSpeeds(scenario, n); const show = showTimes;   // the suggested numbers are the answer sheet: Bronze only
    const known = show && sp.vIn !== null && sp.vOut !== null ? chartLossFor(scenario, ins, { vIn: sp.vIn, vOut: sp.vOut }) : null;
    const dwell = show ? cardDwell(scenario, n) : null;
    const dflt: Record<MarkKind, string> = { pause: dwell !== null ? String(Math.round(dwell * 10) / 10) : '', loss: known !== null ? String(known) : '', carry: show && sp.vIn ? String(sp.vIn) : '', quick: String(n), tod: show && ins.restartTime !== undefined ? formatTodMark(ins.restartTime) : '', cp: '', train: '' };
    const label: Record<MarkKind, string> = { pause: 'chart pause time in seconds (P10.2)', loss: 'seconds lost (circled, written negative: -2.9)', carry: 'speed carried (mph)', quick: 'the row that comes quick (number)', tod: 'time of day (9:34:00)', cp: 'checkpoint number and time: CP3 9:14:22', train: 'delay m:ss (TRAIN Delay 3:47)' };
    const host = rows.querySelector(`.row[data-n="${n}"] .ann`) as HTMLElement | null;
    promptText(label[kind], dflt[kind], raw => {
      const num = Number(raw.replace(/^[Pp]/, '').replace(/^-/, '').replace(',', '.'));
      let text = raw.trim(); let star = false;
      if (kind === 'pause' && Number.isFinite(num)) text = formatPauseMark(num);
      else if (kind === 'loss' && Number.isFinite(num)) text = formatLossMark(num);
      else if (kind === 'carry' && Number.isFinite(num)) text = formatCarryMark(num);
      else if (kind === 'quick') text = formatQuickMark(Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : n);
      else if (kind === 'cp') text = /^CP/i.test(text) ? text.toUpperCase() : `CP${text}`;
      else if (kind === 'train') { const m = /^(\d+):(\d{2})$/.exec(text); text = m ? formatTrainMark(Number(m[1]) * 60 + Number(m[2])) : /^train/i.test(text) ? text : `TRAIN Delay ${text}`; star = true; }
      const mark: Mark = { kind, text, ...(star ? { star: true } : {}) };
      const row = markRow(kind, n, pageTop);
      ann.addMark(row, mark);
      try { sim.act({ type: 'line.annotate', n: row, text: markAnnotation(mark) } as Action); } catch { /* older engine */ }
      lastBookKey = ''; flash(`Marked line ${row}: ${text}`); renderNow();
    }, { host, empty: `Nothing written on line ${n}: type ${label[kind]}, or Esc to cancel` });
  }
  function renderBook(o: Observation): void {
    const key = `${o.currentLine}|${o.stoppedAtLine ?? ''}|${o.driver.lastExecutedLine ?? ''}|${o.phase}|${ann.serialize().length}|${Object.keys(o.annotations ?? {}).length}`;
    if (key === lastBookKey || markPromptOpen) return; lastBookKey = key; lastExecuted = o.driver.lastExecutedLine ?? lastExecuted;
    const frag = document.createDocumentFragment();
    const layout = bookLayout(scenario);   // GRIID-014: page breaks from the row heights (the hand-laid-out drill book keeps its own count)
    for (const r of bookRows(scenario.book, o.currentLine, { timeZone: scenario.timeZone, style: scenario.bookStyle })) {
      const pageNo = layout.pageOfIndex[r.n - 1] ?? 1;
      const pageTop = r.n > 1 && pageNo !== (layout.pageOfIndex[r.n - 2] ?? 1);
      if (pageTop) {
        // PREREAD-001: the hand marks that live on the page edges: "COMES QUICK" with the circled row number at the bottom of the previous page, the carried speed at the top centre
        const quick = ann.marks(r.n - 1).find(m => m.kind === 'quick'), carry = ann.marks(r.n).find(m => m.kind === 'carry');
        const bar = el('div', { class: 'page-break' }, el('span', { class: 'pb-left' }, quick ? el('span', { class: 'hand quick-note', title: 'written at the bottom of the previous page' }, quick.text) : stageDisplayName(scenario.name)), el('span', { class: 'pb-mid' }, carry ? el('span', { class: 'hand carry-top', title: 'speed carried from the previous page' }, carry.text) : ''), el('span', {}, `Page ${pageNo} of ${layout.pages}`));
        frag.append(bar);
      }
      const ins = scenario.book[r.n - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined;
      const hls = ann.highlights(r.n);
      const stopped = o.stoppedAtLine === r.n;
      const row = el('div', { class: `row ${r.state}${stopped ? ' stopped' : ''}${lastExecuted !== null && r.n <= lastExecuted ? ' executed' : ''}${r.omitted ? ' omitted' : ''} ${hls.map(h => `hl-${h}`).join(' ')}`, 'data-n': String(r.n) });
      const svg = rowCameo(node, ins);
      const dCell = el('div', { class: 'gd' });
      dCell.innerHTML = `${stopped ? '<span class="stoptag">STOPPED HERE </span>' : ''}${columnDHtml(r)}${r.omitted ? ' <em>(omitted)</em>' : ''}${o.aids.cumulativePerfectAtNextLine !== undefined && r.isCurrent ? `<span class="cold accent">perfect cumulative ${esc(formatElapsed(o.aids.cumulativePerfectAtNextLine, 0))}</span>` : ''}`;
      if (r.ta) { row.classList.add('ta-row'); row.append(el('div', { class: 'gn' }, r.printed), el('div', { class: 'tabanner-cell', html: taBannerHtml(r) })); }   // REG Example #18: a full-width yellow row
      else if (r.info !== null) { row.classList.add('info-row'); row.append(el('div', { class: 'gn' }, r.printed), el('div', { class: 'ga', html: columnAHtml({ svg }) }), el('div', { class: 'gbc', html: infoBoxHtml(r) }), dCell); }   // GRIID-016: the Information Box over B and C
      else row.append(el('div', { class: 'gn' }, r.printed), el('div', { class: 'ga', html: columnAHtml({ svg }) }),
        el('div', { class: arrowClass('gb', r), html: columnBHtml(r) }), el('div', { class: arrowClass('gc', r), html: columnCHtml(r), title: r.colC }), dCell);
      // PREREAD-001: the hand marks written on this row (the page-edge ones are drawn in the page-break bars); the same drawing the printable page uses
      placeRowMarks(row, ann.marks(r.n), { pause: r.pause, pageTop: r.n > 1 && pageNo !== (layout.pageOfIndex[r.n - 2] ?? 1), lastOnPage: layout.pageOfIndex[r.n] !== undefined && layout.pageOfIndex[r.n] !== pageNo });
      // annotation strip: highlighters + GO-time for pause lines (UI-013)
      const strip = el('div', { class: 'ann' });
      for (const h of HIGHLIGHTS) { const b = el('button', { class: `hl-btn ${h}`, title: `highlight ${h}` }); b.onclick = ev => { ev.stopPropagation(); ann.toggleHighlight(r.n, h as Highlight); lastBookKey = ''; renderBook(sim.observe({ peek: true })); }; strip.append(b); }
      if (r.pause) {
        const go = el('input', { class: 'go-time', placeholder: 'GO at', value: ann.goTime(r.n) || (ann.marks(r.n).length ? '' : (o.annotations?.[r.n] ?? '')) }) as HTMLInputElement;
        go.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') go.blur(); };
        go.onchange = () => { ann.setGoTime(r.n, go.value); try { sim.act({ type: 'line.annotate', n: r.n, text: go.value } as Action); } catch { /* older engine */ } };
        strip.append(el('span', { class: 'muted' }, `0 MPH / ${formatInterval(r.pause)}`), go);
        // the answer sheet (same turn-capped loss as the Debrief) only where the aids ladder allows it
        if (showTimes) { const d = cardDwell(scenario, r.n); if (d !== null) strip.append(el('span', { class: 'muted', title: 'card dwell = pause - stop/start loss (turn-capped)' }, `card ${d.toFixed(1)} s`)); }
      }
      // the hand marks of PREREAD-001 as presets: choose one, type the number (a suggestion is filled in where the aids ladder shows answers), and it is written on the right row
      if (!r.ta && r.info === null) {
        const msel = el('select', { class: 'mark-sel', title: 'write a mark on the book: P10.2 beside the struck pause, a circled loss, the speed carried, COMES QUICK, a time of day, a TRAIN delay with a star' }) as HTMLSelectElement;
        msel.append(el('option', { value: '' }, 'Mark…'), ...MARK_PRESETS.map(pr => el('option', { value: pr.kind }, pr.label)));
        msel.onclick = ev => ev.stopPropagation(); msel.onkeydown = ev => ev.stopPropagation();
        msel.onchange = () => { const kind = msel.value as MarkKind; msel.value = ''; if (kind) writeMark(kind, r.n, pageTop); };
        strip.append(msel);
      }
      row.append(strip); frag.append(row);
    }
    rows.replaceChildren(frag);
    const cur = (rows.querySelector('.row.stopped') ?? rows.querySelector('.row.current')) as HTMLElement | null; if (cur) cur.scrollIntoView({ block: 'center' });
  }

  // ---------- UI-031 Time Allowance point form ----------
  let taLoggedIn = false; let taShowFiled = false;
  function buildTaPanel(vm: ReturnType<typeof taFormVm>): void {
    const first = vm.legs.find(l => l.measured > 0) ?? vm.legs[0];
    const mode: TaFormMode = taMode;
    const carDefault = String((scenario as unknown as { carNumber?: number | string }).carNumber ?? '');
    const formState: TaFormState = { stageDefault: taStageOf(scenario.book), draft: taDraft, legs: vm.legs, first: first ? { legIndex: first.legIndex, fromLine: first.fromLine, toLine: first.toLine, suggested: first.suggested, cause: first.cause } : null, carDefault, loggedIn: taLoggedIn, endOfStage: vm.endOfStage, acked: vm.acked };
    taPanel.innerHTML = `<div class="ta-head"><b>${esc(mode === 'paper' ? 'Time Delay Form (classic paper sheet)' : vm.title)}</b><span class="mono" id="ta-count"></span><label class="ta-paper-toggle" title="the older paper sheet handed to an official at lunch or at the finish; practice only"><input type="checkbox" id="ta-paper" ${mode === 'paper' ? 'checked' : ''}> classic paper</label>${vm.endOfStage ? `<button id="ta-done-pin" class="mini ta-done-pin" type="button" title="the red Done button of the lessons: press it once, after the last Time Allowance of the ENTIRE stage"${vm.acked ? ' disabled' : ''}>Done (red button)</button>` : ''}<button id="ta-toggle" class="mini" title="collapse / expand">_</button></div>
      <div class="ta-body" id="ta-body">
        <p class="muted ta-help">${mode === 'paper' ? 'The paper sheet (older rally schools): fill it in at the stop, hand it to an official at lunch or at the finish. ' : 'The 2026 web form (grscores.com/timeallowance), filed within 15 minutes of the TA point; the red button at the end of the day prints the scorecard. '}Time in multiples of 0m10s (up to 29m30s). Example: <i>${esc(vm.example)}</i></p>
        <details class="ta-worksheet" id="ta-worksheet" open><summary>Your worksheet (not on the form)</summary>
          <div class="ta-helper mono" id="ta-helper"></div>
          <table class="ta-legs" id="ta-legs"></table>
          <div class="ta-work">
            <label>Delay (s) <input id="ta-delay" type="number" min="0" step="1" value="${first ? Math.round(first.measured) : ''}"></label>
            <label>Made up (s) <input id="ta-madeup" type="number" min="0" step="1" value="${first ? Math.round(first.recoverable) : ''}"></label>
            <span id="ta-round" class="ta-round"></span>
            <div class="ta-pattern mono" id="ta-pattern"></div>
          </div>
        </details>
        <div class="ta-form" id="ta-form">${mode === 'paper' ? taPaperHtml(formState) : taWebHtml(formState)}</div>
        <div id="ta-filed" class="ta-filed"></div>
        <div id="ta-ack"></div>
      </div>`;
    const legSel = taField('ta-leg') as unknown as HTMLSelectElement;
    if (first) legSel.value = String(first.legIndex);
    const val = (id: string): string => (taPanel.querySelector(`#${id}`) as HTMLInputElement | null)?.value ?? '';
    const num = (id: string): number => Number(val(id));
    const advice = (leg: number): ReturnType<Simulator['taAdvice']> => sim.taAdvice(leg);
    const measuredOf = (leg: number): number => taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)).legs.find(l => l.legIndex === leg)?.measured ?? 0;
    const refresh = (): void => {
      const leg = Number(legSel.value); const req = allowanceSeconds(val('ta-min'), val('ta-sec'));
      const rd = taRounding(req, measuredOf(leg));
      const r = taPanel.querySelector('#ta-round'); if (r) { r.textContent = rd.text; r.classList.toggle('adj', rd.changed); }
      const pat = taPanel.querySelector('#ta-pattern'); if (pat) pat.textContent = taNoteText({ delay: num('ta-delay') || 0, madeUp: num('ta-madeup') || 0, request: rd.adjusted, cause: val('ta-cause').replace(/^delayed by\s+/i, '') });
      let h = ''; try { h = taHelper(advice(leg), policy.computedCard ? ownLappedDelay(sim.observe({ peek: true }).stopwatch) : null).text; } catch { h = ''; }   // PLAY-032: Bronze shows the navigator's own lap beside the engine's
      const he = taPanel.querySelector('#ta-helper'); if (he) he.textContent = h;   // TAF-002: measured = stopped + chart loss, make up the odd seconds
    };
    const setVal = (id: string, value: string): void => { const e = taField(id); if (e) { e.value = value; taDraft[id] = value; } };
    const fillFor = (leg: number): void => {
      const l = taFormVm(sim.observe({ peek: true }).ta, x => sim.taAdvice(x)).legs.find(x => x.legIndex === leg); if (!l) return;
      legSel.value = String(leg);
      setVal('ta-delay', String(Math.round(l.measured))); setVal('ta-madeup', String(Math.round(l.recoverable)));
      setVal('ta-min', String(Math.floor(l.suggested / 60))); setVal('ta-sec', String(l.suggested % 60));
      setVal('ta-from', l.fromLine === null ? '' : String(l.fromLine)); setVal('ta-to', l.toLine === null ? '' : String(l.toLine));
      if (l.cause) setVal(mode === 'paper' ? 'ta-circumstances' : 'ta-cause', mode === 'paper' ? `caught by a ${l.cause}` : `Delayed by ${l.cause}`);   // the cause the engine saw (a train, a tractor, ...)
      refresh();
    };
    const fieldIds = ['ta-car', 'ta-password', 'ta-phone', 'ta-stage', 'ta-delay', 'ta-madeup', 'ta-min', 'ta-sec', 'ta-from', 'ta-to', 'ta-cause', 'ta-circumstances', 'ta-signature', 'ta-status', 'ta-w1-car', 'ta-w1-name', 'ta-w1-role', 'ta-w2-car', 'ta-w2-name', 'ta-w2-role'];
    for (const id of fieldIds) {
      const f = taField(id); if (!f) continue;
      f.addEventListener('input', () => { taDraft[id] = f.value; refresh(); }); f.addEventListener('change', () => { taDraft[id] = f.value; refresh(); });
      f.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') f.blur(); if (e.key === 'Enter' && (f as HTMLElement).tagName !== 'TEXTAREA') (taPanel.querySelector(taLoggedIn || taMode === 'paper' ? '#ta-submit' : '#ta-login') as HTMLButtonElement).click(); });
    }
    taPanel.querySelectorAll('input[name="ta-type"]').forEach(r => r.addEventListener('change', () => { taDraft['ta-type'] = (r as HTMLInputElement).value; }));
    legSel.addEventListener('change', () => fillFor(Number(legSel.value))); legSel.addEventListener('keydown', e => e.stopPropagation());
    (taPanel.querySelector('#ta-legs') as HTMLElement).onclick = e => { const b = (e.target as HTMLElement).closest('button[data-leg]') as HTMLElement | null; if (b) fillFor(Number(b.dataset.leg)); };
    (taPanel.querySelector('#ta-toggle') as HTMLElement).onclick = () => { taCollapsed = !taCollapsed; };
    const paper = taPanel.querySelector('#ta-paper') as HTMLInputElement; paper.onchange = () => { taMode = paper.checked ? 'paper' : 'web'; taBuiltFor = null; taSig = ''; };
    // web: the login page (Car Number, Password, Phone Number) comes first
    const login = taPanel.querySelector('#ta-login') as HTMLButtonElement | null;
    if (login) login.onclick = () => {
      if (!val('ta-car').trim() || !val('ta-password').trim() || !val('ta-phone').trim()) { flash('Fill in Car Number, Password and Phone Number'); return; }
      if (!/^\d{4}$/.test(val('ta-password').trim())) { flash('The password is four digits'); return; }
      taLoggedIn = true; (taPanel.querySelector('#ta-login-screen') as HTMLElement).hidden = true; (taPanel.querySelector('#ta-entry-screen') as HTMLElement).hidden = false; flash('Logged in to the Time Allowance page');
    };
    const see = taPanel.querySelector('#ta-see') as HTMLButtonElement | null;
    if (see) see.onclick = () => { taShowFiled = !taShowFiled; taSig = ''; renderNow(); };
    const doAck = (): void => {
      // N12: a measured delay with no request filed: ask before the Done button closes the day
      { const fv = taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)); const open = fv.endOfStage ? fv.legs.filter(l => l.measured >= 10 && !l.filed && l.suggested >= 10) : [];
        if (open.length && !confirm(`Leg ${open.map(l => l.legIndex).join(', ')} has a measured delay (${open.map(l => formatInterval(l.measured)).join(', ')}) and no Time Allowance request filed. Cancel to file it first (Use, then Submit); OK to close the day without it.`)) return; }
      if (!taFormVm(sim.observe({ peek: true }).ta, l => sim.taAdvice(l)).endOfStage) { flash('Press the red Done button once, after the last Time Allowances of the ENTIRE stage (the end-of-stage TA point)'); return; }
      act({ type: 'scorecard.ack' }); renderNow();
    };
    const ackBtn = taPanel.querySelector('#ta-ack-btn') as HTMLButtonElement | null;
    if (ackBtn) ackBtn.onclick = doAck;
    const pin = taPanel.querySelector('#ta-done-pin') as HTMLButtonElement | null;   // PLAY-010: the same red Done button, pinned in the header so it is never below the fold
    if (pin) pin.onclick = doAck;
    (taPanel.querySelector('#ta-submit') as HTMLButtonElement).onclick = () => {
      const witnesses: TaWitness[] = [1, 2].map(n => ({ car: val(`ta-w${n}-car`).trim(), description: val(`ta-w${n}-name`).trim(), ...(val(`ta-w${n}-role`) ? { role: val(`ta-w${n}-role`) as 'contestant' | 'official' } : {}) }));
      const typeSel = taPanel.querySelector('input[name="ta-type"]:checked') as HTMLInputElement | null;
      const r = buildTaRequest(taMode, {
        car: val('ta-car'), password: val('ta-password'), phone: val('ta-phone'), stage: val('ta-stage'), leg: Number(legSel.value), from: val('ta-from'), to: val('ta-to'), minutes: val('ta-min'), seconds: val('ta-sec'),
        reason: val('ta-cause'), circumstances: val('ta-circumstances'), type: (typeSel?.value as TaRequestType | undefined) ?? 'time-allowance', status: val('ta-status') === 'navigator' ? 'navigator' : 'driver', signature: val('ta-signature'), witnesses,
        delay: num('ta-delay') || 0, madeUp: num('ta-madeup') || 0,
      });
      if ('error' in r) { flash(r.error); return; }
      act(r.action); flash(taMode === 'web' ? 'Time Allowance submitted' : 'Sheet handed in');
      renderNow();
    };
    refresh();
  }
  function renderTa(o: Observation): void {
    const vm = taFormVm(o.ta, leg => sim.taAdvice(leg));
    if (!vm.visible) { taPanel.style.display = 'none'; taBuiltFor = null; return; }
    taPanel.style.display = ''; taPanel.classList.toggle('collapsed', taCollapsed);
    const built = `${o.ta.windowEndsTod}|${vm.legs.map(l => l.legIndex).join(',')}|${taMode}`;
    if (taBuiltFor !== built) { taBuiltFor = built; taSig = ''; buildTaPanel(vm); }
    const count = taPanel.querySelector('#ta-count'); if (count) count.textContent = `window ${vm.countdown} left`;
    if (taFocusPending) {
      taFocusPending = false;
      const order = taMode === 'paper' ? ['ta-car', 'ta-stage', 'ta-from', 'ta-to', 'ta-min', 'ta-sec'] : taLoggedIn ? ['ta-stage', 'ta-from', 'ta-to', 'ta-min', 'ta-cause'] : ['ta-car', 'ta-password', 'ta-phone'];
      const fields = order.map(id => taField(id)).filter((f): f is HTMLInputElement => !!f);
      (fields.find(f => f.value === '') ?? fields[0])?.focus();
    }
    const sig = JSON.stringify([vm.legs.map(l => [l.measured, l.recoverable, l.suggested, l.fromLine, l.toLine, l.filed?.adjusted ?? null]), vm.requests.length, vm.ackAvailable, vm.acked]);
    if (sig === taSig) return; taSig = sig;
    const legsEl = taPanel.querySelector('#ta-legs'); if (legsEl) legsEl.innerHTML = `<thead><tr><th>Leg</th><th title="measured delay">Delay</th><th title="time you could have made up">Made up</th><th title="suggested request">Suggest</th><th>Lines</th><th></th></tr></thead><tbody>${vm.legs.map(l => `<tr data-leg="${l.legIndex}"><td>${l.legIndex}</td><td class="mono">${formatInterval(l.measured)}</td><td class="mono">${formatInterval(l.recoverable)}</td><td class="mono"><b>${formatInterval(l.suggested)}</b></td><td>${l.fromLine !== null ? `${l.fromLine}-${l.toLine}` : '-'}</td><td><button class="mini" data-leg="${l.legIndex}">Use</button></td></tr>`).join('')}</tbody>`;
    const filed = taPanel.querySelector('#ta-filed') as HTMLElement | null; if (filed) filed.style.display = taMode === 'paper' || taShowFiled ? '' : 'none';
    if (filed) filed.innerHTML = vm.requests.length ? `<b>Filed</b>${vm.requests.map(r => `<div class="${r.status === 'refused' ? 'danger' : ''}">Leg ${r.legIndex}: ${formatInterval(r.requested)}${r.adjustment ? ` (${esc(r.adjustment)})` : ''} ${r.status === 'refused' ? `refused: ${esc(r.reason ?? '')}` : 'filed'}</div>`).join('')}` : '';
    const ack = taPanel.querySelector('#ta-ack') as HTMLElement | null;
    if (ack) {
      ack.innerHTML = vm.endOfStage ? (vm.acked ? '<div class="ok" id="ta-acked">Scorecard acknowledged.</div>' : '<p class="muted">End of the stage: press the red Done button (pinned at the top of this form) once the last Time Allowance is in, so the scoring crew can print your scorecard.</p>') : '';
      const rb = taPanel.querySelector('#ta-ack-btn') as HTMLButtonElement | null; if (rb) rb.disabled = vm.acked;
      const pb = taPanel.querySelector('#ta-done-pin') as HTMLButtonElement | null; if (pb) pb.disabled = vm.acked;
    }
  }

  // ---------- render ----------
  /** Keep the book on the line being executed: at rung >= 1 the pointer follows the driver's check-off (C1). */
  function autoFollow(): void {
    { const le0 = sim.observe({ peek: true }).driver.lastExecutedLine; if (manualLine !== null && le0 !== manualAtExec) manualLine = null; }   // the driver checked a line off: the card follows him again
    if (rung < 1) return;
    const p = sim.observe({ peek: true });
    // PLAY-008: stopped at a sign the navigator can read: the book goes to that line (no N needed at the first stop)
    if (p.stoppedAtLine && p.stoppedAtLine !== stoppedFollowed) { stoppedFollowed = p.stoppedAtLine; if (p.currentLine !== p.stoppedAtLine) act({ type: 'line.set', n: p.stoppedAtLine }); return; }   // once per stop: the player may look elsewhere after
    if (!p.stoppedAtLine) stoppedFollowed = null;
    if (scenario.aids.autoAdvanceLine) return;
    const le = p.driver.lastExecutedLine;
    if (le === null || le === followedExec) return;
    followedExec = le;
    const n = Math.min(bookLen, le + 1);
    if (p.currentLine !== n) act({ type: 'line.set', n });
  }
  // ---------- UI-037 / MAKEUP-001 / CAL-006: the ledger ----------
  function ledgerHtml(o: Observation): string {
    const calRun = inCalibrationRun(scenario, o.driver.lastExecutedLine);
    const untimedNow = !calRun && (inTransitRun(scenario, o.driver.lastExecutedLine) || (!!o.stoppedAtLine && sim.waitReason === 'hold'));   // N14: untimed states show no pace aid
    const ledgerLine = `<div>Ledger: <b class="mono">${o.ledger === null ? 'not set' : escapeHtml((o.ledger > 0 ? '+' : '') + o.ledger + ' s')}</b> <span class="muted">(E)</span></div>`;
    const taLine = `<div class="muted" id="ta-hint">${escapeHtml(ledgerTaHint(o.ta, o.driver.state === 'offcourse' || o.driver.state === 'uturn' || o.driver.state === 'returning'))}</div>`;   // PLAY-032
    // CAL-006: no early/late cue at any rung during the calibration run: the navigator does the math afterwards
    const paceLine = calRun ? '<div class="muted" id="cal-nofeedback">Calibration run: no early/late feedback. Hold the speed, lap each point, do the math after.</div>'
      : untimedNow ? '<div class="muted" id="untimed-note">Nothing is timed here (transit, warm-up or hold): no early / late number.</div>'
      : o.aids.earlyLate !== undefined ? `<div>Pace aid: <b class="mono">${escapeHtml(paceAidText(o.aids.earlyLate, sim.waitReason))}</b></div>` : '';
    // MAKEUP-001: the running total with the 10 % and 20 % options in mph and seconds, and the reminder to drop the extra at the next sign
    const entries = o.ledgerEntries ?? [];
    const owed = typeof o.makeUpTotal === 'number' && entries.length ? o.makeUpTotal : o.ledger;   // MAKEUP-001: the running total of the make-up entries
    const nextIns = scenario.book[o.driver.lastExecutedLine ?? 0];
    const mk = makeUpPlan(owed, assignedAfter(scenario, o.driver.lastExecutedLine), { inTimedInterval: inTimedInterval(scenario, sim.events, o.tod), pause: nextIns?.pause ?? null });
    let makeUp = '';
    const run = sim.makeUp;   // the engine saw a call at least 8 % over the assigned speed: a make-up in progress
    const runLine = run ? `<div class="muted" id="makeup-running">Make-up in progress: ${run.calledMph} mph, +${run.pct} % over ${run.assigned}, for ${Math.max(0, Math.round(o.tod - run.sinceTod))} s: about ${Math.max(0, Math.round((o.tod - run.sinceTod) * run.pct / 100))} s made up so far. Drop it at the next speed-change sign.</div>` : '';
    if (!calRun && mk.owed !== 0) {
      makeUp = `<div class="makeup" id="makeup"><div><b>Make-up total: <span class="mono" id="makeup-owed">${mk.owed > 0 ? '+' : ''}${Math.round(mk.owed)} s</span></b> <span class="muted">(${mk.direction === 'over' ? 'drive over' : 'drive under'}, in chunks)</span></div>`
        + (entries.length ? `<div class="muted" id="makeup-entries">${entries.map(e => `${escapeHtml(e.source)} ${e.seconds > 0 ? '+' : ''}${e.seconds}`).join(', ')}</div>` : '')
        + runLine
        + (mk.options.length ? `<table class="makeup-opts" id="makeup-opts"><tbody>${mk.options.map(x => `<tr data-pct="${x.pct}"><td>${mk.owed < 0 ? '-' : '+'}${x.pct} %</td><td class="mono">${x.mph} mph</td><td class="mono">${x.seconds} s</td><td class="muted">${x.perMinute} s per minute</td></tr>`).join('')}</tbody></table>` : '')
        + `<div class="muted" id="makeup-chunks">Chunks: ${mk.chunks.map(c => `${c.minutes} min = ${c.gain10} s (+10 %) / ${c.gain20} s (+20 %)`).join('; ')}</div>`
        + `<div class="makeup-drop" id="makeup-drop">${escapeHtml(mk.dropReminder)}</div>`
        + (mk.timedWarning ? `<div class="danger" id="makeup-timed">${escapeHtml(mk.timedWarning)}</div>` : '')
        + (mk.stopShortening ? `<div class="muted" id="makeup-stop">${escapeHtml(mk.stopShortening)}</div>` : '')
        + '</div>';
    }
    return ledgerLine + taLine + paceLine + makeUp;
  }

  // ---------- UI-037 / START-001: the start card, the 30-second warning and the count ----------
  /** The start (pre-read) or the restart the car is waiting at: your time, launch time, and the count relative to the launch second. */
  function activeLaunch(o: Observation): { plan: LaunchPlan; line: number } | null {
    if (!policy.computedCard) return null;   // the numbers are the answer sheet: legal runs (rung <= 1) work the launch out themselves
    const info = launchPlanFromInfo(o.launch);   // the engine's own launch plan (START-001): own time, net loss, launch time
    if (info && o.launch) return { plan: info, line: o.launch.line };
    if (o.phase === 'preread') { const plan = startLaunchFor(scenario, 1); return plan ? { plan, line: 1 } : null; }
    if (o.phase === 'running' && o.stoppedAtLine && sim.waitReason === 'hold') { const plan = startLaunchFor(scenario, o.stoppedAtLine); return plan ? { plan, line: o.stoppedAtLine } : null; }
    return null;
  }
  let lastCount: StartCountVm | null = null;
  // PROTO-001: the navigator's count (the engine's driver echoes each number and says "keep counting" past zero)
  let countingStop = false; let lastCountSent: number | null = null; const startBeatsSent = new Set<number>();
  function renderStartCard(o: Observation): void {
    const al = activeLaunch(o);
    const cnt = al ? startCount(o.tod, al.plan.launchTod, withheldTimes) : null; lastCount = cnt;
    const atSign = o.phase === 'preread' || (o.phase === 'running' && !!o.stoppedAtLine && sim.waitReason === 'hold');
    const q = atSign ? startQueueVm(o.startQueue, o.tod, rung) : null;
    const paint = (parts: StartParts, show: boolean): void => {
      parts.queue.textContent = show && q ? q.text : ''; parts.queue.dataset.state = show && q ? q.state : '';
      if (!show || !al || !cnt) { parts.plan.textContent = ''; parts.warn.style.display = 'none'; parts.count.style.display = 'none'; return; }
      parts.plan.textContent = `Line ${al.line}: ${withheldTimes ? withheldLaunchText(al.plan, lineSpeeds(scenario, al.line).vOut) : al.plan.text}`;   // PT-11 N-D7
      parts.warn.style.display = cnt.warning && !o.launch?.warned ? '' : 'none'; if (cnt.banner) parts.warn.textContent = cnt.banner;   // B19: the banner goes once W has warned the driver
      parts.count.style.display = cnt.beatText !== null ? '' : 'none'; if (cnt.beatText !== null) { parts.count.textContent = cnt.beatText; parts.count.dataset.beat = cnt.beatText; parts.count.className = `start-count${cnt.phase === 'go' ? ' go' : ''}`; }
    };
    const onRoad = o.phase !== 'preread' && atSign;
    paint(roadStartParts, onRoad); roadStart.style.display = onRoad && (al || (q && q.state !== 'none')) ? '' : 'none';
    if (preStartParts) paint(preStartParts, o.phase === 'preread');
  }
  function sendCounts(o: Observation, dwellSoFar: number): void {
    // the start count: after W (the 30-second warning) each visible beat 10 ... 1 is the navigator's count to the driver
    const al = activeLaunch(o);
    if (al && o.launch?.warned && lastCount && lastCount.phase === 'counting' && lastCount.beat !== null && !startBeatsSent.has(lastCount.beat)) { startBeatsSent.add(lastCount.beat); act({ type: 'count', n: lastCount.beat }); }
    if (!al) startBeatsSent.clear();
    // the stop count: from the rock-back down the card dwell to zero, then 1, 2, ... while the car has not gone
    if (countingStop && o.stoppedAtLine && o.carStopped && showTimes) {
      const pc = cachedCard(o.stoppedAtLine); const total = pc?.stop ? Math.round(pc.stop.dwell) : null;
      if (total !== null) { const el = Math.floor(Math.max(0, dwellSoFar)); const n = el <= total ? total - el : el - total; if (n !== lastCountSent) { lastCountSent = n; act({ type: 'count', n }); } }
    } else if (!o.stoppedAtLine) lastCountSent = null;
  }
  /** N16: the driver's echoed count (a bare digit per beat) is one updating line, not ten lines that push his questions out of the log. */
  function pushDriver(m: DriverMessage): void {
    const last = driverLog[driverLog.length - 1];
    if (last && driverLineKind(m) === 'count' && driverLineKind(last) === 'count') driverLog[driverLog.length - 1] = m; else driverLog.push(m);
  }
  function renderNow(): void { autoFollow(); obs = sim.observe(); for (const m of obs.driver.messages) pushDriver(m); if (obs.stoppedAtLine && stopWaitTod === null) stopWaitTod = obs.tod; else if (!obs.stoppedAtLine) stopWaitTod = null; draw(obs); }
  function draw(o: Observation): void {
    const w = roadWrap.clientWidth || 600, h = roadWrap.clientHeight || 240;
    const rctx = prepare(roadCanvas, w, h);
    const lastLine = driverLog.length ? driverLog[driverLog.length - 1]! : null;
    const stopCalled = stopCalledTod !== null || sim.events.some(e => e.type === 'call.stop');
    const finishAsk = o.phase === 'running' ? finishPrompt(o.ahead, scenario, stopCalled) : null;
    const pending = o.driver.pendingTurn ? `turn ${o.driver.pendingTurn}` : keys.buffer ? `speed ${keys.buffer}…` : finishAsk;
    // pace aid: at a STOP show how long to wait (rung 3) or only early / late (rung 2), not the raw count to zero (PT-02 BUG-10)
    const dwellSoFar = stopWaitTod !== null ? o.tod - stopWaitTod : 0;
    const calRun = inCalibrationRun(scenario, o.driver.lastExecutedLine);   // CAL-006: no pace bar, no early/late cue and no countdown cue during the calibration run
    // N14: nothing is timed against the ghost in a transit or warm-up, in a calibration run or while the car waits at a hold: no "+N s late", no EARLY arrow (a rung 3 hold keeps its "wait N s more")
    const holdWaiting = !!o.stoppedAtLine && sim.waitReason === 'hold';
    const untimed = calRun || inTransitRun(scenario, o.driver.lastExecutedLine) || holdWaiting || o.phase === 'preread';
    let pace: number | null = calRun || (untimed && !(holdWaiting && rung >= 3)) ? null : (o.aids.earlyLate ?? null); let paceMode: 'seconds' | 'arrow' | 'wait' = 'seconds'; let waitMoreS: number | null = null;
    if (o.stoppedAtLine && pace !== null) {
      if (rung >= 3) {
        const pc = cachedCard(o.stoppedAtLine);
        if (pc?.restart) { const ins = scenario.book[o.stoppedAtLine - 1]; waitMoreS = ins?.restartTime !== undefined ? Math.round((ins.restartTime - Math.round(pc.restart.accel ?? 0) - o.tod) * 10) / 10 : null; }
        else waitMoreS = hiddenCharts ? null : waitMore(cachedStop(o.stoppedAtLine), dwellSoFar);   // N-C1: a hidden car's chart pause time is not on the road either
        paceMode = waitMoreS === null ? 'arrow' : 'wait';
      } else paceMode = 'arrow';
    }
    if (rctx) drawRoad(rctx, o, w, h, theme, { pendingCallout: pending, driverLine: lastLine ? lastLine.text : null, pace, paceMode, waitMore: waitMoreS, countdown: calRun ? null : (o.aids.countdown ?? null), offCourseHint: o.offCourseHint, showDistances: policy.digitalReadouts, paceCars: paceCarsFrom(o).filter(c => !(c.side === 'ahead' && o.ahead.some(f => f.kind === 'car'))), gaining: !!o.cues?.gainingOnCarAhead });
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
    const cvm = clockViewModel(o.tod, o.bezel, { rung, slop: o.rules.clockMinuteSlop, engine: (o.clock as EngineClock | undefined) ?? null });   // INST-001: the loose minute hand
    { const cctx = prepare(clockCanvas, clSize, clSize); if (cctx) drawClock(cctx, cvm, clSize, theme, app.settings.clockFace); }
    clockCanvas.dataset.minuteAmbiguous = String(cvm.minuteAmbiguous); clockCanvas.dataset.face = app.settings.clockFace;
    if (digitalSw) dwMode.classList.toggle('attn', cvm.minuteAmbiguous && sw.mode !== 'tod');
    clockCap.innerHTML = `${legalAsp ? `official start = printed base ${escapeHtml(formatClock(scenario.baseStartTime ?? o.startTime))} + your ASP` : `official start ${escapeHtml(formatClock(o.startTime))}`}${cvm.minuteAmbiguous ? '<div class="clock-warn" id="clock-warn">minute hand is between marks: read the minute on the watch (TOD, M)</div>' : ''}`;   // no numeric time of day at any aids rung (REG II.H.1.d(1))
    const svm = speedoViewModel(o.speedo.reading, 100);
    const pctx = prepare(spCanvas, spSize, spSize); if (pctx) drawSpeedo(pctx, svm, spSize, theme, o.driver.targetIndicated);
    spCap.innerHTML = `${policy.digitalReadouts ? `<b>${escapeHtml(svm.text)}</b> mph · ` : ''}${o.driver.targetIndicated !== null ? `holding ${escapeHtml(String(o.driver.targetIndicated))}` : 'no speed called'}`;
    // HUD
    chipPhase.textContent = o.phase === 'preread' ? (policy.digitalReadouts ? `PRE-READ · start in ${formatElapsed(Math.max(0, o.secondsToStart), 0)}` : 'PRE-READ') : o.phase === 'running' ? `${o.stoppedAtLine ? 'stopped' : o.driver.state}` : 'FINISHED';
    chipPhase.className = `chip ${o.driver.waitingForGo ? 'warn' : o.phase === 'running' ? 'live' : ''}`;
    chipLeg.textContent = o.legIndex === null ? 'leg ?' : `leg ${o.legIndex}`;
    const scale = currentScale(o);
    chipScale.textContent = paused ? 'PAUSED' : `${scale}x${scale !== requested && !paused ? ` (asked ${requested}x)` : ''}${lockedTo1x ? ' locked' : ''}`;
    chipScale.className = `chip ${paused ? 'alert' : scale > 1 ? 'warn' : ''}`;
    hintScale.textContent = paused ? 'PAUSED' : `${scale}x${scale !== requested && !lockedTo1x ? ` (asked ${requested}x)` : ''}${lockedTo1x ? ' locked' : ''}`;
    scaleBtns.querySelectorAll('button[data-scale]').forEach(b => { (b as HTMLButtonElement).style.outline = Number((b as HTMLElement).dataset.scale) === requested ? '2px solid var(--accent)' : ''; });
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    if (flashUntil && alertExpired(performance.now(), flashUntil, sim.tod, flashTod)) { chipMsg.style.display = 'none'; flashUntil = 0; }   // PLAY-032: an alert also expires in sim time (fast-forward, 8x)
    renderStartCard(o);
    sendCounts(o, dwellSoFar);
    // pre-read overlay
    if (o.phase === 'preread') {
      preread.style.display = '';
      if (!preread.firstChild) buildPreread();
      // PLAY-004: 45 s before the launch the box folds itself away (unless the player chose), so the clock and the watch can be read
      { const al0 = o.launch ?? sim.launchInfo(scenario.book[0] ?? null); if (!prereadUserChoice && al0 && al0.launchTime - o.tod <= 45 && !prereadCollapsed && !pendingSave) setPrereadCollapsed(true); }
      const cd = preread.querySelector('#countdown'); if (cd) cd.textContent = policy.digitalReadouts ? `T ${o.secondsToStart >= 0 ? '-' : '+'} ${formatElapsed(Math.abs(o.secondsToStart), 1)}` : '';
    } else preread.style.display = 'none';
    // drawer
    callout.textContent = keys.buffer ? `${keys.buffer}_ (Enter calls it)` : o.driver.pendingTurn ? `turn ${o.driver.pendingTurn} pending` : o.driver.targetIndicated !== null ? `holding ${o.driver.targetIndicated}` : '-';
    if (finishAsk) callout.textContent = `${finishAsk}`;
    nextCallEl.textContent = o.nextCall !== undefined ? (o.nextCall ? `Next call: ${o.nextCall.text}` : '') : (nextCallPrompt(scenario, o.driver.lastExecutedLine, rung) ?? '');   // PROTO-001: at rung >= 2 the reminder of the next call
    if (keys.modifiers.length) callout.textContent += `  [${keys.modifiers.join('')}+arrow]`;
    ledgerBody.innerHTML = ledgerHtml(o);
    chunkRow.style.display = ledgerBody.querySelector('#makeup') ? '' : 'none';
    renderPerfCard(o, dwellSoFar);
    renderTa(o); renderCharts(o);
    notesList.innerHTML = o.notes.slice(-4).map(n => `<div>· ${escapeHtml(n)}</div>`).join('');
    logBody.innerHTML = driverLog.slice(-8).map(m => { const k = driverLineKind(m); return `<div class="${m.kind === 'question' ? 'q' : ''} dl dl-${k}" data-kind="${k}"><span class="muted mono">${policy.digitalReadouts ? escapeHtml(formatClock(m.tod)) : ''}</span> ${escapeHtml(m.text)}</div>`; }).join('') || '<div class="muted">Dad has not said anything yet.</div>';
    renderBook(o);
    // CP card (DEBRIEF-004)
    if (sim.events.length > seenEvents) {
      const fresh = sim.events.slice(seenEvents); seenEvents = sim.events.length;
      if (fresh.some(e => e.type === 'checkpoint' && e.detail?.kind === 'timing')) { try { const r = sim.result(); const cards = cpCards(r.events, r.attribution, scenario.aids, scenario); activeCard = cards[cards.length - 1] ?? null; } catch { activeCard = null; } }
    }
    if (activeCard && o.tod <= activeCard.showUntil) { cpCardBox.style.display = ''; cpCardBox.innerHTML = `Checkpoint ${escapeHtml(activeCard.cpId)}: <b>${activeCard.error > 0 ? '+' : ''}${activeCard.error}</b> s${activeCard.largestBucket ? `<div class="muted">largest: ${escapeHtml(activeCard.largestBucket)} ${activeCard.largestBucketSeconds > 0 ? '+' : ''}${activeCard.largestBucketSeconds} s${activeCard.largestEvent ? ` · ${escapeHtml(activeCard.largestEvent)}` : ''}</div>` : ''}`; }
    else cpCardBox.style.display = 'none';
  }
  // PLAY-004: the pre-read box collapses to a strip over the road (start card, countdown, buttons) so the clock and the stopwatch stay visible during the launch
  let prereadCollapsed = false; let prereadUserChoice = false;
  function setPrereadCollapsed(on: boolean, byUser = false): void {
    prereadCollapsed = on; if (byUser) prereadUserChoice = true;
    preread.classList.toggle('collapsed', on);
    const t = preread.querySelector('#preread-toggle'); if (t) t.textContent = on ? 'Show the pre-read' : 'Hide the pre-read (show clock and watch)';
  }
  function buildPreread(): void {
    const drillStart = scenario.startProcedure === 'drill';   // PLAY-005: D01-D05 launch themselves on the printed second
    const dep = el('button', { class: drillStart ? '' : 'primary', id: 'depart', title: drillStart ? 'leave now, before your launch second (an early departure)' : 'leave now' }, drillStart ? 'Depart early (D)' : 'Depart now (D)'); dep.onclick = () => { if (blockedBySave()) return; act({ type: 'start' }); renderNow(); };
    const warnBtn = el('button', { id: 'warn-driver', title: 'W: tell the driver "about 30 seconds"' }, 'Warn the driver (W)'); warnBtn.onclick = () => handle({ type: 'call.warn' });
    const pullBtn = el('button', { id: 'pull-up', title: 'Q: pull up to the start sign, once the car ahead has left' }, 'Pull up (Q)'); pullBtn.onclick = () => handle({ type: 'pullUp' });
    const li0 = sim.launchInfo(scenario.book[0] ?? null); const minus = li0 ? Math.round(li0.ownTime - li0.launchTime) : 0;
    const skip = el('button', { id: 'skip', class: drillStart ? 'primary' : '' }, drillStart ? 'Fast-forward to the launch' : `Fast-forward to ${FULL_START_FF_LEAD} s before the launch`);
    skip.onclick = () => { if (blockedBySave()) return; act({ type: 'skipPreread', secondsBefore: minus + (drillStart ? 5 : FULL_START_FF_LEAD) }); renderNow(); };   // PLAY-026: a full start stops 45 s before the launch second, so the warning and the count still happen
    const toggle = el('button', { id: 'preread-toggle', class: 'mini', title: 'collapse the pre-read to a strip over the road' }, 'Hide the pre-read (show clock and watch)'); toggle.onclick = () => setPrereadCollapsed(!prereadCollapsed, true);
    const v0 = li0?.speed; let accel = '';
    // N15: the legal rungs get no launch arithmetic (the numbers are the answer sheet): the standing-start loss is looked up on your own chart
    if (v0 && li0) accel = !policy.computedCard
      ? (drillStart ? ' Drill start: no queue and no count. The car launches itself on your launch second: your time minus the standing-start loss of your chart.' : ' Your car loses time getting up to speed (the 0 to speed cell of your chart), so launch that many seconds before your time.')
      : withheldTimes ? (drillStart ? ` Drill start: no queue and no count. The car launches itself on your launch second: your time minus the standing-start loss to ${v0} mph (simple chart, Acc at ${v0}), to the whole second.` : ` Your car loses time getting up to ${v0} mph: launch early by the standing-start loss (simple chart, Acc at ${v0}), to the whole second.`)   // PT-11 N-D7: Silver prints no launch second
      : drillStart ? ` Drill start: no queue and no count. The car launches itself at ${formatClock(li0.launchTime)}, your time minus ${minus} s for its ${li0.netLoss.toFixed(1)} s standing-start loss to ${v0} mph.` : ` Your car loses about ${li0.netLoss.toFixed(1)} s getting up to ${v0} mph, so launch ${minus} s before your time (${formatClock(li0.launchTime)}).`;
    const measureRun = isMeasureRun(scenario);
    // PLAY-027 / PT-10 N-C9: ONE statement about the launch on a measuring run: leave ON your second, no lead (the generic sentence below says nothing else about it)
    if (measureRun) accel = hiddenCharts || !(scenario.tags ?? []).includes('charts:packard')
      ? ' A measuring run: leave ON your second (no launch lead) and call every speed AT its sign; read the pace aid at each MARK in and out, and the net (out minus in) is the chart.'
      : ' Copy mode: leave ON your second (no launch lead) and call every speed AT its sign, so the Packard is driven the way its chart is made; copy the printed cell for each pair.';
    const readBook = measureRun ? 'Read the book on the right: each MARK line says what to read there.' : "Read the book on the right: highlight pauses, write the GO time (pause minus your car's stop/start loss) next to each one.";
    const generic = drillStart
      ? `Official start ${formatClock(scenario.startTime)}. ${readBook}${accel} Wait for it or fast-forward; leaving earlier is an early departure.`
      : `Official start ${formatClock(scenario.startTime)}. ${readBook} The ghost leaves exactly on the second.${accel} Nobody releases you: wait for your time, give the driver the 30-second warning, and ${measureRun ? 'launch ON your second.' : 'launch your standing-start loss early.'}`;
    const keysRow = el('div', { class: 'keys3' }); for (const [k, d] of hint.keys) keysRow.append(el('div', {}, el('kbd', {}, k), ' ', d));
    const rs = restartLines(scenario);
    const preStart = el('div', { class: 'startcard keep' }); preStartParts = startCardParts(preStart);
    preread.append(el('div', { class: 'box' },
      resumeBanner(),
      el('div', { class: 'keep preread-top' }, el('h2', {}, drill ? `${drill.id}: ${drill.title}` : stageDisplayName(scenario.name)), toggle),
      preStart,
      el('div', { class: 'keep prebtns', style: 'display:flex;gap:8px;justify-content:center;margin:6px 0;flex-wrap:wrap' }, ...(drillStart ? [skip, dep] : [pullBtn, warnBtn, dep, skip])),   // N10: the buttons sit above the fold of the box
      el('p', { class: 'objective' }, el('b', {}, 'Objective: '), objective),
      el('div', { class: 'keys-title muted' }, 'The keys that matter'), keysRow,
      el('p', {}, drillStart && hint.preread ? `${hint.preread}${accel.replace(' Drill start: no queue and no count.', '')}` : hint.preread ?? generic),   // PLAY-032: the drill-start sentence once
      rs.length ? el('p', { class: 'accent' }, rs.map(r => `Line ${r.line}: ${r.label}`).join(' · ')) : null,
      el('div', { class: 'big keep', id: 'countdown' }),
      el('p', { class: 'muted', style: 'margin-top:8px' }, 'Space starts the stopwatch for intervals. Time of day comes from the clock (or the watch in TOD mode, M), never from a running chrono.')));
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
    fresh.onclick = () => { if (!confirm('Start fresh and discard the saved run? It cannot be resumed afterwards.')) return; clearStored(LIVE_KEY); pendingSave = null; banner.remove(); flash('Saved run discarded'); renderNow(); };   // PLAY-010: discarding asks first
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
    const line = o.stoppedAtLine ?? manualLine ?? fl.line;   // PLAY-008: the line the player moved the book to wins until the driver's next check-off
    const card = cachedCard(line);
    cardTitle.textContent = o.stoppedAtLine ? `Stopped: line ${line}` : policy.computedCard ? 'Perf card for the next line' : 'Your notes for this line';
    renderSimpleChart(line);
    if (!card) { cardBody.innerHTML = ''; return; }
    const parts: string[] = [`<div><b>Line ${line}</b>: ${escapeHtml(card.text)}</div>`];
    const drillStart = scenario.startProcedure === 'drill';
    let hold: HoldCard | null = policy.computedCard ? (holdCardFor(scenario, sim, line, o.asp) ?? openTransitCard(scenario, sim, o.driver.lastExecutedLine)) : null;   // UI-032: an open exact transit keeps its recorded IN time on the card
    if (hold && hold.start && drillStart) hold = null;   // N8/N9: a drill start launches itself: no "Restart, line 1" block, no count
    const lp = policy.computedCard ? startLaunchFor(scenario, line) : null;   // START-001: your time, launch at your time minus the standing-start loss
    if (lp) parts.push(`<div class="launchcard" id="launchcard"><b>Launch</b> <span class="mono">${esc(withheldTimes ? withheldLaunchText(lp, lineSpeeds(scenario, line).vOut) : lp.text)}</span><div class="muted">${drillStart ? 'A drill start: the car launches itself on that second (fast-forward to it if you like).' : 'Warn the driver about 30 s before; count so the last count lands on the launch second.'}</div></div>`);
    if (hold) {
      const atHold = o.stoppedAtLine === hold.line && hold.goTod !== null;
      const toOut = atHold ? hold.goTod! - o.tod : null;
      let toSign: number | null = null;
      if (hold.kind === 'transit') { const hn = nodes.get(scenario.book[hold.line - 1]?.nodeId ?? ''); if (hn) toSign = secondsToReach(sim.car.s, sim.car.v, hn.s); }   // PLAY-029: only as the IN sign comes up
      const readK = policy.computedCard ? clockReadPrompt(hold, toOut, toSign) : null;   // N7: Bronze asks for the clock read the Debrief grades
      parts.push(`<div class="holdcard ${hold.kind}" id="holdcard"><b>${escapeHtml(hold.title)}</b><div class="mono">${escapeHtml(hold.text)}</div>${!hold.start && hold.lead !== null && hold.goTod !== null && hold.lead > 0 ? `<div class="holdlead" id="holdlead">Say go at <b class="mono">${escapeHtml(formatClock(hold.goTod - hold.lead))}</b>: the out-time minus the ${hold.lead} s standing-start loss, the same lead at every hold.</div>` : ''}${readK ? `<div class="readclock accent" id="readclock"><b>${escapeHtml(readK)}</b></div>` : ''}</div>`);
    }
    // PLAY-002: the transit in force prints no speed and none is called yet: its pace stays on the card whatever line the pointer is on
    { let tp = card.transitPace ?? null;
      if (!tp && o.phase === 'running' && o.driver.targetIndicated === null) for (let n = line; n >= 1; n--) { const ins = scenario.book[n - 1]; if (ins?.transit?.end) break; if (ins?.transit && !ins.transit.end) { tp = cachedCard(n)?.transitPace ?? null; break; } }
      if (tp) parts.push(`<div class="transitpace accent" id="transitpace">${escapeHtml(tp.text)}</div>`); }
    if (card.measure) parts.push(`<div class="measure accent" id="measure-card">${escapeHtml(card.measure)}</div>`);   // PLAY-027
    if (card.restart) {
      parts.push(`<div class="accent">Not a stop: call go so the car leaves at the out-time${card.measure ? ', ON the second' : ''}${card.restart.accel !== null ? ` minus ${Math.round(card.restart.accel)} s for the standing-start loss (${card.restart.accel.toFixed(1)} s)` : ''}.</div>`);
    } else if (card.mode === 'answers' && card.hiddenCar) {
      parts.push(`<div class="hidden-car muted" id="hidden-car-card">${escapeHtml(HIDDEN_CAR_LINE_TEXT)}</div>`);   // PT-10 N-C1: no stop, turn or ramp number of the hidden car; PT-11 N-D8: the chart box prints the hidden-car sentence, the line card only points at the MARKs
    } else if (card.mode === 'answers') {
      if (card.stop && card.withheld) {
        const s = card.stop;   // PT-10 N-C7: Silver: the chart is on the card, the arithmetic is yours
        parts.push(`<div class="withheld" id="withheld-stop">Stop ${s.vIn} in / ${s.vOut} out, pause ${s.pause} s: work the dwell out from the simple chart (pause - Dec at ${s.vIn} - Acc at ${s.vOut}${s.cap !== undefined ? ', plus the turning-stop loss' : ''}) and count it on the stopwatch.</div>`);
      } else if (card.stop) {
        const s = card.stop; const more = waitMore(s, dwellSoFar);
        if (s.chart) parts.push(`<div class="chartline" id="chartline">Chart (b) Stop &amp; Go: ${s.vIn} in / ${s.vOut} out = sit <b class="mono">${s.chart.chart.toFixed(1)}</b> s for a 15 s stop${s.pause !== 15 ? `; this pause is ${s.pause} s: sit <b class="mono">${s.chart.sit.toFixed(1)}</b> s` : ''}</div>`);
        parts.push(`<div>Stop ${s.vIn} in / ${s.vOut} out${s.cap !== undefined ? ` (turn capped at ${s.cap} mph)` : ''}: loss <b class="mono">${s.loss.toFixed(1)}</b> s → dwell <b class="mono">${s.dwell.toFixed(1)}</b> s after "Stopped"${watch === 'analog' ? ' <span class="muted">(set the bezel with ] )</span>' : ' <span class="muted">(count it on the stopwatch)</span>'}</div>`);
        if (o.stoppedAtLine === line && more !== null) parts.push(`<div class="stopcount muted" id="stopcount">Count it out loud for the driver: <kbd>X</kbd> (${countingStop ? '<b>counting</b>' : 'off'}); say "coming in at ${s.vIn}, out ${s.vOut}, holding for ${Math.round(s.dwell)}" first.</div><div class="stopnow">dwell so far <b class="mono">${Math.max(0, dwellSoFar).toFixed(1)}</b> s · ${more > 0.05 ? `wait <b class="mono">${more.toFixed(1)}</b> more s` : '<b class="ok">go now (G)</b>'}</div>`);
      } else if (card.stopNoPause) parts.push(`<div>STOP without pause: loss ${card.stopNoPause.loss.toFixed(1)} s is yours to recover.</div>`);
      if (card.timed && card.withheld) parts.push(`<div class="withheld" id="withheld-timed">Timed: hold ${card.timed.hold} for ${card.timed.seconds} s, then ${card.timed.then}: call ${card.timed.then} at ${card.timed.seconds} s minus the lead for ${card.timed.hold} → ${card.timed.then} (${escapeHtml(leadSource(card.timed.hold, card.timed.then))}).</div>${card.timed.fromGhost ? `<div class="timed-anchor accent" id="timed-anchor">Count from the ghost's departure = arrival + the ${card.timed.fromGhost.pause} s pause minus the braking part (Dec), not from your go.</div>` : ''}`);
      else if (card.timed) parts.push(`<div>Timed: hold ${card.timed.hold} for ${card.timed.seconds} s, call ${card.timed.then} at <b class="mono">${card.timed.call.toFixed(1)}</b> s (lead ${card.timed.lead.toFixed(1)})</div>${card.timed.fromGhost ? `<div class="timed-anchor accent" id="timed-anchor">Count from the ghost's departure = arrival + the ${card.timed.fromGhost.pause} s pause (${card.timed.fromGhost.afterStopped.toFixed(1)} s after "Stopped"), not from your go: call ${card.timed.then} ${card.timed.call.toFixed(1)} s after that = <b class="mono">${card.timed.fromGhost.callAfterStopped.toFixed(1)}</b> s after "Stopped".</div>` : ''}`);
      else if (card.speedChange && card.withheld) parts.push(`<div class="withheld" id="withheld-ramp">Speed ${card.speedChange.from} → ${card.speedChange.to}: call it the lead for that pair before the landmark (${escapeHtml(leadSource(card.speedChange.from, card.speedChange.to))}), so the car crosses the sign at the midpoint speed.</div>`);
      else if (card.speedChange) parts.push(`<div>Speed ${card.speedChange.from} → ${card.speedChange.to}: call it <b class="mono">${card.speedChange.lead.toFixed(1)}</b> s before the landmark (${card.speedChange.ft} ft)</div>`);
      if (card.turnLoss) {
        const t = card.turnLoss;
        parts.push(`<div class="turnloss"><b>Turn loss</b> <span class="muted">(s lost slowing and re-accelerating, no stop)</span>${t.here ? `<div class="thisturn">This turn ${t.here.turn} ${t.here.vIn}${t.here.vIn !== t.here.vOut ? ` &rarr; ${t.here.vOut}` : ''} mph: <b class="mono">this turn: ${t.here.loss.toFixed(1)} s</b></div><div class="muted">${escapeHtml(t.here.rule.text)}</div>` : ''}${t.rows.map(r => `<div class="mono">${r.angle}&deg;: ${t.speeds.map((v, i) => `${v} <b>${r.losses[i]!.toFixed(1)}</b>`).join(' · ')}</div>`).join('')}</div>`);
      }
      if (card.start && card.withheld) parts.push(`<div class="withheld">Standing start to ${card.start.speed}: leave early by the standing-start loss (simple chart, Acc at ${card.start.speed}).</div>`);
      else if (card.start) parts.push(`<div>Standing start to ${card.start.speed}: leave ~<b class="mono">${card.start.early.toFixed(1)}</b> s early</div>`);
    } else {
      const go = ann.goTime(line) || o.annotations?.[line] || '';
      parts.push(`<div class="muted">Legal mode: no computed card. Work it out on the lapboard${scenario.book[line - 1]?.pause ? ' and write the GO time on the line' : ''}.</div>`);
      if (scenario.book[line - 1]?.pause) parts.push(`<div>Your GO at: <b class="mono">${go ? escapeHtml(go) : 'not written'}</b></div>`);
      const hl = ann.highlights(line); if (hl.length) parts.push(`<div class="muted">highlighted: ${hl.join(', ')}</div>`);
    }
    if (o.stoppedAtLine && o.currentLine !== o.stoppedAtLine) parts.unshift(`<div class="hintline">Book is on line ${o.currentLine}: press <kbd>N</kbd> to jump to line ${o.stoppedAtLine}.</div>`);   // first: the card scrolls inside the capped drawer (N1)
    cardBody.innerHTML = parts.join('');
  }
  function currentScale(o: Observation): number {
    const base = baseScale(o);
    const al = activeLaunch(o); if (al && base > 0) { const left = al.plan.launchTod - o.tod; if (left <= 40 && left > -3) return Math.min(base, 1); }   // the count runs in real time
    return base;
  }
  function baseScale(o: Observation): number {
    const nearest = o.ahead.length ? Math.min(...o.ahead.map(f => f.approxDistanceFt)) : null;
    const hazard = o.ahead.some(f => f.kind === 'slow' || f.kind === 'construction' || f.gateDown || f.signalColor === 'red');
    return effectiveScale({ requested, paused, phase: o.phase, carStopped: o.carStopped, waitingForGo: o.driver.waitingForGo, nearestFeatureFt: nearest, hazardActive: hazard, countdownSeconds: o.aids.countdown ?? null, bezelRemaining: o.stopwatch.running && o.stopwatch.kind === 'analog' ? o.stopwatch.bezelRemaining : null, lockedTo1x, holdSecondsLeft: holdSecondsLeft(o) });
  }
  /** PLAY-003: seconds to the out time of the hold the car waits at (the launch second at a restart), or null. */
  function holdSecondsLeft(o: Observation): number | null {
    if (o.phase !== 'running' || !o.driver.waitingForGo || sim.waitReason !== 'hold' || !o.stoppedAtLine) return null;
    const ins = scenario.book[o.stoppedAtLine - 1]; const node = ins ? nodes.get(ins.nodeId) : undefined; if (!node) return null;
    const li = sim.launchInfo(); const go = li ? li.launchTime : sim.holdGoTod(node);
    return go === null ? null : go - o.tod;
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
          if (src.kind === 'drill' && src.drillId === 'D06') saveChartNotes(src.tier, src.seed, result.actions.filter(a => a.action.type === 'note').map(a => (a.action as { text: string }).text));   // PLAY-027
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
    act(a: Action) { if (a.type === 'line.set') setManual(a.n); act(a); renderNow(); return obs; },
    observe: () => sim.observe({ peek: true }),
    result: () => sim.result(),
    finish,
  };
  renderNow();
  raf = requestAnimationFrame(t => { last = t; frame(t); });
  return () => { if (!finished) saveLive(); cleanup(); if (window.__rally?.sim === sim) delete window.__rally; };
}
export type { Scenario };
