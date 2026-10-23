/** PT-13 session 3 (shared profile): find the School from the phone Home, tap a "Try it", play the skill run by the rules. */
import { open, shot, writeJson, geometry, screenWords, tapEl, sleep, BASE } from './pt13-common.js';
import { playRun, summarize, seedPlayer } from './pt13-player.js';

seedPlayer(31);
const h = await open(); const { page } = h;
await page.goto(`${BASE}/`); await page.waitForSelector('[data-screen=home]');
const homeLinks = await page.evaluate(() => [...document.querySelectorAll('.mob a, .mob button')].map(e => `${(e.textContent ?? '').trim()} -> ${(e as HTMLAnchorElement).getAttribute('href') ?? ''}`));
const schoolOnHome = homeLinks.some(l => /school(?!\/dad)/i.test(l) && !/Dad/.test(l));
// Reference: does it lead to the School?
await tapEl(page, '.mob a[href="#/reference"]'); await sleep(800);
const refLinks = await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => /school/.test(a.getAttribute('href') ?? '')).map(a => `${(a.textContent ?? '').trim()} -> ${a.getAttribute('href')}`).slice(0, 10));
const refGeo = await geometry(page);
const refSmall = await page.evaluate(() => { const out: string[] = []; for (const e of document.querySelectorAll('#app *')) { const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue; if (![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) out.push(`${e.tagName}.${(e as HTMLElement).className} ${fs}px "${(e.textContent ?? '').trim().slice(0, 25)}"`); } return { count: out.length, sample: out.slice(0, 8), hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
await shot(page, '20-reference-phone');
// the School by URL (Josh would have to know it, or go through Desk mode)
await page.goto(`${BASE}/#/school`); await sleep(800);
await shot(page, '21-school-phone');
const school = await page.evaluate(() => {
  const btn = document.querySelector('button.try-it') as HTMLElement | null; const r = btn?.getBoundingClientRect();
  // words before the first Try it in reading order
  let words = 0; const w = document.createTreeWalker(document.querySelector('#app')!, NodeFilter.SHOW_TEXT); let n: Node | null;
  while ((n = w.nextNode())) { const p = n.parentElement!; if (btn && (btn.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING || btn.contains(p))) break; const cs = getComputedStyle(p); if (cs.display === 'none' || p.closest('svg')) continue; words += (n.textContent ?? '').split(/\s+/).filter(x => /[A-Za-z0-9]/.test(x)).length; }
  const small: string[] = []; for (const e of document.querySelectorAll('#app *')) { const rr = e.getBoundingClientRect(); if (!rr.width || !rr.height) continue; if (![...e.childNodes].some(x => x.nodeType === 3 && (x.textContent ?? '').trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) small.push(`${e.tagName}.${(e as HTMLElement).className} ${fs}px "${(e.textContent ?? '').trim().slice(0, 25)}"`); }
  return { firstTry: btn ? { skill: btn.dataset.skill, top: Math.round(r!.top), h: Math.round(r!.height), w: Math.round(r!.width) } : null, tryCount: document.querySelectorAll('button.try-it').length, wordsBeforeFirstTry: words, scrollH: document.documentElement.scrollHeight, small: small.length, smallSample: [...new Set(small)].slice(0, 6), hscroll: document.documentElement.scrollWidth > innerWidth + 1, back: !!document.querySelector('.mob-back') && getComputedStyle(document.querySelector('.mob-back')!).display !== 'none' };
});
// Josh's weakest skill after the daily set is Start on time: tap its Try it
const sel = 'button.try-it[data-skill=startOnTime]';
await page.locator(sel).first().scrollIntoViewIfNeeded();
await tapEl(page, sel);
await page.waitForSelector('[data-screen=run]', { timeout: 15000 });
const url = page.url();
const run = await playRun(page, { policy: 'rules', label: 'School Try it: startOnTime', shotPrefix: '22-try', shotKinds: new Set(['rule', 'recap', 'verdict-right', 'verdict-wrong', 'clock', 'transitOut']), turnFromOracle: true, geometry: true });
const out = { homeLinks, schoolOnHome, refLinks, refGeo: { hscroll: refGeo.hscroll, tiny: refGeo.tiny }, refSmall, school, url, summary: summarize(run), run, errors: h.errors };
writeJson('s03-school', out);
console.log(JSON.stringify({ homeLinks, schoolOnHome, refLinks, refSmall, school, url, summary: out.summary, kinds: run.cards.map(c => c.kind), errors: h.errors }, null, 1));
await h.close();
