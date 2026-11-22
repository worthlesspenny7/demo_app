/**
 * SCH-001 / SCH-004: the types of the Rally School 2.0 course (docs/spec/SCHOOL.md). Pure data types, no DOM.
 * content/course.ts exports `COURSE: Module[]`; content/excerpts.ts resolves every `Ref`; the UI (page player,
 * widgets, guided controls) codes against these names.
 */
import type { DecisionKind } from './rules.js';
export type { DecisionKind } from './rules.js';

/** SCH-004: the run controls, introduced one module at a time (the controls ladder). */
export const CONTROL_IDS = [
  'book', 'callTurn', 'callSpeed', 'go', 'watchStartStop', 'watchLap', 'chartCell', 'distanceBar',
  'callAtMark', 'clock', 'todStrip', 'launch', 'makeup', 'taCard', 'holdCard', 'desk',
] as const;
export type ControlId = (typeof CONTROL_IDS)[number];

/** A reference chip: opens the excerpt in a bottom sheet (never pasted into the page). `key` is an EXCERPTS key, e.g. 'hb:p8', 'reg:V.H.3', 'video:2026:110:28'. */
export interface Ref { type: 'hb' | 'reg' | 'video'; key: string; label: string }

export type WidgetId = 'holdSpeed' | 'tapLap' | 'whereCheckpoint' | 'readScorecard';

/** Widget parameters (all optional; the widget reads the engine for the numbers). */
export interface WidgetParams {
  /** holdSpeed / whereCheckpoint: the assigned speed in mph */
  speed?: number;
  /** holdSpeed / whereCheckpoint: the leg length in miles */
  miles?: number;
  /** tapLap: the number of markers to lap at */
  markers?: number;
  /** a seed for any randomised part */
  seed?: number;
  /** readScorecard: which line to ask about */
  ask?: 'total' | 'ace' | 'worst';
  /** a one-line goal shown above the widget (<= 15 words) */
  goal?: string;
}

interface PageBase { refs: Ref[] }
export interface ConceptPage extends PageBase { kind: 'concept'; title: string; words: string; figure?: string }
export interface ExamplePage extends PageBase { kind: 'example'; title: string; lines: string[] }
export interface MinisimPage extends PageBase { kind: 'minisim'; decisionKind: DecisionKind; seed: number; control: ControlId; why: string }
export interface WidgetPage extends PageBase { kind: 'widget'; widget: WidgetId; params: WidgetParams }
export interface CheckPage extends PageBase { kind: 'check'; question: string; options: string[]; answer: number }
export type Page = ConceptPage | ExamplePage | MinisimPage | WidgetPage | CheckPage;
export type PageKind = Page['kind'];

export interface TryIt {
  /** the rule-card skills the try-it run draws on (content/rules.ts RULE_SKILLS) */
  skills: import('./rules.js').RuleSkill[];
  /** the decision kinds the 5 cards use */
  kinds: DecisionKind[];
  cards: 5;
}

export interface Module {
  id: string;            // 'm0' .. 'm12'
  title: string;
  teaches: string;       // <= 20 words
  controls: ControlId[]; // introduced by this module
  pages: Page[];         // 4..8
  tryIt: TryIt;
  youCanNow: string;     // one line, the recap: "You can now ..."
  unlocks?: 'runs' | 'desk';
  /** old lesson ids (content/lessons.ts) this module covers, for #/school/<old id> redirects (SCH-008) */
  covers?: string[];
}
