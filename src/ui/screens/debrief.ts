/** Debrief (DEBRIEF-001..004): per-CP table, attribution bars, worked arithmetic, counterfactuals, ledger, bias/noise, timeline. */
import { debriefViewModel, BUCKET_LABEL, type DebriefVm } from '../viewmodels/debrief.js';
import type { Bucket } from '../../core/sim.js';
import { counterfactuals, type CounterfactualRow } from '../viewmodels/counterfactual.js';
import { drawTimeline } from '../render/timeline.js';
import { prepare, themeFromCss } from '../render/common.js';
import { formatClock, formatSigned } from '../../core/units.js';
import { allDrills } from '../../core/drills/index.js';
import { app, el, escapeHtml, sourceHash, restoreLastRun } from '../state.js';
import { fmtMMSS } from '../viewmodels/book.js';
import { nextDrill, unlockBest, startPathFromProgress, currentPathStep, pathStepHash } from '../viewmodels/curriculum.js';
import { scorecardViewModel } from '../viewmodels/scorecard.js';
import { scorecardPanel } from './scorecard.js';

const BUCKET_COLOR: Record<Bucket, string> = { cruise: '#4fd1c5', stop: '#f0b35b', speedChange: '#9b8cff', timedChange: '#ff8fab', hazard: '#ef5a5a', offCourse: '#c0392b', turn: '#e67e22', start: '#7f8c8d', ta: '#4cc38a' };

