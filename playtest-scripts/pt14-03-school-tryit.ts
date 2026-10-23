/** PT-14 session 3 (shared profile, replay of pt13-03 for every skill): reach the School from the phone Home, measure it and Reference,
 *  then tap "Try it" once per skill and play each skill run by the rule cards. */
import { open, shot, writeJson, geometry, tapEl, sleep, BASE } from './pt14-common.js';
import { playRun, summarize, seedPlayer } from './pt14-player.js';

seedPlayer(33);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const homeLinks = await page.evaluate(() => [...document.querySelectorAll('.mob a, .mob button')].map(e => `${(e.textContent ?? '').trim()} -> ${(e as HTMLAnchorElement).getAttribute('href') ?? ''}`));
const schoolLink = await page.evaluate(() => { const e = document.querySelector('[data-testid=school]'); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), belowFold: r.top > innerHeight }; });
const small = () => page.evaluate(() => { const out: string[] = []; for (const e of document.querySelectorAll('#app *')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) out.push(`${e.tagName}.${(e as HTMLElement).className} ${fs}px "${(e.textContent ?? '').trim().slice(0, 25)}"`); } const cut = [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2 && (e.textContent ?? '').trim().length > 0; }).length; return { count: out.length, sample: [...new Set(out)].slice(0, 6), hscroll: document.documentElement.scrollWidth > innerWidth + 1, cutOffRight: cut, scrollH: document.documentElement.scrollHeight }; });
// Reference
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
await tapEl(page, '.mob a[href="#/reference"]'); await sleep(900);
const ref = await small();
await shot(page, '20-reference-phone');
// School from the Home link
await page.goto(`${BASE}/#/m`); await page.waitForSelector('[data-screen=home]');
await page.locator('[data-testid=school]').scrollIntoViewIfNeeded();
await tapEl(page, '[data-testid=school]'); await sleep(900);
const school = { ...(await small()), tryCount: await page.locator('button.try-it').count(), firstTry: await page.evaluate(() => { const b = document.querySelector('button.try-it') as HTMLElement | null; const r = b?.getBoundingClientRect(); return b ? { skill: b.dataset.skill, top: Math.round(r!.top), h: Math.round(r!.height), w: Math.round(r!.width) } : null; }) };
await shot(page, '21-school-phone');
const runs: unknown[] = []; const sums: unknown[] = [];
for (const sk of ['startOnTime', 'safetyCourse', 'stayOnTime', 'recovery', 'instruments']) {
  await page.goto(`${BASE}/#/school`); await sleep(700);
  const sel = `button.try-it[data-skill=${sk}]`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await tapEl(page, sel);
  await page.waitForSelector('[data-screen=run], [data-screen=confirm]', { timeout: 15000 });
  if (await page.locator('[data-screen=confirm]').count()) { await tapEl(page, '[data-testid=start-over]'); await page.waitForSelector('[data-screen=run]'); }
  const run = await playRun(page, { policy: 'rules', label: `School Try it: ${sk}`, shotPrefix: sk === 'startOnTime' ? '22-try' : sk === 'instruments' ? '23-try' : undefined, shotKinds: new Set(['recap', 'verdict-right', 'verdict-wrong']), geometry: true });
  runs.push(run); sums.push(summarize(run));
}
const out = { homeLinks, schoolLink, ref, school, summaries: sums, runs, errors: h.errors };
writeJson('s03-school', out);
console.log(JSON.stringify({ homeLinks, schoolLink, ref, school, summaries: sums, errors: h.errors }, null, 1));
await h.close();
