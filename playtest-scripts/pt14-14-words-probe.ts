/** PT-14 probe: why the PT-13 word counter (visible text nodes) and the e2e counter (innerText) differ on the same card. */
process.env.PT14_OUT ??= '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt14-words';
const { open, state, BASE, sleep, tapEl } = await import('./pt14-common.js');
const h = await open({ fresh: true }); const { page } = h;
await page.goto(`${BASE}/?mode=mobile#/m/play/skill/recovery`); await page.waitForSelector('[data-screen=run]');
for (let i = 0; i < 5; i++) { const st = await state(page); if (st?.phase === 'rule') { await tapEl(page, '[data-action=ack]'); await sleep(300); } }
await sleep(300);
const r = await page.evaluate(() => {
  const vis = (e: Element): boolean => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const out: string[] = []; const w = document.createTreeWalker(document.querySelector('.mob')!, NodeFilter.SHOW_TEXT); let n: Node | null;
  while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('svg') || !vis(p)) continue; const t = (n.textContent ?? '').trim(); if (t) out.push(`${p.tagName}.${p.className}: ${t}`); }
  return { nodes: out, inner: (document.querySelector('.mob') as HTMLElement).innerText };
});
console.log(JSON.stringify(r, null, 1));
await h.close();
