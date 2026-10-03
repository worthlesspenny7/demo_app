/** D13 campaign: nine D12 stages (seeds 1..9) with a cumulative score table (UI-020). */
import { allDrills } from '../../core/drills/index.js';
import { loadCampaign, campaignSummary, CAMPAIGN_KEY } from '../viewmodels/campaign.js';
import { app, el, sourceHash } from '../state.js';

export function renderCampaign(root: HTMLElement): void {
  const d13 = (() => { try { return allDrills().find(d => d.id === 'D13') ?? null; } catch { return null; } })();
  const tierNames = d13 ? d13.tiers.map(t => t.name) : ['Rookie', 'Sportsman', 'Legal'];
  const page = el('div', { class: 'page', id: 'campaign' }, el('h1', {}, 'D13 Campaign: the Great Race'),
    el('p', { class: 'muted' }, 'Nine stages, each a full D12 stage on its own seed, scored with the age factor. Your best score per stage and the running total are kept in this browser. A real stage is 4 to 5 hours of driving at 1x: play one per evening, or use 4x on the open stretches.'));
  let tier = 0;
  const data = (): ReturnType<typeof loadCampaign> => loadCampaign();
  const table = el('div', {});
  const sel = el('select', { id: 'camp-tier' }); tierNames.forEach((n, i) => sel.append(el('option', { value: String(i) }, n)));
  const draw = (): void => {
    const sum = campaignSummary(data(), tier);
    const t = el('table', { id: 'camp-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Stage'), el('th', { class: 'num' }, 'Raw (s)'), el('th', { class: 'num' }, 'Score (x age factor)'), el('th', { class: 'num' }, 'Aces'), el('th', { class: 'num' }, 'Cumulative'), el('th', {}, ''))));
    const tb = el('tbody', {});
    for (const r of sum.rows) {
      const play = el('button', { class: r.played ? '' : 'primary', 'data-stage': String(r.stage) }, r.played ? 'Replay' : 'Play');
      play.onclick = () => { location.hash = sourceHash({ kind: 'drill', drillId: 'D13', tier, seed: r.stage }); };
      tb.append(el('tr', {}, el('td', {}, `Stage ${r.stage}`), el('td', { class: 'num' }, r.raw === null ? '-' : String(r.raw)), el('td', { class: 'num' }, r.score === null ? '-' : r.score.toFixed(1)), el('td', { class: 'num' }, r.played ? String(r.aces) : '-'), el('td', { class: 'num' }, r.cumulative === null ? '-' : r.cumulative.toFixed(1)), el('td', {}, play)));
    }
    t.append(tb);
    table.replaceChildren(el('p', {}, el('b', {}, `${sum.played} of 9 stages played`), sum.played ? ` · total ${sum.total.toFixed(1)} points (${sum.totalRaw} raw s) · ${sum.aces} aces${sum.complete ? ' · campaign complete' : ''}` : ''), t);
  };
  (sel as HTMLSelectElement).onchange = () => { tier = Number((sel as HTMLSelectElement).value) || 0; draw(); };
  const reset = el('button', { class: 'danger' }, 'Clear campaign scores'); reset.onclick = () => { if (confirm('Erase the campaign table?')) { try { localStorage.removeItem(CAMPAIGN_KEY); } catch { /* ignore */ } draw(); } };
  page.append(el('div', { style: 'display:flex;gap:10px;align-items:center;margin:10px 0' }, el('span', {}, 'Tier:'), sel, el('a', { href: '#/' }, 'Home')), table, el('div', { style: 'margin-top:12px' }, reset));
  void app;
  draw();
  root.replaceChildren(page);
}
