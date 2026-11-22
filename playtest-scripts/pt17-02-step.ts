/** Naive stepper: run a sequence of actions on the persistent profile, then dump what the screen shows.
 *  actions: go:<hash> | text:<button text> | sel:<css> | next | start | wait:<s> | shot:<name> | dump | drag:<sel>:<dx>
 *           | at:<seconds>:<css>  (wait until the mini-sim/run clock reaches <seconds>, then touch-tap <css>) */
import { open, shot, look, words, tap, touchDrag, BASE } from './pt17-common.js';
const acts = process.argv.slice(2);
const { ctx, page, errors } = await open();
const t0 = Date.now();
const dump = async (tag = '') => {
  const l = await look(page);
  const info = await page.evaluate(() => {
    const w = window as any; let mini = null, dec = null;
    try { mini = w.__rally?.school?.mini?.(); } catch {}
    try { dec = w.__rally?.decision?.state?.(); } catch {}
    const v = (e: Element) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    return { mini, dec: dec ? { screen: dec.screen, phase: dec.phase, kind: dec.kind, n: dec.n, of: dec.of, elapsed: dec.elapsed, started: dec.started } : null,
      acts: [...document.querySelectorAll('button')].filter(v).map(b => `${(b as HTMLElement).dataset.action ?? (b as HTMLElement).dataset.option ?? ''}|${(b as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 30)}${(b as HTMLButtonElement).disabled ? '(disabled)' : ''}${b.className.includes('g-grey') ? '(grey)' : ''}`) };
  });
  console.log(`\n=== ${tag} t=${((Date.now() - t0) / 1000).toFixed(1)}s ${l.hash} words(page)=${words(l.text)} words(screen)=${words(l.all)} docScroll=${l.docScroll.s > l.docScroll.c + 1 ? 'YES' : 'no'} pageScroll=${l.pageScroll && l.pageScroll.s > l.pageScroll.c + 1 ? 'YES' : 'no'}`);
  console.log(l.all.replace(/\n{2,}/g, '\n').replace(/^page \d+$/gm, '').replace(/\n+/g, ' | '));
  console.log('school', JSON.stringify(l.school), 'mini', JSON.stringify(info.mini && { kind: info.mini.kind, attempt: info.mini.attempt, complete: info.mini.complete, started: info.mini.started, elapsed: info.mini.elapsed, round: info.mini.round, rounds: info.mini.rounds }), 'dec', JSON.stringify(info.dec));
  console.log('buttons', info.acts.filter(a => !/^\|page \d/.test(a)).join(' ; '));
};
const elapsed = () => page.evaluate(() => { const w = window as any; const m = w.__rally?.school?.mini?.(); if (m && m.kind) return m.elapsed; return w.__rally?.decision?.elapsed?.() ?? 0; });
for (const a of acts) {
  const [cmd, ...rest] = a.split(':'); const arg = rest.join(':');
  if (cmd === 'go') { await page.goto(BASE + '/?mode=mobile' + arg); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(400); }
  else if (cmd === 'bare') { await page.goto(BASE + '/'); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(400); }
  else if (cmd === 'text') { const l = page.locator(`button:visible:has-text("${arg}"), a:visible:has-text("${arg}")`).first(); const b = await l.boundingBox(); if (!b) throw new Error('no text ' + arg); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(350); }
  else if (cmd === 'sel') { await tap(page, arg); await page.waitForTimeout(350); }
  else if (cmd === 'next') { await tap(page, '[data-action=next]:visible'); await page.waitForTimeout(350); }
  else if (cmd === 'start') { await tap(page, '[data-action=start-card]:visible'); await page.waitForTimeout(100); }
  else if (cmd === 'wait') await page.waitForTimeout(Number(arg) * 1000);
  else if (cmd === 'shot') await shot(page, arg);
  else if (cmd === 'dump') await dump(arg);
  else if (cmd === 'at') { const [s, ...css] = rest; const sel = css.join(':'); const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no ' + sel);
    const t = Number(s); while ((await elapsed()) < t) await page.waitForTimeout(15); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); console.log(`tapped ${sel} at ${(await elapsed()).toFixed(2)}`); await page.waitForTimeout(400); }
  else if (cmd === 'drag') { const [sel, dx] = [rest.slice(0, -1).join(':'), Number(rest[rest.length - 1])]; const b = (await page.locator(sel).first().boundingBox())!; await touchDrag(page, b.x + 10, b.y + b.height / 2, b.x + 10 + dx, b.y + b.height / 2); await page.waitForTimeout(300); }
  else throw new Error('bad action ' + a);
}
if (!acts.includes('dump') ) await dump('end');
console.log('errors', errors);
await ctx.close();
