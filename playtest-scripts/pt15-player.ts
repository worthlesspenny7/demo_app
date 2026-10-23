/**
 * PT-15 human player for the phone decision mode (pt14-player.ts with the current brain). The card on screen is read from the DOM into a
 * Decision-shaped object (kind title, prompt, option buttons, Column C, the TOD strip, the sign bar's seconds, the cell behind "Chart" at
 * rung 1) and answered by the rule-card follower (pt15-follower.ts -> tests/pt14-follower.ts) or the naive rookie.
 * Option cards: a 2-3 s read, then a real tap. Timing cards are tapped from what the screen shows, in real time, with a 0.15-0.35 s
 * reaction: pause = the watch digits reach the rounded sit number; restart = the TOD digits show the launch second; speed change = the
 * bar's fill reaches the CALL tick (rung 2) or the lead before the sign (rung 1); timed start = START when "Mark!" shows, CALL when the
 * watch digits reach interval - lead (a compressed hold jumps the digits; the player just keeps watching them).
 * The oracle is logged, and used only as the arrow reader on turn / which-way cards.
 */
import type { Page } from 'playwright';
import type { Decision } from '../src/core/decision/index.js';
import { state, oracle, cardInfo, verdictInfo, screenWords, geometry, tapEl, tapAtElapsed, tapAtTod, shot, sleep } from './pt15-common.js';
import { follow, naive, face } from './pt15-follower.js';

export type Policy = 'naive' | 'rules';
export interface CardLog {
  i: number; kind: string; phase: 'rule' | 'decision'; tShown: number; tTap?: number; tVerdict?: number; tNext?: number;
  words: number; cardWords: number; prompt?: string; options?: string[]; action?: string; oracle?: unknown; timing?: any;
  verdict?: Awaited<ReturnType<typeof verdictInfo>>; note?: string; opened?: string; mark?: { signSeconds: number; markSeenAt: number | null };
  geo?: { hscroll: boolean; small: number; outOfZone: string[]; tiny: string[]; minFont: number }; ruleText?: string; ruleId?: string; n?: number; of?: number;
  dad?: string; skipSeen?: boolean; cardWall?: number; nextRuleFor?: string;
}
export interface RunLog { label: string; policy: Policy; tStart: number; tEnd: number; cards: CardLog[]; recap?: { sum: string; stars: number; worst: string[]; tally: string[] }; errors: string[] }

let rr = 1;
const rnd = (): number => { rr = (rr * 16807) % 2147483647; return (rr - 1) / 2147483646; };
export function seedPlayer(s: number): void { rr = s; }
const readPause = (): number => 2000 + Math.round(rnd() * 1000);
const react = (): number => 0.15 + rnd() * 0.2;
const hmsN = (s: string): number => { const [h, m, x] = s.split(':').map(Number); return h! * 3600 + m! * 60 + x!; };

export interface PlayOpts { policy: Policy; label: string; shotKinds?: Set<string>; ruleWpm?: number; verdictReadMs?: number; maxCards?: number; stopAfterDecisions?: number; geometry?: boolean; shotPrefix?: string; rung?: number; shotWrong?: boolean; shotVerdict?: boolean }

/** The card on screen as the follower's input (only what the screen shows). */
async function readDecision(page: Page, kind: string, c: CardLog, rung: number): Promise<Decision> {
  const info = await cardInfo(page);
  let chart: number | null = null;
  if (rung === 1 && await page.locator('.mchart-btn summary').count()) { await tapEl(page, '.mchart-btn summary'); c.opened = 'Chart'; await sleep(700); }
  const dom = await page.evaluate(() => ({
    chart: (() => { const e = document.querySelector('[data-chart-seconds]') as HTMLElement | null; if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? Number(e.dataset.chartSeconds) : null; })(),
    sign: (document.querySelector('[data-sign-seconds]') as HTMLElement | null)?.dataset.signSeconds ?? null,
    tod: (document.querySelector('.mw-tod')?.textContent ?? '').trim(),
    deadline: !!document.querySelector('.mob-deadline'),
  }));
  if (rung === 1) chart = dom.chart;
  const t = /(\d+:\d\d:\d\d)/.exec(dom.tod)?.[1];
  const d = { id: c.i.toString(), kind, skill: '', prompt: info.prompt, options: info.options.length ? info.options : undefined,
    context: { tod: t ? hmsN(t) : 0, elapsed: 0, row: { line: 0, odometer: '', miles: 0, columnB: [], columnC: [info.rowC], columnD: '' }, chart: chart !== null ? { kind: 'stopGo', vIn: 0, vOut: 0, seconds: chart } : null },
    ...(dom.sign !== null ? { timing: { kind: 'tapAt', truthSeconds: 0, toleranceSeconds: 0, maxSeconds: 0, tapLabel: '', signSeconds: Number(dom.sign) } } : {}),
    ...(dom.deadline ? { deadlineSeconds: 5 } : {}) } as unknown as Decision;
  (d as any).__chart = chart;
  return d;
}

