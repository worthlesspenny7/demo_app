/** Phase VIII phone shell (MOB-020..032 UI parts): pure view-models, progress, the engine adapter, PWA assets. DOM behaviour: e2e/mobile*.spec.ts. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chooseMode, modeFromSearch, MOBILE_MAX_WIDTH } from '../src/ui/mobile/detect.js';
import { emptyProgress, dailySeeds, dailyState, recordRun, setUnfinished, legalUnlocked, bossUnlocked, updateMeter, normalize, dayKey, dailySkills, saveProgress, loadProgress, type KV } from '../src/ui/mobile/progress.js';
import { startRun, resumeRun } from '../src/ui/mobile/engine.js';
import { stubDecision, stubPlan, StubRun } from '../src/ui/mobile/stub-engine.js';
import { decisionCardHtml, bookRowHtml, chartCellHtml, columnDFor, isSentence, verdictParts, ruleCardHtml, driverLine, KIND_TITLE } from '../src/ui/mobile/cards.js';
import { a2hsHint, hapticPattern, haptic, speak } from '../src/ui/mobile/pwa.js';
import { lapRows } from '../src/ui/mobile/tapwatch.js';
import { runnerPlan, RunnerRun, ruleFor } from '../src/ui/mobile/runner-run.js';
import { RULES } from '../content/rules.js';
import { Stopwatch } from '../src/core/stopwatch.js';
import { DECISION_KINDS, SKILLS, SKILL_OF_KIND, type RunResult, type Verdict } from '../src/core/decision/index.js';

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;
const memKV = (): KV & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: k => { delete data[k]; } }; };
const verdict = (skill: Verdict['skill'], correct: boolean): Verdict => ({ decisionId: 'x', kind: 'pause', skill, secondsDelta: correct ? 0 : 3, correct, rule: 'r', ruleId: 'R', source: 's', expected: 'e', chosen: 'c', nextDecisionIn: null });
const result = (vs: Verdict[], mode: RunResult['mode'] = 'daily'): RunResult => ({ seed: 1, mode, verdicts: vs, secondsTotal: 0, correct: vs.filter(v => v.correct).length, total: vs.length, tallies: Object.fromEntries(SKILLS.map(s => [s, { skill: s, correct: 0, total: 0, seconds: 0 }])) as RunResult['tallies'], stars: 2, worst: [], ruleCardsShown: ['RULE-PAUSE'] });

describe('MOB-020 shell switch', () => {
  it('MOB-020 a viewport narrower than 700 px opens the phone shell; ?mode= forces either; a remembered choice wins over the width', () => {
    expect(MOBILE_MAX_WIDTH).toBe(700);
    expect(chooseMode({ search: '', width: 390, stored: null })).toBe('mobile');
    expect(chooseMode({ search: '', width: 699, stored: null })).toBe('mobile');
    expect(chooseMode({ search: '', width: 700, stored: null })).toBe('desk');
    expect(chooseMode({ search: '', width: 1366, stored: null })).toBe('desk');
    expect(chooseMode({ search: '?mode=mobile', width: 1366, stored: 'desk' })).toBe('mobile');
    expect(chooseMode({ search: '?mode=desk', width: 390, stored: 'mobile' })).toBe('desk');
    expect(chooseMode({ search: '', width: 390, stored: 'desk' })).toBe('desk');
    expect(modeFromSearch('?test=1')).toBeNull();
  });
});

describe('MOB-002 / MOB-026 decision cards', () => {
  it('MOB-002 every decision kind renders a card with its kind, a prompt of at most 40 words and its action', () => {
    for (const k of DECISION_KINDS) {
      const d = stubDecision(k, 3);
      const html = decisionCardHtml(d, 2);
      expect(html).toContain(`data-kind="${k}"`);
      expect(html).toContain(KIND_TITLE[k]);
      expect(words(d.prompt)).toBeLessThanOrEqual(40);
      expect(!!d.timing || (d.options?.length ?? 0) >= 1).toBe(true);
      expect((d.options?.length ?? 0)).toBeLessThanOrEqual(4);
      expect(driverLine(d)).toMatch(/^Dad: /);
    }
  });
  it('MOB-026 the book row at phone width: CAMEO left, Column C right (the shared GRIID renderer), the remark below', () => {
    const row = { line: 6, odometer: '', miles: 0, columnB: [], columnC: ['0 MPH', '0m15s', '45 MPH'], columnD: 'Comes quick', cameoSvg: '<svg class="cameo"></svg>' };
    const html = bookRowHtml(row, 2);
    expect(html.indexOf('mrow-a')).toBeLessThan(html.indexOf('mrow-c'));
    expect(html.indexOf('mrow-c')).toBeLessThan(html.indexOf('mrow-d'));
    expect(html).toContain('<div class="cl speed">0 MPH</div>');
    expect(html).toContain('<div class="cl time">0m15s</div>');
    expect(html).toContain('Comes quick');
    // the restart watch from the shared renderer
    expect(bookRowHtml({ ...row, columnC: ['CDT 8:55:00', '30 MPH'] }, 2)).toMatch(/class="zone">CDT<\/b>/);
  });
  it('MOB-026 no sentence in Column D at the legal rung (a short remark stays)', () => {
    expect(isSentence('Comes quick')).toBe(false);
    expect(isSentence('Turn left at the STOP sign.')).toBe(true);
    expect(columnDFor({ columnD: 'Turn left at the STOP sign. Pause 15.' }, 0)).toBe('');
    expect(columnDFor({ columnD: 'Turn left at the STOP sign. Pause 15.' }, 3)).toContain('Turn left');
    expect(columnDFor({ columnD: 'Look sharp' }, 0)).toBe('Look sharp');
    expect(bookRowHtml({ line: 2, odometer: '', miles: 0, columnB: [], columnC: ['35 MPH'], columnD: 'Turn right onto Main Street at the light.' }, 0)).not.toContain('mrow-d');
  });
  it('MOB-026 the simple chart cell is highlighted where relevant and withheld at the legal rung (MOB-031)', () => {
    const c = { kind: 'stopGo' as const, vIn: 35, vOut: 45, seconds: 5.7 };
    expect(chartCellHtml(c, 2)).toMatch(/class="mchart-v hi" data-chart-seconds="5.7" data-meaning="">5.7 s/);
    expect(chartCellHtml(c, 0)).toBe('');
    expect(decisionCardHtml(stubDecision('pause', 1), 2)).toContain('mchart');
    expect(decisionCardHtml(stubDecision('pause', 1), 0)).not.toContain('mchart');
  });
  it('MOB-006 verdict overlay parts: signed seconds, the one-sentence rule, what was right', () => {
    const v = { ...verdict('stayOnTime', false), secondsDelta: 1.24, chosen: 'GO at 7.0 s', expected: 'GO at 5.8 s', rule: 'Sit the chart pause (HB p.8).' };
    expect(verdictParts(v)).toEqual({ head: 'Not quite', seconds: '+1.2 s', rule: 'Sit the chart pause (HB p.8).', detail: 'You: GO at 7.0 s. Right: GO at 5.8 s.' });
    expect(verdictParts({ ...v, correct: true, secondsDelta: -0.3 }).seconds).toBe('−0.3 s');
    expect(ruleCardHtml({ id: 'RULE-X', skill: 'recovery', text: 'Claim it.', source: 'REG V.H.3' })).toContain('REG V.H.3');
  });
});

describe('MOB-021 tap-stopwatch', () => {
  it('MOB-021 the lap table holds interval / cumulative pairs (newest first) from the real Stopwatch model', () => {
    const w = new Stopwatch('digital', 60, 0); w.start(0); w.lap(5.32); w.lap(12.1); w.lap(20);
    const rows = lapRows(w, 3);
    expect(rows.map(r => r.n)).toEqual([3, 2, 1]);
    expect(rows[2]).toEqual({ n: 1, interval: '0m05.3s', cumulative: '0m05.3s' });
    expect(rows[1]).toEqual({ n: 2, interval: '0m06.8s', cumulative: '0m12.1s' });
    expect(lapRows(w, 2)).toHaveLength(2);
  });
});

describe('MOB-030 / MOB-031 progress', () => {
  it('MOB-030 daily set: three seeds per calendar day, the same all day and new the next day', () => {
    const a = dailySeeds('2026-10-23'), b = dailySeeds('2026-10-23'), c = dailySeeds('2026-10-24');
    expect(a).toHaveLength(3); expect(a).toEqual(b); expect(a).not.toEqual(c); expect(new Set(a).size).toBe(3);
    const p = emptyProgress();
    expect(dailyState(p, '2026-10-23').next).toBe(0);
    expect(dailySkills(p, 0)).toEqual([...SKILLS]); expect(dailySkills(p, 1)).toHaveLength(2);
  });
  it('MOB-030 a finished daily run records completion and the streak (consecutive days count, a gap resets)', () => {
    let p = recordRun(emptyProgress(), result([verdict('stayOnTime', true)]), { day: '2026-10-21', dailyIndex: 0 });
    expect(p.streak.current).toBe(1); expect(dailyState(p, '2026-10-21').completed).toEqual([0]); expect(dailyState(p, '2026-10-21').next).toBe(1);
    p = recordRun(p, result([verdict('stayOnTime', true)]), { day: '2026-10-21', dailyIndex: 1 });
    expect(p.streak.current).toBe(1);
    p = recordRun(p, result([verdict('stayOnTime', true)]), { day: '2026-10-22', dailyIndex: 0 });
    expect(p.streak.current).toBe(2); expect(dailyState(p, '2026-10-22').completed).toEqual([0]);
    p = recordRun(p, result([verdict('stayOnTime', true)]), { day: '2026-10-25' });
    expect(p.streak.current).toBe(1); expect(p.streak.best).toBe(2);
    expect(p.rulesSeen).toContain('RULE-PAUSE');
  });
  it('MOB-030 Continue: the unfinished run is stored with the progress and replays to the same card', () => {
    const h = startRun({ skills: [...SKILLS], seed: 7, mode: 'daily', rung: 2 });
    for (let i = 0; i < 4; i++) { const s = h.current(); if (!s) break; if (s.type === 'rule') h.ack(); else h.answer(h.oracle(s.decision)); }
    const at = h.current(); expect(at).not.toBeNull();
    const kv = memKV();
    saveProgress(setUnfinished(emptyProgress(), h.plan, h.responses), kv);
    const back = loadProgress(kv);
    expect(back.unfinished?.responses.length).toBe(h.responses.length);
    const r = resumeRun(back.unfinished!.plan, back.unfinished!.responses)!;
    expect(r.verdicts.length).toBe(h.verdicts.length);
    const now = r.current();
    expect(now?.type).toBe(at!.type);
    if (now?.type === 'decision' && at?.type === 'decision') expect(now.decision.id).toBe(at.decision.id);
    expect(recordRun(back, result([])).unfinished).toBeNull();
  });
  it('MOB-031 meters fill with correct cards and decay with misses; legal rung at 80 %, Boss at 50 % on all five', () => {
    let m = emptyProgress().meters.recovery;
    for (let i = 0; i < 11; i++) m = updateMeter(m, true, '2026-10-23');
    expect(m.value).toBeGreaterThanOrEqual(0.8);
    const after = updateMeter(m, false, '2026-10-23'); expect(after.value).toBeLessThan(m.value);
    const p = emptyProgress(); p.meters.recovery = { ...m, lastDay: null };   // no idle decay: the test does not depend on today's date
    expect(legalUnlocked(p, 'recovery')).toBe(true); expect(legalUnlocked(p, 'instruments')).toBe(false);
    expect(bossUnlocked(p)).toBe(false);
    for (const s of SKILLS) p.meters[s] = { ...p.meters[s], value: 0.5, lastDay: null };
    expect(bossUnlocked(p)).toBe(true);
    expect(normalize({ meters: { recovery: { value: 7 } } }).meters.recovery.value).toBe(1);
    expect(dayKey(new Date(2026, 9, 3))).toBe('2026-10-03');
  });
});

describe('MOB-001 / MOB-005 engine adapter (feature detection)', () => {
  it('MOB-001 a run starts through the core Scheduler when it plans cards, else the labelled UI stub; 10-15 cards, rule cards before a skill', () => {
    const h = startRun({ skills: [...SKILLS], seed: 11, mode: 'daily', rung: 2 });
    expect(['core', 'runner', 'stub']).toContain(h.source);
    expect(h.plan.decisionCount).toBeGreaterThanOrEqual(10); expect(h.plan.decisionCount).toBeLessThanOrEqual(15);
    let decisions = 0, rules = 0, correct = 0;
    for (let i = 0; i < 80; i++) {
      const s = h.current(); if (!s) break;
      if (s.type === 'rule') { rules++; h.ack(); continue; }
      decisions++; const v = h.answer(h.oracle(s.decision)); if (v.correct) correct++;
      expect(v.rule.length).toBeGreaterThan(0);
    }
    expect(decisions).toBe(h.plan.decisionCount);
    expect(rules).toBeLessThanOrEqual(3);
    if (h.source === 'stub') expect(correct).toBe(decisions);
    const r = h.result(); expect(r.total).toBe(decisions); expect(r.worst.length).toBeLessThanOrEqual(3);
  });
  it('MOB-005 the stub plan is seeded and reproducible and never repeats a rule card the player has seen', () => {
    expect(stubPlan([...SKILLS], 5, 'daily', 2)).toEqual(stubPlan([...SKILLS], 5, 'daily', 2));
    const seen = stubPlan([...SKILLS], 5, 'daily', 2, 12, ['RULE-PAUSE', 'RULE-START', 'RULE-COURSE', 'RULE-RECOVER', 'RULE-CLOCK']);
    expect(seen.items.filter(i => i.type === 'rule')).toHaveLength(0);
    const run = new StubRun(stubPlan(['stayOnTime'], 2, 'practice', 0));
    const s = run.next(); expect(s).not.toBeNull();
  });
});

describe('MOB-001 / MOB-005 the real DecisionRunner behind the shell (until the core Scheduler plans runs)', () => {
  it('MOB-001 MOB-005 a skill run chains real legs through the core runner: only that skill\'s kinds, 10-15 cards, rule cards from content/rules.ts before a new skill, oracle answers all right', () => {
    for (const skill of ['stayOnTime', 'safetyCourse'] as const) {
      const plan = runnerPlan({ skills: [skill], seed: 4242, mode: 'practice', rung: 2 })!;
      expect(plan).not.toBeNull();
      expect(plan.decisionCount).toBeGreaterThanOrEqual(10); expect(plan.decisionCount).toBeLessThanOrEqual(15);
      const run = new RunnerRun(plan); const ids: string[] = []; let rules = 0;
      for (let i = 0; i < 60; i++) {
        const s = run.next(); if (!s) break;
        if (s.type === 'rule') { rules++; expect(RULES.some(r => r.id === s.card.id)).toBe(true); expect(words(s.card.text)).toBeLessThanOrEqual(60); run.ack(); continue; }
        expect(SKILL_OF_KIND[s.decision.kind]).toBe(skill);
        expect(words(s.decision.prompt)).toBeLessThanOrEqual(40);
        ids.push(s.decision.id);
        const v = run.answer(run.oracle(s.decision));
        expect(v.correct).toBe(true);
      }
      expect(ids).toHaveLength(plan.decisionCount);
      expect(rules).toBeGreaterThanOrEqual(1); expect(rules).toBeLessThanOrEqual(3);
      // deterministic: the same plan and the same answers give the same cards (Continue)
      const again = new RunnerRun(plan); const ids2: string[] = [];
      for (let i = 0; i < 60; i++) { const s = again.next(); if (!s) break; if (s.type === 'rule') { again.ack(); continue; } ids2.push(s.decision.id); again.answer(again.oracle(s.decision)); }
      expect(ids2).toEqual(ids);
    }
    expect(ruleFor('pause', new Set())).not.toBeNull();
    expect(ruleFor('pause', new Set(RULES.map(r => r.id)))).toBeNull();
  });
});

describe('MOB-023 / MOB-024 PWA and haptics', () => {
  it('MOB-023 MOB-061 manifest: name, icons 192 and 512, standalone, any orientation (the landscape cockpit works installed), theme colour; the worker caches the shell and updates on reload', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as Record<string, unknown> & { icons: { sizes: string; src: string }[] };
    expect(m.name).toBe('Rally Trainer'); expect(m.display).toBe('standalone'); expect(m.orientation).toBe('any'); expect(m.theme_color).toMatch(/^#/);
    expect(m.icons.some(i => i.sizes === '192x192')).toBe(true); expect(m.icons.some(i => i.sizes === '512x512')).toBe(true);
    for (const i of m.icons) expect(() => readFileSync(`public/${i.src}`)).not.toThrow();
    const png = readFileSync('public/icons/icon-512.png'); expect(png.readUInt32BE(16)).toBe(512); expect(png.readUInt32BE(20)).toBe(512);
    const sw = readFileSync('public/sw.js', 'utf8');
    for (const ev of ['install', 'activate', 'fetch']) expect(sw).toContain(`addEventListener('${ev}'`);
    expect(sw).toContain('__RALLY_PRECACHE__'); expect(sw).toContain("req.mode === 'navigate'");
    expect(readFileSync('index.html', 'utf8')).toContain('rel="manifest"');
    expect(a2hsHint({ seen: false, standalone: false, ua: 'iPhone' })).toMatch(/Share/);
    expect(a2hsHint({ seen: true, standalone: false, ua: 'iPhone' })).toBeNull();
    expect(a2hsHint({ seen: false, standalone: true, ua: 'Android' })).toBeNull();
  });
  it('MOB-024 haptics: short for right, double for wrong; no vibrate or speech support is a silent no-op', () => {
    expect(hapticPattern(true)).toHaveLength(1); expect(hapticPattern(false)).toHaveLength(3);
    expect(haptic(true)).toBe(false);
    expect(speak('Holding 35', true)).toBe(false);
  });
});
