/** D13 campaign (UI-020): nine stages, each a D12 stage on its own seed, with a cumulative score table kept in localStorage. */
export const CAMPAIGN_KEY = 'rally-trainer.campaign.v1';
export const CAMPAIGN_STAGES = 9;

export interface CampaignStage { stage: number; tier: number; raw: number; score: number; aces: number; at: number }
export interface CampaignData { version: 1; tiers: Record<string, Record<string, CampaignStage>> }
export interface CampaignStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

function defaultStore(): CampaignStore | null { try { if (typeof localStorage !== 'undefined') { localStorage.getItem(CAMPAIGN_KEY); return localStorage; } } catch { /* blocked */ } return null; }

export function loadCampaign(store: CampaignStore | null = defaultStore()): CampaignData {
  try {
    const raw = store?.getItem(CAMPAIGN_KEY);
    if (raw) { const p = JSON.parse(raw) as Partial<CampaignData>; if (p && p.version === 1 && p.tiers && typeof p.tiers === 'object') return p as CampaignData; }
  } catch { /* corrupt: start over */ }
  return { version: 1, tiers: {} };
}

/** Record a finished stage; a replayed stage keeps its best (lowest) age-factored score. */
export function recordCampaignStage(e: Omit<CampaignStage, 'at'>, store: CampaignStore | null = defaultStore(), now = Date.now()): CampaignData {
  const d = loadCampaign(store);
  if (!(e.stage >= 1 && e.stage <= CAMPAIGN_STAGES)) return d;
  const t = (d.tiers[String(e.tier)] ??= {});
  const prev = t[String(e.stage)];
  if (!prev || e.score < prev.score) t[String(e.stage)] = { ...e, at: now };
  try { store?.setItem(CAMPAIGN_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}

export interface CampaignRow { stage: number; seed: number; played: boolean; raw: number | null; score: number | null; aces: number; cumulative: number | null }
export interface CampaignSummary { tier: number; rows: CampaignRow[]; played: number; complete: boolean; total: number; totalRaw: number; aces: number }

export function campaignSummary(d: CampaignData, tier: number): CampaignSummary {
  const t = d.tiers[String(tier)] ?? {};
  let cum = 0, raw = 0, aces = 0, played = 0;
  const rows: CampaignRow[] = [];
  for (let s = 1; s <= CAMPAIGN_STAGES; s++) {
    const e = t[String(s)];
    if (e) { cum += e.score; raw += e.raw; aces += e.aces; played++; }
    rows.push({ stage: s, seed: s, played: !!e, raw: e ? e.raw : null, score: e ? e.score : null, aces: e?.aces ?? 0, cumulative: e ? Math.round(cum * 10) / 10 : null });
  }
  return { tier, rows, played, complete: played === CAMPAIGN_STAGES, total: Math.round(cum * 10) / 10, totalRaw: raw, aces };
}