/** Play the run on screen until the recap (or `stopAfterDecisions`). */
export async function playRun(page: Page, o: PlayOpts): Promise<RunLog> {
  const log: RunLog = { label: o.label, policy: o.policy, tStart: Date.now(), tEnd: 0, cards: [], errors: [] };
  let decisions = 0; const shotDone = o.shotKinds ?? new Set<string>(); let lastRule: string | null = null;
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
      c.tTap = await tapEl(page, '[data-action=ack]'); lastRule = ruleId;
      await page.waitForFunction(() => (window as any).__rally.decision.state().phase !== 'rule' || document.querySelector('[data-screen=recap]'), null, { timeout: 60000 }).catch(() => undefined);
      c.tNext = Date.now(); log.cards.push(c); continue;
    }
    if (st.phase === 'verdict') { await tapEl(page, '[data-action=next]'); await sleep(50); continue; }
    if (st.phase !== 'decision') { await sleep(50); continue; }
    const kind = st.kind!; const prompt = (await cardInfo(page)).prompt; const or = await oracle(page);
    const dad = await page.evaluate(() => (document.querySelector('[data-testid=driver-line]')?.textContent ?? '').trim());
    const c: CardLog = { i, kind, phase: 'decision', tShown, words: w.total, cardWords: w.card, prompt, oracle: or, timing: st.timing, n: st.n, of: st.of, dad, ...(geo ? { geo } : {}), ...(lastRule ? { nextRuleFor: lastRule } : {}) };
    lastRule = null;
    if (o.shotPrefix && !shotDone.has(kind)) { shotDone.add(kind); await shot(page, `${o.shotPrefix}-${kind}`); }
    await act(page, o, kind, prompt, or, c);
    c.tTap = Date.now(); c.cardWall = (c.tTap - tShown) / 1000;
    await page.waitForSelector('[data-testid=verdict]', { timeout: 150000 });
    c.tVerdict = Date.now();
    c.verdict = await verdictInfo(page);
    if (o.shotPrefix && o.shotVerdict && !shotDone.has('verdict')) { await sleep(300); shotDone.add('verdict'); await shot(page, `${o.shotPrefix}-verdict`); }
    else if (o.shotPrefix && (o.shotWrong ?? true) && !c.verdict.correct && !shotDone.has('verdict-wrong')) { await sleep(300); shotDone.add('verdict-wrong'); await shot(page, `${o.shotPrefix}-verdict-wrong-${kind}`); }
    decisions++;
    await sleep(o.verdictReadMs ?? (c.verdict.correct ? 2000 : 3000));
    const tN = await tapEl(page, '[data-action=next]');
    await page.waitForFunction(() => { const s = (window as any).__rally.decision.state(); return s.phase === 'decision' || s.phase === 'rule' || s.screen === 'recap'; }, null, { timeout: 120000 }).catch(() => undefined);
    c.tNext = tN;
    log.cards.push(c);
  }
  log.tEnd = Date.now();
  return log;
}

async function waitDigits(page: Page, target: number, max = 150): Promise<void> {
  await page.waitForFunction(t => { const s = (document.querySelector('[data-testid=watch-digits]')?.textContent ?? ''); const m = /(\d+):(\d\d(?:\.\d+)?)/.exec(s); const v = m ? Number(m[1]) * 60 + Number(m[2]) : -1; return v >= t || (window as any).__rally.decision.state().phase !== 'decision'; }, target, { polling: 'raf', timeout: max * 1000 });
}
const stillOpen = (page: Page): Promise<boolean> => page.evaluate(() => (window as any).__rally.decision.state().phase === 'decision');

