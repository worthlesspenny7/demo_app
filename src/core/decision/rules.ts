/**
 * Rule text for verdicts and rule cards (MOB-005, MOB-010). The cards come from content/rules.ts (RULES, owned by the content agent);
 * a built-in fallback keyed by decision kind covers any kind or skill the content does not (yet) carry, so the engine never depends on
 * the content being complete.
 */
import { RULES as CONTENT_RULES } from '../../../content/rules.js';
import type { DecisionKind, RuleCard, Skill } from './types.js';

interface ContentCard { id: string; skill: string; text: string; source: string; kinds?: readonly string[]; title?: string; videoOnly?: boolean; sim?: boolean; short?: string }
const VIDEO = '(video, not in the documents)'; const SIMC = '(simulator convention)';
function fromContent(c: ContentCard): RuleCard {
  return { id: c.id, skill: c.skill as Skill, text: c.text, source: `${c.source}${c.videoOnly ? ` ${VIDEO}` : ''}${c.sim ? ` ${SIMC}` : ''}`, ...(c.title ? { title: c.title } : {}), ...(c.short ? { short: c.short } : {}), ...(c.kinds ? { kinds: [...c.kinds] as DecisionKind[] } : {}) };
}
const LOADED: RuleCard[] = Array.isArray(CONTENT_RULES) ? (CONTENT_RULES as unknown as ContentCard[]).filter(c => c && typeof c.id === 'string' && typeof c.text === 'string').map(fromContent) : [];

/** Built-in fallback, one per kind (used only when content/rules.ts has no card for it). */
export const FALLBACK_RULES: Record<DecisionKind, RuleCard> = {
  preread: { id: 'FB-preread', skill: 'safetyCourse', text: 'Read the line you are on and the next one, and write a speed on every row.', source: 'HB p.13, p.15 tip 8', kinds: ['preread'] },
  turn: { id: 'FB-turn', skill: 'safetyCourse', text: 'Call the turn early, by the sign the book names, so the driver can brake for it.', source: 'HB p.15 tip 4', kinds: ['turn'] },
  speedChange: { id: 'FB-speedChange', skill: 'stayOnTime', text: 'Start the new speed half a ramp early so the car crosses the sign at the midpoint speed.', source: 'HB p.12', kinds: ['speedChange'] },
  timedStart: { id: 'FB-timedStart', skill: 'stayOnTime', text: 'A timed hold counts from where the ghost leaves the landmark; call the next speed half a ramp early.', source: 'REG VII.E.2.d', kinds: ['timedStart'] },
  pause: { id: 'FB-pause', skill: 'stayOnTime', text: 'Wait the chart pause, the printed pause minus the stop-and-go loss for your speeds, then say GO.', source: 'HB p.8', kinds: ['pause'] },
  restart: { id: 'FB-restart', skill: 'startOnTime', text: 'Launch at your own time minus the standing-start loss, on the second.', source: 'HB p.7', kinds: ['restart'] },
  transitOut: { id: 'FB-transitOut', skill: 'startOnTime', text: 'For an exact transit the OUT time is the IN time plus the printed interval.', source: 'HB p.11-12', kinds: ['transitOut'] },
  makeup: { id: 'FB-makeup', skill: 'recovery', text: 'To make up S seconds drive 10 % over the assigned speed for 10 times S seconds.', source: 'HB p.10', kinds: ['makeup'] },
  hazard: { id: 'FB-hazard', skill: 'recovery', text: 'Claim a Time Allowance only for a delay beyond your control, such as a train; make up a light or a slow truck.', source: 'REG V.H.1', kinds: ['hazard'] },
  ta: { id: 'FB-ta', skill: 'recovery', text: 'Claim in multiples of 10 seconds, only what you could not make up.', source: 'REG V.H.3, V.H.5', kinds: ['ta'] },
  lost: { id: 'FB-lost', skill: 'recovery', text: 'When you know you missed a turn, turn around at once and time the way back.', source: '2026 Training Session [94:27] (video)', kinds: ['lost'] },
  checkpoint: { id: 'FB-checkpoint', skill: 'safetyCourse', text: 'At a green timing checkpoint sign do nothing: hold your speed through it.', source: 'REG V.A.1.a', kinds: ['checkpoint'] },
  clock: { id: 'FB-clock', skill: 'instruments', text: 'Take the minute from the stopwatch in time-of-day mode; the dash clock minute hand is loose.', source: 'REG II.H.1.d(3)', kinds: ['clock'] },
  watch: { id: 'FB-watch', skill: 'instruments', text: 'Lap the watch at the sign, then call the next speed when the watch reads the lap plus the interval, half a ramp early.', source: 'REG VII.E.2.d; HB p.12', kinds: ['watch'] },
};

/**
 * Which card, and which sentence of it, names the rule behind a verdict (MOB-054). Keyed by kind, then by outcome `variant` (the runner
 * picks it from what decided the card: a late or an early tap, a missed START or a missed call, a light or a train...). An entry is a
 * card id, optionally `~words` = the sentence of that card containing those words (default: the first sentence). First existing wins.
 */
