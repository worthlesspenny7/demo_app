/**
 * Phase VIII School layout (MOB-010, MOB-011, MOB-012): the pure model behind #/school, so the word budgets can be tested without a DOM.
 * The School page is a grid of rule cards grouped by the Four S's; the long lessons live on the Reference page under "Long form";
 * Dad's card has a "Dad reads this" mode, one rule per screen. src/ui/screens/school.ts renders exactly this model, in this order.
 */
import { LESSONS, type Lesson } from './lessons.js';
import { RULES, SKILL_GROUPS, ruleById, sourceLine, words, type DecisionKind, type RuleCard, type RuleSkill } from './rules.js';

export const SCHOOL_TITLE = 'School';
/** MOB-012: the School shows at most this many words before its first "Try it" button. */
export const SCHOOL_WORDS_BEFORE_TRY_MAX = 60;
/** MOB-012: the first-run path (a new player's first screen to the first decision) shows at most this many rule cards. */
export const FIRST_RUN_RULE_CARDS_MAX = 2;

/** The one line under the title: short, and it says where the long readings went. */
export function schoolIntro(lessons: Lesson[] = LESSONS): string {
  const mins = lessons.map(l => l.minutes);
  return `Short rules, then drive. ${lessons.length} long readings, ${Math.min(...mins)} to ${Math.max(...mins)} minutes each, are in Reference under Long form.`;
}

export interface SchoolGroup { skill: RuleSkill; title: string; fourS: string; cards: RuleCard[] }
/** The rule cards grouped by the Four S's (safety and course, start, stay on time) then recovery and instruments, in card order. */
export function schoolGroups(rules: RuleCard[] = RULES): SchoolGroup[] {
  return SKILL_GROUPS.map(g => ({ ...g, cards: rules.filter(r => r.skill === g.skill) })).filter(g => g.cards.length > 0);
}

/** The parts of a rule card in the order they sit in the DOM: the "Try it" button is in the card's header row, before the rule text. */
export const CARD_PARTS = ['title', 'try', 'text', 'source', 'long'] as const;
export type CardPart = (typeof CARD_PARTS)[number];
export const TRY_LABEL = 'Try it';
export const LONG_LABEL = 'Long form';
export function cardPartText(c: RuleCard, part: CardPart): string {
  switch (part) {
    case 'title': return c.title;
    case 'try': return TRY_LABEL;
    case 'text': return c.text;
    case 'source': return `Source: ${sourceLine(c)}`;
    case 'long': return c.lesson ? LONG_LABEL : '';
  }
}
/** Where "Try it" goes: the mobile run route (agent B implements it), the skill the card belongs to. */
export const tryHash = (skill: RuleSkill): string => `#/run?skill=${skill}`;

/** Every visible word on the School page before its first "Try it" button, in DOM order. */
export function schoolTextBeforeFirstTry(rules: RuleCard[] = RULES, lessons: Lesson[] = LESSONS): string[] {
  const out: string[] = [SCHOOL_TITLE, schoolIntro(lessons)];
  const g = schoolGroups(rules)[0]; if (!g) return out;
  out.push(g.title, g.fourS);
  const c = g.cards[0]; if (!c) return out;
  for (const p of CARD_PARTS) { if (p === 'try') break; out.push(cardPartText(c, p)); }
  return out;
}
export const schoolWordsBeforeFirstTry = (rules: RuleCard[] = RULES, lessons: Lesson[] = LESSONS): number => schoolTextBeforeFirstTry(rules, lessons).reduce((a, t) => a + words(t), 0);

/** One-tap check cards: the lessons' check questions, kept (they mark the lesson passed in the saved progress). */
export interface CheckCard { lessonId: string; title: string; question: string; options: string[]; answer: number; explain: string }
export function checkCards(lessons: Lesson[] = LESSONS): CheckCard[] {
  return lessons.map(l => ({ lessonId: l.id, title: l.title, question: l.check.question, options: l.check.options, answer: l.check.answer, explain: l.check.explain }));
}

// ---------------------------------------------------------------- first run (MOB-012)
export type FirstRunStep = { screen: 'rule'; rule: string } | { screen: 'decision'; kind: DecisionKind };
/**
 * A brand-new player's path from the first screen to the first decision: one rule card (green means do nothing, red means stop), then the checkpoint
 * decision it precedes, a one-tap choice. The Scheduler (MOB-005) uses the same card because RULE-003 lists 'checkpoint' in its kinds.
 */
export const FIRST_RUN_PATH: FirstRunStep[] = [{ screen: 'rule', rule: 'RULE-003' }, { screen: 'decision', kind: 'checkpoint' }];
export function firstRunRuleCards(path: FirstRunStep[] = FIRST_RUN_PATH): RuleCard[] {
  return path.flatMap(s => (s.screen === 'rule' ? [ruleById(s.rule)].filter((r): r is RuleCard => !!r) : []));
}

// ---------------------------------------------------------------- Dad reads this (MOB-011)
export const DAD_CARD_LESSON = 'protocol';
export const DAD_TITLE = "Dad's card";
/** The printable card of the team-protocol lesson: its title and one line per rule. */
export function dadCard(lessons: Lesson[] = LESSONS): { title: string; lines: string[] } {
  const l = lessons.find(x => x.id === DAD_CARD_LESSON);
  const b = l?.body.find((x): x is { card: { title: string; lines: string[] } } => typeof x === 'object' && 'card' in x);
  return b ? { title: b.card.title, lines: [...b.card.lines] } : { title: DAD_TITLE, lines: [] };
}
export interface DadPage { n: number; total: number; text: string }
/** "Dad reads this while you drive": one rule per screen. */
export function dadPages(lessons: Lesson[] = LESSONS): DadPage[] {
  const lines = dadCard(lessons).lines;
  return lines.map((text, i) => ({ n: i + 1, total: lines.length, text }));
}
/** The page after a swipe or arrow: stays on the first and last page. dir -1 = back, +1 = next. */
export const dadStep = (i: number, dir: -1 | 1, total: number): number => Math.max(0, Math.min(total - 1, i + dir));
/** A horizontal swipe (touch deltas in px): a left swipe goes to the next rule, a right swipe back; short or mostly vertical moves do nothing. */
export function dadSwipe(dx: number, dy: number, minPx = 40): -1 | 0 | 1 { if (Math.abs(dx) < minPx || Math.abs(dx) < Math.abs(dy) * 1.5) return 0; return dx < 0 ? 1 : -1; }
