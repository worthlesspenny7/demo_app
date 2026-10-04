/** Lesson check questions: the options are shuffled each time the lesson is drawn, and the answer index follows the right option (PT-10 N-C4: "10 of 12 answers were option 2"). Pure: no DOM. */
import { rng } from '../../core/rng.js';

export interface LessonCheckLike { question: string; options: string[]; answer: number; explain: string }
export interface ShuffledCheck { options: string[]; /** index of the right option in `options` */ answer: number }

/** A seeded shuffle of the options with the answer tracked by value: `options[answer]` is always the lesson's right option. */
export function shuffleCheck(check: Pick<LessonCheckLike, 'options' | 'answer'>, seed: number): ShuffledCheck {
  const r = rng(seed); const order = check.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = r.int(0, i); [order[i], order[j]] = [order[j]!, order[i]!]; }
  return { options: order.map(i => check.options[i]!), answer: order.indexOf(check.answer) };
}
