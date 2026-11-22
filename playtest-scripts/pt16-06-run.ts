/** Play a run on the phone run screen (a School try-it or an unguided run) with real taps, dumping every card.
 *  usage: tsx pt16-06-run.ts <start hash> <start button text|-> <policy: first|oracle|naive> <shot prefix> [maxSteps]
 *  naive: option cards pick by the first option; timing cards tap at the oracle second + 0.6 s (a newcomer's reaction). */
import { open, shot, BASE } from './pt16-common.js';
const [hash, startText, policy = 'oracle', prefix = 'run', maxS = '80'] = process.argv.slice(2);
const { ctx, page, errors } = await open();
await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('[data-screen]'); await page.waitForTimeout(400);
const tapEl = async (sel: string) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('no ' + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
if (startText !== '-') { await tapEl(`button:has-text("${startText}"), a:has-text("${startText}")`); await page.waitForTimeout(600); }
const st = () => page.evaluate(() => (window as any).__rally.decision.state());
const screenText = () => page.evaluate(() => ((document.querySelector('[data-screen]') as HTMLElement | null)?.innerText ?? '').replace(/\n+/g, ' | '));
const guidedInfo = () => page.evaluate(() => ({ guided: !!document.querySelector('.mob-run.guided'), hidden: [...document.querySelectorAll('.g-hide')].map(e => (e as HTMLElement).dataset.testid || (e as HTMLElement).dataset.action || e.className), grey: [...document.querySelectorAll('.g-grey')].map(e => (e as HTMLElement).dataset.action || (e as HTMLElement).innerText.slice(0, 20)), pointer: (document.querySelector('[data-testid=pointer]') as HTMLElement | null)?.innerText ?? null, pointerControl: (document.querySelector('[data-testid=pointer]') as HTMLElement | null)?.dataset.control ?? null, actions: [...document.querySelectorAll('.mob-actions button')].map(b => ((b as HTMLElement).dataset.action ?? (b as HTMLElement).dataset.option ?? '') + ':' + (b as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 24)) }));
let shots = 0, decisions = 0; const t0 = Date.now(); const kinds: Record<string, number> = {};
for (let i = 0; i < Number(maxS); i++) {
  const s = await st();
  if (s.screen !== 'run') {
    const txt = await screenText();
    if (/recap/.test(s.screen) || /stars|You can now|Recap|recap/i.test(txt)) { console.log('END screen', s.screen, page.url().replace(/.*#/, '#'), '\n', txt.slice(0, 900)); await shot(page, `${prefix}-recap`); break; }
    await page.waitForTimeout(300); continue;
  }
  if (s.phase === 'rule') { console.log(`[rule] ${(await screenText()).slice(0, 400)}`); await tapEl('.mob-actions [data-action=ack]'); await page.waitForTimeout(250); continue; }
  if (s.phase === 'verdict') { console.log(`   verdict: ${(await screenText()).slice(0, 500)}`); await tapEl('.mob-actions [data-action=next]'); await page.waitForTimeout(250); continue; }
  if (s.phase !== 'decision') { await page.waitForTimeout(200); continue; }
  decisions++; kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
  const gi = await guidedInfo();
  console.log(`\n#${s.n}/${s.of} kind=${s.kind} t=${((Date.now() - t0) / 1000).toFixed(0)}s guided=${JSON.stringify(gi)}\n  CARD: ${(await screenText()).slice(0, 700)}`);
  if (shots < 4) { await shot(page, `${prefix}-card${++shots}`); }
  const o = await page.evaluate(() => (window as any).__rally.decision.oracle());
  if (o?.optionId !== undefined) {
    const id = policy === 'first' || policy === 'naive' ? s.options[0] : o.optionId; // mixed/early: options right
    console.log(`  pick ${id} (oracle ${o.optionId})`);
    await tapEl(`.mob-actions [data-option="${id}"]`);
  } else if (o?.taps?.length || o?.tapSeconds !== undefined) {
    const extra = policy === 'naive' || policy === 'mixed' ? 0.6 : policy === 'early' ? -3 : 0.1;
    const seq: [string, number][] = o.taps?.length ? [['startstop', o.taps[0]], ...(o.taps.length > 1 ? [['lap', o.taps[1]] as [string, number]] : [])] : [['go', o.tapSeconds]];
    console.log(`  timing ${JSON.stringify(o)}`);
    for (const [act, sec] of seq) {
      const sel = `.mob-actions [data-action=${act}]`; const b = await page.locator(sel).boundingBox(); if (!b) { console.log('no control', act); break; }
      await page.waitForFunction(t => (window as any).__rally.decision.elapsed() >= t, sec + extra, { polling: 'raf', timeout: 120000 });
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    }
  } else { console.log('  no oracle; first option'); if (s.options.length) await tapEl(`.mob-actions [data-option="${s.options[0]}"]`); }
  await page.waitForTimeout(400);
}
console.log('decisions', decisions, 'kinds', JSON.stringify(kinds), 'wall s', ((Date.now() - t0) / 1000).toFixed(0));
console.log('errors', errors); await ctx.close();
