/** PT-18 SCH-022/028 as a human: read the card R ms under Start, tap Start, then tap when the SCREEN gives the cue (not the oracle):
 *  speed change: the bar's fill reaches the CALL tick; pause: the watch digits reach the "sit X s" on the card; stopwatch/timed start:
 *  START when "Mark!" shows (or the cue reads 0 ft), LAP at the second Mark, timed CALL when the watch reaches hold - lead; restart: the
 *  CDT digits reach the launch second worked out from the card (base + position - loss, or your time - loss).
 *  usage: <readMs> <reactionMs> <hash>...  (touch taps; logs the verdict) */
import { open, tap, BASE } from './pt18-common.js';
const [readMs, reactMs, ...hashes] = process.argv.slice(2);
const { ctx, page, errors } = await open({ profile: '/tmp/claude-0/-home-user-demo-app/81b8a363-0754-5c45-808c-9ead00db3b3c/scratchpad/pt18-probe' });
const snap = () => page.evaluate(() => {
  const q = (s: string) => document.querySelector(s) as HTMLElement | null;
  const fill = q('.msign-fill'); const call = q('.msign-call');
  return { e: (window as any).__rally.school.mini().elapsed as number, fill: fill ? parseFloat(fill.style.width) : null, call: call ? parseFloat(call.style.left) : null,
    ft: q('.msign-ft')?.textContent ?? '', mark: q('.msign-mark')?.textContent ?? '', watch: q('[data-testid=watch-digits]')?.textContent ?? '', tod: q('[data-testid=tod-digits]')?.textContent ?? '' };
});
const secs = (w: string) => { const m = /(\d+):(\d+(?:\.\d+)?)/.exec(w); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const todS = (t: string) => { const m = /(\d+):(\d\d):(\d\d)/.exec(t); return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN; };
async function tapWhen(sel: string, cond: (s: Awaited<ReturnType<typeof snap>>) => boolean, label: string) {
  const b = (await page.locator(sel).first().boundingBox())!;
  for (let i = 0; i < 6000; i++) { const s = await snap(); if (cond(s)) { if (Number(reactMs)) await page.waitForTimeout(Number(reactMs)); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); const s2 = await snap(); console.log(`   ${label}: cue seen at e=${s.e.toFixed(2)} watch=${s.watch} tod=${s.tod} fill=${s.fill} call=${s.call} ft="${s.ft}" mark="${s.mark}" -> tapped at e=${s2.e.toFixed(2)}`); return; } await page.waitForTimeout(8); }
  console.log('   cue never came for', label);
}
for (const hash of hashes) {
  await page.goto(BASE + '/?mode=mobile' + hash); await page.waitForSelector('.s2-minisim');
  const kind = await page.locator('.s2-minisim').getAttribute('data-kind');
  const prompt = await page.locator('.mprompt').innerText();
  await page.waitForTimeout(Number(readMs));
  const before = await snap();
  await tap(page, '.s2-miniacts [data-action=start-card]'); await page.waitForTimeout(60);
  const after = await snap();
  console.log(`\n${hash} ${kind} read ${readMs} ms | "${prompt}"\n   before Start e=${before.e} watch=${before.watch} tod=${before.tod}; 60 ms after Start e=${after.e.toFixed(2)} watch=${after.watch} tod=${after.tod}`);
  const o = await page.evaluate(() => (window as any).__rally.school.oracle());
  if (kind === 'speedChange') await tapWhen('.s2-miniacts [data-action=go]', s => s.fill !== null && s.call !== null && s.fill <= s.call, 'CALL at tick');
  else if (kind === 'pause') { const sit = Number(/sit (\d+(?:\.\d+)?) s/.exec(prompt)![1]); await tapWhen('.s2-miniacts [data-action=go]', s => secs(s.watch) >= sit, `GO at watch ${sit}`); }
  else if (kind === 'watch' || kind === 'timedStart') {
    await tapWhen('.s2-miniacts [data-action=startstop]', s => !!s.mark.trim() || / 0 ft$/.test(s.ft), 'START on Mark');
    if (kind === 'watch') { const t1 = Date.now(); for (let i = 0; i < 3000 && (await snap()).mark.trim(); i++) await page.waitForTimeout(10); console.log(`   (first "Mark!" stayed on screen ${(Date.now() - t1)} ms after START, beside the next cue)`); const lab2 = /LAP at the ([^.]+)\./.exec(prompt)![1]!; let lastFt = ''; await tapWhen('.s2-miniacts [data-action=lap]', s => { const ok = s.ft.includes(lab2) && (/ 0 ft$/.test(s.ft) || !!s.mark.trim()) ; lastFt = s.ft; return ok; }, 'LAP at ' + lab2); }
    else { const m = /CALL \d+ (\d+(?:\.\d+)?) s before the 0m(\d+)s/.exec(prompt)!; const at = Number(m[2]) - Number(m[1]); await tapWhen('.s2-miniacts [data-action=lap]', s => secs(s.watch) >= at, `CALL at watch ${at}`); }
  } else if (kind === 'restart') {
    const base = /base CDT (\d+:\d\d:\d\d), you start (\d+)/.exec(prompt); const mine = /your time CDT (\d+:\d\d:\d\d)/.exec(prompt); const loss = Number(/loss (\d+(?:\.\d+)?) s/.exec(prompt)![1]);
    const target = (base ? todS(base[1]!) + Number(base[2]) * 60 : todS(mine![1]!)) - loss;
    await tapWhen('.s2-miniacts [data-action=go]', s => todS(s.tod) >= Math.ceil(target - 1e-6), `LAUNCH at CDT second ${Math.ceil(target)}`);
  }
  await page.waitForTimeout(500);
  const v = page.locator('[data-testid=mini-verdict]');
  console.log(`   oracle ${JSON.stringify(o)} -> ${await v.count() ? (await v.getAttribute('data-correct')) + ' "' + (await v.innerText()).replace(/\n+/g, ' | ').slice(0, 110) + '"' : 'no verdict'}`);
}
console.log('errors', errors); await ctx.close();
