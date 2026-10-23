/**
 * PT-13 human player model for the phone decision mode. Two policies:
 *  - naive: a rookie who skims the rule cards and does what the card literally says (or what seems natural);
 *  - rules: a rookie who applies the rule cards he was shown, using only what is on the screen.
 * Option cards: a 2-3 s read pause, then a real tap. Timing cards: tapped in real time from on-screen information only
 * (the prompt numbers, the facts chips, the watch digits / TOD strip), with a 0.15-0.25 s human reaction added.
 * The oracle is read and logged for comparison but never used to choose, except for the direction of a turn
 * (which a person reads off the CAMEO arrow; see the report) when `turnFromOracle` is set.
 */
import type { Page } from 'playwright';
import { state, oracle, cardInfo, verdictInfo, screenWords, geometry, tapEl, tapAtElapsed, tapAtTod, shot, sleep } from './pt13-common.js';

export type Policy = 'naive' | 'rules';
export interface CardLog {
  i: number; kind: string; phase: 'rule' | 'decision'; tShown: number; tTap?: number; tVerdict?: number; tNext?: number;
  words: number; cardWords: number; prompt?: string; options?: string[]; facts?: string[]; chart?: string; rowC?: string; rowD?: string;
  action?: string; oracle?: unknown; timing?: unknown; verdict?: Awaited<ReturnType<typeof verdictInfo>>; note?: string; geo?: { hscroll: boolean; small: number; outOfZone: string[]; tiny: string[]; minFont: number };
  ruleText?: string; n?: number; of?: number; tapToVerdictMs?: number; nextToCardMs?: number;
}
export interface RunLog { label: string; policy: Policy; tStart: number; tEnd: number; cards: CardLog[]; recap?: { sum: string; stars: number; worst: string[]; tally: string[] }; errors: string[] }

