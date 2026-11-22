/** Josh's scope addition after PT-16 (SCH-021..027): words, Start before timers, check options, Module 0's parties and photos, Module 1's
 *  sign traps, inputs on the card, "the driver". DOM parts: e2e/school-josh.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE, pageText, pageWords } from '../content/course.js';
import type { MinisimPage } from '../content/course-types.js';
import { words } from '../content/rules.js';
import { miniSim, SIGN_FORMS, type Decision } from '../src/core/decision/index.js';
import { DRIVER_EXPERT, DRIVER_ROOKIE, DRIVER_SPORTSMAN } from '../src/core/course.js';
import { INTRO_PHOTOS, PHOTO_CREDIT, figureSvg } from '../src/ui/school2/figures.js';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(f) ? [p] : []; });
const SOURCES = [...walk('content'), ...walk('src/ui')].map(p => ({ p, s: readFileSync(p, 'utf8') }));
const read = (p: string): string => readFileSync(p, 'utf8');
function card(kind: MinisimPage['decisionKind'], seed: number, o: { form?: MinisimPage['form']; variant?: number } = {}): { d: Decision; run: ReturnType<typeof miniSim> } {
  const run = miniSim(kind, seed, o); let s = run.next(); while (s && s.type === 'rule') { run.ack(); s = run.next(); }
  if (!s || s.type !== 'decision') throw new Error(`${kind} ${seed} no card`); return { d: s.decision, run };
}
const sims = COURSE.flatMap((m, mi) => m.pages.flatMap((p, pi) => p.kind === 'minisim' ? [{ m, mi, pi, p: p as MinisimPage, at: `${m.id} page ${pi + 1}` }] : []));

describe('SCH-021 "right" is a direction', () => {
  it('SCH-021 no affirmative "Right" in content/ or src/ui (verdict heads, checks, widgets, quizzes say Correct); directions stay', () => {
    const bad: string[] = [];
    for (const { p, s } of SOURCES) s.split('\n').forEach((l, i) => { if (/\bRight[.:!]|You'?re right|\bright!|head: [^\n]*\? 'Right'|'Right\.'/.test(l)) bad.push(`${p}:${i + 1}`); });
    expect(bad).toEqual([]);
    expect(read('src/ui/mobile/cards.ts')).toMatch(/head: v\.correct \? 'Correct'/);
    expect(read('src/ui/school2/player.ts')).toMatch(/'Correct\.'/);
    expect(read('content/course.ts')).toMatch(/turn left/);   // directions remain
  });
});

describe('SCH-022 nothing timed before Start', () => {
  it('SCH-022 the tap-watch can be gated: frozen face, taps ignored and no time passes until Start; the run screen and the mini-sim gate every timed card', () => {
    const tw = read('src/ui/mobile/tapwatch.ts');
    expect(tw).toMatch(/const elapsed = \(\): number => started \?/); expect(tw).toMatch(/'data-action': 'start-card'/); expect(tw).toMatch(/if \(!started\) return;/);
    expect(read('src/ui/mobile/run.ts').match(/gate: true, onStart/g)?.length).toBe(2);
    expect(read('src/ui/school2/minisim.ts').match(/gate: true, onStart/g)?.length).toBe(2);
    expect(read('src/ui/mobile/run.ts')).toMatch(/if \(view\.started === false\) return 0;/);
  });
});

describe('SCH-023 check options', () => {
  const UNITS = new Set(['points', 'point', 'seconds', 'second', 'mph', 'minutes']);
  it('SCH-023 every check: distinct options (first three words differ), no shared key word with the question in every option, wrong options are real alternatives', () => {
    for (const m of COURSE) m.pages.forEach((p, i) => {
      if (p.kind !== 'check') return; const at = `${m.id} page ${i + 1}`;
      const heads = p.options.map(o => o.toLowerCase().split(/\s+/).slice(0, 3).join(' '));
      expect(new Set(heads).size, at).toBe(p.options.length);
      const q = new Set(p.question.toLowerCase().match(/[a-z']{4,}/g) ?? []);
      const common = (p.options[0]!.toLowerCase().match(/[a-z']{4,}/g) ?? []).filter(w => !UNITS.has(w) && p.options.every(o => o.toLowerCase().includes(w)) && q.has(w));
      expect(common, at).toEqual([]);
      p.options.forEach((o, k) => { if (k !== p.answer) { expect(o.trim().length, at).toBeGreaterThan(1); expect(o, at).not.toBe(p.options[p.answer]); } });
    });
    const m0 = COURSE[0]!.pages.filter(p => p.kind === 'check');
    expect(m0.length).toBe(1); expect(pageText(m0[0]!)).toMatch(/ghost/); expect(pageText(m0[0]!)).not.toMatch(/hold speed/i);
  });
});

describe('SCH-024 Module 0: three parties and the Great Race photos', () => {
  it('SCH-024 the organizers speak only through the Course Instructions, the navigator (co-driver) reads them to the driver, the driver drives and reads back', () => {
    const t = COURSE[0]!.pages.map(pageText).join(' ');
    expect(t).toMatch(/organizers[^.]*only through the Course Instructions/); expect(t).toMatch(/navigator, also called the co-driver/); expect(t).toMatch(/driver drives[^.]*says each call back/);
    expect(COURSE.flatMap(m => m.pages.map(pageText)).join(' ').match(/co-driver/g)?.length).toBe(1);
  });
  it('SCH-024 the vibe page: a credited strip of stills copied from docs/research/frames into public/intro, under 70 words with captions; the intro video link appears only with a URL', () => {
    const gr = COURSE[0]!.pages.find(p => p.kind === 'concept' && p.title === 'The Great Race')!;
    expect(gr.kind === 'concept' && gr.figure).toBe('photos');
    expect(INTRO_PHOTOS.length).toBeGreaterThanOrEqual(3); expect(INTRO_PHOTOS.length).toBeLessThanOrEqual(4);
    const frames = readdirSync('docs/research/frames');
    for (const ph of INTRO_PHOTOS) { expect(existsSync(join('public', ph.src)), ph.src).toBe(true); expect(frames.some(f => f.startsWith(ph.frame)), ph.frame).toBe(true); }
    expect(PHOTO_CREDIT).toMatch(/Stills? from Great Race rally school videos?/i);
    const html = figureSvg('photos'); expect(html).toContain(PHOTO_CREDIT); expect(html).not.toMatch(/intro-video/);   // no intro URL yet
    expect(pageWords(gr) + words(INTRO_PHOTOS.map(p => p.caption).join(' ')) + words(PHOTO_CREDIT)).toBeLessThan(70);
  });
});

describe('SCH-025 Module 1 sign traps', () => {
  it('SCH-025 Module 1 plays the normal sign case, then limit / blank / partial / twin / overhead / bracket, each why naming the trap; the book is always the answer and the trap an option', () => {
    const m1 = COURSE[1]!; const cases = m1.pages.flatMap(p => p.kind === 'minisim' ? [p, ...(p.rounds ?? [])].filter(x => x.form?.startsWith('sign:')).map(x => ({ form: x.form!, why: x.why, seed: x.seed })) : []);
    expect(cases.map(c => c.form)).toEqual([...SIGN_FORMS]);
    for (const c of cases) {
      if (c.form !== 'sign:normal') expect(c.why, c.form).toMatch(/^Trap: /);
      expect(words(c.why)).toBeLessThanOrEqual(25);
      const { d, run } = card('preread', c.seed, { form: c.form });
      expect(d.options!.length, c.form).toBeGreaterThanOrEqual(3);
      const o = run.oracle()!; const v = run.answer(o); expect(v.correct, c.form).toBe(true);
      const col = d.context.row?.columnC.join(' ') ?? '';
      if (c.form === 'sign:blank') expect(col.trim()).toBe(''); else expect(col, c.form).toContain(o.optionId!.slice(1));
    }
    const lim = card('preread', 111, { form: 'sign:limit' }).d; const posted = /SPEED LIMIT (\d+)/.exec(lim.prompt)![1]!;
    expect(lim.options!.map(x => x.id)).toContain(`v${posted}`); expect(lim.context.row!.columnC.join(' ')).not.toContain(posted);
  });
});

describe('SCH-026 inputs on the card or taught before', () => {
  it('SCH-026 every mini-sim gives the number it grades on the card (sit, lead, time) or the course taught it on an earlier page; Module 4 works the arithmetic before its first pause mini-sim', () => {
    const taught = (mi: number, pi: number, re: RegExp): boolean => COURSE.slice(0, mi + 1).some((m, k) => m.pages.slice(0, k === mi ? pi : undefined).some(p => re.test(pageText(p))));
    for (const { p, mi, pi, at } of sims) {
      const { d } = card(p.decisionKind, p.seed, { ...(p.form ? { form: p.form } : {}), ...(p.variant !== undefined ? { variant: p.variant } : {}) });
      if (d.kind === 'pause') expect(d.prompt, at).toMatch(/sit [\d.]+ s/);
      if (d.kind === 'speedChange' || d.kind === 'timedStart') { expect(d.prompt, at).toMatch(/[\d.]+ s before|half a ramp/); if (/half a ramp/.test(d.prompt)) expect(taught(mi, pi, /ramp/), at).toBe(true); }
      if (d.kind === 'watch' && d.options?.length) { expect(d.prompt, at).toMatch(/lead [\d.]+ s/); expect(taught(mi, pi, /\blead\b/), at).toBe(true); }
      if (d.kind === 'restart' && /base|position/i.test(d.prompt)) expect(taught(mi, pi, /position in minutes|starting position/), at).toBe(true);
      if (d.kind === 'restart') expect(taught(mi, pi, /start loss/), at).toBe(true);
    }
    const m4 = COURSE[4]!.pages; const ex = m4.findIndex(p => p.kind === 'example'); const first = m4.findIndex(p => p.kind === 'minisim');
    expect(ex).toBeGreaterThanOrEqual(0); expect(ex).toBeLessThan(first); expect(pageText(m4[ex]!)).toMatch(/15 minus [\d.]+/);
    const go = COURSE[2]!.pages.find(p => p.kind === 'minisim' && p.decisionKind === 'pause') as MinisimPage;
    expect(card('pause', go.seed).d.prompt).toMatch(/sit [\d.]+ s on the watch, then tap GO/);
  });
});

describe('SCH-027 the driver', () => {
  it('SCH-027 no "Dad" in content/ or src/ui (UI strings, cards, pointers, lessons, rule cards, the Driver\'s card, settings); the driver models are named Driver', () => {
    const bad: string[] = [];
    for (const { p, s } of SOURCES) s.split('\n').forEach((l, i) => { if (/\bdad\b/i.test(l)) bad.push(`${p}:${i + 1}`); });
    expect(bad).toEqual([]);
    for (const d of [DRIVER_EXPERT, DRIVER_ROOKIE, DRIVER_SPORTSMAN]) expect(d.name).toBe('Driver');
    expect(read('content/school-layout.ts')).toMatch(/DRIVER_CARD_TITLE = "Driver's card"/);
    expect(read('src/core/decision/runner.ts')).not.toMatch(/\bDad\b/);
  });
});
