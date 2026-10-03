/**
 * Debrief scorecard mirroring the official one (UI-034, REG V.C/V.E), the TA requests with the committee's decision (UI-031),
 * and the instrument-discipline findings (WATCH-009). Pure view-model, no DOM.
 */
import type { StageResult, InstrumentFinding, TaRequestRecord } from '../../core/sim.js';
import type { Scenario } from '../../core/course.js';
import type { LegScore } from '../../core/scoring.js';
import { formatClock } from '../../core/units.js';
import { formatInterval } from '../../core/griid.js';

export type LegFlag = 'ace' | 'late-cap' | 'early-cap' | 'missed' | '';
export interface ScorecardLeg {
  legIndex: number; cpId: string;
  perfect: string; actual: string;
  /** Seconds after the TA credit, + late / - early; null when the checkpoint was missed. */
  error: number | null; errorText: string;
  /** Error before any TA credit. */
  rawError: number | null;
  taCredit: number;
  /** The 1 s/s penalty part (capped) plus any extras (sight zone): what the card prints in the penalty column. */
  penalty: number; sightZone: number;
  flag: LegFlag;
  /** "capped at 2m00s (late)", "capped at 5m00s (early)", "missed checkpoint: 3m00s", "" */
  flagText: string;
  ace: boolean;
}
export interface TaRequestRow {
  legIndex: number; requested: number; adjusted: number; adjustment: string; status: 'filed' | 'refused'; credit: number;
  fromLine: number; toLine: number; note: string; reason: string; text: string;
}
export interface PenaltyItem { kind: 'sightZone' | 'earlyDeparture' | 'observation'; label: string; seconds: number; legIndex?: number }
export interface ScorecardVm {
  legs: ScorecardLeg[];
  caps: { late: number; early: number; missed: number };
  capsText: string;
  taRequests: TaRequestRow[];
  taCreditTotal: number;
  scorecardAcked: boolean | null;
  items: PenaltyItem[];
  raw: number; ageFactor: number; ageYear: number | null; ageText: string;
  /** Stage score to 0.01 s, as printed: "45.60". */
  score: number; scoreText: string;
  aces: number;
  dnf: boolean; dnfReason: string; banner: string;
  discipline: { findings: InstrumentFinding[]; clean: boolean; summary: string };
}

const mmss = (s: number): string => formatInterval(Math.abs(s));
const fmtSigned = (e: number): string => (e > 0 ? `+${e}` : `${e}`);

function legFlag(l: LegScore, caps: ScorecardVm['caps']): { flag: LegFlag; text: string } {
  if (l.extras?.missed) return { flag: 'missed', text: `missed checkpoint: ${mmss(caps.missed)}${l.taReason ? ` (${l.taReason})` : ''}` };
  if (l.capped) return (l.error ?? 0) >= 0 ? { flag: 'late-cap', text: `capped at ${mmss(caps.late)} (late)` } : { flag: 'early-cap', text: `capped at ${mmss(caps.early)} (early)` };
  if (l.ace) return { flag: 'ace', text: 'ACE' };
  return { flag: '', text: '' };
}

/** TA requests as filed with the committee's decision per request (status, adjusted amount, reason). */
export function taRequestRows(result: StageResult | null | undefined): TaRequestRow[] {
  const reqs: TaRequestRecord[] = result?.ta?.requests ?? [];
  const legs = result?.score?.legs ?? [];
  return reqs.map(r => {
    const leg = legs.find(l => l.index === r.legIndex);
    const credit = r.status === 'refused' ? 0 : (leg?.taCredit ?? 0);
    const reason = r.status === 'refused' ? (r.reason ?? 'refused') : (leg?.taReason ?? '');
    const adj = r.status === 'refused' ? 'refused' : r.adjustment ? r.adjustment : `${formatInterval(r.adjusted)} as requested`;
    return {
      legIndex: r.legIndex, requested: r.requested, adjusted: r.adjusted, adjustment: r.adjustment ?? '', status: r.status, credit,
      fromLine: r.fromLine, toLine: r.toLine, note: r.note ?? '', reason,
      text: `Leg ${r.legIndex}: requested ${formatInterval(r.requested)} (lines ${r.fromLine}-${r.toLine}), ${adj}; credit ${formatInterval(credit)}${reason ? `. ${reason}` : ''}`,
    };
  });
}

export function scorecardViewModel(result: StageResult | null | undefined, scenario?: Scenario | null): ScorecardVm {
  const score = result?.score;
  const rules = scenario?.rules;
  const caps = { late: rules?.maxLate ?? 120, early: rules?.maxEarly ?? 300, missed: rules?.missedCheckpoint ?? 180 };
  const legs: ScorecardLeg[] = (score?.legs ?? []).map(l => {
    const { flag, text } = legFlag(l, caps);
    const perfectTod = l.anchorTod + l.perfectDuration;
    return {
      legIndex: l.index, cpId: l.cpId, perfect: formatClock(perfectTod), actual: l.actualTod === null ? 'missed' : formatClock(l.actualTod),
      error: l.error, errorText: l.error === null ? '-' : fmtSigned(l.error), rawError: l.rawError, taCredit: l.taCredit,
      penalty: l.penalty, sightZone: l.extras?.sightZone ?? 0, flag, flagText: text, ace: l.ace,
    };
  });
  const items: PenaltyItem[] = [];
  for (const l of legs) if (l.sightZone > 0) items.push({ kind: 'sightZone', label: `Sight zone, leg ${l.legIndex}: stopped or at 5 mph or less within sight of the checkpoint`, seconds: l.sightZone, legIndex: l.legIndex });
  (score?.earlyDepartures ?? []).forEach((e, i) => items.push({ kind: 'earlyDeparture', label: `Early departure ${i + 1}: left a promoted stop ${e.minutesEarly.toFixed(1)} min early${e.referral ? ' (referred, VI.B.3)' : ''}`, seconds: e.penalty }));
  if (score?.observationPenalty) items.push({ kind: 'observation', label: 'Observation Checkpoint crossed without the stop', seconds: score.observationPenalty });
  const taRequests = taRequestRows(result);
  const year = scenario?.car?.year ?? null;
  const af = score?.ageFactor ?? 1;
  const findings = result?.instrumentDiscipline ?? [];
  const dnf = !!score?.dnf;
  return {
    legs, caps, capsText: `Late legs are capped at ${mmss(caps.late)}, early legs at ${mmss(caps.early)}; a missed checkpoint scores ${mmss(caps.missed)}.`,
    taRequests, taCreditTotal: taRequests.reduce((a, r) => a + r.credit, 0), scorecardAcked: result?.ta?.scorecardAcked ?? null,
    items, raw: score?.raw ?? 0, ageFactor: af, ageYear: year, ageText: `${af.toFixed(3)}${year !== null ? ` (${year})` : ''}`,
    score: score?.score ?? 0, scoreText: (score?.score ?? 0).toFixed(2), aces: score?.aces ?? 0,
    dnf, dnfReason: score?.dnfReason ?? '', banner: dnf ? `DNF / FNS: ${score?.dnfReason ?? 'the final checkpoint was missed'}. The stage is excluded from championship awards.` : '',
    discipline: { findings, clean: findings.length === 0, summary: findings.length === 0 ? 'Clean: every timing action used the right instrument.' : `${findings.length} instrument finding${findings.length === 1 ? '' : 's'}: use the clock for time of day, the stopwatch for intervals.` },
  };
}
