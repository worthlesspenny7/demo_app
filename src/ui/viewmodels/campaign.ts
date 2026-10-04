/**
 * D13 campaign (UI-020, CAMP-001): Trophy Run (Stage 0, a tie-break only) plus nine stages, each a D12 stage on its own seed and its own drawn ASP,
 * with a division setting (REG-003 discards), the age factor (REG-002) and a standings table ordered by compareStandings (REG-004). Kept in localStorage.
 */
import { championshipTotal, ageFactor, rankStandings, DIVISION_DISCARDS, DEFAULT_DIVISION, TIE_BREAK_ORDER, QUALIFYING_STAGES, type Division, type Standing } from '../../core/scoring.js';
import { campaignAsp } from '../../core/drills/staged.js';
import { FORD_1939 } from '../../core/course.js';

export const CAMPAIGN_KEY = 'rally-trainer.campaign.v1';
export const CAMPAIGN_STAGES = 9;
/** The Trophy Run (Stage 0) is played as D13 seed 10 (the route parser treats seed 0 as 1) and recorded as stage 0. */
export const TROPHY_RUN_SEED = 10;

export const DIVISIONS: { id: Division; label: string }[] = [
  { id: 'rookie', label: 'Rookie' }, { id: 'sportsman', label: 'Sportsman' }, { id: 'expert', label: 'Expert' }, { id: 'grand', label: 'Grand Champion' }, { id: 'xcup', label: 'X-Cup' },
];
export const divisionLabel = (d: Division): string => DIVISIONS.find(x => x.id === d)?.label ?? d;
const isDivision = (x: unknown): x is Division => typeof x === 'string' && x in DIVISION_DISCARDS;

export interface CampaignStage {
  stage: number; tier: number; raw: number; score: number; aces: number; at: number;
  /** Every discardable item of the stage (one per leg plus each separate penalty): the pool of I.F.3. Absent on entries stored before CAMP-001. */
  penaltyItems?: number[];
  /** DNF / FNS on the stage (REG-001). */
  dnf?: boolean;
}
export interface CampaignData { version: 1; tiers: Record<string, Record<string, CampaignStage>>; /** CAMP-001: the division (default Rookie). */ division?: Division }
export interface CampaignStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultStore(): CampaignStore | null { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(CAMPAIGN_KEY); return localStorage; } } catch { /* blocked */ } return null; }

export function loadCampaign(store: CampaignStore | null = defaultStore()): CampaignData {
  try {
    const raw = store?.getItem(CAMPAIGN_KEY);
    if (raw) { const p = JSON.parse(raw) as Partial<CampaignData>; if (p && p.version === 1 && p.tiers && typeof p.tiers === 'object') return { ...(p as CampaignData), division: isDivision(p.division) ? p.division : DEFAULT_DIVISION }; }
  } catch { /* corrupt: start over */ }
  return { version: 1, tiers: {}, division: DEFAULT_DIVISION };
}
function save(d: CampaignData, store: CampaignStore | null): void { try { store?.setItem(CAMPAIGN_KEY, JSON.stringify(d)); } catch { /* ignore */ } }

/** CAMP-001: the division the campaign is scored in (rookie by default). */
export function setCampaignDivision(division: Division, store: CampaignStore | null = defaultStore()): CampaignData {
  const d = loadCampaign(store); d.division = isDivision(division) ? division : DEFAULT_DIVISION; save(d, store); return d;
}

/** Record a finished stage; a replayed stage keeps its best (lowest) age-factored score. Stage 0 or seed 10 is the Trophy Run. */
export function recordCampaignStage(e: Omit<CampaignStage, 'at'>, store: CampaignStore | null = defaultStore(), now = Date.now()): CampaignData {
  const d = loadCampaign(store);
  const stage = e.stage === TROPHY_RUN_SEED ? 0 : e.stage;
  if (!(Number.isInteger(stage) && stage >= 0 && stage <= CAMPAIGN_STAGES)) return d;
  const t = (d.tiers[String(e.tier)] ??= {});
  const prev = t[String(stage)];
  if (!prev || e.score < prev.score) t[String(stage)] = { ...e, stage, at: now };
  save(d, store);
  return d;
}

export interface CampaignRow {
  stage: number; /** the D13 seed that plays this stage */ seed: number; played: boolean; raw: number | null; score: number | null; aces: number; cumulative: number | null;
  /** The assigned starting position drawn for this stage (shown on the card, STAGE-002). */
  asp: number; dnf: boolean;
  /** Seconds of this stage's pool removed by the division's discards; null when the entry has no leg detail. */
  discarded: number | null;
}
export interface StandingRow extends Standing { you: boolean; rank: number }
export interface CampaignSummary {
  tier: number; rows: CampaignRow[]; played: number; complete: boolean;
  /** Sum of the stage scores played (raw x age factor each), before discards: kept for the stage table. */
  total: number; totalRaw: number; aces: number;
  division: Division; divisionLabel: string; discardCount: number;
  championship: { raw: number; afterDiscards: number; ageFactor: number; ageFactored: number; discarded: number[]; /** stages stored without leg detail count whole (no discards) */ withoutDetail: number[]; eligible: boolean };
  /** Stage 0: never part of the total, shown for the tie-break (V.C.2.f). */
  trophyRun: { played: boolean; raw: number | null; score: number | null; asp: number; seed: number };
  standings: StandingRow[]; tieBreak: readonly string[];
}