export function renderDebrief(root: HTMLElement): void {
  const last = app.lastResult ?? restoreLastRun();
  if (!last) { root.replaceChildren(el('div', { class: 'page' }, el('h1', {}, 'Debrief'), el('p', {}, 'No finished run yet. ', el('a', { href: '#/' }, 'Pick a drill')))); return; }
  const { run, result } = last;
  let history: Record<string, number[]> = {}; try { history = app.progress.maneuverHistory(); } catch { history = {}; }
  const vm: DebriefVm = debriefViewModel(result, run.scenario, { history });
  const page = el('div', { class: 'page debrief', id: 'debrief' });
  if (run.aborted) page.append(el('div', { class: 'banner', id: 'aborted' }, el('b', {}, 'Run ended early: '), 'this run was ended before the finish, so it is not recorded (no stars, history or bias entries). The numbers below describe only what was driven.'));
  // rubric
  let rubricHtml = '';
  if (run.drill) { try { const rb = run.drill.rubric(result, run.scenario); rubricHtml = `<div class="pill" style="font-size:16px;padding:6px 12px">${'★'.repeat(rb.stars)}${'☆'.repeat(3 - rb.stars)} ${escapeHtml(rb.headline)}</div><ul>${rb.feedback.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`; } catch { rubricHtml = ''; } }
  const head = el('div', { class: 'head' });
  const headline = el('div', { class: 'panel' }, el('h3', {}, run.drill ? `${run.drill.id} ${run.drill.title}` : run.scenario.name), el('div', { class: 'headline' }, vm.headline),
    el('p', { class: 'muted' }, `Raw ${vm.score.raw} s × age factor ${vm.score.ageFactor} = ${vm.score.score} · benchmark: ${escapeHtml(String((result.score as { benchmark?: string }).benchmark ?? '-'))} · ${vm.score.aces} ace${vm.score.aces === 1 ? '' : 's'} · driving ${formatMin(vm.drivingSeconds)}${vm.offCourseCount ? ` · off course ${vm.offCourseCount}x` : ''}${vm.observationMissed ? ' · observation checkpoint missed' : ''}`),
    el('div', { html: rubricHtml }));
  const sc = scorecardViewModel(result, run.scenario);
  head.append(headline, el('div', {}, scorecardPanel(sc), el('div', { class: 'tip', id: 'tip', style: 'margin-top:10px' }, el('b', {}, vm.tip.startsWith('Clean run') ? 'Verdict: ' : 'Fix this next: '), vm.tip), ...vm.tips.slice(1).map(t => el('div', { class: 'tip', style: 'margin-top:6px' }, el('b', {}, 'Also: '), t)),
    el('p', { style: 'margin-top:8px' }, el('a', { id: 'book-link', href: `#/book/last`, target: '_blank', rel: 'noopener' }, 'Printable book for this stage'))));
  page.append(head);
  // actions
  const actions = el('div', { style: 'display:flex;gap:8px;margin:14px 0' });
  const retry = el('button', { class: 'primary', id: 'retry' }, 'Retry this run'); retry.onclick = () => { location.hash = sourceHash(run.source); };
  const next = el('button', { id: 'next' }, run.source.kind === 'drill' ? 'Next seed' : 'Next scenario'); next.onclick = () => { const s = run.source; location.hash = sourceHash({ ...s, seed: s.seed + 1 }); };
  const home = el('button', {}, 'Home'); home.onclick = () => { location.hash = '#/'; };
  actions.append(retry, next, home);
  if (run.source.kind === 'drill') {
    try {
      const ds = allDrills(); const prog = app.progress.load(); const best = unlockBest(ds, prog);
      // PLAY-001: while the Start-here path is open, Next opens the path's next step (a Bronze star moves it on)
      const step = currentPathStep(startPathFromProgress(ds, prog, id => app.progress.lessonDone(id)));
      const nd = step ? null : nextDrill(run.source.drillId, ds, best);
      if (step && !(step.kind === 'drill' && step.id === run.source.drillId)) { const b = el('button', { id: 'nextdrill', class: 'primary' }, `Next on your path: ${step.label}`); b.onclick = () => { location.hash = pathStepHash(step); }; actions.append(b); }
      if (nd) {
        const b = el('button', { id: 'nextdrill', class: nd.locked ? 'locked-btn' : '' }, nd.locked ? `🔒 Next drill: ${nd.drill.id} (needs ${nd.needs})` : `Next drill: ${nd.drill.id}`);
        if (nd.locked) b.setAttribute('disabled', ''); else b.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: nd.drill.id, tier: 0, seed: 1 }); };
        actions.append(b);
      }
    } catch { /* none */ }
  }
  page.append(actions);
  // attribution bars + timeline
  const two = el('div', { class: 'grid', style: 'grid-template-columns:1fr 1.3fr;align-items:start' });
  const bars = el('div', { class: 'panel bars' }, el('h3', {}, 'Seconds lost by cause, per leg'));
  const maxAbs = Math.max(5, ...vm.legs.flatMap(l => l.segments.map(s => Math.abs(s.seconds))), ...vm.legs.map(l => Math.abs(l.sum)));
  for (const l of vm.legs) {
    const bar = el('div', { class: 'bar' }, el('div', { class: 'zero' }));
    let posX = 50, negX = 50;
    for (const s of l.segments) { const w = Math.abs(s.seconds) / maxAbs * 50; const seg = el('div', { class: 'seg', title: `${s.label}: ${formatSigned(s.seconds)} s` }); seg.style.background = BUCKET_COLOR[s.bucket]; seg.style.width = `${w}%`; if (s.seconds >= 0) { seg.style.left = `${posX}%`; posX += w; } else { negX -= w; seg.style.left = `${negX}%`; } bar.append(seg); }
    bars.append(el('div', { class: 'bar-row' }, el('span', {}, `Leg ${l.legIndex}`), bar, el('span', { class: 'num mono' }, l.error === null ? 'missed' : `${formatSigned(l.error)} s`)));
    if (Math.abs(l.residual) > 1.5) bars.append(el('div', { class: 'muted', style: 'font-size:12px' }, `(buckets sum ${formatSigned(l.sum)}, rounding residual ${formatSigned(l.residual)})`));
  }
  const legend = el('div', { class: 'legend' }); for (const b of Object.keys(BUCKET_LABEL) as Bucket[]) if (Math.abs(vm.totals[b]) >= 0.05) legend.append(el('span', {}, el('i', { style: `background:${BUCKET_COLOR[b]}` }), `${BUCKET_LABEL[b]} ${formatSigned(vm.totals[b])}`)); bars.append(legend);
  const tl = el('div', { class: 'panel timeline-wrap' }, el('h3', {}, 'Actual vs ghost'));
  const canvas = el('canvas', { id: 'timeline' }); tl.append(canvas);
  two.append(bars, tl);
  // UI-035: the page opens on the summary, the scorecard and the headline tip; the per-leg attribution, the stop detail and the replays are one click away
  const attribution = el('details', { class: 'panel fold', id: 'attribution', style: 'margin-top:14px' }, el('summary', {}, `Seconds lost by cause, per leg (${vm.legs.length} legs) and the timeline`), two);
  page.append(attribution);
  // worked arithmetic
  const worked = el('details', { class: 'panel worked fold', id: 'worked', style: 'margin-top:14px' }, el('summary', {}, 'Worked arithmetic per maneuver (stops, restarts, timed changes, turns)'));
  const ul = el('ul', {});
  for (const s of vm.stops) ul.append(el('li', {}, s.text));   // B16: the row's own text (no "entry ?" rows, no-pause stops say "make the seconds up")
  for (const r of vm.restarts) ul.append(el('li', {}, r.text));
  for (const t of vm.timed) ul.append(el('li', {}, t.text));
  for (const t of vm.landmarks) ul.append(el('li', {}, t.text));
  for (const t of vm.turns) ul.append(el('li', { class: t.late ? 'danger' : '' }, t.text));
  for (const c of vm.cruise) ul.append(el('li', {}, c.text));
  if (!ul.childElementCount) ul.append(el('li', { class: 'muted' }, 'No stops, timed changes or speed changes were executed.'));
  worked.append(ul); page.append(worked);
  // counterfactuals
  const cf = el('details', { class: 'panel fold', id: 'counterfactuals', style: 'margin-top:14px' }, el('summary', {}, 'What if: replays of your action log'), el('p', { class: 'muted' }, 'Each row re-runs your action log through the simulator with one thing changed.'));
  const cfBody = el('div', {}, el('div', { class: 'muted' }, 'Replaying…')); cf.append(cfBody); page.append(cf);
  // ledger + bias/noise
  const three = el('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;margin-top:14px;align-items:start' });
  const ledger = el('div', { class: 'panel' }, el('h3', {}, 'Your ledger vs the truth'), el('p', {}, vm.ledger.text));
  if (vm.ledger.rows.length) { const t = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Time'), el('th', { class: 'num' }, 'You said'), el('th', { class: 'num' }, 'Truth'), el('th', { class: 'num' }, 'Off by')))); const b = el('tbody', {}); for (const r of vm.ledger.rows) b.append(el('tr', {}, el('td', { class: 'mono' }, formatClock(r.tod)), el('td', { class: 'num' }, sgn(r.believed)), el('td', { class: 'num' }, sgn(r.truth)), el('td', { class: `num ${Math.abs(r.diff) > 3 ? 'danger' : 'ok'}` }, sgn(r.diff)))); t.append(b); ledger.append(t); }
  const bias = el('div', { class: 'panel' }, el('h3', {}, 'Bias or noise?'), el('p', { class: 'muted' }, 'Judged on THIS run (needs at least 2 of a kind): bias (|mean| > sd) is fixed by a number on the card; noise only by practice. The history columns (your last 10 runs plus this one) are for context only.'));
  const bt = el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Maneuver'), el('th', { class: 'num' }, 'n'), el('th', { class: 'num' }, 'mean'), el('th', { class: 'num' }, 'sd'), el('th', { class: 'num' }, 'hist n'), el('th', { class: 'num' }, 'hist mean'), el('th', {}, 'verdict'))));
  const bb = el('tbody', {});
  const shownBias = vm.bias.rows.filter(r => r.n >= 2);
  if (!shownBias.length) bias.append(el('p', { class: 'muted', id: 'bias-empty' }, 'Not enough maneuvers of one kind in this run (need at least 2) for a bias or noise verdict.'));
  for (const r of shownBias) bb.append(el('tr', {}, el('td', {}, r.label), el('td', { class: 'num' }, String(r.n)), el('td', { class: 'num' }, r.mean === null ? '-' : sgn(r.mean)), el('td', { class: 'num' }, r.sd === null ? '-' : r.sd.toFixed(1)), el('td', { class: 'num' }, String(r.histN)), el('td', { class: 'num' }, r.histMean === null ? '-' : sgn(r.histMean)), el('td', {}, r.verdict === 'none' ? el('span', { class: 'muted' }, '-') : el('span', { class: `pill ${r.verdict}` }, r.verdict), r.fix ? el('div', { class: 'muted', style: 'font-size:12px' }, r.fix) : null)));
  bt.append(bb); if (shownBias.length) bias.append(bt);
  three.append(ledger, bias); page.append(three);
  // driver transcript
  const transcript = el('details', { class: 'panel', style: 'margin-top:14px' }, el('summary', {}, 'Driver transcript and event log'));
  const pre = el('pre', { class: 'mono', style: 'font-size:12px;max-height:300px;overflow:auto' }, result.events.filter(e => e.type !== 'mainRoad').map(e => `${formatClock(e.tod)}  ${Math.round(e.s).toString().padStart(6)} ft  ${e.type}${e.detail ? '  ' + JSON.stringify(e.detail) : ''}`).join('\n'));
  transcript.append(pre); page.append(transcript);
  root.replaceChildren(page);
  // draw the timeline once laid out
  const drawTl = (): void => { const w = tl.clientWidth - 34; const ctx = prepare(canvas, Math.max(300, w), 260); if (ctx) drawTimeline(ctx, vm.timeline, vm.ledger.rows, Math.max(300, w), 260, themeFromCss()); };
  requestAnimationFrame(drawTl); attribution.addEventListener('toggle', () => { if (attribution.open) requestAnimationFrame(drawTl); });   // the timeline is measured once its fold is open
  // counterfactuals off the main thread tick
  setTimeout(() => {
    let rows: CounterfactualRow[] = [];
    try { rows = counterfactuals(result, run.scenario, { watch: run.watch }); } catch { rows = []; }
    cfBody.replaceChildren();
    if (!rows.length) cfBody.append(el('div', { class: 'muted' }, 'Nothing to replay.'));
    for (const r of rows) {
      const line = el('div', { class: `cf-row ${r.applicable ? '' : 'na'}` }, el('span', {}, r.label), el('span', { class: 'cps' }, r.applicable ? r.rows.map(x => x.text).join('   ') : 'not applicable to this run'), el('span', { class: 'mono muted' }, r.applicable ? `${r.rawAfter} pts (was ${r.rawBefore})` : ''));
      cfBody.append(line);
    }
  }, 30);
}
const sgn = (x: number): string => (x > 0 ? `+${x.toFixed(1)}` : x.toFixed(1));
const formatMin = fmtMMSS;
