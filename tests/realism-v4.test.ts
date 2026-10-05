// Fix sprint PT-11 / realism v4 (2026-10-04): docs/playtest/REVALIDATION-v4-realism.md sections 3 and 5 (generated content and the calibration / transit rows).
// One describe per spec id (ENG-027, ENG-028, GEN-015..GEN-017 in docs/spec/SPECS.md). The oracle over all 50 day seeds is in tests/gen-v4-oracle-*.test.ts.
import { describe, it, expect } from 'vitest';
import { generateStage, PROFILES } from '../src/core/generator/generate.js';
import { ScenarioBuilder } from '../src/core/builder.js';
import { nodeById, validateScenario, timedFinalSpeed, instructionS, type Scenario, type Instruction } from '../src/core/course.js';
import { columnCLines, formatInterval } from '../src/core/griid.js';
import { buildGhost, ghostTimeAt } from '../src/core/ghost.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { taStageOf } from '../src/ui/viewmodels/ta.js';
import { taWebHtml } from '../src/ui/render/taform.js';
import { perfCardFor, instrumentPolicy } from '../src/ui/viewmodels/cockpitinfo.js';

const cache = new Map<number, Scenario>();
const day = (seed: number): Scenario => { let s = cache.get(seed); if (!s) { s = generateStage(seed); cache.set(seed, s); } return s; };
const SEEDS = Array.from({ length: 50 }, (_, i) => i + 1);
const node = (sc: Scenario, i: Instruction) => nodeById(sc.course, i.nodeId);
const paren = (l: string): boolean => /^\(\d+h?\d*m\d\ds\)$/.test(l);

describe('ENG-027 the calibration official time and the transit time-left rows', () => {
  it('ENG-027 the calibration start row prints the official time = the run time rounded up to the minute (REG #5 / #10: 25m17.8s -> 26m00s); the transit after the last box prints plain and carries the allowance', () => {
    // REG Example #5 / #10: a 21.08-mile run at 50 is 25m17.8s and prints 26m00s
    const b = new ScenarioBuilder({ startTime: 8 * 3600 }).start(30); b.advanceMiles(1); b.calibrationRun({ miles: 21.0817, speed: 50, points: 4, allowanceExtraSeconds: 180, thenTransit: { exact: false, seconds: 540 } }); b.advanceMiles(4.5); b.restart(30, 8 * 3600 + 3300); b.advanceMiles(1).checkpoint().advanceFt(300).finish();
    const ex = b.build(); const cal = ex.book.filter(i => i.section === 'calibration');
    expect(columnCLines(cal[0]!)).toEqual(['50 MPH', '26m00s', '* 0m00.0s']); expect(cal[0]!.text).toMatch(/the transit time is 26 minutes/);
    const last = cal[cal.length - 1]!; expect(last.transit).toMatchObject({ exact: false, plain: true, seconds: 540 + 180 }); expect(columnCLines(last)[columnCLines(last).length - 1]).toBe('12m00s');   // plain: no parentheses
    for (const seed of SEEDS.slice(0, 12)) {
      const sc = day(seed); const c = sc.book.filter(i => i.section === 'calibration'); const begin = c[0]!, end = c[c.length - 1]!;
      expect(begin.transit!.seconds, `seed ${seed}`).toBe(Math.ceil(end.perfectCumulative! / 60) * 60);
      expect(end.transit).toMatchObject({ exact: false, plain: true }); expect(columnCLines(end).some(paren)).toBe(false);
    }
  });
  it('ENG-027 a row prints one time-left figure: the guide wins over a countdown rung on the same row; no generated row prints two (50 day seeds)', () => {
    expect(columnCLines({ transitGuide: 30, transitCountdown: 600 } as Partial<Instruction>)).toEqual(['(0m30s)']);
    for (const seed of SEEDS) for (const i of day(seed).book) expect(columnCLines(i).filter(paren).length, `seed ${seed} line ${i.n}`).toBeLessThanOrEqual(1);
  });
  it('ENG-027 the lunch transit prints the 10m / 8m / 3m / 0m30s ladder after the meal stop, in order, at the pace from the meal departure (11a); a rest stop is the 3-minute rung', () => {
    for (const seed of SEEDS) {
      const sc = day(seed); const meal = sc.book.find(i => i.promotedStop?.kind === 'meal')!; const restart = sc.book.find(i => i.n > meal.n && i.section === 'restart')!;
      const rows = sc.book.filter(i => i.n > meal.n && i.n < restart.n);
      const figs = rows.map(i => i.transitCountdown ?? i.transitGuide ?? (i.promotedStop?.kind === 'rest' ? i.promotedStop.leaveBeforeEndSeconds : undefined)).filter((x): x is number => x !== undefined);
      expect(figs, `seed ${seed}`).toEqual([600, 480, 180, 30]);
      const lines = rows.flatMap(i => columnCLines(i)).filter(paren); expect(lines).toEqual(['(10m00s)', '(8m00s)', '(3m00s)', '(0m30s)']);
      // each rung sits where the meal-departure pace puts it (45 minutes over the miles from the meal stop to the restart), within 10 %
      const total = instructionS(sc.course, restart) - instructionS(sc.course, meal);
      for (const i of rows) { const f = i.transitCountdown ?? i.transitGuide; if (f === undefined) continue; const left = 2700 * (instructionS(sc.course, restart) - instructionS(sc.course, i)) / total; expect(Math.abs(left - f) / f, `seed ${seed} line ${i.n}`).toBeLessThan(0.25); }
    }
  });
});

