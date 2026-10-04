/** PT-08 step 7: D06 Bronze "Build your charts" in the shared profile, measured the way the MARK lines say (not copied):
 *  lap at every MARK; at each MARK the pace aid (Bronze: seconds early/late against the ghost) is read; at the MARK out the net loss is
 *  late(out) - late(in), and "chart pause time = your dwell + your seconds early/late against the 15 s pause". The note is typed in the notes box
 *  in the drill's own format ("stopgo 50>40 = 8.8"). The driving is the card follower (card mode, 4x). usage: tsx pt08-07-d06.ts [tier] [label] */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt08-common.js';
import { playHuman } from './pt08-human.js';
const [tier = '0', label = 'd06-bronze'] = process.argv.slice(2);
const F = `07-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, `#/cockpit/drill/D06/${tier}/1`); await hold(page);
const o0 = await obs(page); const book = o0.book as any[];
const marks = book.filter(b => /^MARK /.test(b.text ?? ''));
log(F, 'marks: ' + marks.map(m => m.n + ' ' + m.text.slice(0, 40)).join(' | '));
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as const;
const lateAt: Record<number, number | null> = {}; const dwellAt: Record<number, number> = {};
let first = true;
for (const m of marks) {
  const r = await playHuman(page, { ...base, keepState: !first, until: `(S.lastPassedLine || 0) >= ${m.n}` }); first = false;
  const o = await obs(page); if (o.phase === 'finished') break;
  await page.keyboard.press('l');
  const chip = await txt(page, '#pacechip, .pacechip, #pace'); const aid = o.aids?.earlyLate;
  lateAt[m.n] = typeof aid === 'number' ? aid : null;
  log(F, `MARK line ${m.n} (${m.text.slice(0, 22)}): tod ${o.tod.toFixed(1)} aids ${JSON.stringify(o.aids)} chip "${chip}" wall ${(r.wall / 60).toFixed(1)} min`);
  const mm = /MARK (\w\d) out.*?(Stop & go|Accel(?:\/decel)?|Turn|Stop in the middle) (\d+) > (\d+)/.exec(m.text + ' ' + (book.find(b => b.n === m.n - 1 - (/ out/.test(m.text) ? 1 : 0))?.text ?? ''));
  const pair = /(Stop & go|Accel\/decel|Accel|Turn|Stop in the middle) (\d+) > (\d+)/.exec(m.text) ?? /(Stop & go|Accel\/decel|Accel|Turn|Stop in the middle) (\d+) > (\d+)/.exec(book.slice(0, m.n).reverse().find(b => /MARK \w\d in|Accel 0 >/.test(b.text ?? ''))?.text ?? '');
  void mm;
  if (/ out:/.test(m.text) && pair) {
    const inLine = book.slice(0, m.n - 1).reverse().find(b => /MARK \w\d in|Restart: leave on the second/.test(b.text ?? ''));
    const lin = inLine ? (lateAt[inLine.n] ?? 0) : 0; const lout = lateAt[m.n] ?? null;
    const net = lout === null ? null : Math.round((lout - (/Restart/.test(inLine?.text ?? '') ? 0 : lin)) * 10) / 10;
    const kind = /Stop & go/.test(pair[1]!) ? 'stopgo' : /middle/.test(pair[1]!) ? 'stopmid' : /Turn/.test(pair[1]!) ? 'turn' : 'accel';
    let val = net;
    if (kind === 'stopgo' && net !== null) { const sl = book.slice(inLine!.n, m.n).find(b => b.pause); const dw = (await page.evaluate(() => (window as any).__HS?.dwell)) ?? 0; dwellAt[m.n] = dw; val = Math.round((dw + net) * 10) / 10; void sl; }
    const note = `${kind} ${pair[2]}>${pair[3]} = ${val}`;
    log(F, `   -> net ${net} (late in ${lin}, out ${lout}); note "${note}"`);
    if (val !== null) { const ni = page.locator('input[placeholder^="note"]'); await ni.click(); await ni.type(note); await page.keyboard.press('Enter'); await page.locator('#view').focus().catch(() => {}); }
  }
  if (m.n === marks[1]?.n) { await shot(page, `${label}-mark`); log(F, 'perf: ' + await txt(page, '#perfcard') + '\nhud: ' + await txt(page, '.hud, #hud')); }
}
const r = await playHuman(page, { ...base, keepState: true });
log(F, `played: finished ${r.finished} wall est ${(r.wall / 60).toFixed(1)} min`);
await page.waitForTimeout(600); await shot(page, `${label}-debrief`);
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText());
await goto(page, '#/'); log(F, '== HOME ==\n' + await txt(page, '#starthere-panel'));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
