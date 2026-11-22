/** PT-17 (from pt16-10): taps Start at once on timed mini-sims (so the reading-time leak is ~0.3 s), WRONG=1 makes the first timed
 *  mini-sim a deliberate late tap (+3 s) followed by Try again; prints multi-case rounds. Walk a whole module by touch as an attentive newcomer: reading pages (time on page = words/200 wpm, not waited), mini-sims answered right
 *  (one deliberate miss on the first option mini-sim when MISS=1), timing taps at the oracle second + 0.5 s, checks tapped right after one wrong,
 *  widgets played; prints every page with words, scroll and chips; screenshots the first of each kind. usage: <module> [shotPrefix] [MISS] */
import { open, shot, look, words, BASE } from './pt17-common.js';
const [mod, prefix = mod, miss = '0', wrongTimed = '0'] = process.argv.slice(2); let wrongDone = wrongTimed !== '1';
const { ctx, page, errors } = await open();
await page.goto(BASE + `/?mode=mobile#/school/${mod}/1`); await page.waitForSelector('[data-testid=page]'); await page.waitForTimeout(300);
const tapL = async (sel: string) => { const l = page.locator(sel).first(); const b = await l.boundingBox(); if (!b) throw new Error('no ' + sel); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300); };
const ptext = () => page.evaluate(() => (document.querySelector('[data-testid=page]') as HTMLElement).innerText.replace(/\n+/g, ' | '));
let model = 0, taps = 0; const shotKinds = new Set<string>(); let missed = miss !== '1';
for (let i = 0; i < 14; i++) {
  const l = await look(page); const s = l.school; if (!s) break;
  const w = words(l.text);
  console.log(`\n--- p${s.page + 1}/${s.of} ${s.kind} words=${w} scroll=${l.pageScroll && l.pageScroll.s > l.pageScroll.c + 1 ? 'YES' : 'no'} doc=${l.docScroll.s > l.docScroll.c + 1 ? 'SCROLL' : 'fit'} chips=${JSON.stringify(l.chips)}\n${l.text.replace(/\n+/g, ' | ')}`);
  model += w / 200 * 60;
  if (!shotKinds.has(s.kind)) { shotKinds.add(s.kind); if (prefix !== '-') await shot(page, `${prefix}-${s.kind}`); }
  if (s.kind === 'tryit') break;
  if (!s.complete) {
    if (s.kind === 'check') {
      await tapL('.s2-checkopts [data-right=false]'); taps++; console.log('  wrong ->', (await ptext()).split('|').slice(-1)[0]);
      await tapL('.s2-checkopts [data-right=true]'); taps++; console.log('  right ->', (await ptext()).split('|').slice(-1)[0]); model += 6;
    } else if (s.kind === 'minisim') {
      const m = await page.evaluate(() => (window as any).__rally.school.mini());
      const o = await page.evaluate(() => (window as any).__rally.school.oracle());
      console.log('  mini', JSON.stringify({ kind: m.kind, options: m.options, timing: m.timing }), 'oracle', JSON.stringify(o));
      const ctl = await page.evaluate(() => [...document.querySelectorAll('.s2-miniacts button')].map(b => `${(b as HTMLElement).dataset.action ?? (b as HTMLElement).dataset.option}:${(b as HTMLElement).innerText.replace(/\s+/g, ' ')}`));
      console.log('  controls', ctl, 'pointer', await page.locator('[data-testid=pointer]').getAttribute('data-control').catch(() => null));
      if (o?.optionId !== undefined) {
        if (!missed) { missed = true; const wrong = m.options.find((x: string) => x !== o.optionId); await tapL(`.s2-miniacts [data-option="${wrong}"]`); taps++; console.log('  MISS ->', (await ptext()).slice(-300)); await tapL('[data-action=try-again]'); taps++; }
        await tapL(`.s2-miniacts [data-option="${o.optionId}"]`); taps++; model += 8;
        for (let r = 0; r < 6 && await page.locator('[data-action=next-case]').count(); r++) { console.log('  case ->', (await ptext()).slice(-220)); await tapL('[data-action=next-case]'); taps++; const o2 = await page.evaluate(() => (window as any).__rally.school.oracle()); console.log('  next case:', (await ptext()).slice(0, 260)); await tapL(`.s2-miniacts [data-option="${o2.optionId}"]`); taps++; model += 8; }
      } else if (o) {
        if (await page.locator('.s2-miniacts [data-action=start-card]').count()) { await tapL('.s2-miniacts [data-action=start-card]'); taps++; }
        if (!wrongDone) { wrongDone = true; const o1 = await page.evaluate(() => (window as any).__rally.school.oracle()); const s1: [string, number][] = o1.taps?.length ? o1.taps.map((t: number, k: number) => [k === 0 ? 'startstop' : 'lap', t]) : [['go', o1.tapSeconds]];
          for (let k = 0; k < s1.length; k++) { const [act, t] = s1[k]!; let loc = page.locator(`.s2-miniacts [data-action=${act}]`); if (!(await loc.count())) loc = page.locator('.s2-miniacts [data-action=go]'); const b = (await loc.first().boundingBox())!; await page.waitForFunction(x => (window as any).__rally.school.mini().elapsed >= x, t + (k === s1.length - 1 ? 3 : 0), { polling: 'raf', timeout: 120000 }); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); taps++; }
          await page.waitForTimeout(1500); console.log('  WRONG TIMED ->', (await ptext()).slice(-280), '| verdict still shown:', await page.locator('[data-testid=mini-verdict]').count());
          await tapL('[data-action=try-again]'); taps++; if (await page.locator('.s2-miniacts [data-action=start-card]').count()) { await tapL('.s2-miniacts [data-action=start-card]'); taps++; } }
        const seq: [string, number][] = o.taps?.length ? o.taps.map((t: number, k: number) => [k === 0 ? 'startstop' : 'lap', t]) : [['go', o.tapSeconds]];
        for (const [act, t] of seq) {
          let loc = page.locator(`.s2-miniacts [data-action=${act}]`); if (!(await loc.count())) loc = page.locator('.s2-miniacts button');
          const b = (await loc.first().boundingBox())!;
          await page.waitForFunction(x => (window as any).__rally.school.mini().elapsed >= x, t + 0.2, { polling: 'raf', timeout: 120000 });
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); taps++;
        }
        model += (seq[seq.length - 1]![1] ?? 0) + 4; await page.waitForTimeout(400);
      }
      console.log('  ->', (await ptext()).slice(-260));
    } else if (s.kind === 'widget') {
      const wid = await page.evaluate(() => (document.querySelector('[data-widget]') as HTMLElement | null)?.dataset.widget);
      console.log('  widget', wid);
      if (wid === 'holdSpeed') { const tg = Number(/Assigned (\d+)/.exec(l.text)?.[1] ?? 35); await page.locator('[data-testid=speed-slider]').fill(String(tg)); taps++; await page.waitForSelector('.s2-widget.s2-done', { timeout: 40000 }).catch(() => console.log('  hold not done in 40 s')); model += 15; }
      else if (wid === 'whereCheckpoint') { await page.waitForTimeout(3000); await tapL('[data-action=leg-ended]'); taps++; model += 10; }
      else if (wid === 'tapLap') { for (let k = 0; k < 3; k++) { await page.waitForTimeout(900); await tapL('[data-action=lap]'); taps++; } await tapL('.s2-q [data-right=true]'); taps++; model += 15; }
      else if (wid === 'readScorecard') { await tapL('[data-widget=readScorecard] button[data-right=true]'); taps++; model += 20; }
      console.log('  ->', (await ptext()).slice(-300));
    }
  }
  const st2 = await page.evaluate(() => (window as any).__rally.school.state());
  if (!st2.complete) console.log('  !! page not complete after play');
  await tapL('[data-action=next]:visible'); taps++; model += 1.5;
}
console.log(`\nMODEL reading+play seconds (excl. try-it) ${model.toFixed(0)}, taps ${taps}`);
console.log('errors', errors); await ctx.close();