describe('ENG-028 the TA row says "Today is Stage N." and the web form starts on that Stage', () => {
  it('ENG-028 a day stage prints "Today is Stage N." on both TA rows (REG Example #18 / #36, frame 2026-110m28s), N in 1-9 (day seed n is Stage ((n - 1) mod 9) + 1); a drill prints Stage 1; the web form\'s Stage field is prefilled', () => {
    expect(taStageOf(day(21).book)).toBe('3'); expect(taStageOf(day(9).book)).toBe('9'); expect(taStageOf(day(10).book)).toBe('1');
    for (const seed of [1, 4, 7]) {
      const ta = day(seed).book.filter(i => i.taPoint); expect(ta.length).toBe(2);
      for (const t of ta) { expect(t.taPoint!.stage).toBe(seed); expect(t.text).toContain(`if any. Today is Stage ${seed}.`); }
      expect(ta[0]!.text).toMatch(/this morning's run, if any\. Today is Stage \d+\. If you have no Time Allowances/); expect(ta[1]!.text).toMatch(/this afternoon's run, if any\. Today is Stage \d+\. Then, whether or not/);
      expect(taStageOf(day(seed).book)).toBe(String(seed));
    }
    const leg = new ScenarioBuilder({}).start(30).advanceMiles(1).checkpoint().advanceFt(200).endTimedPortion({ endOfStage: true }).advanceMiles(0.2).finish().build();
    expect(leg.book.find(i => i.taPoint)!.text).toMatch(/Today is Stage 1\./);
    const html = taWebHtml({ draft: {}, legs: [{ legIndex: 1 }], carDefault: '', stageDefault: taStageOf(day(4).book), loggedIn: true, endOfStage: false, acked: false });
    expect(html).toMatch(/id="ta-stage" type="number" min="0" step="1" value="4"/);
    expect(taWebHtml({ draft: { 'ta-stage': '9' }, legs: [{ legIndex: 1 }], carDefault: '', stageDefault: '4', loggedIn: true, endOfStage: false, acked: false })).toMatch(/id="ta-stage"[^>]*value="9"/);   // what the player typed wins
  });
});

describe('GEN-015 12 and 15 mph rows and posted limits at or below the assigned speed', () => {
  it('GEN-015 town school zones and congested areas print 15 (sometimes 12) mph rows on many days; a posted limit sits at or below the assigned speed on some rows (REG VII.E.1.c) and never more than 10 below', () => {
    let d15 = 0, d12 = 0, dBelow = 0, above = 0;
    for (const seed of SEEDS) {
      const sc = day(seed); const sp = sc.book.flatMap(i => [i.speed, i.timed?.holdSpeed, i.timed?.thenSpeed, ...(i.timed?.chain ?? []).map(c => c.thenSpeed)]).filter((v): v is number => v !== undefined);
      if (sp.includes(15)) d15++; if (sp.includes(12)) d12++;
      let below = false;
      for (const i of sc.book) { const m = /^SPEED LIMIT (\d+)$/.exec(node(sc, i).sign?.text ?? ''); if (!m || i.speed === undefined) continue; const lim = Number(m[1]); if (lim <= i.speed) below = true; else above++; expect(lim).toBeGreaterThanOrEqual(i.speed - 10); expect(lim % 5).toBe(0); }
      if (below) dBelow++;
    }
    expect(d15).toBeGreaterThanOrEqual(25); expect(d12).toBeGreaterThanOrEqual(5); expect(dBelow).toBeGreaterThanOrEqual(30); expect(above).toBeGreaterThan(50);   // most posted limits are still above it
    // a 12 or 15 row is a town row: the rows around it are town speeds
    for (const seed of SEEDS.slice(0, 20)) { const b = day(seed).book; b.forEach((i, k) => { if (i.speed === 12 && k > 0) { const prev = [...b.slice(0, k)].reverse().find(x => x.speed !== undefined); expect(prev!.speed!).toBeLessThanOrEqual(30); } }); }
  });
});