let rr = 1;
const rnd = (): number => { rr = (rr * 16807) % 2147483647; return (rr - 1) / 2147483646; };
export function seedPlayer(s: number): void { rr = s; }
const readPause = (): number => 2000 + Math.round(rnd() * 1000);
const react = (): number => 0.15 + rnd() * 0.1;
const fps = (mph: number): number => mph * 5280 / 3600;
const num = (s: string | undefined): number => Number(s);
const hms = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };
const fmt = (t: number): string => { t = Math.round(t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
const opt = (opts: { id: string; label: string }[], re: RegExp): string | undefined => opts.find(o => re.test(o.label))?.id;
function parseIv(s: string): number { const m = /(\d+)m(\d\d)s/.exec(s); return m ? num(m[1]) * 60 + num(m[2]) : NaN; }

export interface PlayOpts { policy: Policy; label: string; shots?: Record<string, string>; shotKinds?: Set<string>; ruleWpm?: number; verdictReadMs?: number; maxCards?: number; stopAfterDecisions?: number; geometry?: boolean; turnFromOracle?: boolean; shotPrefix?: string }

/** Play the run on screen until the recap (or `stopAfterDecisions`). */
export async function playRun(page: Page, o: PlayOpts): Promise<RunLog> {
  const log: RunLog = { label: o.label, policy: o.policy, tStart: Date.now(), tEnd: 0, cards: [], errors: [] };
  let decisions = 0; const shotDone = o.shotKinds ?? new Set<string>();
  for (let i = 0; i < (o.maxCards ?? 120); i++) {
    let st = await state(page);
    for (let k = 0; k < 100 && (!st || (st.screen === 'run' && st.phase === 'done')); k++) { await sleep(50); st = await state(page); }
    if (!st) break;
    if (st.screen === 'recap') {
      log.recap = await page.evaluate(() => ({ sum: (document.querySelector('[data-testid=recap-sum]')?.textContent ?? '').trim(), stars: Number((document.querySelector('.mob-stars') as HTMLElement | null)?.dataset.stars ?? -1), worst: [...document.querySelectorAll('.mob-worst li')].map(e => (e.textContent ?? '').trim()), tally: [...document.querySelectorAll('.mob-tally tr')].map(e => (e.textContent ?? '').trim()) }));
      if (!shotDone.has('recap') && o.shotPrefix) { shotDone.add('recap'); await shot(page, `${o.shotPrefix}-recap`); }
      break;
    }
    if (o.stopAfterDecisions !== undefined && decisions >= o.stopAfterDecisions && st.phase !== 'verdict') break;
    const tShown = Date.now();
    const w = await screenWords(page);
    let geo: CardLog['geo'];
    if (o.geometry) { const g = await geometry(page); geo = { hscroll: g.hscroll, small: g.small.length, outOfZone: g.controls.filter(c => !c.inBottom40 && !/×|Home/.test(c.label) && c.label !== '').map(c => `${c.label}@${c.top}`), tiny: g.tiny, minFont: g.minFont }; }
    if (st.phase === 'rule') {
      const text = w.cardText;
      const c: CardLog = { i, kind: 'rule', phase: 'rule', tShown, words: w.total, cardWords: w.card, ruleText: text, n: st.n, of: st.of, ...(geo ? { geo } : {}) };
      if (o.shotPrefix && !shotDone.has('rule')) { shotDone.add('rule'); await shot(page, `${o.shotPrefix}-rule-card`); }
      const wpm = o.ruleWpm ?? 230;
      await sleep(Math.max(2500, (w.card / wpm) * 60_000));
      c.tTap = await tapEl(page, '[data-action=ack]');
      await page.waitForFunction(() => (window as any).__rally.decision.state().phase !== 'rule' || document.querySelector('[data-screen=recap]'), null, { timeout: 60000 }).catch(() => undefined);
      c.tNext = Date.now(); log.cards.push(c); continue;
    }
    if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(50); continue; }
    if (st.phase !== 'decision') { await sleep(50); continue; }
    const info = await cardInfo(page); const or = await oracle(page);
    const c: CardLog = { i, kind: st.kind!, phase: 'decision', tShown, words: w.total, cardWords: w.card, prompt: info.prompt, options: info.options.map(x => x.label), facts: info.facts, chart: `${info.chart} [${info.chartV}]`, rowC: info.rowC, rowD: info.rowD, oracle: or, timing: st.timing, n: st.n, of: st.of, ...(geo ? { geo } : {}) };
    if (o.shotPrefix && !shotDone.has(st.kind!)) { shotDone.add(st.kind!); await shot(page, `${o.shotPrefix}-${st.kind}`); }
    await act(page, o, st, info, or, c);
    c.tTap = Date.now();
    await page.waitForSelector('[data-testid=verdict]', { timeout: 120000 });
    c.tVerdict = Date.now(); c.tapToVerdictMs = c.tVerdict - c.tTap;
    c.verdict = await verdictInfo(page);
    if (o.shotPrefix) await sleep(350);   // let the verdict pop-in animation finish before a screenshot
    if (o.shotPrefix && !c.verdict.correct && !shotDone.has('verdict-wrong')) { shotDone.add('verdict-wrong'); await shot(page, `${o.shotPrefix}-verdict-wrong-${st.kind}`); }
    else if (o.shotPrefix && c.verdict.correct && !shotDone.has('verdict-right')) { shotDone.add('verdict-right'); await shot(page, `${o.shotPrefix}-verdict-right-${st.kind}`); }
    decisions++;
    await sleep(o.verdictReadMs ?? (c.verdict.correct ? 2000 : 3000));
    const tN = await tapEl(page, '[data-action=next]');
    await page.waitForFunction(() => { const s = (window as any).__rally.decision.state(); return s.phase === 'decision' || s.phase === 'rule' || s.screen === 'recap'; }, null, { timeout: 120000 }).catch(() => undefined);
    c.tNext = tN; c.nextToCardMs = Date.now() - tN;
    log.cards.push(c);
  }
  log.tEnd = Date.now();
  return log;
}

async function act(page: Page, o: PlayOpts, st: NonNullable<Awaited<ReturnType<typeof state>>>, info: Awaited<ReturnType<typeof cardInfo>>, or: any, c: CardLog): Promise<void> {
  const naive = o.policy === 'naive'; const p = info.prompt; const opts = info.options; const kind = st.kind!;
  const choose = async (id: string | undefined, why: string): Promise<void> => {
    const pick = id ?? opts[0]!.id; c.action = `${opts.find(x => x.id === pick)?.label ?? pick} (${why})`;
    await sleep(readPause());
    if (await page.evaluate(() => (window as any).__rally.decision.state().phase) !== 'decision') { c.note = 'card timed out during the read pause'; return; }
    await tapEl(page, `.mob-actions [data-option="${pick}"]`);
  };
  switch (kind) {
    case 'clock': return choose(naive ? opt(opts, /Dash clock/) : opt(opts, /Stopwatch/), naive ? 'the clock is right there' : 'RULE-038');
    case 'checkpoint': return choose(naive ? opt(opts, /Stop at the sign/) : opt(opts, /Hold speed/), naive ? 'a checkpoint is where you check in' : 'RULE-003');
    case 'lost': return choose(naive ? opt(opts, /Keep going, it may/) : opt(opts, /Turn around/), naive ? 'roads usually rejoin' : 'RULE-034');
    case 'hazard': {
      const h = info.facts.join(' ');
      if (naive) return choose(opt(opts, /Wait it out, claim/), 'not my fault, claim it');
      const both = /Train|Accident/i.test(h) || /Tractor|Combine|Construction|School bus/i.test(h);
      return choose(both ? opt(opts, /Claim the measured/) : opt(opts, /make the time up/), both ? 'RULE-031 beyond control + RULE-033 odd seconds' : 'RULE-031 light: make it up');
    }
    case 'transitOut': {
      const m = /IN (\d+:\d\d:\d\d), take exactly (\d+m\d\ds)/.exec(p);
      const want = m ? fmt(hms(m[1]!) + parseIv(m[2]!)) : '';
      return choose(opts.find(x => x.label === want)?.id, `IN + interval = ${want}`);
    }
    case 'ta': {
      const m = /delayed (\d+m\d\ds)/.exec(p); const rec = /about (\d+) s of it could be made up/.exec(p);
      const meas = m ? parseIv(m[1]!) : 0;
      if (naive) { const ids = opts.map(x => ({ x, v: parseIv(x.label) || 0 })).sort((a, b) => b.v - a.v); return choose(ids[0]?.x.id, 'claim the most'); }
      const want = Math.floor((meas - (rec ? num(rec[1]) : 0)) / 10) * 10;
      const best = opts.map(x => ({ x, v: /No claim/.test(x.label) ? 0 : parseIv(x.label) })).sort((a, b) => Math.abs(a.v - want) - Math.abs(b.v - want))[0];
      return choose(best?.x.id, `RULE-033: ${meas} - ${rec?.[1] ?? 0} -> ${want}`);
    }
    case 'makeup': {
      const m = /You are (\d+) s (late|early)/.exec(p); const s = m ? num(m[1]) : 0;
      if (naive) return choose(opt(opts, /20 %/), 'fastest way back');
      return choose(s >= 15 ? opt(opts, /20 %/) : opt(opts, /10 %/), s >= 15 ? 'RULE-026 big chunk' : 'RULE-025');
    }
    case 'preread': {
      if (/Which way/.test(p)) return choose(o.turnFromOracle ? or?.optionId : opts[0]!.id, 'read the CAMEO arrow');
      if (/What speed/.test(p)) { const v = /(\d+) MPH/.exec(info.rowC)?.[1]; return choose(opt(opts, new RegExp(`^${v} mph`)), `Column C says ${v}`); }
      const pm = /pause (\d+) s/.exec(p); const pause = pm ? num(pm[1]) : 0;
      if (naive) return choose(opt(opts, new RegExp(`^Wait ${pause} s`)), 'the book says pause');
      const ch = /(\d+(?:\.\d)?) s/.exec(info.chartV)?.[1];
      if (ch) { const want = pause - num(ch); const best = opts.map(x => ({ x, v: /Go at once/.test(x.label) ? 0 : num(/Wait ([\d.]+)/.exec(x.label)?.[1]) })).sort((a, b) => Math.abs(a.v - want) - Math.abs(b.v - want))[0]; return choose(best?.x.id, `RULE-016 ${pause} - chart ${ch} = ${want.toFixed(1)}`); }
      const nonPrinted = opts.find(x => !new RegExp(`Wait ${pause} s|Go at once`).test(x.label)); return choose(nonPrinted?.id, 'RULE-016: not the printed pause (no chart shown)');
    }
    case 'turn': return choose(o.turnFromOracle ? or?.optionId : opts[0]!.id, 'read the CAMEO arrow');
    case 'pause': {
      const sit = /chart says sit ([\d.]+) s/.exec(p); const pm = /Pause (\d+) s/.exec(p);
      let t: number; let why: string;
      if (sit) { t = naive ? num(sit[1]) : Math.round(num(sit[1])); why = naive ? `the card says sit ${sit[1]}` : `RULE-017 rounded ${sit[1]}`; }
      else { t = num(pm?.[1] ?? 15); why = 'no chart on screen: printed pause'; }
      t += react(); c.action = `GO at ${t.toFixed(2)} s (${why})`;
      await tapAtElapsed(page, '[data-action=go]', t); return;
    }
    case 'restart': {
      const m = /your time (\d+:\d\d:\d\d)/.exec(p); const l = /standing-start loss ([\d.]+) s/.exec(p); const leave = /leave at (\d+:\d\d:\d\d)/.exec(p);
      let target: string; let why: string;
      if (leave) { target = leave[1]!; why = 'lunch: leave on the time'; }
      else if (naive) { target = m![1]!; why = 'tap on my time'; }
      else { const loss = l ? Math.round(num(l[1])) : 3; target = fmt(hms(m![1]!) - loss); why = `RULE-011 ${m![1]} - ${loss} s${l ? '' : ' (no loss shown; card example 3 s)'}`; }
      const r = react(); c.action = `LAUNCH when the TOD strip shows ${target} (+${r.toFixed(2)} s) (${why})`;
      const ok = await tapAtTod(page, '[data-action=go]', target, r);
      if (!ok) c.note = `TOD ${target} never appeared`;
      return;
    }
    case 'speedChange': {
      const ft = num(/(\d+) ft/.exec(info.facts.join(' '))?.[1] ?? /(\d+) ft ahead/.exec(p)?.[1]);
      const mph = num(/in (\d+)/.exec(info.facts.join(' '))?.[1]);
      const lead = /Lead ([\d.]+) s/.exec(p)?.[1];
      let t: number; let why: string;
      if (naive) { t = 4.5; why = 'no sign on screen: a guess, about when it feels close'; }
      else { t = ft / fps(mph) - (lead ? num(lead) : 2); why = `arithmetic: ${ft} ft / ${fps(mph).toFixed(1)} ft/s - lead ${lead ?? '2 (RULE-020)'}`; }
      t = Math.max(0.3, t) + react(); c.action = `CALL at ${t.toFixed(2)} s (${why})`;
      await tapAtElapsed(page, '.mob-actions [data-action=go]', t); return;
    }
    case 'timedStart': {
      const ft = num(/(\d+) ft/.exec(info.facts.join(' '))?.[1]); const mph = num(/in (\d+)/.exec(info.facts.join(' '))?.[1]);
      const iv = parseIv(p); const lead = /CALL \d+ ([\d.]+) s before/.exec(p)?.[1];
      let t1: number; let t2: number; let why: string;
      if (naive) { t1 = 2.5; t2 = t1 + iv; why = 'START after reading (no sign on screen), CALL when the watch shows the interval'; }
      else { t1 = ft / fps(Math.max(1, mph)); t2 = t1 + iv - (lead ? num(lead) : 2); why = `START at ${ft} ft / ${fps(mph).toFixed(1)} ft/s, CALL at START + ${iv} - ${lead ?? '2 (RULE-020)'}`; }
      t1 += react(); t2 += react(); c.action = `START ${t1.toFixed(2)} s, CALL ${t2.toFixed(2)} s (${why})`;
      await tapAtElapsed(page, '[data-action=startstop]', t1);
      await tapAtElapsed(page, '[data-action=lap]', t2); return;
    }
    default: return choose(opts[0]?.id, 'unknown kind: first option');
  }
}

export function summarize(log: RunLog): Record<string, unknown> {
  const dec = log.cards.filter(c => c.phase === 'decision');
  const taps = dec.map(c => c.tTap!).filter(Boolean);
  const gaps = taps.slice(1).map((t, i) => (t - taps[i]!) / 1000);
  const shownGaps = dec.slice(1).map((c, i) => (c.tShown - dec[i]!.tShown) / 1000);
  const wall = (log.tEnd - log.tStart) / 1000;
  const med = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : NaN; };
  return {
    label: log.label, policy: log.policy, wallSeconds: Math.round(wall), decisions: dec.length, rules: log.cards.filter(c => c.phase === 'rule').length,
    decisionsPerMinute: +(dec.length / (wall / 60)).toFixed(2), medianGapTapToTap: +med(gaps).toFixed(1), maxGap: +Math.max(...gaps).toFixed(1),
    medianGapCardToCard: +med(shownGaps).toFixed(1), correct: dec.filter(c => c.verdict?.correct).length,
    wordsBeforeFirstTap: dec.map(c => c.words), ruleWords: log.cards.filter(c => c.phase === 'rule').map(c => c.cardWords),
    maxTapToVerdictMs: Math.max(...dec.map(c => c.tapToVerdictMs ?? 0)), maxNextToCardMs: Math.max(...dec.map(c => c.nextToCardMs ?? 0)),
    medianOnCardSeconds: +med(dec.map(c => (c.tTap! - c.tShown) / 1000)).toFixed(1), recap: log.recap,
  };
}
