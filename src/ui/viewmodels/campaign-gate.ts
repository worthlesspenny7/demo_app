/** N9: #/campaign honours the D13 lock. Pure core + a thin reader of the stored progress. */
import { allDrills, isUnlocked } from '../../core/drills/index.js';
import type { Drill } from '../../core/drills/types.js';
import { app } from '../state.js';
import { unlockBest } from './curriculum.js';

export interface CampaignGate { open: boolean; note: string }

export function gateFor(d13: Drill | null | undefined, best: Record<string, number>): CampaignGate {
  if (!d13) return { open: false, note: 'The campaign (D13) is not available in this build.' };
  if (isUnlocked(d13, best)) return { open: true, note: '' };
  const missing = d13.unlock.filter(u => (best[u.drill] ?? 0) < u.stars).map(u => `${u.drill} ${'★'.repeat(u.stars)}`).join(', ');
  return { open: false, note: `The campaign is locked: D13 needs ${missing} at Silver or Gold.` };
}

export function campaignGate(): CampaignGate {
  try {
    const ds = allDrills();
    return gateFor(ds.find(d => d.id === 'D13'), unlockBest(ds, app.progress.load()));
  } catch { return { open: true, note: '' }; }
}