async function act(page: Page, o: PlayOpts, kind: string, prompt: string, or: any, c: CardLog): Promise<void> {
  const rung = o.rung ?? 2;
  const d = await readDecision(page, kind, c, rung);
  const arrow = kind === 'turn' || (kind === 'preread' && /Which way/.test(prompt)) ? or?.optionId : undefined;
  const brain = o.policy === 'rules' ? follow : naive;
  let a; try { a = brain(d, { react: () => 0, arrow, chart: (d as any).__chart }); } catch (e) { c.note = `brain could not answer from the screen: ${String((e as Error).message)}`; a = { optionId: d.options?.[0]?.id }; }
  c.action = JSON.stringify(a);
  if (a.optionId !== undefined) {
    await sleep(kind === 'turn' ? 1500 : readPause());
    if (!(await stillOpen(page))) { c.note = 'card timed out during the read pause'; return; }
    await tapEl(page, `.mob-actions [data-option="${a.optionId}"]`); return;
  }
  // skip note seen?
  void page.waitForFunction(() => { const e = document.querySelector('[data-testid=skip-note]') as HTMLElement | null; return !!e && !e.hidden; }, null, { polling: 'raf', timeout: 120000 }).then(() => { c.skipSeen = true; }).catch(() => undefined);
  if (kind === 'restart' && a.tapSeconds !== undefined) {
    const target = face(d.context.tod + a.tapSeconds);
    const ok = await tapAtTod(page, '[data-action=go]', target, react()); if (!ok) c.note = `TOD ${target} never appeared`; return;
  }
  if (kind === 'pause' && a.tapSeconds !== undefined) { await waitDigits(page, Math.max(0, a.tapSeconds)); await sleep(react() * 1000); if (await stillOpen(page)) await tapEl(page, '[data-action=go]'); return; }
  if (kind === 'timedStart' && a.taps) {
    const markAt = await page.waitForFunction(() => /Mark/.test(document.querySelector('[data-testid=mark]')?.textContent ?? '') || (window as any).__rally.decision.state().phase !== 'decision', null, { polling: 'raf', timeout: 60000 }).then(() => page.evaluate(() => (window as any).__rally.decision.elapsed())).catch(() => null);
    c.mark = { signSeconds: d.timing?.signSeconds ?? -1, markSeenAt: markAt };
    await sleep(react() * 1000); await tapEl(page, '[data-action=startstop]');
    await waitDigits(page, Math.max(0.5, a.taps[1] - a.taps[0])); await sleep(react() * 1000);
    if (!(await stillOpen(page))) { c.note = 'the card closed before the watch reached the CALL reading it asks for'; return; }
    await tapEl(page, '[data-action=lap]'); return;
  }
  if (kind === 'speedChange' && a.tapSeconds !== undefined) {
    if (o.policy === 'naive') {
      const markAt = await page.waitForFunction(() => /Mark/.test(document.querySelector('[data-testid=mark]')?.textContent ?? '') || (window as any).__rally.decision.state().phase !== 'decision', null, { polling: 'raf', timeout: 60000 }).then(() => page.evaluate(() => (window as any).__rally.decision.elapsed())).catch(() => null);
      c.mark = { signSeconds: d.timing?.signSeconds ?? -1, markSeenAt: markAt }; await sleep(react() * 1000); await tapEl(page, '.mob-actions [data-action=go]'); return;
    }
    const hasTick = await page.locator('.msign-call').count();
    if (hasTick) {
      await page.waitForFunction(() => { const f = document.querySelector('.msign-fill') as HTMLElement | null; const t = document.querySelector('.msign-call') as HTMLElement | null; if (!f || !t) return true; return parseFloat(f.style.width) <= parseFloat(t.style.left) || (window as any).__rally.decision.state().phase !== 'decision'; }, null, { polling: 'raf', timeout: 60000 }).catch(() => undefined);
      await sleep(react() * 1000); await tapEl(page, '.mob-actions [data-action=go]');
    } else await tapAtElapsed(page, '.mob-actions [data-action=go]', a.tapSeconds + react());
    return;
  }
  if (a.tapSeconds !== undefined) { await tapAtElapsed(page, '[data-action=go]', a.tapSeconds + react()); return; }
}

export function summarize(log: RunLog): Record<string, unknown> {
  const dec = log.cards.filter(c => c.phase === 'decision');
  const taps = dec.map(c => c.tTap!).filter(Boolean);
  const gaps = taps.slice(1).map((t, i) => (t - taps[i]!) / 1000);
  const wall = (log.tEnd - log.tStart) / 1000;
  const q = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo]! + (s[hi]! - s[lo]!) * (k - lo); };
  return {
    label: log.label, policy: log.policy, wallSeconds: Math.round(wall), decisions: dec.length, rules: log.cards.filter(c => c.phase === 'rule').map(c => c.ruleId).join(','),
    decisionsPerMinute: +(dec.length / (wall / 60)).toFixed(2), medianGap: +q(gaps, 0.5).toFixed(1), p75Gap: +q(gaps, 0.75).toFixed(1), maxGap: +Math.max(...gaps).toFixed(1), over15: gaps.filter(g => g > 15).length,
    correct: dec.filter(c => c.verdict?.correct).length, kinds: dec.map(c => c.kind).join(','), words: dec.map(c => c.words), maxWords: Math.max(...dec.map(c => c.words)), ruleWords: log.cards.filter(c => c.phase === 'rule').map(c => c.words),
    ruleThen: dec.filter(c => c.nextRuleFor).map(c => `${c.nextRuleFor}->${c.kind}: ${c.prompt?.slice(0, 50)}`),
    cardWall: dec.map(c => `${c.kind}:${c.cardWall?.toFixed(1)}`).join(' '), skips: dec.filter(c => c.skipSeen).map(c => `${c.kind} ${c.cardWall?.toFixed(1)} s`),
    wrong: dec.filter(c => !c.verdict?.correct).map(c => `${c.kind}: ${c.prompt} -> ${c.verdict?.head} ${c.verdict?.sec} | ${c.action} ${c.note ?? ''}`),
    notes: dec.filter(c => c.note).map(c => `${c.kind}: ${c.note}`),
    geoBad: dec.filter(c => c.geo && (c.geo.hscroll || c.geo.small || c.geo.tiny.length || c.geo.outOfZone.length)).map(c => `${c.kind}: ${JSON.stringify(c.geo)}`).slice(0, 5),
    recap: log.recap, ofSeries: dec.map(c => `${c.n}/${c.of}`).join(' '),
  };
}
