/**
 * Decision cards (MOB-002, MOB-026): what a card shows for each decision kind, as pure HTML strings for the tests and the run screen.
 * The book row is the real GRIID row at phone width: the CAMEO left, Column C right (the shared renderer: bold centred lines, the restart
 * watch, the calibration box), the Column D remark below; no sentence in Column D at the legal rung. The simple chart cell is shown
 * highlighted where the card's arithmetic uses it (withheld at the legal rung, MOB-031).
 */
import type { BookRowView, Decision, DecisionKind, RuleCard, Verdict } from '../../core/decision/index.js';
import { SKILL_TITLE } from '../../core/decision/index.js';
import { columnCHtml, columnBHtml, esc } from '../render/griid.js';
import { formatClockFace, type ColumnBSymbol } from '../../core/griid.js';

/** Short title of each kind for the card header. */
export const KIND_TITLE: Record<DecisionKind, string> = {
  preread: 'Pre-read', turn: 'Turn', speedChange: 'Speed change', timedStart: 'Timed start', pause: 'Pause', restart: 'Restart', transitOut: 'Transit out',
  makeup: 'Make-up', hazard: 'Hazard', ta: 'Time Allowance', lost: 'Lost', checkpoint: 'Checkpoint', clock: 'Clock',
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
/** The simple chart cell the card uses, highlighted: the IN row, the OUT column and the value. Null at the legal rung. */
export function chartCellHtml(chart: Decision['context']['chart'], rung: number): string {
  if (!chart || rung <= 0) return '';
  return `<div class="mchart" aria-label="chart cell"><span class="mchart-k">${esc(CHART_NAME[chart.kind] ?? chart.kind)}</span>`
    + `<span class="mchart-io">${chart.vIn} → ${chart.vOut}</span><span class="mchart-v hi" data-chart-seconds="${chart.seconds}">${chart.seconds.toFixed(1)} s</span></div>`;
}

const fmtTod = (t: number | undefined): string => (t === undefined ? '' : formatClockFace(t));
/** The facts line of a card (speeds, distance, times, lateness, hazard, TA ledger, clock), at most a few short items. */
export function factsHtml(d: Decision, rung: number): string {
  const c = d.context; const f: string[] = [];
  if (c.speeds) f.push(c.speeds.in !== undefined && c.speeds.out !== undefined ? `in ${c.speeds.in} · out ${c.speeds.out}` : `at ${c.speeds.current}${c.speeds.target ? ` → ${c.speeds.target}` : ''}`);
  if (c.distanceFt !== undefined) f.push(`${Math.round(c.distanceFt)} ft`);
  if (c.times?.base !== undefined) f.push(`base ${fmtTod(c.times.base)}`);
  if (c.times?.in !== undefined) f.push(`IN ${fmtTod(c.times.in)}`);
  if (c.lateSeconds !== undefined) f.push(c.lateSeconds >= 0 ? `${c.lateSeconds.toFixed(0)} s late` : `${(-c.lateSeconds).toFixed(0)} s early`);
  if (c.hazard) f.push(c.hazard.label);
  if (c.ta) f.push(`watch ${c.ta.measured} s`);
  if (c.clock) f.push(c.clock.minuteAmbiguous && (rung <= 0 || c.clock.minute === null) ? 'minute hand at the change' : `minute ${c.clock.minute ?? '?'}`);
  return f.length ? `<div class="mfacts">${f.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : '';
}

/** A small dash-clock face for clock cards (hands only, no digital readout, REG II.H.1.d(1)). */
export function clockFaceSvg(c: NonNullable<Decision['context']['clock']>): string {
  const hand = (deg: number, len: number, w: number, col: string): string => { const a = (deg - 90) * Math.PI / 180; return `<line x1="50" y1="50" x2="${(50 + Math.cos(a) * len).toFixed(1)}" y2="${(50 + Math.sin(a) * len).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  let ticks = ''; for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180; const r0 = i % 5 ? 44 : 40; ticks += `<line x1="${(50 + Math.sin(a) * r0).toFixed(1)}" y1="${(50 - Math.cos(a) * r0).toFixed(1)}" x2="${(50 + Math.sin(a) * 47).toFixed(1)}" y2="${(50 - Math.cos(a) * 47).toFixed(1)}" stroke="#111" stroke-width="${i % 5 ? 0.6 : 1.6}"/>`; }
  return `<svg class="mclock" viewBox="0 0 100 100" role="img" aria-label="dash clock"><circle cx="50" cy="50" r="48" fill="#f7f5ee" stroke="#333" stroke-width="2"/>${ticks}${hand(c.hourAngle, 24, 4, '#111')}${hand(c.minuteAngle, 38, 3, '#111')}${hand(c.secondAngle, 44, 1.2, '#c0392b')}<circle cx="50" cy="50" r="2.5" fill="#111"/></svg>`;
}

/** The card body: kind title, prompt, the book row, chart cell, facts, note. */
export function decisionCardHtml(d: Decision, rung: number): string {
  const c = d.context;
  const row = c.row ? bookRowHtml(c.row, rung) : '';
  return `<article class="mcard" data-kind="${d.kind}" data-decision="${esc(d.id)}">`
    + `<div class="mcard-kind">${esc(KIND_TITLE[d.kind])}</div>`
    + `<p class="mprompt">${esc(d.prompt)}</p>`
    + row + (c.clock ? clockFaceSvg(c.clock) : '') + chartCellHtml(c.chart, rung) + factsHtml(d, rung)
    + (c.note ? `<p class="mnote">${esc(c.note)}</p>` : '')
    + `</article>`;
}

export function ruleCardHtml(r: RuleCard): string {
  return `<article class="mcard mrule" data-rule="${esc(r.id)}"><div class="mcard-kind">Rule · ${esc(SKILL_TITLE[r.skill])}</div><p class="mrule-text">${esc(r.text)}</p><p class="msource">${esc(r.source)}</p></article>`;
}

/** The verdict overlay text: seconds and the one-sentence rule. */
export function verdictParts(v: Verdict): { head: string; seconds: string; rule: string; detail: string } {
  const s = Math.abs(v.secondsDelta) < 0.05 ? '0.0 s' : `${v.secondsDelta > 0 ? '+' : '−'}${Math.abs(v.secondsDelta).toFixed(1)} s`;
  return { head: v.correct ? 'Right' : 'Not quite', seconds: s, rule: v.rule, detail: v.correct ? v.chosen : `You: ${v.chosen}. Right: ${v.expected}.` };
}

/** The driver's line for the landscape mini cockpit and speech (MOB-022, MOB-024). */
export function driverLine(d: Decision): string {
  const c = d.context;
  switch (d.kind) {
    case 'pause': return 'Dad: "Stopped. Give me the go."';
    case 'restart': return 'Dad: "At the line. Count me down."';
    case 'timedStart': return 'Dad: "Holding the speed. Tell me when."';
    case 'speedChange': return `Dad: "Holding ${c.speeds?.current ?? 'speed'}. Call the change."`;
    case 'turn': return 'Dad: "Which way here?"';
    case 'checkpoint': return 'Dad: "Green sign up ahead."';
    case 'hazard': return `Dad: "${c.hazard?.label ?? 'Something ahead'}."`;
    case 'lost': return 'Dad: "I think we missed it."';
    case 'makeup': return 'Dad: "Are we late?"';
    default: return c.speeds ? `Dad: "Holding ${c.speeds.current}."` : 'Dad: "Ready."';
  }
}