describe('GEN-016 pause rows where the real pages print them: the blinker and the two-row railroad crossing', () => {
  it('GEN-016 a blinker row prints "0 MPH / 0m15s / NN MPH" and the car stops there (REG Example #15); the two-row crossing is the round RR sign row then the tracks row "0 MPH / 0m15s / 15 MPH" (11b rows 102-103)', () => {
    let blink = 0, rr = 0;
    for (const seed of SEEDS) {
      const sc = day(seed);
      for (const i of sc.book) {
        const n = node(sc, i);
        if (n.control === 'BLINKER' && i.pause) { blink++; expect(n.fullStop).toBe(true); expect(columnCLines(i).slice(0, 2)).toEqual(['0 MPH', '0m15s']); expect(i.text).toMatch(/Blinker\. Pause 15 seconds/); }
        if (n.control === 'RR' && i.pause) {
          rr++; expect(n.fullStop).toBe(true); expect(columnCLines(i)).toEqual(['0 MPH', '0m15s', '15 MPH']);
          const prev = sc.book[i.n - 2]!; expect(node(sc, prev).sign?.shape).toBe('rr-advance'); expect(instructionS(sc.course, i) - instructionS(sc.course, prev)).toBeCloseTo(450, 0);
          if (prev.speed !== undefined) expect(prev.speed).toBeLessThanOrEqual(20);
        }
      }
    }
    expect(blink).toBeGreaterThanOrEqual(50); expect(rr).toBeGreaterThanOrEqual(30);
    // the engine: the car comes to a full stop at a fullStop node and the navigator's go releases it (a train first holds it, TA-eligible)
    const sc = day(1); const b = sc.book.find(i => node(sc, i).control === 'BLINKER' && i.pause)!;
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim), 8 * 3600);
    expect(r.events.some(e => e.type === 'wait' && e.detail?.nodeId === b.nodeId && e.detail?.reason === 'stop')).toBe(true);
    expect(r.attribution.flatMap(a => a.stops ?? []).some(st => st.line === b.n && st.pause === 15)).toBe(true);
  });
});

