/**
 * PT-14 human player for the phone decision mode: the PT-13 player (pt13-player.ts) with the brain swapped for pt14-follower.ts.
 * Option cards: a 2-3 s read pause, then a real tap. Timing cards are tapped from what the screen shows, in real time:
 *   pause: the watch digits reach the rounded "sit" number; restart: the TOD digits show the launch second; speed change: the sign bar's
 *   fill reaches the call tick (rung 2) or the lead before the sign (rung 1, chart opened); timed start: START when "Mark!" appears,
 *   CALL when the watch digits reach interval - lead. A 0.15-0.35 s reaction is added to every timed tap.
 * When a card's number sits behind "details" or the Chart button the player taps it open first (a real tap, counted in the time).
 * The oracle is logged, and used only as the arrow reader on turn / which-way cards.
 */
import type { Page } from 'playwright';
import { state, oracle, cardInfo, verdictInfo, screenWords, geometry, tapEl, tapAtElapsed, tapAtTod, shot, sleep } from './pt14-common.js';
import { follow, naive, type Screen, type Action } from './pt14-follower.js';

export type Policy = 'naive' | 'rules';
export interface CardLog {
  i: number; kind: string; phase: 'rule' | 'decision'; tShown: number; tTap?: number; tVerdict?: number; tNext?: number;
  words: number; cardWords: number; prompt?: string; options?: string[]; action?: string; oracle?: unknown; timing?: unknown;
  verdict?: Awaited<ReturnType<typeof verdictInfo>>; note?: string; opened?: string; mark?: { signSeconds: number; markSeenAt: number | null };
  geo?: { hscroll: boolean; small: number; outOfZone: string[]; tiny: string[]; minFont: number }; ruleText?: string; ruleId?: string; n?: number; of?: number; tapToVerdictMs?: number; nextToCardMs?: number;
}
export interface RunLog { label: string; policy: Policy; tStart: number; tEnd: number; cards: CardLog[]; recap?: { sum: string; stars: number; worst: string[]; tally: string[] }; errors: string[] }

