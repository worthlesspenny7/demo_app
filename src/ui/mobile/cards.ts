/**
 * Decision cards (MOB-002, MOB-026): what a card shows for each decision kind, as pure HTML strings for the tests and the run screen.
 * The book row is the real GRIID row at phone width: the CAMEO left, Column C right (the shared renderer: bold centred lines, the restart
 * watch, the calibration box), the Column D remark below; no sentence in Column D at the legal rung. The simple chart cell is shown
 * highlighted where the card's arithmetic uses it (withheld at the legal rung, MOB-031).
 */
import type { BookRowView, Decision, DecisionKind, RuleCard, Verdict } from '../../core/decision/index.js';
import { SKILL_TITLE } from '../../core/decision/index.js';
import { columnCHtml, columnBHtml, esc } from '../render/griid.js';
import { formatClockFace, formatInterval, type ColumnBSymbol } from '../../core/griid.js';

/** Short title of each kind for the card header. */
export const KIND_TITLE: Record<DecisionKind, string> = {
  preread: 'Pre-read', turn: 'Turn', speedChange: 'Speed change', timedStart: 'Timed start', pause: 'Pause', restart: 'Restart', transitOut: 'Transit out',
  makeup: 'Make-up', hazard: 'Hazard', ta: 'Time Allowance', lost: 'Lost', checkpoint: 'Checkpoint', clock: 'Clock', watch: 'Stopwatch',
};

/** A Column D text is a "sentence" (the GRIID-004 written form) rather than a remark ("Comes quick", "$1.50") when it has five or more words, or three or more with a full stop. */
export function isSentence(d: string): boolean { const t = d.trim(); const n = t ? t.split(/\s+/).length : 0; return n >= 5 || (n > 2 && /[.!?]/.test(t)); }
/** MOB-026: Column D as the card prints it: at the legal rung (0) a sentence is withheld, a short remark stays. */
export function columnDFor(row: Pick<BookRowView, 'columnD'>, rung: number): string { const d = row.columnD ?? ''; return rung <= 0 && isSentence(d) ? '' : d; }

/** The restart watch (zone over the time of day) when Column C starts with "CDT 8:55:00". */
function todOf(c: string[]): { zone: string; time: string } | null { const m = /^([A-Z]{3,4}) (\d{1,2}:\d\d:\d\d)$/.exec(c[0] ?? ''); return m ? { zone: m[1]!, time: m[2]! } : null; }

/** The GRIID row at phone width (MOB-026). */
export function bookRowHtml(row: BookRowView, rung: number): string {
  const tod = todOf(row.columnC);
  const c = columnCHtml({ c: row.columnC, cBox: null, cIcons: tod ? ['restart'] : [], tod });
  const b = row.columnB?.length ? `<div class="mrow-b">${columnBHtml({ b: row.columnB as ColumnBSymbol[], odometer: row.odometer || null })}</div>` : '';
  const d = columnDFor(row, rung);
  return `<div class="mrow" data-line="${row.line}" aria-label="book row ${row.line}">`
    + `<div class="mrow-n">${esc(row.line)}</div>`
    + `<div class="mrow-a">${row.cameoSvg ? `<span class="cameo-svg">${row.cameoSvg}</span>` : ''}</div>`
    + `<div class="mrow-c gc">${b}${c}</div>`
    + (d ? `<div class="mrow-d">${esc(d)}</div>` : '')
    + `</div>`;
}

const CHART_NAME: Record<string, string> = { stopGo: 'Stop & go', accel: 'Acc / dec', lead: 'Lead', turn: 'Turn', speedChange: 'Speed change' };
/** MOB-050: a chip says what its number means: "sit" (the time to wait at a pause), "loss" (the loss to subtract), "lead" (call this early). */
const MEANING: Record<string, string> = { sit: 'sit', loss: 'loss', lead: 'lead' };
/** The simple chart cell the card uses, highlighted: the IN / OUT pair and the value labelled by its meaning. Withheld at the legal rung;
 *  at rung 1 (a later Boss) it sits behind a "Chart" button on the card (MOB-059). */