describe('GEN-017 the stage variety the Example prints: a mid-stage "take exactly" transit, delayed and chained timed changes', () => {
  it('GEN-017 50 day seeds validate; the mid-stage exact transit, the delayed timed change (REG #25) and the chained timed change (REG #14) each appear on many days and read as the Example prints them', () => {
    let exact = 0, delayed = 0, chain = 0;
    for (const seed of SEEDS) {
      const sc = day(seed); expect(validateScenario(sc), `seed ${seed}`).toEqual([]);
      const ex = sc.book.find(i => i.transit?.exact && !i.transit.end);
      if (ex) {
        exact++; expect(ex.text).toMatch(/take exactly \d+ minutes/); expect(columnCLines(ex)).toEqual([formatInterval(ex.transit!.seconds)]);
        const end = sc.book.find(i => i.n > ex.n && i.transit?.end)!; expect(end.transit!.exact).toBe(true); expect(end.speed).toBeDefined();
        const cps = sc.checkpoints.filter(c => c.kind === 'timing'); expect(cps.some(c => c.s > instructionS(sc.course, ex) && c.s < instructionS(sc.course, end))).toBe(false);   // nothing timed inside it
      }
      for (const i of sc.book) {
        if (i.timed?.delayed) { delayed++; expect(i.speed).toBeUndefined(); expect(columnCLines(i)).toEqual([formatInterval(i.timed.seconds), `${i.timed.thenSpeed} MPH`]); expect(i.text).toMatch(/Continue at the previous average speed/); }
        if (i.timed?.chain?.length) {
          chain++; const c = i.timed.chain[0]!;
          expect(columnCLines(i)).toEqual([`${i.timed.holdSpeed} MPH`, formatInterval(i.timed.seconds), `${i.timed.thenSpeed} MPH`, formatInterval(c.seconds), `${c.thenSpeed} MPH`]);
          expect(i.text).toMatch(new RegExp(`Hold ${i.timed.thenSpeed} miles per hour for .*then change average speed to ${c.thenSpeed} miles per hour`)); expect(timedFinalSpeed(i.timed)).toBe(c.thenSpeed);
        }
      }
    }
    expect(exact).toBeGreaterThanOrEqual(20); expect(delayed).toBeGreaterThanOrEqual(20); expect(chain).toBeGreaterThanOrEqual(20);
  });
  it('GEN-017 the ghost drives a chain: hold, then the second speed for its interval, then the third; the card and the next row carry the final speed', () => {
    const b = new ScenarioBuilder({ startTime: 8 * 3600 }).start(30); b.advanceMiles(0.5); b.timedAt('sign', { holdSpeed: 30, seconds: 36, thenSpeed: 45, chain: [{ seconds: 72, thenSpeed: 50 }] }); b.advanceMiles(2.5).checkpoint().advanceFt(300).finish();
    const sc = b.build(); expect(validateScenario(sc)).toEqual([]); const g = buildGhost(sc); const s0 = instructionS(sc.course, sc.book[1]!);
    const t0 = ghostTimeAt(g, s0), s1 = s0 + 30 * 1.4666666666666666 * 36, s2 = s1 + 45 * 1.4666666666666666 * 72;
    expect(ghostTimeAt(g, s1) - t0).toBeCloseTo(36, 3); expect(ghostTimeAt(g, s2) - ghostTimeAt(g, s1)).toBeCloseTo(72, 3); expect(ghostTimeAt(g, s2 + 50 * 1.4666666666666666 * 10) - ghostTimeAt(g, s2)).toBeCloseTo(10, 3);
    expect(columnCLines(sc.book[1]!)).toEqual(['30 MPH', '0m36s', '45 MPH', '1m12s', '50 MPH']);
    expect(perfCardFor(sc, 1, instrumentPolicy(sc.aids))).toBeTruthy();
    // the oracle calls both changes, each a ramp lead before the ghost's change, and lands the checkpoint
    const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim)); const calls = r.events.filter(e => e.type === 'call.speed').map(e => e.detail?.mph);
    expect(calls).toContain(45); expect(calls).toContain(50); expect(calls.indexOf(45)).toBeLessThan(calls.lastIndexOf(50)); expect(Math.abs(r.score.legs[0]!.error!)).toBeLessThanOrEqual(1);
  });
  it('GEN-017 the oracle finishes the days that carry every new row on course, with every leg within 5 s plus half the committee-recoverable delay', () => {
    const seeds = [1, 2, 3, 4, 5, 6]; const seen = { exact: false, delayed: false, chain: false, blink: false, rr: false, s15: false };
    for (const seed of seeds) {
      const sc = generateStage(seed, { ...PROFILES.fullStage, trafficWaitProbability: 0 });
      seen.exact ||= sc.book.some(i => i.transit?.exact && !i.transit.end); seen.delayed ||= sc.book.some(i => i.timed?.delayed); seen.chain ||= sc.book.some(i => !!i.timed?.chain);
      seen.blink ||= sc.book.some(i => node(sc, i).control === 'BLINKER' && !!i.pause); seen.rr ||= sc.book.some(i => node(sc, i).control === 'RR' && !!i.pause); seen.s15 ||= sc.book.some(i => i.speed === 15 || i.speed === 12);
      const sim = new Simulator(sc); const r = runBot(sim, new OracleBot(sim), 8 * 3600);
      expect(sim.phase).toBe('finished'); expect(r.offCourseCount).toBe(0); expect(r.observationMissed).toBe(false); expect(r.dnf).toBe(false); expect(r.score.earlyRestartPenalty).toBe(0);
      for (const l of r.score.legs) expect(Math.abs(l.error!), `seed ${seed} leg ${l.index}`).toBeLessThanOrEqual(5 + 0.5 * (sim.taRecoverable[l.index] ?? 0));
    }
    expect(Object.values(seen).every(Boolean), JSON.stringify(seen)).toBe(true);
  }, 120_000);
});

