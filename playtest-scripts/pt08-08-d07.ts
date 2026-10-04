/** PT-08 step 8: D07 Bronze, the morning calibration run, as the lesson and the objective say: stopwatch reset and started at the asterisk (first
 *  calibration row), L at every calibration box, the watch's lap (interval / cumulative) noted as "cal N = i / c", then parked at the restart:
 *  k = printed cumulative / my cumulative, typed in the Timewise box and set. The rest is the card follower at 4x. */
import { launch, goto, shot, txt, log, reset, hold, obs } from './pt08-common.js';
import { playHuman } from './pt08-human.js';
const [tier = '0', label = 'd07-bronze'] = process.argv.slice(2);
const F = `08-${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 });
const { page } = h;
await goto(page, `#/cockpit/drill/D07/${tier}/1`); await hold(page);
log(F, '== PREREAD ==\n' + await txt(page, '#preread') + '\n== PERF ==\n' + (await txt(page, '#perfcard')).slice(0, 600));
const o0 = await obs(page); const cal = (o0.book as any[]).filter(b => b.section === 'calibration');
log(F, 'calibration rows: ' + cal.map(c => `${c.n} (${c.perfectInterval ?? '-'} / ${c.perfectCumulative ?? '-'})`).join(', '));
const base = { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as const;
let first = true; let lastCum = 0; let lastPrinted = 0; let prevCum = 0;
for (let i = 0; i < cal.length; i++) {
  const c = cal[i];
  await playHuman(page, { ...base, keepState: !first, until: `o.ahead.some(f => f.nodeId === '${c.nodeId}' && f.approxDistanceFt <= 12) || (S.lastPassedLine || 0) >= ${c.n}` }); first = false;
  const o = await obs(page); if (o.phase === 'finished') break;
  if (i === 0) { await page.keyboard.press('Shift+R'); await page.keyboard.press(' '); log(F, `asterisk line ${c.n}: watch reset + start at tod ${o.tod.toFixed(1)}`); if (true) { await shot(page, `${label}-asterisk`); log(F, 'perf: ' + (await txt(page, '#perfcard')).slice(0, 700) + '\ncal box: ' + await txt(page, '#calbox')); } continue; }
  await page.keyboard.press('l'); await page.waitForTimeout(50);
  const w = await obs(page); const laps = w.stopwatch?.laps ?? []; const lp = laps[laps.length - 1];
  const disp = (await txt(page, '#stopwatch')).replace(/\n/g, ' ');
  const cum = typeof lp === 'number' ? lp : lp ? (lp.cumulative ?? lp.total ?? lp.split ?? null) : null; const iv = cum !== null ? cum - prevCum : null; if (cum !== null) prevCum = cum;
  log(F, `cal ${i} line ${c.n}: tod ${o.tod.toFixed(1)} watch ${JSON.stringify(lp)} display "${disp.slice(0, 140)}"`);
  const fmt = (x: number) => `${Math.floor(x / 60)}m${(x % 60).toFixed(1).padStart(4, '0')}`;
  if (cum !== null && iv !== null) { const note = `cal ${i} = ${fmt(iv)} / ${fmt(cum)}`; const ni = page.locator('input[placeholder^="note"]'); await ni.click(); await ni.type(note); await page.keyboard.press('Enter'); await page.locator('#view').focus().catch(() => {}); log(F, '  note ' + note); lastCum = cum; lastPrinted = c.perfectCumulative ?? 0; }
}
const k = lastCum ? Math.round(lastPrinted / lastCum * 10000) / 10000 : 1;
log(F, `k = ${lastPrinted} / ${lastCum.toFixed(1)} = ${k}`);
// park at the restart, then set the factor
await playHuman(page, { ...base, keepState: true, until: "o.driver.state === 'waiting:hold'" });
await page.locator('#cal-k').fill(String(k)); await page.locator('#cal-setk').click(); await page.locator('#view').focus().catch(() => {});
log(F, 'set factor: ' + await txt(page, '#alert') + ' | cal box: ' + await txt(page, '#calbox'));
await shot(page, `${label}-factor`);
const r = await playHuman(page, { ...base, keepState: true });
log(F, `played: finished ${r.finished} wall est ${(r.wall / 60).toFixed(1)} min`);
await page.waitForTimeout(600); await shot(page, `${label}-debrief`);
for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText());
await goto(page, '#/'); log(F, '== HOME ==\n' + await txt(page, '#starthere-panel'));
log(F, 'errors: ' + JSON.stringify(h.errors));
await h.close();
