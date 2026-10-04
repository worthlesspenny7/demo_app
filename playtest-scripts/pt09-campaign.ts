/** PT-09 area 7: championshipTotal / campaign view-model edges: discards per division, ties, Stage 0, stages 8-9, DNF, replays, legacy entries, hostile entries. */
import { championshipTotal, DIVISION_DISCARDS, ageFactor, roundFactored, compareStandings, rankStandings, type Division } from '../src/core/scoring.js';
import { recordCampaignStage, loadCampaign, campaignSummary, CAMPAIGN_KEY, setCampaignDivision, type CampaignStore } from '../src/ui/viewmodels/campaign.js';

const log = console.log; const issues: string[] = [];
const st = (stage: number, items: number[], dnf = false) => ({ stage, score: { legs: [] as never[], dnf, penaltyItems: items } });
const approx = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
const chk = (name: string, ok: boolean, detail = ''): void => { if (!ok) { issues.push(`${name} ${detail}`); log('FAIL', name, detail); } };

// 1. discards per division: pool of stages 1-7 only, 8-9 whole
for (const [div, n] of Object.entries(DIVISION_DISCARDS) as [Division, number][]) {
  const stages = Array.from({ length: 9 }, (_, i) => st(i + 1, [10 + i, 5, 1, 0, 3]));   // 7 qualifying stages x 5 items = 35 items
  const t = championshipTotal(stages, div, { year: 1939 });
  const pool = stages.filter(s => s.stage <= 7).flatMap(s => s.score.penaltyItems).sort((a, b) => b - a);
  const kept = stages.filter(s => s.stage >= 8).flatMap(s => s.score.penaltyItems).reduce((a, b) => a + b, 0);
  const want = pool.slice(n).reduce((a, b) => a + b, 0) + kept;
  chk(`${div} discards`, t.discarded.length === n && approx(t.afterDiscards, want), `got ${t.afterDiscards}, want ${want}, discarded ${t.discarded}`);
  chk(`${div} age factored`, approx(t.ageFactored, roundFactored(want, 0.845)), `${t.ageFactored}`);
}
// 2. stage 0, 10, negatives, NaN stage numbers, fractional stage numbers are ignored; a repeated stage counts once (the later one)
{
  const t = championshipTotal([st(0, [50]), st(10, [50]), st(-1, [50]), st(1.5, [50]), st(NaN, [50]), st(1, [4, 3]), st(1, [2, 1])], 'rookie', { year: 1939 });
  chk('stage 0 / 10 / junk ignored, replay replaces', t.raw === 3 && t.stagesCounted.join() === '1', `raw ${t.raw} counted ${t.stagesCounted}`);
}
// 3. fewer items than discards; all zero; empty; ties among items; discard of equal values
{
  chk('fewer items than discards', championshipTotal([st(1, [5, 4])], 'rookie').afterDiscards === 0);
  chk('empty', championshipTotal([], 'rookie').afterDiscards === 0 && championshipTotal([], 'rookie').stagesCounted.length === 0);
  const t = championshipTotal([st(1, [7, 7, 7, 7, 7, 7, 7, 7])], 'rookie'); chk('equal items', t.afterDiscards === 14 && t.discarded.length === 6);
  const t2 = championshipTotal([st(8, [30, 20]), st(9, [10])], 'rookie'); chk('stages 8-9 kept whole, no discards', t2.afterDiscards === 60 && t2.discarded.length === 0, `${t2.afterDiscards}`);
}
// 4. DNF: stage 8 or 9 removes eligibility, a DNF on 1-7 does not; DNF stage items still counted
{
  chk('dnf stage 8', !championshipTotal([st(8, [10], true)], 'rookie').championshipEligible); chk('dnf stage 9', !championshipTotal([st(9, [10], true)], 'rookie').championshipEligible);
  chk('dnf stage 7 ok', championshipTotal([st(7, [10], true)], 'rookie').championshipEligible); chk('dnf stage 8 replayed clean', championshipTotal([st(8, [10], true), st(8, [10], false)], 'rookie').championshipEligible);
}
// 5. age factor use: opts.year, no year (first stage's factor), year NaN
{
  chk('year 1939', approx(championshipTotal([st(1, [100])], 'rookie', { year: 1939 }).ageFactor, 0.845));
  const noYear = championshipTotal([{ stage: 1, score: { legs: [], dnf: false, penaltyItems: [100], ageFactor: 0.9 } }], 'rookie'); chk('no year takes the stage factor', noYear.ageFactor === 0.9);
  const none = championshipTotal([st(1, [100])], 'rookie'); chk('no year and no factor -> 1', none.ageFactor === 1, `${none.ageFactor}`);
  try { championshipTotal([st(1, [100])], 'rookie', { year: NaN }); chk('year NaN throws or is rejected', false, 'did not throw'); } catch { /* ok (RangeError) */ }
  chk('age table', [1953, 1954, 1939, 1930, 1929, 1900, 1899].map(y => ageFactor(y)).join() === '0.915,1,0.845,0.8,0.79,0.5,0.5', [1953, 1954, 1939, 1930, 1929, 1900, 1899].map(y => ageFactor(y)).join());
  // hostile items: NaN, negative, Infinity, strings
  const h = championshipTotal([st(1, [NaN, -5, Infinity, 3])], 'rookie'); log('hostile items [NaN,-5,Infinity,3] ->', JSON.stringify({ raw: h.raw, afterDiscards: h.afterDiscards, ageFactored: h.ageFactored }));
  if (!Number.isFinite(h.ageFactored)) issues.push('championshipTotal with a non-finite penalty item returns a non-finite total (items come from localStorage via penaltyItems)');
}
// 6. standings ties
{
  const a = { name: 'a', total: 10.1 + 20.2 + 30.3, scoringYear: 1930 }, b = { name: 'b', total: 60.6, scoringYear: 1929 };
  chk('tie by 0.01 uses the older Scoring Year', rankStandings([a, b])[0]!.name === 'b'); chk('tie then Trophy Run', rankStandings([{ name: 'x', total: 5, scoringYear: 1939, trophyRunPosition: 3 }, { name: 'y', total: 5, scoringYear: 1939, trophyRunPosition: 2 }])[0]!.name === 'y');
  chk('no Trophy Run position sorts last', rankStandings([{ name: 'x', total: 5, scoringYear: 1939 }, { name: 'y', total: 5, scoringYear: 1939, trophyRunPosition: 9 }])[0]!.name === 'y');
  chk('0.004 apart is a tie', compareStandings({ name: 'a', total: 5.004, scoringYear: 1939 }, { name: 'b', total: 5.001, scoringYear: 1939 }) === 0);
  chk('0.005 apart is not', compareStandings({ name: 'a', total: 5.005, scoringYear: 1939 }, { name: 'b', total: 5.001, scoringYear: 1939 }) !== 0, 'Math.round(500.5)=501 vs 500');
  chk('NaN total does not throw', (() => { try { rankStandings([{ name: 'a', total: NaN, scoringYear: 1939 }, { name: 'b', total: 1, scoringYear: 1939 }]); return true; } catch { return false; } })());
}
// 7. campaign store: stage 0 via seed 10, stage 10, replays, tiers, legacy entries without penaltyItems, divisions, corrupt storage
{
  const mem: Record<string, string> = {}; const store: CampaignStore = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  recordCampaignStage({ stage: 10, tier: 0, raw: 40, score: 33.8, aces: 0, penaltyItems: [20, 20] }, store);   // Trophy Run
  recordCampaignStage({ stage: 0, tier: 0, raw: 30, score: 25.35, aces: 0, penaltyItems: [30] }, store);       // replay of stage 0: lower score wins
  recordCampaignStage({ stage: 11, tier: 0, raw: 1, score: 1, aces: 0 }, store); recordCampaignStage({ stage: -1, tier: 0, raw: 1, score: 1, aces: 0 }, store); recordCampaignStage({ stage: 2.5, tier: 0, raw: 1, score: 1, aces: 0 }, store);
  for (let s = 1; s <= 9; s++) recordCampaignStage({ stage: s, tier: 1, raw: 10 + s, score: Math.round((10 + s) * 0.845 * 100) / 100, aces: s % 2, penaltyItems: s === 3 ? undefined : [10, s, 0] }, store);
  recordCampaignStage({ stage: 4, tier: 1, raw: 5, score: 4.23, aces: 0, penaltyItems: [5, 0, 0] }, store);   // better replay
  recordCampaignStage({ stage: 5, tier: 1, raw: 90, score: 76, aces: 0, penaltyItems: [90, 0, 0] }, store);    // worse replay: ignored
  const d = loadCampaign(store); const s0 = d.tiers['0']!; chk('Stage 0 stored once with the better score', !!s0['0'] && s0['0'].score === 25.35 && Object.keys(s0).length === 1, JSON.stringify(Object.keys(s0)));
  const sum = campaignSummary(d, 1); chk('summary played 9', sum.played === 9 && sum.complete);
  chk('stage 4 replay kept the better', sum.rows[3]!.raw === 5); chk('stage 5 worse replay ignored', sum.rows[4]!.raw === 15);
  const trophy = campaignSummary(d, 0).trophyRun; chk('trophy run read from stage 0', trophy.played && trophy.raw === 30);
  log('tier 1 summary:', JSON.stringify({ total: sum.total, champ: { ...sum.championship, discarded: sum.championship.discarded.join('/') }, withoutDetail: sum.championship.withoutDetail, standings: sum.standings.map(x => `${x.rank}:${x.name.slice(0, 22)}:${x.total}`) }));
  // legacy entry (stage 3 has no penaltyItems) counts whole, not discarded
  chk('legacy stage counted whole', sum.championship.withoutDetail.join() === '3');
  // the age factor in the summary is FORD 1939
  chk('summary uses the 1939 factor', sum.championship.ageFactor === 0.845);
  // division switch changes the discard count
  setCampaignDivision('grand', store); const g = campaignSummary(loadCampaign(store), 1); chk('grand = 3 discards', g.discardCount === 3 && g.championship.discarded.length === 3, `${g.discardCount}`);
  // new tier names: the campaign keys tiers 0/1/2; the D13 card names Bronze/Silver/Gold (legalTiers); unknown tier 7 is empty, not a crash
  const t7 = campaignSummary(loadCampaign(store), 7); chk('unknown tier is empty', t7.played === 0 && !t7.complete);
  // corrupt + hostile stored data
  mem[CAMPAIGN_KEY] = '{"version":1,"tiers":{"1":{"1":{"stage":1,"tier":1,"raw":"x","score":null,"aces":0,"at":0,"penaltyItems":["a",null,5]}}},"division":"nope"}';
  try { const c = campaignSummary(loadCampaign(store), 1); log('hostile stored entry ->', JSON.stringify({ total: c.total, ch: c.championship.ageFactored, div: c.division })); if (!Number.isFinite(c.championship.ageFactored) || !Number.isFinite(c.total)) issues.push('campaignSummary returns a non-finite total for a hand-edited localStorage entry (penaltyItems with strings/null, score null)'); }
  catch (e) { issues.push(`campaignSummary throws on a hand-edited entry: ${(e as Error).message}`); }
  mem[CAMPAIGN_KEY] = '{not json'; chk('corrupt json -> empty campaign', loadCampaign(store).division === 'rookie');
  mem[CAMPAIGN_KEY] = '{"version":1,"tiers":{"1":{"4":null,"5":"x"}}}'; try { campaignSummary(loadCampaign(store), 1); } catch (e) { issues.push(`campaignSummary throws on null/string stage entries: ${(e as Error).message}`); }
  // record NaN / Infinity / negative score
  const mem2: Record<string, string> = {}; const store2: CampaignStore = { getItem: k => mem2[k] ?? null, setItem: (k, v) => { mem2[k] = v; } };
  recordCampaignStage({ stage: 1, tier: 0, raw: NaN, score: NaN, aces: 0 }, store2); recordCampaignStage({ stage: 2, tier: 0, raw: 5, score: -1, aces: 0 }, store2); recordCampaignStage({ stage: 3, tier: 0, raw: 5, score: Infinity, aces: 0 }, store2);
  log('hostile record: stored', mem2[CAMPAIGN_KEY]?.slice(0, 160)); const c2 = campaignSummary(loadCampaign(store2), 0); log(' summary total', c2.total, c2.championship.ageFactored);
  // NaN score replay lock: a NaN score is stored first, then a real score can never replace it (e.score < NaN is false)
  recordCampaignStage({ stage: 1, tier: 0, raw: 20, score: 17, aces: 0 }, store2); log(' stage 1 after a real replay over a stored NaN:', JSON.stringify(loadCampaign(store2).tiers['0']!['1']));
  if (loadCampaign(store2).tiers['0']!['1']!.raw !== 20) issues.push('a stored NaN/Infinity score locks the stage: later real scores never replace it (recordCampaignStage compares e.score < prev.score)');
}
log('ISSUES', issues.length); log(issues.join('\n'));
