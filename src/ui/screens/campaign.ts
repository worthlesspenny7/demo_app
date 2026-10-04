/** D13 campaign: Trophy Run (tie-break only) plus nine D12 stages (seeds 1..9), each with a drawn ASP, a division, discards and the age factor (UI-020, CAMP-001). */
import { allDrills } from '../../core/drills/index.js';
import { loadCampaign, campaignSummary, setCampaignDivision, CAMPAIGN_KEY, DIVISIONS, TROPHY_RUN_SEED } from '../viewmodels/campaign.js';
import type { Division } from '../../core/scoring.js';
import { app, el, sourceHash } from '../state.js';

const mmss = (s: number): string => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

export function renderCampaign(root: HTMLElement): void {
  const d13 = (() => { try { return allDrills().find(d => d.id === 'D13') ?? null; } catch { return null; } })();
  const tierNames = d13 ? d13.tiers.map(t => t.name) : ['Bronze', 'Silver', 'Gold'];
  const page = el('div', { class: 'page', id: 'campaign' }, el('h1', {}, 'D13 Campaign: the Great Race'),
    el('p', { class: 'muted' }, 'The Trophy Run (Stage 0) and nine stages, each a full D12 stage on its own seed and its own assigned starting position (ASP), scored with the age factor. Your division discards its worst legs of Stages 1-7 (REG-003); the Trophy Run is not part of the total and only breaks ties. Your best score per stage and the running total are kept in this browser. A real stage is 4 to 5 hours of driving at 1x: play one per evening, or use 4x on the open stretches.'));
  let tier = 0;
  const data = (): ReturnType<typeof loadCampaign> => loadCampaign();
  const table = el('div', {});
  const sel = el('select', { id: 'camp-tier' }); tierNames.forEach((n, i) => sel.append(el('option', { value: String(i) }, n)));
  const divSel = el('select', { id: 'camp-division', title: 'The division sets how many of your worst legs in Stages 1-7 are discarded' });
  const draw = (): void => {
    const cd = data(); const sum = campaignSummary(cd, tier);
    (divSel as HTMLSelectElement).value = sum.division;
    const play = (stage: number, seed: number, played: boolean): HTMLElement => { const b = el('button', { class: played ? '' : 'primary', 'data-stage': String(stage) }, played ? 'Replay' : 'Play'); b.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: 'D13', tier, seed }); }; return b; };
    const t = el('table', { id: 'camp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Stage'), el('th', { class: 'num', title: 'Assigned starting position: your start is the printed time plus this many minutes' }, 'ASP (min)'), el('th', { class: 'num' }, 'Raw (s)'), el('th', { class: 'num' }, 'Score (x age factor)'), el('th', { class: 'num', title: 'Seconds of your worst legs removed by the division discards' }, 'Discarded (s)'), el('th', { class: 'num' }, 'Aces'), el('th', { class: 'num' }, 'Cumulative'), el('th', {}, ''))));
    const tb = el('tbody', {});
    const tr = sum.trophyRun;
    tb.append(el('tr', { class: 'muted', 'data-stage': '0' }, el('td', {}, 'Stage 0: Trophy Run (tie-break only)'), el('td', { class: 'num' }, String(tr.asp)), el('td', { class: 'num' }, tr.raw === null ? '-' : String(tr.raw)), el('td', { class: 'num' }, tr.score === null ? '-' : tr.score.toFixed(1)), el('td', { class: 'num' }, '-'), el('td', { class: 'num' }, '-'), el('td', { class: 'num' }, 'not counted'), el('td', {}, play(0, TROPHY_RUN_SEED, tr.played))));
    for (const r of sum.rows) {
      tb.append(el('tr', {}, el('td', {}, `Stage ${r.stage}${r.dnf ? ' (DNF)' : ''}`), el('td', { class: 'num' }, String(r.asp)), el('td', { class: 'num' }, r.raw === null ? '-' : String(r.raw)), el('td', { class: 'num' }, r.score === null ? '-' : r.score.toFixed(1)),
        el('td', { class: 'num' }, r.stage > 7 ? 'none (8, 9)' : r.discarded === null ? '-' : String(Math.round(r.discarded))), el('td', { class: 'num' }, r.played ? String(r.aces) : '-'), el('td', { class: 'num' }, r.cumulative === null ? '-' : r.cumulative.toFixed(1)), el('td', {}, play(r.stage, r.seed, r.played))));
    }
    t.append(tb);
    const c = sum.championship;
    const champ = el('div', { class: 'panel', id: 'camp-championship' }, el('h3', {}, `Championship total: ${sum.divisionLabel} division`),
      el('p', {}, sum.played ? `Raw ${c.raw} s, minus the worst ${sum.discardCount} legs of Stages 1-7${c.discarded.length ? ` (${c.discarded.map(mmss).join(', ')})` : ''} = ${c.afterDiscards} s, x age factor ${c.ageFactor.toFixed(3)} (1939) = ${c.ageFactored.toFixed(2)} points.` : `Play a stage to start the total. The ${sum.divisionLabel} division discards its worst ${sum.discardCount} legs of Stages 1-7; the age factor for a 1939 car is ${c.ageFactor.toFixed(3)}.`),
      c.withoutDetail.length ? el('p', { class: 'muted' }, `${c.withoutDetail.length === 1 ? `Stage ${c.withoutDetail[0]} was` : `Stages ${c.withoutDetail.join(', ')} were`} stored without leg detail, so ${c.withoutDetail.length === 1 ? 'it counts' : 'they count'} whole (no discards); replay ${c.withoutDetail.length === 1 ? 'it' : 'them'} to include ${c.withoutDetail.length === 1 ? 'it' : 'them'} in the discards.`) : null,
      c.eligible ? null : el('p', { class: 'muted' }, 'A DNF on Stage 8 or 9 removes Championship eligibility (V.F.5).'));
    const st = el('table', { id: 'camp-standings' }, el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Team (car, division)'), el('th', { class: 'num', title: 'Raw seconds after discards, times the car\'s age factor' }, 'Total (x age factor)'), el('th', { class: 'num' }, 'Scoring year'), el('th', { class: 'num' }, 'Trophy Run pos.'))));
    const sb = el('tbody', {}); for (const s of sum.standings) sb.append(el('tr', { class: s.you ? 'primary' : '' }, el('td', {}, s.you && !sum.played ? '-' : String(s.rank)), el('td', {}, s.name), el('td', { class: 'num' }, s.you && !sum.played ? 'play a stage' : s.total.toFixed(2)), el('td', { class: 'num' }, String(s.scoringYear)), el('td', { class: 'num' }, s.trophyRunPosition === undefined ? '-' : String(s.trophyRunPosition)))); st.append(sb);
    const standings = el('div', { class: 'panel' }, el('h3', {}, 'Standings against benchmark pace'), el('p', { class: 'muted' }, `Order: ${sum.tieBreak.join(', then ')} (REG-004). The Trophy Run is only that last tie-break. Benchmark pace is a typical day score with no discards, for the stages you have played.`), st);
    table.replaceChildren(el('p', {}, el('b', {}, `${sum.played} of 9 stages played`), sum.played ? ` · stage scores total ${sum.total.toFixed(1)} points (${sum.totalRaw} raw s) · ${sum.aces} aces${sum.complete ? ' · campaign complete' : ''}` : ''), champ, t, standings);
  };
  for (const dv of DIVISIONS) divSel.append(el('option', { value: dv.id }, dv.label));
  (sel as HTMLSelectElement).onchange = () => { tier = Number((sel as HTMLSelectElement).value) || 0; draw(); };
  (divSel as HTMLSelectElement).onchange = () => { setCampaignDivision((divSel as HTMLSelectElement).value as Division); draw(); };
  const reset = el('button', { class: 'danger' }, 'Clear campaign scores'); reset.onclick = () => { if (confirm('Erase the campaign table?')) { try { const keep = data().division; localStorage.removeItem(CAMPAIGN_KEY); if (keep) setCampaignDivision(keep); } catch { /* ignore */ } draw(); } };
  page.append(el('div', { style: 'display:flex;gap:10px;align-items:center;margin:10px 0;flex-wrap:wrap' }, el('span', { title: 'Bronze, Silver or Gold: how hard the stage is played (the driver and the speedometer)' }, 'Tier:'), sel, el('span', { title: 'Your division sets how many of your worst legs are discarded' }, 'Division:'), divSel, el('a', { href: '#/' }, 'Home')), table, el('div', { style: 'margin-top:12px' }, reset));
  void app;
  draw();
  root.replaceChildren(page);
}
