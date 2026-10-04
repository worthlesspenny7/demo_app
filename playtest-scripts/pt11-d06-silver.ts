/** PT-11 (copy of pt10-d06-silver + modes stock / blank / debriefcopy / overlay check). PT-10: is D06 measurable as coached at Silver? Scratch copy of the profile (PT11_NOSAVE=1), D06 Silver seed 1 (or argv), two ways:
 *   measure: a measuring run exactly as the MARK lines say: leave ON the second, call each speed AT its sign, sit the full printed 15 s, lap at every
 *            MARK and read the Silver pace aid (seconds early/late) there. Notes: net loss = late(out) - late(in); stop & go chart pause = 15 - net;
 *            also logs what the literal MARK-out text gives ("15 s minus your seconds late against the ghost here").
 *   copy:    no measuring at all: open the C overlay before the start and copy this car's cells off "YOUR CAR'S CHARTS" (is the hidden car hidden?).
 *  usage: PT11_NOSAVE=1 tsx pt11-d06-silver.ts <measure|copy> [tier=1] [seed=1] [variant=net|literal] */
import { launch, goto, shot, txt, log, reset, hold, obs, BASE as BASE_URL } from './pt11-common.js';
import { playHuman } from './pt11-human.js';
const [mode = 'measure', tierS = '1', seedS = '1', variant = 'net'] = process.argv.slice(2);
const label = `d06-t${tierS}-s${seedS}-${mode}${mode === 'measure' ? '-' + variant : ''}`;
const F = `${label}.txt`; reset(F);
const h = await launch({ width: 1366, height: 768 }); const { page } = h;
await goto(page, `#/cockpit/drill/D06/${tierS}/${seedS}`); await hold(page);
await page.locator('#resume-banner button', { hasText: /Start fresh/ }).click().catch(() => {});
const o0 = await obs(page); const book = o0.book as any[];
const marks = book.filter(b => /^MARK \w\d (in|out)/.test(b.text ?? ''));
log(F, 'car on the card: ' + (await txt(page, '#simplechart')).slice(0, 300));
const noteBox = async (s: string) => { const ni = page.locator('input[placeholder^="note"]'); await ni.click(); await ni.type(s); await page.keyboard.press('Enter'); await page.locator('#view').focus().catch(() => {}); };
const pairOf = (id: string) => { const m = marks.find(x => new RegExp(`^MARK ${id} in`).test(x.text)) ?? marks.find(x => new RegExp(`^MARK ${id} out`).test(x.text)); const p = m ? /(Stop & go|Accel|Turn|Stop in the middle) (\d+) > (\d+)/.exec(m.text) : null; return p ? { kind: p[1]!, vi: p[2]!, vo: p[3]! } : null; };
const tableFrom = (ov: string, tag: string): Record<string, number> => {
  const i = ov.indexOf(tag); if (i < 0) return {}; const blk = ov.slice(i, i + 3000).split('\n'); const out: Record<string, number> = {}; let cols: number[] = [];
  for (const line of blk) { if (cols.length && /^\(/.test(line.trim())) break; const c = line.split('\t').map(x => x.trim()); const ne = c.filter(Boolean);
    if (!cols.length) { if (ne.length >= 8 && ne.every(x => !isNaN(Number(x)))) cols = ne.map(Number); continue; }
    if (c.length >= cols.length + 1) { const vals = c.slice(c.length - cols.length); const row = Number(c[c.length - cols.length - 1]); if (!isNaN(row) && c[c.length - cols.length - 1] !== '') cols.forEach((cv, k) => { if (vals[k] !== '' && !isNaN(Number(vals[k]))) out[`${row}>${cv}`] = Number(vals[k]); }); } }
  return out; };
// overlay check (every mode): what does C show on this tier?
await page.keyboard.press('c'); await page.waitForTimeout(200); { const ov = await page.locator('body').innerText(); const head = /YOUR CAR'S CHARTS[^\n]*/.exec(ov)?.[0] ?? '(no YOUR CAR heading)'; const hid = /hide the car|what you measure today|hidden/i.exec(ov.slice(ov.indexOf('PAUSED') + 1))?.[0];
  log(F, `C overlay: heading "${head}", (a) table cells ${Object.keys(tableFrom(ov, '(a) ACCELERATION')).length}, (b) ${Object.keys(tableFrom(ov, '(b) STOP & GO')).length}; hidden text: ${hid}`); await shot(page, `${label}-overlay`); }
await page.keyboard.press('Escape'); await page.locator('#view').focus().catch(() => {});
const notesFrom = async (A: Record<string, number>, B: Record<string, number>, C: Record<string, number>, src: string) => {
  for (const id of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1']) { const p = pairOf(id); if (!p) continue; const k = `${p.vi}>${p.vo}`;
    const n = p.kind === 'Stop & go' ? `stopgo ${k} = ${B[k]}` : p.kind === 'Accel' ? `accel ${k} = ${A[k]}` : p.kind === 'Turn' ? `turn ${k} = ${C[k]}` : `stopmid ${k} = ${(15 - (B[k] ?? NaN)).toFixed(1)}`;
    if (/undefined|NaN/.test(n)) { log(F, `no ${src} cell for ${id} ${p.kind} ${k}`); continue; } log(F, `${src}: ${n}`); await noteBox(n); } };
if (mode === 'stock') {   // copy the stock 1939 Ford's printed charts (D04 Bronze's C overlay, the same car the Reference prints) instead of measuring
  const p2 = await h.ctx.newPage(); await p2.goto(BASE_URL + '/#/cockpit/drill/D04/0/1'); await p2.waitForTimeout(400); await p2.keyboard.press('c'); await p2.waitForTimeout(250);
  const ov = await p2.locator('body').innerText(); log(F, 'stock overlay head: ' + (/YOUR CAR'S CHARTS[^\n]*/.exec(ov)?.[0] ?? '?')); await p2.close();
  await notesFrom(tableFrom(ov, '(a) ACCELERATION'), tableFrom(ov, '(b) STOP & GO'), tableFrom(ov, '(c) TURNS'), 'stock Ford');
  const r = await playHuman(page, { mode: 'naive', start: 'own', lead: 0, warn: true, pullUp: true, scale: 4, log: s => log(F, s) } as any); log(F, `drove without measuring: wall ${(r.wall / 60).toFixed(1)} min`);
} else if (mode === 'blank' || mode === 'debriefcopy') {   // blank: drive with no notes; debriefcopy: notes = the values a previous blank run's Debrief printed (env PT11_D06_NOTES, ';'-separated), then drive without measuring
  for (const n of (process.env.PT11_D06_NOTES ?? '').split(';').map(x => x.trim()).filter(Boolean)) { log(F, 'note from the Debrief: ' + n); await noteBox(n); }
  const r = await playHuman(page, { mode: 'naive', start: 'own', lead: 0, warn: true, pullUp: true, scale: 4, log: s => log(F, s) } as any); log(F, `drove without measuring: wall ${(r.wall / 60).toFixed(1)} min`);
} else if (mode === 'copy') {
  await page.keyboard.press('c'); await page.waitForTimeout(200); const ov = await page.locator('body').innerText(); await page.keyboard.press('Escape');
  const head = /YOUR CAR'S CHARTS[^\n]*/.exec(ov)?.[0]; log(F, 'overlay head: ' + head);
  const table = (tag: string): Record<string, number> => {   // a grid from the overlay text: the header row of OUT speeds, then one row per IN speed (blank diagonal cells kept)
    const i = ov.indexOf(tag); const blk = ov.slice(i, i + 3000).split('\n'); const out: Record<string, number> = {}; let cols: number[] = [];
    for (const line of blk) { if (cols.length && /^\(/.test(line.trim())) break; const c = line.split('\t').map(x => x.trim()); const ne = c.filter(Boolean);
      if (!cols.length) { if (ne.length >= 8 && ne.every(x => !isNaN(Number(x)))) cols = ne.map(Number); continue; }
      if (c.length >= cols.length + 1) { const vals = c.slice(c.length - cols.length); const row = Number(c[c.length - cols.length - 1]); if (!isNaN(row) && c[c.length - cols.length - 1] !== '') cols.forEach((cv, k) => { if (vals[k] !== '' && !isNaN(Number(vals[k]))) out[`${row}>${cv}`] = Number(vals[k]); }); } }
    return out; };
  const A = table('(a) ACCELERATION'), B = table('(b) STOP & GO'), C = table('(c) TURNS');
  for (const id of ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1']) { const p = pairOf(id); if (!p) continue; const k = `${p.vi}>${p.vo}`;
    const n = p.kind === 'Stop & go' ? `stopgo ${k} = ${B[k]}` : p.kind === 'Accel' ? `accel ${k} = ${A[k]}` : p.kind === 'Turn' ? `turn ${k} = ${C[k]}` : `stopmid ${k} = ${(15 - (B[k] ?? NaN)).toFixed(1)}`; log(F, 'copied ' + n); await noteBox(n); }
  const r = await playHuman(page, { mode: 'card', start: 'count', warn: true, pullUp: true, scale: 4, log: s => log(F, s) } as any); log(F, `drove by the card: wall ${(r.wall / 60).toFixed(1)} min`);
} else {
  const lateAt: Record<number, number | null> = {}; let first = true; let wall = 0;
  const base = { mode: 'naive', start: 'own', lead: 0, warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s) } as any;
  for (const m of marks) {
    const r = await playHuman(page, { ...base, keepState: !first, until: `(S.lastPassedLine || 0) >= ${m.n}` }); first = false; wall = r.wall;
    const o = await obs(page); if (o.phase === 'finished') break;
    await page.keyboard.press('l');
    const late = typeof o.aids?.earlyLate === 'number' ? o.aids.earlyLate : null; lateAt[m.n] = late;
    log(F, `MARK line ${m.n} "${m.text.slice(0, 60)}": pace aid ${JSON.stringify(o.aids)} chip "${await txt(page, '#pacechip')}"`);
    if (m.n === marks[1]?.n) await shot(page, `${label}-mark`);
    const id = /^MARK (\w\d) out/.exec(m.text)?.[1]; if (!id) continue;
    const p = pairOf(id)!; const inM = marks.find(x => new RegExp(`^MARK ${id} in`).test(x.text));
    const lin = inM ? (lateAt[inM.n] ?? 0) : 0; const lout = late ?? 0; const net = Math.round((lout - lin) * 10) / 10;
    const k = `${p.vi}>${p.vo}`; let n = '';
    if (p.kind === 'Stop & go') n = `stopgo ${k} = ${variant === 'literal' ? Math.round((15 - lout) * 10) / 10 : Math.round((15 - net) * 10) / 10}`;
    else if (p.kind === 'Accel') n = `accel ${k} = ${p.vi === '0' ? lout : net}`;
    else if (p.kind === 'Turn') n = `turn ${k} = ${net}`;
    else n = `stopmid ${k} = ${net}`;
    log(F, `  ${id}: late in ${lin}, out ${lout}, net ${net} -> note "${n}" (literal MARK-out reading would be ${Math.round((15 - lout) * 10) / 10})`);
    await noteBox(n);
  }
  const r = await playHuman(page, { ...base, keepState: true }); log(F, `measuring run: wall ${(r.wall / 60).toFixed(1)} min`);
}
await page.waitForTimeout(600);
if (/debrief/.test(page.url())) { for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true); await shot(page, `${label}-debrief`); log(F, '== DEBRIEF ==\n' + await page.locator('#view').innerText()); }
else log(F, 'NOT FINISHED ' + page.url());
log(F, 'errors ' + JSON.stringify(h.errors));
await h.browser.close();
