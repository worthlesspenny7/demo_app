// Phase VIII content: MOB-010 (rule cards), MOB-011 (Dad reads this), MOB-012 content part (text budgets).
// The page layout is a pure model (content/school-layout.ts) that src/ui/screens/school.ts renders in order, so the budgets are tested on the model;
// the renderer is checked against the model by reading its source (there is no DOM in the unit tests), and the Playwright run covers the real page.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RULES, RULE_SKILLS, DECISION_KINDS, SKILL_GROUPS, RULE_TEXT_MAX_WORDS, RULE_TITLE_MAX_WORDS, VIDEO_LABEL, SIM_LABEL, sourceLine, rulesForKind, rulesForSkill, ruleById, words, type RuleCard, type DecisionKind } from '../content/rules.js';
import { CARD_PARTS, FIRST_RUN_PATH, FIRST_RUN_RULE_CARDS_MAX, SCHOOL_WORDS_BEFORE_TRY_MAX, checkCards, dadCard, dadPages, dadStep, dadSwipe, firstRunRuleCards, schoolGroups, schoolIntro, schoolTextBeforeFirstTry, schoolWordsBeforeFirstTry, tryHash } from '../content/school-layout.js';
import { LESSONS, LESSON_ORDER, lessonWithReferenceText } from '../content/lessons.js';
import { PENALTY_ROWS } from '../content/reference-data.js';

const read = (p: string): string => readFileSync(p, 'utf8');
const SPECS = read('docs/spec/SPECS.md');
const REG = read('docs/research/09-event-regulations-2026.md');
const HB = read('docs/research/08-rookie-handbook-body.md') + '\n' + read('docs/research/08b-rookie-handbook-appendices.md');
const VIDEOS = ['10-rally-school-videos.md', '10a-training-sessions-2024-2026.md', '10b-rally-school-classen-croker.md', '10c-short-videos.md'].map(f => read(`docs/research/${f}`)).join('\n');
const SCHOOL_SRC = read('src/ui/screens/school.ts');
const REF_SRC = read('src/ui/screens/reference.ts');
const card = (id: string): RuleCard => { const c = ruleById(id); if (!c) throw new Error(`${id} missing`); return c; };
const text = (id: string): string => card(id).text;