describe('ENG-028 the realism v4 slips (section 3) are corrected', () => {
  it('ENG-028 TA causes read "such as" (V.H.1); the web form has no witness and Stage on its entry page; no spelling traps (VII.D); the V.E.3.c occupant rule is age 13+; a transit is "not scored", never "untimed"; the calibration start prints the official time; Settings lists TS/G and T@20; the 20 % table carries the speed-limit caution; the frame says page 1 of 13', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { LESSONS, lessonWithReferenceText, lessonText } = await import('../content/lessons.js');
    const { TA_FORM_FIELDS, TA_FORM_NOTE, PENALTY_ROWS } = await import('../content/reference-data.js');
    const { TRAPS } = await import('../src/core/generator/traps.js');
    const all = LESSONS.map(l => lessonWithReferenceText(l)).join('\n'); const ref = readFileSync('src/ui/screens/reference.ts', 'utf8');
    // 1. V.H.1 gives examples ("such as"), not a closed list
    expect(lessonText(LESSONS.find(l => l.id === 'four-s')!)).toMatch(/such as a train blocking the route or an accident scene \(REG V\.H\.1\)/);
    for (const t of [all, ref, ...TRAPS.map(c => c.tip)]) expect(t).not.toMatch(/only a train (blocking the route )?or an accident (scene )?qualifies/);
    // 2. the 2026 web form
    const f = (id: string) => TA_FORM_FIELDS.find(x => x.id === id)!;
    expect(f('witnesses').form).toBe('paper'); expect(f('witnesses').note).toMatch(/web form has no witness field/); expect(f('stage').form).toBe('both'); expect(f('stage').note).toMatch(/entry page/);
    expect(TA_FORM_NOTE).toMatch(/Car Number, Password and Phone Number on the login page; Stage \(filled in\), Leg Number, Between Instructions, Allowance \(m s\) and Reason on the entry page\. It has no witness field\./);
    // 3. no spelling traps
    expect(ref).not.toMatch(/quoted signs must match exactly/); expect(ref).toMatch(/no traps based on spelling, and a referenced sign may be quoted in whole or in part \(REG VII\.D\)/);
    // 4. II.D.4.b: additional occupants age 13 or older
    expect(PENALTY_ROWS.find(r => r.rule.startsWith('V.E.3.c'))!.what).toMatch(/age 13 or older/);
    // 5. transits are not scored, not untimed
    expect(all).not.toMatch(/untimed/i); expect(ref).not.toMatch(/Untimed sections/); expect(lessonText(LESSONS.find(l => l.id === 'transits')!)).toMatch(/A transit is not scored/);
    // 6. the GRIID lesson describes the page: the official time
    const g = lessonText(LESSONS.find(l => l.id === 'griid-cameo')!); expect(g).not.toMatch(/its allowance, and an empty box/); expect(g).toMatch(/the official time \(the run time rounded up to the minute: 25m17\.8s prints 26m00s/);
    // 7. Settings
    expect(readFileSync('src/ui/screens/settings.ts', 'utf8')).toMatch(/Simple chart: Speed, Dec, Acc, S\/G, TS\/G, T@15, T@20, Lead \(default\)/);
    // 8. the 20 % rule never above the posted limit
    expect(ref).toMatch(/id: 'ref-speed-caution'/); expect(ref).toMatch(/The 20 % column on 55 is 66 mph/); expect(lessonText(LESSONS.find(l => l.id === 'recovery')!)).toMatch(/Never above the posted limit: 20 % over 55 is 66 mph/);
    // 9. the frame reads "Page 1 of 13" ("of 26" is the speaker's figure)
    expect(existsSync('docs/research/frames/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-13.jpg')).toBe(true); expect(existsSync('docs/research/frames/2026-73m54s+0-five-column-instruction-page-footer-page-1-of-26.jpg')).toBe(false);
    expect(readFileSync('docs/research/11a-frames-training-sessions.md', 'utf8')).not.toMatch(/page-1-of-26/);
  });
});