export function chartCellHtml(chart: Decision['context']['chart'], rung: number): string {
  if (!chart || rung <= 0) return '';
  const word = chart.meaning ? `${MEANING[chart.meaning] ?? chart.meaning} ` : '';
  const inner = `<span class="mchart-k">${esc(CHART_NAME[chart.kind] ?? chart.kind)}</span>`
    + `<span class="mchart-io">${chart.vIn} → ${chart.vOut}</span><span class="mchart-v hi" data-chart-seconds="${chart.seconds}" data-meaning="${chart.meaning ?? ''}">${word}${chart.seconds.toFixed(1)} s</span>`;
  if (rung === 1) return `<details class="mchart-btn" data-testid="chart-button"><summary class="mob-reveal">Chart</summary><div class="mchart" aria-label="chart cell">${inner}</div></details>`;
  return `<div class="mchart" aria-label="chart cell">${inner}</div>`;
}

/** The facts of a card (speeds, distance, times, lateness, hazard, TA ledger, clock): short chips. MOB-061: shown behind "details". */
export function factsHtml(d: Decision, rung: number): string {
  const c = d.context; const f: string[] = [];
  // PT-14 item 10: one clock format, 12-hour with the zone label in front ("CDT 9:31:50")
  const fmtTod = (t: number | undefined): string => (t === undefined ? '' : `${c.zone ? `${c.zone} ` : ''}${formatClockFace(t)}`);
  if (c.speeds) f.push(c.speeds.in !== undefined && c.speeds.out !== undefined ? `in ${c.speeds.in} · out ${c.speeds.out}` : `holding ${c.speeds.current}`);
  if (c.distanceFt !== undefined) f.push(`${d.kind === 'checkpoint' || d.kind === 'hazard' ? 'ahead' : 'to the line'} ${Math.round(c.distanceFt)} ft`);
  if (c.room) f.push(`${c.room.what === 'timed' ? 'to the timed line' : 'to the checkpoint'} ${c.room.ft} ft`);
  if (c.limit !== undefined) f.push(`limit ${c.limit}`);
  if (c.times?.base !== undefined) f.push(`base ${fmtTod(c.times.base)}`);
  if (c.times?.position !== undefined) f.push(`position ${c.times.position}`);
  if (c.times?.own !== undefined && d.kind === 'restart') f.push(`your time ${fmtTod(c.times.own)}`);
  if (c.times?.in !== undefined) f.push(`IN ${fmtTod(c.times.in)}`);
  if (c.lateSeconds !== undefined) f.push(c.lateSeconds >= 0 ? `${c.lateSeconds.toFixed(0)} s late` : `${(-c.lateSeconds).toFixed(0)} s early`);
  if (c.hazard) f.push(c.hazard.label);
  if (c.ta) f.push(`delay ${c.ta.measured} s`, ...(c.ta.madeUp !== undefined ? [`made up ${c.ta.madeUp} s`] : []));
  if (c.lost) f.push(`off route ${c.lost.agoSeconds} s`, ...(c.lost.detourSeconds !== null ? [`detour +${c.lost.detourSeconds} s`] : []));
  if (c.clock) f.push(c.clock.minuteAmbiguous && (rung <= 0 || c.clock.minute === null) ? 'minute hand at the change' : `minute ${c.clock.minute ?? '?'}`);
  return f.length ? `<div class="mfacts">${f.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
}
/** MOB-061: the chips and the chart cell behind one tap-to-reveal "details" (rung 1: the chart has its own "Chart" button). */
export function detailsHtml(d: Decision, rung: number): string {
  const facts = factsHtml(d, rung); const chart = rung >= 2 ? chartCellHtml(d.context.chart, rung) : '';
  const hold = d.timing?.skip?.detail ? `<p class="mskipd" data-testid="skip-detail">${esc(d.timing.skip.detail)}</p>` : '';   // PT-15 P5: the long explanation lives here, the prompt keeps a 4-word note
  return facts || chart || hold ? `<details class="mdetails" data-testid="details"><summary class="mob-reveal">details</summary>${chart}${facts}${hold}</details>` : '';
}

/** MOB-052: where the sign is at `elapsed` seconds into a timed card: the bar's fraction (1 -> 0 at the sign), feet left, and the "Mark!" moment. */
export function signState(t: Pick<NonNullable<Decision['timing']>, 'signSeconds' | 'signFt'>, elapsed: number): { frac: number; ft: number; mark: boolean } {
  const T = t.signSeconds ?? 0; if (!(T > 0)) return { frac: 0, ft: 0, mark: false };
  const frac = Math.max(0, Math.min(1, 1 - elapsed / T));
  return { frac, ft: Math.round((t.signFt ?? 0) * frac / 10) * 10, mark: elapsed >= T && elapsed < T + 1.5 };
}
/** MOB-052: the distance-to-sign bar of a timed card (the run screen animates it; it reaches zero at the sign, where Dad says "Mark!").
 *  A speed-change card at rung 2 marks the call point (the chart lead before the sign) with a tick labelled CALL (PT-14 item 8). */
export function signBarHtml(d: Decision, rung: number): string {
  const t = d.timing; if (!t?.signSeconds) return '';
  const lead = d.kind === 'speedChange' && rung >= 2 && d.context.chart?.meaning === 'lead' ? Math.min(1, d.context.chart.seconds / t.signSeconds) : null;
  const at = lead !== null ? (lead * 100).toFixed(1) : null;
  return `<div class="msign${at !== null ? ' has-call' : ''}" data-testid="sign-bar" data-sign-seconds="${t.signSeconds}" data-sign-ft="${t.signFt ?? 0}">`
    + `<div class="msign-track"><span class="msign-fill" style="width:100%"></span>${at !== null ? `<span class="msign-call" style="left:${at}%" aria-hidden="true"></span>` : ''}<span class="msign-post" aria-hidden="true"></span></div>`
    + `<b class="msign-ft">${t.signFt ?? 0} ft</b>`
    + (at !== null ? `<div class="msign-ticks"><span class="msign-calllbl" data-testid="call-tick" style="left:${Math.min(90, Math.max(10, Number(at))).toFixed(1)}%" aria-label="call when the bar reaches here">CALL</span></div>` : '')
    + `<b class="msign-mark" data-testid="mark" aria-live="assertive"></b></div>`;
}
/** MOB-053: the stopwatch on a watch card: the main digits and the lap at the sign. */
export function watchCardHtml(w: NonNullable<Decision['context']['watch']>): string {
  const lap = w.laps[w.laps.length - 1];
  return `<div class="mwatchcard" data-testid="watch-card"><span class="mwc-digits">${esc(formatInterval(w.reading, true))}</span>${lap ? `<span class="mwc-lap">lap ${esc(formatInterval(lap.cumulative, true))}</span>` : ''}</div>`;
}

/** A small dash-clock face for clock cards (hands only, no digital readout, REG II.H.1.d(1)). */
export function clockFaceSvg(c: NonNullable<Decision['context']['clock']>): string {
  const hand = (deg: number, len: number, w: number, col: string): string => { const a = (deg - 90) * Math.PI / 180; return `<line x1="50" y1="50" x2="${(50 + Math.cos(a) * len).toFixed(1)}" y2="${(50 + Math.sin(a) * len).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  let ticks = ''; for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; const r0 = i % 5 ? 44 : 40; ticks += `<line x1="${(50 + Math.sin(a) * r0).toFixed(1)}" y1="${(50 - Math.cos(a) * r0).toFixed(1)}" x2="${(50 + Math.sin(a) * 47).toFixed(1)}" y2="${(50 - Math.cos(a) * 47).toFixed(1)}" stroke="#111" stroke-width="${i % 5 ? 0.6 : 1.6}"/>`; }
  return `<svg class="mclock" viewBox="0 0 100 100" role="img" aria-label="dash clock"><circle cx="50" cy="50" r="48" fill="#f7f5ee" stroke="#333" stroke-width="2"/>${ticks}${hand(c.hourAngle, 24, 4, '#111')}${hand(c.minuteAngle, 38, 3, '#111')}${hand(c.secondAngle, 44, 1.2, '#c0392b')}<circle cx="50" cy="50" r="2.5" fill="#111"/></svg>`;
}

