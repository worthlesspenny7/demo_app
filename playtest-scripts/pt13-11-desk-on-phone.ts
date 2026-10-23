/** PT-13: Desk mode at 390x844 (throwaway profile), for the "beats Desk mode for a few minutes on a phone" judgement. */
process.env.PT13_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt13-desk';
const { open, shot, writeJson, sleep, BASE } = await import('./pt13-common.js');
const h = await open({ fresh: true }); const { page } = h;
const t0 = Date.now();
await page.goto(`${BASE}/?mode=desk#/`); await sleep(1200);
const home = await page.evaluate(() => {
  const vis = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  let small = 0; for (const e of document.querySelectorAll('#app *')) { if (!vis(e) || ![...e.childNodes].some(n => n.nodeType === 3 && (n.textContent ?? '').trim())) continue; if (parseFloat(getComputedStyle(e).fontSize) < 16) small++; }
  const words = (document.querySelector('#app')?.textContent ?? '').split(/\s+/).filter(x => /[A-Za-z0-9]/.test(x)).length;
  const playable = [...document.querySelectorAll('.card.playable')].slice(0, 3).map(e => (e.textContent ?? '').trim().slice(0, 60));
  return { hscroll: document.documentElement.scrollWidth > innerWidth + 1, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, small, words, playable };
});
await shot(page, '80-desk-home-phone');
// open the first drill
const first = page.locator('.card.playable').first();
let drill: unknown = null;
if (await first.count()) {
  await first.click(); await sleep(1500);
  drill = await page.evaluate(() => ({ url: location.hash, hscroll: document.documentElement.scrollWidth > innerWidth + 1, scrollW: document.documentElement.scrollWidth, words: (document.querySelector('#app')?.textContent ?? '').split(/\s+/).filter(x => /[A-Za-z0-9]/.test(x)).length, buttons: [...document.querySelectorAll('#app button')].filter(b => (b as HTMLElement).offsetParent).length }));
  // (the card click does not navigate on its own; no second screenshot)
}
writeJson('s11-desk', { home, drill, ms: Date.now() - t0, errors: h.errors });
console.log(JSON.stringify({ home, drill, errors: h.errors }, null, 1));
await h.close();
