// Phase IX content: SCH-001 (course model and budgets), SCH-002 (excerpts, videos), SCH-003 (Module 0 + 1), SCH-004 data part
// (controls ladder, unlocks), SCH-010 (first-visit line). The course is pure data (content/course.ts), so the budgets are tested here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  COURSE, FIRST_VISIT, FIGURES, CORE_MODULES, CONCEPT_MAX_WORDS, EXAMPLE_MAX_WORDS, WHY_MAX_WORDS, TEACHES_MAX_WORDS, REFS_MAX, PAGES_MIN, PAGES_MAX,
  FIRST_TWO_MAX_WORDS, FIRST_TWO_MIN_INTERACTIONS, FIRST_VISIT_MAX_WORDS, pageText, moduleWords, isInteraction, controlModule, controlsThrough, allRefs, moduleForLesson,
} from '../content/course.js';
import { CONTROL_IDS } from '../content/course-types.js';
import { EXCERPTS } from '../content/excerpts.js';
import { VIDEOS, VIDEO_KEYS, videoLink, mmssToSeconds } from '../content/videos.js';
import { DECISION_KINDS, RULE_SKILLS, words } from '../content/rules.js';
import { LESSONS } from '../content/lessons.js';

const read = (p: string): string => readFileSync(p, 'utf8');
const SCHOOL = read('docs/spec/SCHOOL.md');
const README = read('docs/research/transcripts/README.md');
const URL_ROWS: [string, string][] = read('docs/research/transcripts/urls.txt').split('\n').filter(l => /^\s*[\w-]+\s*=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
const URLS = new Map(URL_ROWS);
const pages = COURSE.flatMap((m, mi) => m.pages.map((p, pi) => ({ m, mi, p, pi, at: `${m.id} page ${pi + 1}` })));

describe('SCH-001 course model', () => {
  it('SCH-001 13 modules in the SCHOOL.md order, ids m0..m12, each with a title, teaches <= 20 words, 4-8 pages, a 5-card try-it and a one-line youCanNow', () => {
    expect(COURSE.length).toBe(13);
    const tableTitles = [...SCHOOL.matchAll(/^\| (\d+) \| ([^|]+) \|/gm)].map(r => r[2]!.trim());
    expect(COURSE.map(m => m.title)).toEqual(tableTitles);
    COURSE.forEach((m, i) => {
      expect(m.id).toBe(`m${i}`);
      expect(words(m.teaches), m.id).toBeLessThanOrEqual(TEACHES_MAX_WORDS);
      expect(m.pages.length, m.id).toBeGreaterThanOrEqual(PAGES_MIN); expect(m.pages.length, m.id).toBeLessThanOrEqual(PAGES_MAX);
      expect(m.tryIt.cards).toBe(5);
      expect(m.tryIt.kinds.length, m.id).toBeGreaterThan(0); for (const k of m.tryIt.kinds) expect(DECISION_KINDS).toContain(k);
      expect(m.tryIt.skills.length, m.id).toBeGreaterThan(0); for (const s of m.tryIt.skills) expect(RULE_SKILLS).toContain(s);
      expect(m.youCanNow, m.id).toMatch(/^You can now /); expect(m.youCanNow).not.toMatch(/\n/); expect(words(m.youCanNow)).toBeLessThanOrEqual(16);
    });
  });
  it('SCH-001 page budgets: concept <= 70 words, example <= 50 words in all, why <= 25 words, at most 2 refs per page', () => {
    for (const { p, at } of pages) {
      expect(p.refs.length, at).toBeLessThanOrEqual(REFS_MAX);
      if (p.kind === 'concept') { expect(words(p.words), at).toBeLessThanOrEqual(CONCEPT_MAX_WORDS); expect(words(p.title), at).toBeLessThanOrEqual(7); if (p.figure) expect(FIGURES[p.figure], `${at} figure ${p.figure}`).toBeDefined(); }
      if (p.kind === 'example') expect(words(p.lines.join(' ')), at).toBeLessThanOrEqual(EXAMPLE_MAX_WORDS);
      if (p.kind === 'minisim') { expect(DECISION_KINDS, at).toContain(p.decisionKind); expect(words(p.why), at).toBeLessThanOrEqual(WHY_MAX_WORDS); expect(Number.isInteger(p.seed), at).toBe(true); expect(CONTROL_IDS, at).toContain(p.control); }
    }
  });
  it('SCH-001 check pages: one question, 3-4 parallel options (word counts within 2, the answer is not the unique longest), answers spread over positions', () => {
    const answers: number[] = [];
    for (const { p, at } of pages) {
      if (p.kind !== 'check') continue;
      expect((p.question.match(/\?/g) ?? []).length, at).toBe(1);
      expect(p.options.length, at).toBeGreaterThanOrEqual(3); expect(p.options.length, at).toBeLessThanOrEqual(4);
      expect(new Set(p.options).size, at).toBe(p.options.length);
      expect(p.answer, at).toBeGreaterThanOrEqual(0); expect(p.answer, at).toBeLessThan(p.options.length);
      const w = p.options.map(words); expect(Math.max(...w) - Math.min(...w), at).toBeLessThanOrEqual(2);
      const longest = Math.max(...w); expect(w[p.answer] === longest && w.filter(x => x === longest).length === 1, `${at} answer is the unique longest`).toBe(false);
      answers.push(p.answer);
    }
    expect(new Set(answers).size).toBeGreaterThanOrEqual(3);
    for (const i of new Set(answers)) expect(answers.filter(a => a === i).length / answers.length).toBeLessThanOrEqual(0.5);
  });
  it('SCH-001 every concept page is followed within 2 pages by a mini-sim or a widget', () => {
    for (const m of COURSE) m.pages.forEach((p, i) => {
      if (p.kind !== 'concept') return;
      const next = m.pages.slice(i + 1, i + 3);
      expect(next.some(n => n.kind === 'minisim' || n.kind === 'widget'), `${m.id} page ${i + 1} "${p.title}"`).toBe(true);
    });
  });
  it('SCH-001 no reference text inside page words (no REG rule, HB page, [mm:ss] caption stamp, video title or URL)', () => {
    for (const { p, at } of pages) {
      const t = pageText(p);
      expect(t, at).not.toMatch(/\bREG\b|\bHB p|\bHB App|\[\d+:\d\d\]|Appendix|https?:|Training Session|Rally School|docs\/research/);
      expect(t, at).not.toMatch(/[<>*`#_\n]/);
    }
  });
  it('SCH-001 every page kind is used and every widget of the model appears', () => {
    expect(new Set(pages.map(x => x.p.kind))).toEqual(new Set(['concept', 'example', 'minisim', 'widget', 'check']));
    const widgets = new Set(pages.flatMap(x => x.p.kind === 'widget' ? [x.p.widget] : []));
    expect(widgets).toEqual(new Set(['holdSpeed', 'tapLap', 'whereCheckpoint', 'readScorecard']));
  });
  it('SCH-001 every old lesson redirects to exactly one module', () => {
    for (const l of LESSONS) { expect(moduleForLesson(l.id), l.id).toBeDefined(); expect(COURSE.filter(m => m.covers?.includes(l.id)).length, l.id).toBe(1); }
  });
});

describe('SCH-002 excerpts and videos', () => {
  it('SCH-002 every Ref in the course resolves to an excerpt of the same type, and the chip label names the source', () => {
    const refs = allRefs(); expect(refs.length).toBeGreaterThan(30);
    for (const r of refs) {
      const e = EXCERPTS[r.key]; expect(e, r.key).toBeDefined();
      expect(r.key.startsWith(`${r.type}:`), r.key).toBe(true);
      expect(r.label, r.key).toMatch(r.type === 'hb' ? /^HB (p\.\d+|App\. [A-F])$/ : r.type === 'reg' ? /^REG [IVX]+\.[A-Z](\.\d+)?$/ : /^Video .+ \d+:\d\d$/);
    }
  });
  it('SCH-002 excerpt shape: key matches its record, title, text <= 120 words, citation; video excerpts carry the video key and seconds', () => {
    const list = Object.entries(EXCERPTS); expect(list.length).toBeGreaterThanOrEqual(40);
    for (const [k, e] of list) {
      expect(e.key).toBe(k);
      expect(k).toMatch(/^(hb:(p\d+|app[A-F])|reg:[IVX]+\.[A-Z](\.\d+)?|video:[\w-]+:\d+:\d\d)$/);
      expect(e.title.length, k).toBeGreaterThan(3);
      expect(words(e.text), k).toBeGreaterThan(10); expect(words(e.text), k).toBeLessThanOrEqual(120);
      expect(e.citation.length, k).toBeGreaterThan(10);
      if (k.startsWith('video:')) {
        const [, vk, mm, ss] = k.split(':');
        expect(VIDEO_KEYS as readonly string[]).toContain(vk); expect(e.video?.key).toBe(vk); expect(e.video?.seconds).toBe(mmssToSeconds(`${mm}:${ss}`));
        expect(e.citation, k).toContain(VIDEOS.find(v => v.key === vk)!.title);
      } else expect(e.video, k).toBeUndefined();
      expect((e.text.match(/"/g) ?? []).length % 2, `${k} balanced quotes`).toBe(0);
    }
  });
  it('SCH-002 excerpts are faithful: HB and REG keys name a page or rule present in the extractions, and quoted words appear in the research files', () => {
    const HB = read('docs/research/08-rookie-handbook-body.md') + read('docs/research/08b-rookie-handbook-appendices.md');
    const REG = read('docs/research/09-event-regulations-2026.md');
    const VID = ['10-rally-school-videos.md', '10a-training-sessions-2024-2026.md', '10b-rally-school-classen-croker.md', '10c-short-videos.md'].map(f => read(`docs/research/${f}`)).join('\n');
    const norm = (s: string): string => s.replace(/\s+/g, ' ').replace(/[’']/g, "'").toLowerCase();
    const ALL = norm(HB + REG + VID);
    for (const [k, e] of Object.entries(EXCERPTS)) {
      if (k.startsWith('reg:')) expect(REG, k).toContain(k.slice(4));
      if (k.startsWith('hb:p')) expect(HB, k).toMatch(new RegExp(`p\\.${k.slice(4)}\\b|p\\.\\d+-${k.slice(4)}\\b`));
      if (k.startsWith('video:')) { const at = k.split(':').slice(2).join(':'); expect(VID, k).toContain(at); }
      // every quoted stretch of 4+ words is in the extractions (split at "..." elisions)
      for (const q of e.text.match(/"([^"]+)"/g) ?? []) for (const part of q.slice(1, -1).split(/\s*\.\.\.\s*/)) {
        if (words(part) < 4) continue;
        expect(ALL.includes(norm(part)), `${k}: "${part}" not found in docs/research`).toBe(true);
      }
    }
  });
  it('SCH-002 VIDEOS: the 13 keys of urls.txt with the README titles; url copied from urls.txt (blank = undefined); videoLink adds t=<seconds>s', () => {
    expect(VIDEOS.map(v => v.key)).toEqual(URL_ROWS.map(r => r[0]));
    for (const v of VIDEOS) {
      expect(README, v.key).toContain(`| ${v.title} |`);
      expect(v.url, v.key).toBe(URLS.get(v.key) || undefined);
      expect(v.note.length).toBeGreaterThan(5);
      if (!v.url) expect(videoLink(v.key, 6628)).toBeUndefined();
      else expect(videoLink(v.key, 6628)).toBe(`${v.url}${v.url.includes('?') ? '&' : '?'}t=6628s`);
    }
    expect(videoLink('nope', 10)).toBeUndefined();
  });
});

describe('SCH-003 Module 0 and Module 1', () => {
  const [m0, m1] = [COURSE[0]!, COURSE[1]!];
  it('SCH-003 Module 0 assumes nothing: ghost car, assigned speeds, hidden checkpoints, 1 point per second, Ace, the Great Race, driver vs navigator', () => {
    const t = m0.pages.map(pageText).join(' ').toLowerCase();
    for (const w of ['ghost', 'speed', 'checkpoint', 'nobody tells you where', 'one point', 'ace', 'great race', 'driver', 'navigator']) expect(t, w).toContain(w);
    const gr = m0.pages.find(p => p.kind === 'concept' && p.title === 'The Great Race');
    expect(gr && gr.kind === 'concept' ? gr.words.split(/[.!?](\s|$)/).filter(s => s.trim().length > 1).length : 0).toBe(2);
    expect(m0.controls).toEqual([]);
    expect(m0.pages.some(p => p.kind === 'minisim')).toBe(false);
    const widgets = m0.pages.flatMap(p => p.kind === 'widget' ? [p.widget] : []);
    expect(new Set(widgets)).toEqual(new Set(['holdSpeed', 'whereCheckpoint']));
  });
  it('SCH-003 Modules 0 + 1 are under 900 words with at least 8 interactions', () => {
    expect(moduleWords(m0) + moduleWords(m1)).toBeLessThan(FIRST_TWO_MAX_WORDS);
    expect([...m0.pages, ...m1.pages].filter(isInteraction).length).toBeGreaterThanOrEqual(FIRST_TWO_MIN_INTERACTIONS);
    // the first interaction is the second page (first mini-sim / widget within 90 s)
    expect(isInteraction(m0.pages[1]!)).toBe(true);
  });
});

describe('SCH-004 controls ladder (data part)', () => {
  it('SCH-004 every ControlId is introduced exactly once, by the module SCHOOL.md names, Desk last', () => {
    const intro = COURSE.flatMap(m => m.controls);
    expect(new Set(intro).size).toBe(intro.length);
    expect(new Set(intro)).toEqual(new Set(CONTROL_IDS));
    expect(controlModule('book')).toBe(1); expect(controlModule('go')).toBe(2); expect(controlModule('watchLap')).toBe(3); expect(controlModule('chartCell')).toBe(4);
    expect(controlModule('callAtMark')).toBe(5); expect(controlModule('launch')).toBe(6); expect(controlModule('makeup')).toBe(8); expect(controlModule('taCard')).toBe(9);
    expect(controlModule('holdCard')).toBe(10); expect(controlModule('desk')).toBe(12);
  });
  it('SCH-004 no page uses a control before the module that introduces it', () => {
    for (const { p, mi, at } of pages) if (p.kind === 'minisim') expect(controlsThrough(mi), `${at} uses ${p.control}`).toContain(p.control);
  });
  it('SCH-004 modules 0-6 are the core (module 6 unlocks unguided runs) and module 12 unlocks Desk mode', () => {
    expect(COURSE.filter(m => m.unlocks).map(m => [m.id, m.unlocks])).toEqual([['m6', 'runs'], ['m12', 'desk']]);
    expect(CORE_MODULES).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  });
  it('SCH-004 every mini-sim seed is unique, so no two pages replay the same card', () => {
    const seeds = pages.flatMap(x => x.p.kind === 'minisim' ? [x.p.seed] : []);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('SCH-010 first visit', () => {
  it('SCH-010 the first-visit line says what this is in <= 30 words, needs no prior concept, and starts Module 0', () => {
    expect(FIRST_VISIT.title).toBe('What is this?');
    expect(words(FIRST_VISIT.line)).toBeLessThanOrEqual(FIRST_VISIT_MAX_WORDS);
    expect(FIRST_VISIT.line.startsWith('What is this?')).toBe(true);
    expect(FIRST_VISIT.line).toContain(FIRST_VISIT.text);
    expect(FIRST_VISIT.text).not.toMatch(/\bTSD\b|\bASP\b|\bTA\b|GRIID|CAMEO/);
    expect(FIRST_VISIT.start).toMatch(/Module 0/);
    expect(COURSE[0]!.title).toBe('What is a TSD rally?');
  });
});