/** The card body: kind title, prompt, the book row, the clock / watch / sign the card is about, the chart button (rung 1), the details. */
export function decisionCardHtml(d: Decision, rung: number): string {
  const c = d.context;
  const row = c.row ? bookRowHtml(c.row, rung) : '';
  return `<article class="mcard" data-kind="${d.kind}" data-decision="${esc(d.id)}">`
    + `<div class="mcard-kind">${esc(KIND_TITLE[d.kind])}</div>`
    + `<p class="mprompt">${esc(d.prompt)}</p>`
    + row + (c.clock ? clockFaceSvg(c.clock) : '') + (c.watch ? watchCardHtml(c.watch) : '') + signBarHtml(d, rung)
    + (d.timing?.skip ? `<p class="mskip" data-testid="skip-note" hidden>Jumped ahead ${Math.round(d.timing.skip.to - d.timing.skip.at)} s.</p>` : '')
    + (rung === 1 ? chartCellHtml(c.chart, 1) : '') + detailsHtml(d, rung)
    + `</article>`;
}

/** MOB-061: the rule card as the phone shows it: the title and the rule (under 60 words with the strip); the source one tap away. */
export function ruleCardHtml(r: RuleCard): string {
  return `<article class="mcard mrule" data-rule="${esc(r.id)}">${r.title ? `<h2 class="mrule-title">${esc(r.title)}</h2>` : ''}<p class="mrule-text">${esc(r.short ?? r.text)}</p>`
    + `<details class="mdetails"><summary class="mob-reveal">source</summary><p class="msource">${esc(r.source)}</p>${r.short ? `<p class="mrule-long">${esc(r.text)}</p>` : ''}</details></article>`;
}

