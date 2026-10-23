/** PT-13 session 1 (fresh shared profile): open the app as Josh, do what the screen says; Daily run 1 naive, runs 2 and 3 by the rule cards. */
import { open, shot, writeJson, screenWords, geometry, tapEl, sleep, BASE } from './pt13-common.js';
import { playRun, summarize, seedPlayer, type RunLog } from './pt13-player.js';

seedPlayer(13);
const h = await open({ fresh: true });
const { page } = h;
const timeline: { t: number; what: string }[] = [];
const t0 = Date.now(); const mark = (what: string): void => { timeline.push({ t: +((Date.now() - t0) / 1000).toFixed(2), what }); };
await page.goto(`${BASE}/`);
await page.waitForSelector('[data-screen=home]'); mark('home visible');
const homeWords = await screenWords(page); const homeGeo = await geometry(page);
await shot(page, '01-home-first-open');
const homeFull = await page.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, vh: innerHeight, hint: document.querySelector('[data-testid=a2hs-hint]')?.textContent ?? null, daily: document.querySelector('[data-testid=play-daily]')?.getBoundingClientRect().top }));
await sleep(1500);   // finds the big yellow button
await tapEl(page, '[data-testid=play-daily]'); mark('tapped Play daily run 1');
const shotKinds = new Set<string>();
const logs: RunLog[] = [];
const r1 = await playRun(page, { policy: 'naive', label: 'daily-1 naive', shotPrefix: '02-d1', shotKinds, geometry: true, turnFromOracle: true, ruleWpm: 2000 });   // first run: Josh glances at a rule card and taps Got it (about 2.5 s); he reads nothing optional
logs.push(r1);
const firstDec = r1.cards.find(c => c.phase === 'decision')!;
timeline.push({ t: +((firstDec.tShown - t0) / 1000).toFixed(2), what: `first decision card shown (${firstDec.kind})` });
timeline.push({ t: +((firstDec.tTap! - t0) / 1000).toFixed(2), what: 'first decision tapped' });
const within60 = r1.cards.filter(c => c.tShown - t0 <= 60_000).map(c => `${((c.tShown - t0) / 1000).toFixed(1)}s ${c.phase === 'rule' ? 'RULE' : c.kind}${c.verdict ? (c.verdict.correct ? ' right' : ' wrong') : ''}`);
// back to Home after the recap (what Josh sees), then runs 2 and 3 by the rules
for (const k of [2, 3]) {
  await page.locator('[data-action=next-run]').waitFor();
  if (k === 3) await shot(page, `0${k + 1}-recap-before-run${k}`).catch(() => undefined);   // the recap before run 2 is pt13-02-d1-recap.png
  await tapEl(page, '[data-action=next-run]');
  await page.waitForSelector('[data-screen=run]');
  logs.push(await playRun(page, { policy: 'rules', label: `daily-${k} rules`, shotPrefix: k === 2 ? '03-d2' : undefined, shotKinds, geometry: true, turnFromOracle: true, ruleWpm: 200 }));
}
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
await shot(page, '05-home-after-daily');
const homeAfter = await page.evaluate(() => ({ streak: document.querySelector('[data-testid=streak]')?.textContent, pills: [...document.querySelectorAll('.mob-pill')].map(e => e.textContent), meters: [...document.querySelectorAll('.mob-meter')].map(e => (e.textContent ?? '').replace(/\s+/g, ' ').trim()), daily: document.querySelector('[data-testid=play-daily]')?.textContent, boss: document.querySelector('[data-testid=boss], [data-testid=boss-locked]')?.textContent, legal: [...document.querySelectorAll('[data-legal]')].map(e => (e as HTMLElement).dataset.legal) }));
const out = { timeline, within60, homeWords: homeWords.total, homeText: homeWords.text, homeGeo, homeFull, homeAfter, summaries: logs.map(summarize), logs, errors: h.errors };
writeJson('s01-first-and-daily', out);
console.log(JSON.stringify({ timeline, within60, homeWords: homeWords.total, homeFull, homeAfter, summaries: out.summaries, errors: h.errors }, null, 1));
await h.close();