const PREFERRED: Record<DecisionKind, Record<string, string[]>> = {
  preread: { turn: ['RULE-041', 'RULE-006'], speed: ['RULE-042', 'RULE-007'], pause: ['RULE-016'], default: ['RULE-006'] },
  turn: { default: ['RULE-041', 'RULE-006'], late: ['RULE-006', 'RULE-008'] },
  speedChange: { default: ['RULE-020'], late: ['RULE-020'], early: ['RULE-020', 'RULE-019'] },
  timedStart: { default: ['RULE-021~half a ramp early', 'RULE-020'], start: ['RULE-022~starts the stopwatch', 'RULE-021'] },
  pause: { default: ['RULE-016', 'RULE-018'], early: ['RULE-016', 'RULE-018'], nogo: ['RULE-018~always end the count', 'RULE-016'] },
  restart: { default: ['RULE-011', 'RULE-010'], minute: ['RULE-038', 'RULE-037'], base: ['RULE-010', 'RULE-011'], lunch: ['RULE-015', 'RULE-011'] },
  transitOut: { default: ['RULE-014'] },
  makeup: { default: ['RULE-025'], big: ['RULE-026', 'RULE-025'], limit: ['RULE-026~posted limit', 'RULE-005'], room: ['RULE-027~before or after the interval', 'RULE-026'], stop: ['RULE-029', 'RULE-025'] },
  hazard: { default: ['RULE-033~odd seconds', 'RULE-031'], light: ['RULE-031~traffic light', 'RULE-031'], small: ['RULE-032~Claim only what', 'RULE-031'], claim: ['RULE-033~odd seconds', 'RULE-032'], noTa: ['RULE-031', 'RULE-031'] },
  ta: { default: ['RULE-033~odd seconds', 'RULE-032'], over: ['RULE-032~Claim only what', 'RULE-033'] },
  lost: { default: ['RULE-034', 'RULE-035'], loop: ['RULE-043', 'RULE-034'], ta: ['RULE-031~wrong turn', 'RULE-035'] },
  checkpoint: { default: ['RULE-003', 'RULE-004'], slow: ['RULE-004', 'RULE-003'], red: ['RULE-003~red GREAT RACE STOP', 'RULE-003'] },
  clock: { default: ['RULE-038', 'RULE-037'], mid: ['RULE-038', 'RULE-037'], second: ['RULE-038~second hand', 'RULE-038'], interval: ['RULE-039', 'RULE-038'] },
  watch: { default: ['RULE-021~Lap the watch', 'RULE-039'] },
};
const parseRef = (ref: string): { id: string; words: string | null } => { const i = ref.indexOf('~'); return i < 0 ? { id: ref, words: null } : { id: ref.slice(0, i), words: ref.slice(i + 1) }; };
/** The sentences of a card's text. */
export function sentences(text: string): string[] { return text.trim().replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9])/); }

export function allRuleCards(): RuleCard[] { return LOADED.length ? LOADED.slice() : Object.values(FALLBACK_RULES); }
export function ruleCardById(id: string): RuleCard | undefined { return LOADED.find(r => r.id === id) ?? Object.values(FALLBACK_RULES).find(r => r.id === id); }

/** The card behind a kind's verdict (outcome `variant` optional). */
export function ruleCardFor(kind: DecisionKind, variant = 'default'): RuleCard { return ruleRefFor(kind, variant).card; }
function ruleRefFor(kind: DecisionKind, variant = 'default'): { card: RuleCard; words: string | null } {
  const pref = PREFERRED[kind]; const refs = [...(pref[variant] ?? []), ...(pref.default ?? [])];
  for (const ref of refs) { const { id, words } = parseRef(ref); const c = LOADED.find(r => r.id === id); if (c) return { card: c, words }; }
  const byKind = LOADED.filter(r => r.kinds?.includes(kind)).sort((a, b) => (a.kinds?.length ?? 0) - (b.kinds?.length ?? 0) || a.id.localeCompare(b.id));
  return { card: byKind[0] ?? FALLBACK_RULES[kind], words: null };
}
/** The card the Scheduler shows before the first decision of a skill (the card behind that decision's kind, if it belongs to the skill). */
export function introCardFor(skill: Skill, kind: DecisionKind): RuleCard {
  const c = ruleCardFor(kind);
  if (c.skill === skill) return c;
  const same = LOADED.find(r => r.skill === skill && r.kinds?.includes(kind)) ?? LOADED.find(r => r.skill === skill);
  return same ?? { ...FALLBACK_RULES[kind], skill };
}

/** First sentence of a card's text (the verdict's one-sentence rule). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s+(?=[A-Z0-9])|$)/s.exec(text.trim());
  return (m ? m[1]! : text.trim()).replace(/\s+/g, ' ');
}
/** "One sentence naming the rule (source)." for a verdict. */
export function verdictRule(kind: DecisionKind, variant?: string): { sentence: string; card: RuleCard } {
  const { card, words: w } = ruleRefFor(kind, variant);
  const pick = w ? sentences(card.text).find(x => x.toLowerCase().includes(w.toLowerCase())) : undefined;
  const s = (pick ?? firstSentence(card.text)).replace(/[.!?]$/, '');
  return { sentence: `${s} (${card.source}).`, card };
}
export const words = (s: string): number => (s.trim() === '' ? 0 : s.trim().split(/\s+/).length);