/** The verdict overlay text: the headline (with the missed part, MOB-054), signed seconds and the one-sentence rule. */
export function verdictParts(v: Verdict): { head: string; seconds: string; rule: string; detail: string } {
  const s = Math.abs(v.secondsDelta) < 0.05 ? '0.0 s' : `${v.secondsDelta > 0 ? '+' : '−'}${Math.abs(v.secondsDelta).toFixed(1)} s`;
  return { head: v.correct ? 'Right' : v.missed ? `Not quite: ${v.missed}` : 'Not quite', seconds: s, rule: v.rule, detail: v.correct ? v.chosen : `You: ${v.chosen}. Right: ${v.expected}.` };
}

/** The driver's line for the landscape mini cockpit and speech (MOB-022, MOB-024). */
export function driverLine(d: Decision): string {
  const c = d.context;
  switch (d.kind) {
    case 'pause': return 'Dad: "Stopped. Give me the go."';
    case 'restart': return 'Dad: "At the line. Count me down."';
    case 'timedStart': return `Dad: "Holding ${c.speeds?.assigned ?? c.speeds?.current ?? 'speed'}. I'll say mark at the sign."`;
    case 'speedChange': return `Dad: "Holding ${c.speeds?.current ?? 'speed'}. I'll say mark at the sign."`;
    case 'watch': return 'Dad: "Lapped. When do I change?"';
    case 'turn': return 'Dad: "Which way here?"';
    case 'checkpoint': return /red GREAT RACE STOP/.test(d.prompt) ? 'Dad: "Red board ahead, we stop."' : /pulls off/.test(d.prompt) ? 'Dad: "Car ahead pulling off, we keep going."' : 'Dad: "Green sign up ahead."';
    case 'hazard': return `Dad: "${c.hazard?.label ?? 'Something ahead'}."`;
    case 'lost': return 'Dad: "I think we missed it."';
    case 'makeup': return 'Dad: "Are we late?"';
    default: return c.speeds ? `Dad: "Holding ${c.speeds.current}."` : 'Dad: "Ready."';
  }
}
