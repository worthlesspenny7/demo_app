/** PT-18 final sprint (SCH-038..042): R1 fair checkpoint widget, R2 honest recaps, R3 restart verdict quotes the card, R4 pointers from the card, R5/R8 wrong-answer reasons and figures. DOM parts: e2e/school-final.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { COURSE } from '../content/course.js';
import type { MinisimPage } from '../content/course-types.js';
import { miniSim, tryItStars, tryItPassed, recapSum, cardPointer, registerCourse, POINTER_OF_CONTROL, type Decision } from '../src/core/decision/index.js';
import { WhereCheckpointModel } from '../src/ui/school2/widget-models.js';
import { figureSvg } from '../src/ui/school2/figures.js';

registerCourse(COURSE);
const read = (p: string): string => readFileSync(p, 'utf8');

describe('SCH-038 the checkpoint widget is fair', () => {
  it('SCH-038 the drawn sign is where the car is at the ghost\'s time: a tap as the nose reaches it scores 0; the page offers Try again, not a disabled Done', () => {
    const m = new WhereCheckpointModel(35, 0.2, 1);
    expect(m.carS(m.perfect)).toBeCloseTo(m.legFt, 6);   // the car is at the sign at the ghost's time
    expect(m.press(Math.round(m.perfect * 10) / 10).penalty).toBe(0);
    const w = read('src/ui/school2/widgets.ts');
    expect(w).toContain("btn.textContent = 'Try again'");
    expect(w).not.toMatch(/btn\.textContent = 'Done'/); expect(w).not.toMatch(/\(btn as HTMLButtonElement\)\.disabled = true/);
    expect(w).toMatch(/const r = road\(12\);/);   // the strip ends in the 12 px sign: the nose meets its near edge at the leg's end
  });
});

describe('SCH-039 an honest try-it recap', () => {
  const run = (correct: number, timed: boolean) => ({ correct, total: 5, secondsTotal: 12.3, verdicts: [{ kind: timed ? 'pause' : 'checkpoint' }] as { kind: never }[] });
  it('SCH-039 0/5, 3/5 and 5/5: pass, stars and the heading the recap prints; below 3 of 5 it says Not yet and never "done" or "You can now"', () => {
    expect([0, 3, 5].map(c => [tryItPassed({ correct: c, total: 5 }), tryItStars({ correct: c, total: 5, secondsTotal: 0 })])).toEqual([[false, 0], [true, 2], [true, 3]]);
    const t = read('src/ui/school2/tryit.ts');
    expect(t).toMatch(/passed \? `Module \$\{moduleNumber\(m, i\)\} done` : `Not yet: \$\{r \? r\.correct : 0\} of \$\{r \? r\.total : 5\} correct`/);
    expect(t).toMatch(/passed \? el\('p', \{ class: 's2-youcan'/);
    expect(t.indexOf('[next, again]')).toBeGreaterThan(0);   // Try again is first below 3 of 5 ... (the order is [again, next] when passed)
  });
  it('SCH-039 a run with no timed cards prints no "s off"; a timed run does; the phone recap and the try-it recap share the line', () => {
    expect(recapSum(run(3, false))).toBe('3 of 5 correct');
    expect(recapSum(run(0, false))).toBe('0 of 5 correct');
    expect(recapSum(run(5, true))).toBe('5 of 5 correct · 12.3 s off');
    expect(read('src/ui/mobile/recap.ts')).toContain('recapSum(r)'); expect(read('src/ui/school2/tryit.ts')).toContain('core.recapSum(r)');
  });
});

describe('SCH-040 restart verdicts quote the card\'s own sum', () => {
  it('SCH-040 over 10 seeds a restart verdict\'s rule is "<this card\'s time> minus <loss> s is <launch>", never the fixed 9:32:00 example', () => {
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const mk = () => { const r = miniSim('restart', seed, { control: 'launch', variant: 0 }); let s = r.next(); while (s && s.type === 'rule') { r.ack(); s = r.next(); } return { r, d: (s as { decision: Decision }).decision }; };
      const { r, d } = mk(); if (!d.timing) continue;
      const own = /your time \S+ (\d+:\d\d:\d\d)/.exec(d.prompt)?.[1]; if (!own) continue;
      for (const dt of [0, 4]) {
        const { r: r2 } = dt === 0 ? { r } : mk();
        const v = r2.answer({ tapSeconds: d.timing.truthSeconds + dt });
        const m = /(\d+:\d\d:\d\d) minus ([\d.]+) s is (\d+:\d\d:\d\d)/.exec(v.rule);
        expect(m, `seed ${seed}: ${v.rule}`).toBeTruthy();
        expect(m![1]).toBe(own);
        const sec = (x: string): number => x.split(':').reduce((a, b) => a * 60 + Number(b), 0);
        expect(Math.abs(sec(m![1]!) - Number(m![2]) - sec(m![3]!))).toBeLessThanOrEqual(0.5);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });
});

describe('SCH-041 pointers come from the card', () => {
  it('SCH-041 a hold-lead pointer quotes the card\'s own lead or says half a ramp; a START/LAP watch card points at START before LAP', () => {
    const base = 'Tap START on the Mark, then CALL about 2 s before the hold ends.';
    const card = (prompt: string, chart?: number) => ({ kind: 'timedStart' as const, prompt, timing: { kind: 'startStop' }, context: { chart: chart === undefined ? null : { seconds: chart } } });
    expect(cardPointer(base, card('Line 4: START on Mark!, then CALL 30 1.0 s before the 0:40 ends.', 1))).toBe('Tap START on the Mark, then CALL 1.0 s before the hold ends.');
    expect(cardPointer(base, card('Line 4: START on Mark!, then CALL 30 2.5 s before the 0:40 ends.', 2.5))).toContain('2.5 s before');
    expect(cardPointer(base, card('Line 4: START on Mark!, then CALL 30 half a ramp before the 0:40 ends.'))).toContain('half a ramp before the hold ends');
    const w = { kind: 'watch' as const, prompt: 'x', timing: { kind: 'startStop' } };
    expect(cardPointer(POINTER_OF_CONTROL.watchLap, w)).toMatch(/START[\s\S]*LAP/);
    expect(cardPointer(POINTER_OF_CONTROL.watchLap, { ...w, timing: { kind: 'tap' } })).toBe(POINTER_OF_CONTROL.watchLap);
  });
  it('SCH-041 the run screen and the mini-sim build their pointer through cardPointer', () => {
    expect(read('src/ui/mobile/guided.ts')).toContain('cardPointer(pointerFor(g.newest), d)'); expect(read('src/ui/school2/minisim.ts')).toContain('core.cardPointer(');
  });
});

describe('SCH-042 a wrong check answer explains; the figures fit', () => {
  it('SCH-042 every check page has a one-line why; the player shows it under the right option', () => {
    const checks = COURSE.flatMap(m => m.pages.flatMap(p => p.kind === 'check' ? [p] : []));
    expect(checks.length).toBe(12);
    for (const c of checks) { expect(c.why, c.question).toBeTruthy(); expect(c.why!.length).toBeLessThan(110); expect(c.why).not.toMatch(/^Not quite/); }
    const pl = read('src/ui/school2/player.ts');
    expect(pl).toContain("right.after(reason)"); expect(pl).not.toMatch(/Not quite: \$\{p\.options/);
  });
  it('SCH-042 the two-seats captions are one item per line and the Module 4 stop label is small enough for its box', () => {
    const seats = figureSvg('two-seats');
    for (const t of ['road', 'speed', 'book, clock,', 'watch']) expect(seats).toContain(`>${t}</text>`);
    expect(seats).not.toContain('book, clock, watch'); expect(seats).not.toContain('road, speed');
    expect(figureSvg('chart-cell')).toMatch(/>This app's car:<\/text><text[^>]*>\d+ → \d+</);
  });
});
