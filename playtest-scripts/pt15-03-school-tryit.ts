/** PT-15 session 3 (shared profile, replay of pt14-03): Reference and School on the phone (closed, then every section open: text under
 *  16 px, horizontal scroll, page height, tables that scroll inside), then "Try it" once per skill from the School (opening the skill's
 *  section with a real tap when it is closed), each skill run played by the rule cards. */
import { open, shot, writeJson, tapEl, sleep, BASE } from './pt15-common.js';
import { playRun, summarize, seedPlayer } from './pt15-player.js';
import type { Page } from 'playwright';

seedPlayer(153);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const schoolLink = await page.evaluate(() => { const e = document.querySelector('[data-testid=school]'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), belowFold: r.top > innerHeight }; });
const measure = (p: Page) => p.evaluate(() => {
  const out: string[] = [];
  for (const e of document.querySelectorAll('#app *')) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (e.closest('svg')) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden') continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue;
    const fs = parseFloat(cs.fontSize); if (fs < 15.99) out.push(`${e.tagName}.${(e as HTMLElement).className} ${fs}px "${(e.textContent ?? '').trim().slice(0, 25)}"`);
  }
  const cut = [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.right > innerWidth + 2 && (e.textContent ?? '').trim().length > 0)) return false; for (let a = e.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; } return true; }).length;
  const innerScroll = [...document.querySelectorAll('#app *')].filter(e => { const o = getComputedStyle(e).overflowX; return (o === 'auto' || o === 'scroll') && (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1; }).length;
  const secs = document.querySelectorAll('details').length; const openSecs = [...document.querySelectorAll('details')].filter(d => (d as HTMLDetailsElement).open).length;
  const tapSmall = [...document.querySelectorAll('#app summary, #app button, #app a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44); }).length;
  return { small: out.length, sample: [...new Set(out)].slice(0, 6), hscroll: document.documentElement.scrollWidth > innerWidth + 1, cutOffRight: cut, innerScroll, scrollH: document.documentElement.scrollHeight, details: secs, open: openSecs, tapUnder44: tapSmall };
});
const openAll = (p: Page) => p.evaluate(() => { for (const d of document.querySelectorAll('details')) (d as HTMLDetailsElement).open = true; });
// Reference
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
await tapEl(page, '.mob a[href="#/reference"]'); await sleep(900);
const refClosed = await measure(page);
const refTop = await page.evaluate(() => [...document.querySelectorAll('summary')].slice(0, 30).map(s => (s.textContent ?? '').trim().slice(0, 40)));
await shot(page, '20-reference-phone');
// open the TA section with a real tap, as Josh would look up the TA causes
const taSummary = await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /regulation|time allowance|rules/i.test(x.textContent ?? '')); if (!s) return null; (s as HTMLElement).scrollIntoView({ block: 'center' }); return (s.textContent ?? '').trim(); });
if (taSummary) { const loc = page.locator('summary', { hasText: taSummary.slice(0, 20) }).first(); const b = await loc.boundingBox(); if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(600); await shot(page, '21-reference-section-open'); }
const refOneOpen = await measure(page);
await openAll(page); await sleep(500);
const refAll = await measure(page);
// School from the Home link
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
await page.locator('[data-testid=school]').scrollIntoViewIfNeeded();
await tapEl(page, '[data-testid=school]'); await sleep(900);
const schoolClosed = { ...(await measure(page)), tryCount: await page.locator('button.try-it').count(), visibleTry: await page.locator('button.try-it:visible').count(), groups: await page.evaluate(() => [...document.querySelectorAll('details.school-sec > summary')].map(s => (s.textContent ?? '').trim())) };
await shot(page, '22-school-phone');
await openAll(page); await sleep(400);
const schoolAll = await measure(page);
const runs: unknown[] = []; const sums: unknown[] = []; const reach: unknown[] = [];
for (const sk of ['startOnTime', 'safetyCourse', 'stayOnTime', 'recovery', 'instruments']) {
  await page.goto(`${BASE}/#/school`); await sleep(700);
  const sel = `button.try-it[data-skill=${sk}]`;
  let taps = 0;
  const closed = await page.evaluate(s => { const b = document.querySelector(s); const d = b?.closest('details') as HTMLDetailsElement | null; return d && !d.open ? true : false; }, sel);
  if (closed) {
    const sumSel = await page.evaluate(s => { const b = document.querySelector(s)!; const d = b.closest('details')!; const all = [...document.querySelectorAll('details.school-sec')]; return `details.school-sec:nth-of-type(${all.indexOf(d) + 1}) > summary`; }, sel);
    const idx = await page.evaluate(s => { const b = document.querySelector(s)!; const d = b.closest('details')!; return [...document.querySelectorAll('details.school-sec')].indexOf(d); }, sel);
    const loc = page.locator('details.school-sec > summary').nth(idx); await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); if (bb) { await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); taps++; } await sleep(400); void sumSel;
  }
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await tapEl(page, sel); taps++;
  await page.waitForSelector('[data-screen=run], [data-screen=confirm]', { timeout: 15000 });
  if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
  reach.push({ sk, sectionWasClosed: closed, taps });
  const run = await playRun(page, { policy: 'rules', label: `School Try it: ${sk}`, shotPrefix: sk === 'startOnTime' ? '23-try' : undefined, shotKinds: new Set(['recap', 'verdict-right', 'verdict-wrong', 'rule', 'transitOut', 'clock', 'ta']), geometry: true });
  runs.push(run); sums.push(summarize(run));
}
const out = { schoolLink, refClosed, refTop, taSummary, refOneOpen, refAll, schoolClosed, schoolAll, reach, summaries: sums, runs, errors: h.errors };
writeJson('s03-school', out);
console.log(JSON.stringify({ schoolLink, refClosed, refTop, taSummary, refOneOpen, refAll, schoolClosed, schoolAll, reach, summaries: sums, errors: h.errors }, null, 1));
await h.close();
