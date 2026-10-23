/** Final sprint PT-15 (docs/playtest/PT-15-phone-replay-2.md BUG-P1, P2, P3, P5): MOB-072..076 (engine and card parts; the run screen is e2e/mobile-pt15.spec.ts). */
import { describe, it, expect } from 'vitest';
import { decisionCardHtml, driverLine } from '../src/ui/mobile/cards.js';
import { SKILL_TITLE, introCardFor, Scheduler, DecisionRun, microScenario, microRunner, type Decision } from '../src/core/decision/index.js';
import { microSubcase } from '../src/core/decision/scenarios.js';
import { RULES } from '../content/rules.js';

const visible = (html: string): string => html.replace(/<p[^>]*\bhidden\b[^>]*>[\s\S]*?<\/p>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<details[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>[\s\S]*?<\/details>/g, ' $1 ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
const tokens = (t: string): number => t.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;

describe('MOB-072 P1: the rule card shown before an exact-transit OUT launch states the graded rule', () => {
  it('MOB-072 RULE-014 says to launch at the OUT time minus the start loss, as at every restart; it is the card shown before that sub-case', () => {
    const text = RULES.find(r => r.id === 'RULE-014')!.text;
    expect(text).toMatch(/IN 2:41:20 plus 20m00s is OUT 3:01:20/); expect(text).toMatch(/say GO at the OUT time minus your start loss, as at every restart/); expect(text).not.toMatch(/exactly on the OUT second/);
    expect(microSubcase('restart', 1)).toBe('transitOut'); expect(introCardFor('startOnTime', 'restart', 'transitOut').id).toBe('RULE-014');
  });
  it('MOB-072 a player who follows the card (OUT minus the loss) is right on 40 of 40 transit-OUT launches; launching on the OUT second is the miss the card now warns against', () => {
    let right = 0;
    for (let s = 1; s <= 40; s++) {
      const mk = (): { d: Decision; answer: ReturnType<typeof microRunner>['answer'] } => { const r = microRunner(microScenario('restart', s, 1), 2); const d = r.next()!; return { d, answer: r.answer.bind(r) as never }; };
      const a = mk(); expect(a.d.prompt).toMatch(/^Transit OUT/);
      const out = /your time [A-Z]{3} (\d+):(\d\d):(\d\d)/.exec(a.d.prompt)!; const loss = Number(/loss ([\d.]+) s/.exec(a.d.prompt)![1]);
      const todOut = Number(out[1]) * 3600 + Number(out[2]) * 60 + Number(out[3]);
      const t = a.d.timing!; const tod0 = todOut - (t.truthSeconds + loss);           // the card's own moment, from "your time" and the launch second
      const v = a.answer(a.d, { tapSeconds: todOut - loss - tod0 + 0.3 });            // follow the card: GO at OUT minus the loss
      expect(v.correct, `${a.d.prompt} -> ${v.chosen}`).toBe(true); right++;
      const b = mk(); const w = b.answer(b.d, { tapSeconds: todOut - tod0 });          // the old wording: exactly on the OUT second
      expect(w.correct).toBe(loss < 1.5 ? true : false);
    }
    expect(right).toBe(40);
  });
});

describe('MOB-073 P2: START on a compressed hold is graded in wall seconds', () => {
  it('MOB-073 a START 2.5 s late reads "START 2.5 s late" (not the jump), and the CALL stays reachable before the card closes', () => {
    let n = 0;
    for (let s = 1; s <= 12; s++) {
      const run = new DecisionRun(Scheduler.boss(s * 1237, null, 2).plan());
      for (let i = 0; i < 200; i++) {
        const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
        const t = st.decision.timing;
        if (t?.skip && t.kind === 'startStop') {
          n++; expect(t.maxSeconds).toBeGreaterThan(t.secondTapSeconds! + t.toleranceSeconds);
          const v = run.answer({ taps: [t.truthSeconds + 2.5, t.secondTapSeconds!] });
          expect(v.correct).toBe(false); expect(v.missed).toBe('START 2.5 s late'); expect(v.secondsDelta).toBeCloseTo(2.5, 1);
        } else run.answer(run.oracle());
      }
    }
    expect(n).toBeGreaterThan(0);
  }, 120_000);
});

describe('MOB-074 P3: the driver\'s line on a checkpoint card matches the variant', () => {
  it('MOB-074 red STOP board, green sign, car pulling off', () => {
    const line = (variant: number): string => { const d = microRunner(microScenario('checkpoint', 3, variant), 2).next()!; return driverLine(d); };
    const lines = new Map<string, string>();
    for (let v = 0; v < 6; v++) { const d = microRunner(microScenario('checkpoint', 3, v), 2).next()!; lines.set(/red GREAT RACE STOP/.test(d.prompt) ? 'red' : /pulls off/.test(d.prompt) ? 'car' : 'green', line(v)); }
    expect(lines.get('red')).toBe('Dad: "Red board ahead, we stop."');
    expect(lines.get('green')).toBe('Dad: "Green sign up ahead."');
    expect(lines.get('car')).toBe('Dad: "Car ahead pulling off, we keep going."');
  });
});

describe('MOB-076 P5: Boss long-hold cards stay under 40 words', () => {
  it('MOB-076 every compressed Boss card (rung 1 and 2) is under 40 words with the strip and the watch face; the long note sits behind details', () => {
    let n = 0, worst = 0;
    for (const rung of [1, 2] as const) for (let s = 1; s <= 14; s++) {
      const run = new DecisionRun(Scheduler.boss(s * 1237, null, rung).plan());
      for (let i = 0; i < 200; i++) {
        const st = run.next(); if (!st) break; if (st.type === 'rule') { run.ack(); continue; }
        const d = st.decision; const t = d.timing;
        if (t?.skip) {
          n++; const html = decisionCardHtml(d, rung);
          const face = tokens(`TOD 9:43:12 0:00.00 ${t.tapLabel}${t.secondTapLabel ? ` ${t.secondTapLabel}` : ''}`);
          const w = tokens(`${SKILL_TITLE[d.skill]} ★12 12/15`) + tokens(visible(html)) + (d.options ?? []).reduce((a, o) => a + tokens(o.label), 0) + face;
          worst = Math.max(worst, w); expect(w, `${rung}: ${d.kind} ${d.prompt} | ${visible(html).replace(/\s+/g, ' ')}`).toBeLessThan(40);
          expect(d.prompt).not.toMatch(/skips ahead/); expect(html).toMatch(/data-testid="skip-detail"[^>]*>Long hold: .*the watch jumps ahead to 5 s before the/);
        }
        run.answer(run.oracle());
      }
    }
    expect(n).toBeGreaterThan(3); expect(worst).toBeGreaterThan(20);
  }, 120_000);
});