let rr = 1;
const rnd = (): number => { rr = (rr * 16807) % 2147483647; return (rr - 1) / 2147483646; };
export function seedPlayer(s: number): void { rr = s; }
const readPause = (): number => 2000 + Math.round(rnd() * 1000);
const react = (): number => 0.15 + rnd() * 0.2;
const iv = (s: string): number => { const m = /(\d+)m(\d\d(?:\.\d+)?)s/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const digits = (s: string): number => { const m = /(\d+):(\d\d(?:\.\d+)?)/.exec(s); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };

export interface PlayOpts { policy: Policy; label: string; shotKinds?: Set<string>; ruleWpm?: number; verdictReadMs?: number; maxCards?: number; stopAfterDecisions?: number; geometry?: boolean; shotPrefix?: string; rung?: number }

async function readScreen(page: Page, kind: string, prompt: string, c: CardLog, needChart: boolean): Promise<Screen> {
  const info = await cardInfo(page);
  if (needChart) {
    const sel = await page.evaluate(() => document.querySelector('.mchart-btn summary') ? '.mchart-btn summary' : document.querySelector('.mdetails summary') ? '.mdetails summary' : null);
    if (sel) { await tapEl(page, sel); c.opened = sel.includes('chart') ? 'Chart' : 'details'; await sleep(900); }
  }
  const dom = await page.evaluate(() => ({
    chart: (document.querySelector('[data-chart-seconds]') as HTMLElement | null)?.dataset.chartSeconds ?? null,
    chartVisible: (() => { const e = document.querySelector('[data-chart-seconds]'); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
    sign: (document.querySelector('[data-sign-seconds]') as HTMLElement | null)?.dataset.signSeconds ?? null,
    lap: (document.querySelector('.mwc-lap')?.textContent ?? '').trim(),
  }));
  return { kind, prompt, rowC: info.rowC, options: info.options, chart: dom.chart !== null && dom.chartVisible ? Number(dom.chart) : null, sign: dom.sign !== null ? Number(dom.sign) : null, lapCum: dom.lap ? iv(dom.lap) : null };
}

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
    if (o.geometry) { const g = await geometry(page); geo = { hscroll: g.hscroll, small: g.small.length, outOfZone: g.controls.filter(c => !c.inBottom40 && !/×|Home|details|Chart|source/.test(c.label) && c.label !== '').map(c => `${c.label}@${c.top}`), tiny: g.tiny, minFont: g.minFont }; }
    if (st.phase === 'rule') {
      const ruleId = await page.evaluate(() => (document.querySelector('[data-rule]') as HTMLElement | null)?.dataset.rule ?? '');
      const c: CardLog = { i, kind: 'rule', phase: 'rule', tShown, words: w.total, cardWords: w.card, ruleText: w.cardText, ruleId, n: st.n, of: st.of, ...(geo ? { geo } : {}) };
      if (o.shotPrefix && !shotDone.has('rule')) { shotDone.add('rule'); await shot(page, `${o.shotPrefix}-rule-card`); }
      await sleep(Math.max(2500, (w.card / (o.ruleWpm ?? 230)) * 60_000));
      c.tTap = await tapEl(page, '[data-action=ack]');
      await page.waitForFunction(() => (window as any).__rally.decision.state().phase !== 'rule' || document.querySelector('[data-screen=recap]'), null, { timeout: 60000 }).catch(() => undefined);
      c.tNext = Date.now(); log.cards.push(c); continue;
    }
    if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(50); continue; }
    if (st.phase !== 'decision') { await sleep(50); continue; }
    const kind = st.kind!; const prompt = (await cardInfo(page)).prompt; const or = await oracle(page);
    const c: CardLog = { i, kind, phase: 'decision', tShown, words: w.total, cardWords: w.card, prompt, oracle: or, timing: st.timing, n: st.n, of: st.of, ...(geo ? { geo } : {}) };
    if (o.shotPrefix && !shotDone.has(kind)) { shotDone.add(kind); await shot(page, `${o.shotPrefix}-${kind}`); }
    await act(page, o, kind, prompt, or, c);
    c.tTap = Date.now();
    await page.waitForSelector('[data-testid=verdict]', { timeout: 150000 });
    c.tVerdict = Date.now(); c.tapToVerdictMs = c.tVerdict - c.tTap;
    c.verdict = await verdictInfo(page);
    if (o.shotPrefix) await sleep(350);
    if (o.shotPrefix && !c.verdict.correct && !shotDone.has('verdict-wrong')) { shotDone.add('verdict-wrong'); await shot(page, `${o.shotPrefix}-verdict-wrong-${kind}`); }
    else if (o.shotPrefix && c.verdict.correct && !shotDone.has('verdict-right')) { shotDone.add('verdict-right'); await shot(page, `${o.shotPrefix}-verdict-right-${kind}`); }
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

async function waitDigits(page: Page, target: number, max = 150): Promise<void> {
  await page.waitForFunction(t => { const s = (document.querySelector('[data-testid=watch-digits]')?.textContent ?? ''); const m = /(\d+):(\d\d(?:\.\d+)?)/.exec(s); const v = m ? Number(m[1]) * 60 + Number(m[2]) : -1; return v >= t || (window as any).__rally.decision.state().phase !== 'decision'; }, target, { polling: 'raf', timeout: max * 1000 });
}

async function act(page: Page, o: PlayOpts, kind: string, prompt: string, or: any, c: CardLog): Promise<void> {
  const rung = o.rung ?? 2;
  // the follower needs the chart cell when the prompt does not carry its number
  const needChart = o.policy === 'rules' && ((kind === 'preread' && /How long/.test(prompt)) || kind === 'watch' || (rung <= 1 && ['pause', 'restart', 'speedChange', 'timedStart'].includes(kind)));
  const scr = await readScreen(page, kind, prompt, c, needChart);
  if (kind === 'turn' || (kind === 'preread' && /Which way/.test(prompt))) scr.arrow = or?.optionId;
  const a: Action = o.policy === 'rules' ? follow(scr, react) : naive(scr, react);
  c.action = JSON.stringify(a);
  if ('optionId' in a) {
    await sleep(readPause());
    if (await page.evaluate(() => (window as any).__rally.decision.state().phase) !== 'decision') { c.note = 'card timed out during the read pause'; return; }
    await tapEl(page, `.mob-actions [data-option="${a.optionId}"]`); return;
  }
  if ('tod' in a) { const ok = await tapAtTod(page, '[data-action=go]', a.tod, a.react); if (!ok) c.note = `TOD ${a.tod} never appeared`; return; }
  if (kind === 'pause' && 'tap' in a) {
    // watch the digits run from the stop to the rounded sit number, then GO
    const target = a.tap - 0.25; await waitDigits(page, Math.max(0, Math.round(target))); await sleep(react() * 1000); await tapEl(page, '[data-action=go]'); return;
  }
  if (kind === 'timedStart' && 'taps' in a) {
    const seg = iv(/before the (\d+m\d\ds) ends/.exec(prompt)?.[1] ?? ''); const L = (a.taps[1] - a.taps[0]);   // the follower's call offset (seg - lead + react)
    const markAt = await page.waitForFunction(() => /Mark/.test(document.querySelector('[data-testid=mark]')?.textContent ?? '') || (window as any).__rally.decision.state().phase !== 'decision', null, { polling: 'raf', timeout: 60000 }).then(() => page.evaluate(() => (window as any).__rally.decision.elapsed())).catch(() => null);
    c.mark = { signSeconds: scr.sign ?? -1, markSeenAt: markAt };
    if (o.policy === 'naive') { await sleep(react() * 1000); await tapEl(page, '[data-action=startstop]'); await waitDigits(page, seg); await sleep(react() * 1000); await tapEl(page, '[data-action=lap]'); return; }
    await sleep(react() * 1000); await tapEl(page, '[data-action=startstop]');
    await waitDigits(page, Math.max(0.5, L - 0.25)); await sleep(react() * 1000);
    if (await page.evaluate(() => (window as any).__rally.decision.state().phase) !== 'decision') { c.note = 'the card ended (its maxSeconds) before the watch reached the CALL reading the card asks for'; return; }
    await tapEl(page, '[data-action=lap]');
    void seg; return;
  }
  if (kind === 'speedChange' && 'tap' in a) {
    if (o.policy === 'naive') {
      const markAt = await page.waitForFunction(() => /Mark/.test(document.querySelector('[data-testid=mark]')?.textContent ?? '') || (window as any).__rally.decision.state().phase !== 'decision', null, { polling: 'raf', timeout: 60000 }).then(() => page.evaluate(() => (window as any).__rally.decision.elapsed())).catch(() => null);
      c.mark = { signSeconds: scr.sign ?? -1, markSeenAt: markAt }; await sleep(react() * 1000); await tapEl(page, '.mob-actions [data-action=go]'); return;
    }
    // rung 2: the fill reaches the call tick; rung 1: the lead before the sign (same moment)
    const hasTick = await page.locator('.msign-call').count();
    if (hasTick) await page.waitForFunction(() => { const f = document.querySelector('.msign-fill') as HTMLElement | null; const t = document.querySelector('.msign-call') as HTMLElement | null; if (!f || !t) return true; return parseFloat(f.style.width) <= parseFloat(t.style.left) || (window as any).__rally.decision.state().phase !== 'decision'; }, null, { polling: 'raf', timeout: 60000 }).catch(() => undefined);
    if (!hasTick) await tapAtElapsed(page, '.mob-actions [data-action=go]', a.tap); else { await sleep(react() * 1000); await tapEl(page, '.mob-actions [data-action=go]'); }
    return;
  }
  if ('tap' in a) { await tapAtElapsed(page, '[data-action=go]', a.tap); return; }
}

export function summarize(log: RunLog): Record<string, unknown> {
  const dec = log.cards.filter(c => c.phase === 'decision');
  const taps = dec.map(c => c.tTap!).filter(Boolean);
  const gaps = taps.slice(1).map((t, i) => (t - taps[i]!) / 1000);
  const wall = (log.tEnd - log.tStart) / 1000;
  const q = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo]! + (s[hi]! - s[lo]!) * (k - lo); };
  return {
    label: log.label, policy: log.policy, wallSeconds: Math.round(wall), decisions: dec.length, rules: log.cards.filter(c => c.phase === 'rule').length,
    decisionsPerMinute: +(dec.length / (wall / 60)).toFixed(2), medianGap: +q(gaps, 0.5).toFixed(1), p75Gap: +q(gaps, 0.75).toFixed(1), maxGap: +Math.max(...gaps).toFixed(1),
    correct: dec.filter(c => c.verdict?.correct).length, kinds: dec.map(c => c.kind).join(','), words: dec.map(c => c.words), ruleWords: log.cards.filter(c => c.phase === 'rule').map(c => c.words),
    wrong: dec.filter(c => !c.verdict?.correct).map(c => `${c.kind}: ${c.prompt} -> ${c.verdict?.head} ${c.verdict?.sec} | ${c.action}`),
    recap: log.recap, ofSeries: dec.map(c => `${c.n}/${c.of}`).join(' '),
  };
}