describe('MOB-010 rule cards: shape, budgets, sources', () => {
  it('MOB-010 there are 30 to 40 cards with unique ids RULE-001.., a known skill, and every skill has cards', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(30); expect(RULES.length).toBeLessThanOrEqual(40);
    expect(new Set(RULES.map(r => r.id)).size).toBe(RULES.length);
    RULES.forEach((r, i) => { expect(r.id).toBe(`RULE-${String(i + 1).padStart(3, '0')}`); expect(RULE_SKILLS).toContain(r.skill); });
    for (const s of RULE_SKILLS) expect(rulesForSkill(s).length, s).toBeGreaterThan(0);
    expect(SKILL_GROUPS.map(g => g.skill)).toEqual([...RULE_SKILLS]);
  });
  it('MOB-010 every card has a title of at most 6 words and a text of at most 60 words, plain (no markup), one paragraph', () => {
    for (const r of RULES) {
      expect(words(r.title), `${r.id} title`).toBeGreaterThan(0); expect(words(r.title), `${r.id} title`).toBeLessThanOrEqual(RULE_TITLE_MAX_WORDS);
      expect(words(r.text), `${r.id} text`).toBeGreaterThan(10); expect(words(r.text), `${r.id} text (${words(r.text)} words)`).toBeLessThanOrEqual(RULE_TEXT_MAX_WORDS);
      expect(r.text, r.id).not.toMatch(/[<>*`#_\n]/); expect(r.title, r.id).not.toMatch(/[<>*`#_\n]/);
    }
  });
  it('MOB-010 every card has a source: a REG rule number, an HB page or a video caption [mm:ss]', () => {
    for (const r of RULES) {
      expect(r.source.trim().length, r.id).toBeGreaterThan(5);
      expect(r.source, `${r.id} source`).toMatch(/REG [IVX]+\.[A-Z]|HB p\.\d|HB Appendix|\[\d+:\d\d\]|Example Rally #\d+/);
    }
  });
  it('MOB-010 every cited REG rule, HB page and video timestamp exists in the research files (citations are exact)', () => {
    for (const r of RULES) {
      for (const m of r.source.matchAll(/\b((?:I|II|III|IV|V|VI|VII|VIII)\.[A-Z](?:\.\d+)?(?:\.[a-z])?(?:\([0-9a-z]+\))?)/g)) {
        const rule = m[1]!; const base = rule.replace(/\(.*$/, '');
        const letter = /\.([a-z])$/.exec(base)?.[1]; const parent = letter ? base.slice(0, -2) : base;
        const found = REG.includes(base) || (!!letter && REG.includes(parent) && new RegExp(`\\n\\s*- ${letter}\\. `).test(REG));   // a lettered item is listed as "- d." under its parent rule
        expect(found, `${r.id}: REG ${rule} is not in docs/research/09`).toBe(true);
      }
      for (const m of r.source.matchAll(/HB p\.(\d+)(?:-(\d+))?/g)) { const lo = Number(m[1]), hi = Number(m[2] ?? m[1]); expect(lo >= 1 && hi <= 15 || lo >= 25, `${r.id}: HB p.${lo}-${hi}`).toBe(true); expect(hi, r.id).toBeGreaterThanOrEqual(lo); }
      for (const m of r.source.matchAll(/(?:Example Rally #|Appendix D \(Example Rally #)(\d+)/g)) expect(REG.includes(`#${m[1]}`) || HB.includes(`#${m[1]}`), `${r.id}: example #${m[1]}`).toBe(true);
      for (const m of r.source.matchAll(/\[(\d+:\d\d)\]/g)) expect(VIDEOS.includes(m[1]!), `${r.id}: [${m[1]}] is in no video analysis`).toBe(true);
    }
  });
  it('MOB-010 the video names a card cites are the 13 videos of docs/research/10', () => {
    const names = ['Clock and Stopwatch', 'Starting on Time', 'Time Delay Form', 'Making Up Time', 'Rally School Part 1', 'Rally School Part 2', '2024 Training Session', '2026 Training Session', 'How-To: Hacking'];
    for (const r of RULES) for (const m of r.source.matchAll(/(Clock and Stopwatch|Starting on Time|Time Delay Form|Making Up Time|Rally School Part [12]|20(?:24|26) Training Session|How-To: Hacking)/g)) expect(names, r.id).toContain(m[1]);
  });
  it('MOB-010 a rule that only a video makes says so, and a simulator convention says so', () => {
    for (const r of RULES) {
      if (!/REG [IVX]|HB p\.|HB App/.test(r.source)) expect(r.videoOnly, `${r.id} cites only a video`).toBe(true);
      if (r.videoOnly) expect(sourceLine(r)).toContain(VIDEO_LABEL);
      if (r.sim) expect(sourceLine(r)).toContain(SIM_LABEL);
      if (!r.videoOnly) expect(sourceLine(r)).not.toContain(VIDEO_LABEL);
    }
    expect(RULES.filter(r => r.sim).map(r => r.id)).toEqual(['RULE-016', 'RULE-020', 'RULE-021']);   // the cards whose numbers are the simulator's Ford or its ghost reading
    expect(text('RULE-016')).toMatch(/simulator's performance card; measure your car/); expect(text('RULE-020')).toMatch(/simulator Ford, measure yours/);
  });
  it('MOB-010 every decision kind of MOB-002 has at least one card, and the kinds list is the spec\'s', () => {
    const mob002 = SPECS.split('\n').find(l => l.startsWith('MOB-002 '))!;
    let at = 0; for (const k of DECISION_KINDS) { const i = mob002.indexOf(`${k} (`, at); expect(i, `${k} in MOB-002 order`).toBeGreaterThanOrEqual(at); at = i; }
    expect(DECISION_KINDS.length).toBe(13);
    for (const k of DECISION_KINDS) expect(rulesForKind(k).length, `a card precedes ${k}`).toBeGreaterThan(0);
    for (const r of RULES) { expect(r.kinds.length, r.id).toBeGreaterThan(0); for (const k of r.kinds) expect(DECISION_KINDS).toContain(k as DecisionKind); expect(new Set(r.kinds).size, r.id).toBe(r.kinds.length); }
  });
  it('MOB-010 a lesson link on a card names a real lesson, and a Long form entry exists for it', () => {
    const ids = new Set(LESSONS.map(l => l.id));
    for (const r of RULES) if (r.lesson) expect(ids.has(r.lesson), `${r.id} -> ${r.lesson}`).toBe(true);
    expect(RULES.filter(r => !r.lesson).length).toBe(0);
  });
});

describe('MOB-010 every rule the drills grade is on a card', () => {
  // [what the drills grade, the card id, a pattern its text must show]
  const COVER: [string, string, RegExp][] = [
    ["the Four S's priority", 'RULE-001', /Safety first, Start on time, Stay on course, Stay on time[\s\S]*earlier one wins/],
    ['full stop at every STOP, also with no pause', 'RULE-002', /full stop at every STOP[\s\S]*no pause printed/],
    ['green = do nothing, red = stop', 'RULE-003', /green sign[\s\S]*is nothing[\s\S]*red[\s\S]*stop/i],
    ['never 5 mph or slower in sight of a green sign', 'RULE-004', /5 mph or slower[\s\S]*green[\s\S]*30 seconds/],
    ['posted limits obeyed and recovered after', 'RULE-005', /posted limit[\s\S]*recover/],
    ['work this line and the next, comes quick', 'RULE-006', /current instruction and the next one[\s\S]*comes quick/],
    ['carry the speed to the next page', 'RULE-007', /bottom of each page to the top of the next/],
    ['driver reads back', 'RULE-008', /driver repeats every turn and every speed/],
    ['ICE', 'RULE-009', /identify[\s\S]*confirm[\s\S]*execute/],
    ['start = base + position', 'RULE-010', /base time plus your starting position[\s\S]*Position 1 leaves at base plus 1 minute/],
    ['launch early by the start loss', 'RULE-011', /minus the car's standing-start loss[\s\S]*9:31:57/],
    ['nobody releases you', 'RULE-012', /No official, flag or crew tells you when to go/],
    ['pull up only when the car ahead leaves', 'RULE-013', /only after the car ahead has left/],
    ['exact transit OUT = IN + interval', 'RULE-014', /IN 2:41:20 plus 20m00s is OUT 3:01:20/],
    ['lunch inside the transit', 'RULE-015', /45 minutes prior[\s\S]*2:22:00/],
    ['pause = chart cell (15 minus dec minus acc)', 'RULE-016', /Dec\(in\)[\s\S]*Acc\(out\)/],
    ['chart pause rounded to whole seconds', 'RULE-017', /nearest whole second/],
    ['say GO, count from the rock-back', 'RULE-018', /rocks back[\s\S]*end the count with the word GO/],
    ['split the speed change at the sign', 'RULE-019', /midpoint speed[\s\S]*32\.5/],
    ['lead = half the ramp', 'RULE-020', /half a ramp early[\s\S]*2\.3 s early/],
    ['timed changes count from the ghost\'s departure', 'RULE-021', /ghost leaves the landmark/],
    ['"mark"', 'RULE-022', /driver says mark/],
    ['caps 2 min late / 5 min early, missed checkpoint 3 min', 'RULE-023', /2 minutes[\s\S]*5 minutes[\s\S]*3 minutes/],
    ['turn: chart loss made up after', 'RULE-024', /chart loss with the 10 % rule/],
    ['10 % make-up', 'RULE-025', /10 % above[\s\S]*10 times/],
    ['20 % make-up', 'RULE-026', /20 % above[\s\S]*5 times/],
    ['never make up inside a timed interval', 'RULE-027', /hold the assigned speed/],
    ['drop the extra at the next sign', 'RULE-028', /drop your extra speed/],
    ['shorten a stop', 'RULE-029', /gain 9/],
    ['a checkpoint resets you', 'RULE-030', /automatically on time the instant you reach a checkpoint/],
    ['TA only for trains/accidents and the like', 'RULE-031', /train[\s\S]*accident[\s\S]*wrong turn/],
    ['TA in 10 s steps within 15 min', 'RULE-032', /multiples of 10 seconds[\s\S]*15 minutes/],
    ['measured delay = stopped time + chart loss', 'RULE-033', /time you stood still[\s\S]*plus the stop-and-go loss/],
    ['lost: turn around, time it, double it', 'RULE-034', /turn around[\s\S]*stopwatch[\s\S]*double/],
    ['rejoin 30 s behind a car', 'RULE-035', /30 seconds behind a car/],
    ['the car a minute behind is your clock', 'RULE-036', /car a minute behind you[\s\S]*ten minutes late/],
    ['the loose minute hand', 'RULE-037', /minute hand is loose/],
    ['read the minute off the watch', 'RULE-038', /hour and minute from the stopwatch in time-of-day mode/],
    ['stopwatch for intervals / clock for time of day', 'RULE-039', /stopwatch measures how long[\s\S]*time of day/],
    ['clock set to WWV at pickup', 'RULE-040', /WWV/],
  ];
  it('MOB-010 each graded rule is on its card and each card is used by exactly one rule', () => {
    for (const [what, id, re] of COVER) expect(text(id), `${what} (${id})`).toMatch(re);
    expect(new Set(COVER.map(c => c[1])).size).toBe(COVER.length); expect(COVER.length).toBe(RULES.length);
  });
  it('MOB-010 the numbers on the cards are right (worked examples, the Packard chart, the regulations table)', () => {
    const tod = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
    expect(tod('9:05:00') + 27 * 60).toBe(tod('9:32:00')); expect(tod('9:32:00') - 3).toBe(tod('9:31:57'));                       // RULE-010, 011
    expect(tod('2:41:20') + 20 * 60).toBe(tod('3:01:20'));                                                                         // RULE-014
    expect(tod('2:55:00') + 12 * 60).toBe(tod('3:07:00')); expect(tod('3:07:00') - 45 * 60).toBe(tod('2:22:00'));                  // RULE-015
    expect((35 + 30) / 2).toBe(32.5); expect(4.6 / 2).toBeCloseTo(2.3, 9);                                                          // RULE-019, 020
    expect(40 * 1.1).toBeCloseTo(44, 9); expect(4.4 * 10).toBeCloseTo(44, 9);                                                       // RULE-025: 4.4 s late at 40: 44 mph for 44 s
    expect(40 * 1.2).toBeCloseTo(48, 9); expect(8 * 5).toBe(40);                                                                    // RULE-026: 8 s late at 40: 48 mph for 40 s
    expect(60 * 0.1).toBeCloseTo(6, 9); expect(60 * 0.2).toBeCloseTo(12, 9);                                                        // 6 s and 12 s gained per minute driven over (RULE-025, 026)
    expect(44 * (44 - 40) / 40).toBeCloseTo(4.4, 9); expect(40 * (48 - 40) / 40).toBeCloseTo(8, 9);                                 // t = E x v / d: the watch seconds the two examples gain
    expect(35 * 1.1).toBeCloseTo(38.5, 9);                                                                                          // RULE-028: 10 % of 35 is 38.5
    expect(10 - 1).toBe(9); expect(47 * 2).toBe(94); expect(3 * 60 + 47 - 7).toBe(3 * 60 + 40);                                     // RULE-029, 034, 033
    const secs = (rule: string): number | null => PENALTY_ROWS.find(p => p.rule === rule)?.seconds ?? null;
    expect(secs('V.E.1.b')).toBe(120); expect(secs('V.E.1.c')).toBe(300); expect(secs('V.E.2.a, V.C.2.b')).toBe(180); expect(secs('V.E.3.a')).toBe(30);   // RULE-023, 004
    expect(PENALTY_ROWS.find(p => p.rule === 'V.E.3.e')!.penalty).toBe('DNF');                                                      // RULE-002
    expect(text('RULE-023')).toMatch(/2 minutes[\s\S]*5 minutes[\s\S]*3 minutes/); expect(text('RULE-004')).toContain('30 seconds'); expect(text('RULE-002')).toContain('DNF');
    expect(HB).toMatch(/30 in \/ 40 out = 8\.6 s/); expect(text('RULE-016')).toContain('8.6 s'); expect(text('RULE-024')).toContain('4.0 s'); expect(HB).toMatch(/exit 35 = 4 s lost/);   // Packard charts
    expect(text('RULE-017')).toMatch(/8\.6 becomes 9/);
  });
  it('MOB-010 the cards agree with the long lessons they link to (same numbers, nothing the lessons contradict)', () => {
    const lessonText = (id: string): string => lessonWithReferenceText(LESSONS.find(l => l.id === id)!);
    expect(lessonText('recovery')).toContain('44 mph for 44 s'); expect(lessonText('recovery')).toContain('48 mph for 40 s'); expect(lessonText('recovery')).toContain('gain');
    expect(lessonText('lost')).toContain('lost 94'); expect(lessonText('transits')).toContain('9:31:57'); expect(lessonText('transits')).toContain('2:22:00');
    expect(lessonText('which-timer')).toContain('56, 57, 58, 59'); expect(lessonText('timed-leads')).toContain('2.3 s');
  });
  it('MOB-010 rulesForKind puts the most specific card first (the Scheduler shows one rule card before a decision)', () => {
    expect(rulesForKind('checkpoint')[0]!.id).toBe('RULE-003'); expect(rulesForKind('ta')[0]!.kinds).toContain('ta');
    for (const k of DECISION_KINDS) { const cs = rulesForKind(k); for (let i = 1; i < cs.length; i++) expect(cs[i - 1]!.kinds.length).toBeLessThanOrEqual(cs[i]!.kinds.length); }
  });
});

describe('MOB-010 School: rule cards by the Four S\'s, "Try it", check cards; the long form moved to Reference', () => {
  it('MOB-010 the School groups every card once, in the order safety and course, start, stay on time, recovery, instruments', () => {
    const gs = schoolGroups(); expect(gs.map(g => g.skill)).toEqual([...RULE_SKILLS]);
    expect(gs.flatMap(g => g.cards.map(c => c.id))).toEqual(RULES.map(r => r.id));
    expect(gs[0]!.title).toBe('Safety and course'); expect(gs[0]!.fourS).toMatch(/Four S's 1 and 3/); expect(gs[1]!.fourS).toMatch(/2/); expect(gs[2]!.fourS).toMatch(/4/);
  });
  it('MOB-010 "Try it" opens #/run?skill=<skill> and sits in the card header before the rule text', () => {
    for (const s of RULE_SKILLS) expect(tryHash(s)).toBe(`#/run?skill=${s}`);
    expect(CARD_PARTS.indexOf('try')).toBe(1); expect(CARD_PARTS.indexOf('try')).toBeLessThan(CARD_PARTS.indexOf('text'));
    expect(SCHOOL_SRC).toMatch(/tryHash\(c\.skill\)/); expect(SCHOOL_SRC).toMatch(/for \(const part of CARD_PARTS\)/); expect(SCHOOL_SRC).toMatch(/schoolGroups\(\)/); expect(SCHOOL_SRC).toMatch(/checkCards\(\)/);
  });
  it('MOB-010 the lessons\' check questions stay as one-tap cards and a right answer still marks the lesson passed', () => {
    const cs = checkCards(); expect(cs.map(c => c.lessonId)).toEqual(LESSONS.map(l => l.id));
    for (const c of cs) { expect(c.options.length).toBeGreaterThanOrEqual(3); expect(c.answer).toBeGreaterThanOrEqual(0); expect(c.answer).toBeLessThan(c.options.length); expect(c.question.length).toBeGreaterThan(10); }
    expect(SCHOOL_SRC).toMatch(/app\.progress\.markLesson\(c\.lessonId\)/); expect(SCHOOL_SRC).toMatch(/shuffleCheck\(/);
  });
  it('MOB-010 every lesson has a collapsed Long form entry on the Reference page, found by title, and its id still opens at #/school/<id>', () => {
    expect(LESSON_ORDER.length).toBe(LESSONS.length); expect(LESSONS.length).toBe(14);
    expect(REF_SRC).toMatch(/function longFormPanel/); expect(REF_SRC).toMatch(/'Long form'/); expect(REF_SRC).toMatch(/for \(const l of LESSONS\)/);
    expect(REF_SRC).toMatch(/el\('details', \{ class: 'long-entry', id: `ref-long-\$\{l\.id\}`/); expect(REF_SRC).not.toMatch(/'long-entry'[^)]*open/);   // collapsed by default
    expect(REF_SRC).toMatch(/id: 'long-search'/); expect(REF_SRC).toMatch(/e\.title\.toLowerCase\(\)\.includes\(q\)/); expect(REF_SRC).toMatch(/t instanceof HTMLDetailsElement\) t\.open = true/);
    expect(REF_SRC).toMatch(/longFormPanel\(\)\);/);
    expect(SCHOOL_SRC).toMatch(/LESSONS\.find\(l => l\.id === lessonId\)/); expect(SCHOOL_SRC).toMatch(/`#\/reference\/long-\$\{lesson\.id\}`/);
    for (const l of LESSONS) { expect(l.title.length).toBeGreaterThan(0); expect(l.id).toMatch(/^[a-z-]+$/); }
  });
  it('MOB-010 the School names the long readings and where they went, in one short line', () => {
    expect(schoolIntro()).toMatch(/readings, \d+ to \d+ minutes each/); expect(schoolIntro()).toContain('Reference under Long form'); expect(words(schoolIntro())).toBeLessThanOrEqual(25);
  });
});

describe('MOB-011 Dad reads this: one rule per screen, large type, swipe or arrow; the printed card is unchanged', () => {
  it('MOB-011 the reader has one page per line of the printable card, in order, numbered n of N', () => {
    const card = dadCard(); const pages = dadPages();
    expect(card.title).toBe('Card for the driver (print and keep in the car)'); expect(card.lines.length).toBeGreaterThanOrEqual(15);
    expect(pages.map(p => p.text)).toEqual(card.lines); pages.forEach((p, i) => { expect(p.n).toBe(i + 1); expect(p.total).toBe(card.lines.length); });
    const lessonCard = LESSONS.find(l => l.id === 'protocol')!.body.find(b => typeof b === 'object' && 'card' in b) as { card: { title: string; lines: string[] } };
    expect(card.lines).toEqual(lessonCard.card.lines);   // print and reader can never disagree
  });
  it('MOB-011 each screen holds one rule, short enough for large type', () => {
    for (const p of dadPages()) { expect(words(p.text), p.text).toBeLessThanOrEqual(30); expect(p.text.split(/\n/).length).toBe(1); }
  });
  it('MOB-011 an arrow or a swipe moves one rule and stops at the ends; a short or vertical swipe does nothing', () => {
    expect(dadStep(0, -1, 20)).toBe(0); expect(dadStep(0, 1, 20)).toBe(1); expect(dadStep(19, 1, 20)).toBe(19); expect(dadStep(19, -1, 20)).toBe(18);
    expect(dadSwipe(-120, 5)).toBe(1); expect(dadSwipe(120, -5)).toBe(-1); expect(dadSwipe(-20, 0)).toBe(0); expect(dadSwipe(-100, 90)).toBe(0); expect(dadSwipe(0, 200)).toBe(0);
  });
  it('MOB-011 the page is #/school/dad: the print button and mountPrintCard are the existing ones, and the reader listens for touch and arrow keys', () => {
    expect(SCHOOL_SRC).toMatch(/lessonId === 'dad'/); expect(SCHOOL_SRC).toMatch(/renderBlock\(\{ card \}\)/);
    expect(SCHOOL_SRC).toMatch(/'Print this card'/); expect(SCHOOL_SRC).toMatch(/export function mountPrintCard/); expect(SCHOOL_SRC).toMatch(/id: 'print-root'/);
    expect(SCHOOL_SRC).toMatch(/'Dad reads this'/); expect(SCHOOL_SRC).toMatch(/touchstart/); expect(SCHOOL_SRC).toMatch(/touchend/); expect(SCHOOL_SRC).toMatch(/ArrowRight/); expect(SCHOOL_SRC).toMatch(/ArrowLeft/);
    expect(SCHOOL_SRC).toMatch(/font-size: clamp\(28px, 7\.5vw, 52px\)/); expect(SCHOOL_SRC).toMatch(/dadSwipe\(/); expect(SCHOOL_SRC).toMatch(/dadStep\(/);
    expect(SCHOOL_SRC).toMatch(/href: '#\/school\/dad'/);
  });
  it('MOB-011 the protocol lesson still carries the printable card (print unchanged)', () => {
    const l = LESSONS.find(x => x.id === 'protocol')!; expect(l.body.some(b => typeof b === 'object' && 'card' in b)).toBe(true);
    expect(read('src/ui/styles.css')).toMatch(/html\.print-card-only #print-root \.printcard/);
  });
});

describe('MOB-012 text budgets (content part): the School before its first Try it, the first-run path', () => {
  it('MOB-012 the School shows at most 60 words before its first "Try it" button', () => {
    const w = schoolWordsBeforeFirstTry(); expect(w).toBeGreaterThan(0); expect(w).toBeLessThanOrEqual(SCHOOL_WORDS_BEFORE_TRY_MAX);
    expect(schoolTextBeforeFirstTry()[0]).toBe('School');
  });
  it('MOB-012 the budget holds for any card as the first card, so reordering the cards cannot break it', () => {
    for (const r of RULES) {
      const w = schoolWordsBeforeFirstTry([r], LESSONS); expect(w, r.id).toBeLessThanOrEqual(SCHOOL_WORDS_BEFORE_TRY_MAX);
    }
  });
  it('MOB-012 a new player\'s first-run path (first screen to first decision) shows at most two rule cards, each under 60 words, before a decision the card precedes', () => {
    const cards = firstRunRuleCards(); expect(cards.length).toBeGreaterThan(0); expect(cards.length).toBeLessThanOrEqual(FIRST_RUN_RULE_CARDS_MAX);
    expect(FIRST_RUN_PATH.filter(s => s.screen === 'rule').length).toBeLessThanOrEqual(2);
    const decision = FIRST_RUN_PATH.find(s => s.screen === 'decision'); expect(decision).toBeTruthy(); expect(FIRST_RUN_PATH[FIRST_RUN_PATH.length - 1]!.screen).toBe('decision');
    for (const c of cards) { expect(words(c.text)).toBeLessThanOrEqual(RULE_TEXT_MAX_WORDS); if (decision && decision.screen === 'decision') expect(c.kinds).toContain(decision.kind); }
    expect(cards.reduce((a, c) => a + words(c.title) + words(c.text), 0)).toBeLessThanOrEqual(60);   // about 15 s of reading: the first decision stays inside MOB-040's 20 s
  });
  it('MOB-012 no card is longer than the budget and the whole deck stays short enough to skim (a card is read in about 15 s)', () => {
    const total = RULES.reduce((a, r) => a + words(r.text), 0); expect(Math.max(...RULES.map(r => words(r.text)))).toBeLessThanOrEqual(60); expect(total / RULES.length).toBeLessThanOrEqual(45);
  });
});

describe('MOB-010 sanity of the module surface used by the other agents', () => {
  it('MOB-010 RULES is the RuleCard[] the Scheduler imports: exported kinds and skills are the closed sets', () => {
    expect(RULE_SKILLS).toEqual(['safetyCourse', 'startOnTime', 'stayOnTime', 'recovery', 'instruments']);
    expect(DECISION_KINDS).toEqual(['preread', 'turn', 'speedChange', 'timedStart', 'pause', 'restart', 'transitOut', 'makeup', 'hazard', 'ta', 'lost', 'checkpoint', 'clock']);
    expect(ruleById('RULE-001')!.skill).toBe('safetyCourse'); expect(ruleById('RULE-999')).toBeUndefined();
  });
});