/** Benchmark pace per day (R06 §4: champion ~3 s, expert ~13 s, sportsman ~25 s, rookie ~46 s) for the field shown beside you; no discards. */
const FIELD: { name: string; perDay: number; year: number }[] = [
  { name: 'Champion pace (1936 Packard)', perDay: 3, year: 1936 },
  { name: 'Expert pace (1941 Plymouth)', perDay: 13, year: 1941 },
  { name: 'Sportsman pace (1948 Studebaker)', perDay: 25, year: 1948 },
  { name: 'Rookie pace (1956 Chevrolet)', perDay: 46, year: 1956 },
];
const r2 = (x: number): number => Math.round(x * 100) / 100;

export function campaignSummary(d: CampaignData, tier: number): CampaignSummary {
  const t = d.tiers[String(tier)] ?? {}; const division = isDivision(d.division) ? d.division : DEFAULT_DIVISION;
  let cum = 0, raw = 0, aces = 0, played = 0;
  const rows: CampaignRow[] = []; const withItems: { stage: number; score: { legs: never[]; dnf: boolean; penaltyItems: number[] } }[] = []; const withoutDetail: number[] = []; let legacyRaw = 0; let dnfLate = false;
  for (let s = 1; s <= CAMPAIGN_STAGES; s++) {
    const e = t[String(s)];
    if (e) {
      cum += e.score; raw += e.raw; aces += e.aces; played++;
      if (Array.isArray(e.penaltyItems) && e.penaltyItems.length) withItems.push({ stage: s, score: { legs: [], dnf: !!e.dnf, penaltyItems: e.penaltyItems } }); else { withoutDetail.push(s); legacyRaw += e.raw; if (e.dnf && s >= 8) dnfLate = true; }
    }
    rows.push({ stage: s, seed: s, played: !!e, raw: e ? e.raw : null, score: e ? e.score : null, aces: e?.aces ?? 0, cumulative: e ? Math.round(cum * 10) / 10 : null, asp: campaignAsp(s), dnf: !!e?.dnf, discarded: null });
  }
  const champ = championshipTotal(withItems, division, { year: FORD_1939.year });
  // per-stage discard display: take the discarded items off the stages of the pool, largest first (the same greedy order as championshipTotal)
  const left = [...champ.discarded];
  for (const row of rows) { if (!row.played || !QUALIFYING_STAGES.includes(row.stage)) continue; const items = t[String(row.stage)]?.penaltyItems; if (!items?.length) continue; let cut = 0; for (const it of [...items].sort((a, b) => b - a)) { const i = left.indexOf(it); if (i >= 0) { left.splice(i, 1); cut += it; } } row.discarded = cut; }
  const afterDiscards = champ.afterDiscards + legacyRaw; const f = ageFactor(FORD_1939.year); const total = r2(afterDiscards * f);
  const trophy = t['0'];
  // the Trophy Run finishing position (the second tie-break) is the rank of the Trophy Run day score among the field's typical day scores
  const trophyRank = (own: number): number => 1 + FIELD.filter(x => x.perDay < own).length + (trophy && trophy.raw < own ? 1 : 0);
  const field: Standing[] = FIELD.map(x => ({ name: x.name, total: r2(x.perDay * Math.max(played, 1) * ageFactor(x.year)), scoringYear: x.year, trophyRunPosition: trophyRank(x.perDay) }));
  const you: Standing = { name: `You (${FORD_1939.year} Ford, ${divisionLabel(division)})`, total, scoringYear: FORD_1939.year, trophyRunPosition: trophy ? 1 + FIELD.filter(x => x.perDay < trophy.raw).length : undefined };
  // B20: with no stage played yet there is no total to rank: you start below the field's benchmark rows instead of heading the table at 0.00
  const ranked = (played ? rankStandings([you, ...field]) : [...rankStandings(field), you]).map((s, i): StandingRow => ({ ...s, you: s === you, rank: i + 1 }));
  return {
    tier, rows, played, complete: played === CAMPAIGN_STAGES, total: Math.round(cum * 10) / 10, totalRaw: raw, aces,
    division, divisionLabel: divisionLabel(division), discardCount: DIVISION_DISCARDS[division],
    championship: { raw: champ.raw + legacyRaw, afterDiscards, ageFactor: f, ageFactored: total, discarded: champ.discarded, withoutDetail, eligible: champ.championshipEligible && !dnfLate },
    trophyRun: { played: !!trophy, raw: trophy ? trophy.raw : null, score: trophy ? trophy.score : null, asp: campaignAsp(0), seed: TROPHY_RUN_SEED },
    standings: ranked, tieBreak: TIE_BREAK_ORDER,
  };
}
