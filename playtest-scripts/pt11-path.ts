/** PT-10 path walker: Josh follows the Home "Next:" button in ONE browser profile for one evening, step after step, until the evening's wall budget
 *  is spent (a step is only started while there is time left; the one in progress is finished). Every step is dispatched by what the button opened:
 *  a lesson (read, answer the check, note the lesson's own "Next on your path"), the D09 deck, or a cockpit drill (played by the PT-10 human model
 *  at the tier the button chose). After each step Home is re-read so the button can be compared with what the step's own Next button promised.
 *  usage: tsx pt11-path.ts <evening 1|2> <budget minutes> [fresh | cont:<minutes already spent this evening>]
 *  Wall time: lessons at 200 words/min + 1 min for the check; D09 at 15 s a card; drives from the cockpit's own scale rules (pt11-human) + 2 min
 *  pre-read + 2 min Debrief. Real keys and clicks; sim time only via window.__rally.advance. */
import { appendFileSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { launch, goto, shot, txt, log, hold, obs, adv, OUT, type H } from './pt11-common.js';
import { playHuman } from './pt11-human.js';
const [ev = '1', budgetS = '120', freshS = ''] = process.argv.slice(2);
const evening = Number(ev); const budget = Number(budgetS);
const F = `path-e${evening}.txt`;
const TL = `${OUT}/timeline.jsonl`;
if (freshS === 'fresh' && existsSync(TL)) writeFileSync(TL, '');
const h: H = await launch({ width: 1366, height: 768 }, freshS === 'fresh');
const { page } = h;
let wall = /^cont:/.test(freshS) ? Number(freshS.slice(5)) : 0; const tries: Record<string, number> = {};
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const record = (e: Record<string, unknown>) => appendFileSync(TL, JSON.stringify({ evening, ...e }) + '\n');
const starsOf = (s: string) => (/[★☆]{3}/.exec(s) ?? ['?'])[0];

// ---------- lessons
const wrongFirst: Record<string, RegExp> = { lost: /drive faster/i, transits: /2:37:00/, 'ghost-car': /plus the braking/i, 'measure-car': /69\.9/ };
async function lesson(id: string): Promise<{ min: number; res: string }> {
  let body = await page.locator('#view').innerText();
  let n = words(body); let pages = 1;
  log(F, `== LESSON ${id} page 1 (${n} words) ==\n${body}`);
  // PT-11: a long lesson is two pages (PLAY-040): read page 1, press "Next page", read page 2
  for (let pg = 2; pg <= 4; pg++) {
    const np = page.locator('#lesson-next-page'); if (!(await np.count()) || !(await np.first().isVisible())) break;
    await np.first().click(); await page.waitForTimeout(150); pages = pg;
    body = await page.locator('#view').innerText(); const n2 = words(body); n += n2;
    log(F, `== LESSON ${id} page ${pg} (${n2} words) ==\n${body}`);
  }
  record({ kind: 'lesson-words', id, words: n, pages });
  const opts = page.locator('.quiz .opt'); const labels = await opts.allInnerTexts();
  const lens = labels.map(l => l.length);
  const w = wrongFirst[id] ? labels.findIndex(l => wrongFirst[id]!.test(l)) : -1;
  let res = '';
  if (w >= 0) { await opts.nth(w).click(); await page.waitForTimeout(80); res += 'slip first; '; log(F, 'WRONG: ' + labels[w] + ' -> ' + await txt(page, '.quiz p.danger')); }
  for (let i = 0; i < labels.length; i++) { if (i === w) continue; await opts.nth(i).click(); await page.waitForTimeout(80); if (await page.locator('.quiz p.ok').count()) { const sorted = [...lens].sort((a, b) => b - a); res += `right on option ${i + 1} of ${labels.length} (len rank ${sorted.indexOf(lens[i]!) + 1}, lens ${lens.join('/')})`; record({ kind: 'check', id, pos: i + 1, of: labels.length, lens, rightLen: lens[i], longest: lens[i] === Math.max(...lens) }); log(F, 'RIGHT (' + (i + 1) + '): ' + labels[i] + ' -> ' + await txt(page, '.quiz p.ok')); break; } res += 'x'; log(F, 'wrong try: ' + labels[i]); }
  if (id === 'protocol') await dadCard();
  await shot(page, `e${evening}-lesson-${id}`);
  const nav = (await page.locator('#view .actions button').allInnerTexts()).join(' | '); log(F, 'lesson nav: ' + nav);
  const np = await txt(page, '#next-path'); record({ kind: 'lesson-next', id, next: np });
  return { min: n / 200 + 1, res: `${res}; lesson Next: ${np}` };
}
async function dadCard(): Promise<void> {
  const card = page.locator('.printcard'); log(F, 'printcard count ' + await card.count());
  if (!await card.count()) return;
  await card.first().scrollIntoViewIfNeeded(); await shot(page, 'dad-card-screen');
  log(F, '== DAD CARD (screen) ==\n' + await card.first().innerText());
  await page.evaluate(() => { (window as any).print = () => {}; });
  await page.locator('#print-card').click().catch(e => log(F, 'print click failed ' + e));
  await page.waitForTimeout(200);
  await page.pdf({ path: `${OUT}/dad-card.pdf`, format: 'Letter', printBackground: true }).catch(e => log(F, 'pdf failed ' + e));
  log(F, 'dad card PDF written');
  await page.evaluate(() => { document.getElementById('print-root')?.remove(); document.documentElement.classList.remove('print-card-only'); });
}

// ---------- D09
const D09_ANSWERS = (process.env.PT11_D09 ?? '4,3,1,4,1,2,4,1,3,2,1,2,2,3,4,2,4,4,1,3').split(',').map(Number);
async function d09(): Promise<{ min: number; res: string }> {
  await page.evaluate(() => { const d0 = Date.now; (Date as any).now = () => Math.floor(d0() / 1000) * 1000 + 123; location.hash = '#/'; });   // the deck seed is Date.now() % 1000: pinned to 123 (the deck dumped in 02-d09-dump.txt)
  await page.waitForTimeout(150); await page.evaluate(() => { location.hash = '#/quiz/D09'; }); await page.waitForTimeout(300);
  let longest = 0;
  for (let i = 0; i < 20; i++) {
    const prompt = await txt(page, '.quiz .panel p'); const opts = await page.locator('.quiz .opt').allInnerTexts();
    if (i === 0) await shot(page, `e${evening}-d09-card1`);
    const k = D09_ANSWERS[i] ?? 1;
    await page.keyboard.press(String(k)); await page.waitForTimeout(60);
    const fb = await txt(page, '.quiz .panel p.ok, .quiz .panel p.danger');
    const right = /^Right/.test(fb) ? k : opts.findIndex(o => fb.includes(o.replace(/^\d/, '').trim().slice(0, 40))) + 1;
    const lens = opts.map(o => o.length); const li = lens.indexOf(Math.max(...lens)) + 1; if (li === right) longest++;
    log(F, `D09 card ${i + 1}: ${prompt}\n   ${opts.join('\n   ')}\n   -> ${k}: ${fb}`);
    if (i === 6) await shot(page, `e${evening}-d09-card7`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  }
  const r = await txt(page, '.quiz .panel'); log(F, '== D09 RESULT ==\n' + r + `\n(longest option was the right one on ${longest}/20 cards)`);
  await shot(page, `e${evening}-d09-result`);
  const np = await txt(page, '#next-path');
  return { min: 5, res: `${(/\d+ \/ 20 correct [★☆]{3}/.exec(r) ?? ['?'])[0]}; longest-option right on ${longest}/20; Next: ${np}` };
}

// ---------- drives
const base = (tier: number, extra: Record<string, unknown> = {}) => ({ mode: tier === 0 ? 'card' : 'card', chart: tier > 0, leadRule: process.env.PT11_LEADRULE ?? 'cardA',   // PT-11: Silver reads the ramp lead the way the withheld card says (chart (a) cell); PT11_LEADRULE=convert models a Josh who converts the net loss into the lead (scratch evening 3)
  start: 'count', warn: true, pullUp: true, scale: 4, log: (s: string) => log(F, s), ...extra }) as any;
async function debrief(label: string): Promise<{ stars: string; text: string; next: string }> {
  await page.waitForTimeout(600);
  if (!/debrief/.test(page.url())) { log(F, 'NOT FINISHED ' + page.url()); await shot(page, `${label}-unfinished`); return { stars: 'unfinished', text: '', next: '' }; }
  await shot(page, `${label}-debrief`);
  for (const d of await page.locator('details').all()) await d.evaluate(e => (e as HTMLDetailsElement).open = true);
  const text = await page.locator('#view').innerText(); log(F, `== DEBRIEF ${label} ==\n` + text);
  const next = await txt(page, '#nextdrill'); const btns = (await page.locator('#view .actions button').allInnerTexts()).join(' | ');
  log(F, 'debrief buttons: ' + btns);
  return { stars: starsOf(text), text, next };
}
async function preread(label: string): Promise<any> {
  await hold(page);
  const rb = page.locator('#resume-banner button', { hasText: /Start fresh/ }); if (await rb.count()) { log(F, 'resume banner: ' + await txt(page, '#resume-banner') + ' -> Start fresh'); await rb.first().click(); await hold(page); }
  await shot(page, `${label}-preread`);
  log(F, `== ${label} HINT ==\n` + await txt(page, '#hintbar') + '\n== PREREAD ==\n' + await txt(page, '#preread') + '\n== PERF ==\n' + (await txt(page, '#perfcard')).slice(0, 1500));
  return obs(page);
}
let lastTod = 0;
async function lapLoop(): Promise<number> {   // D01: L as the bumper passes each marker
  let o = await obs(page); let laps = 0; let lastSign: number | null = null; let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 40000 && o && o.phase !== 'finished'; i++) {
    if (o.phase === 'running' && !o.stopwatch.running) await page.keyboard.press(' ');
    const sign = o.ahead.find((f: any) => f.kind === 'sign' || /MARKER/i.test(f.label ?? ''));
    if (lastSign !== null && lastSign < 60 && (!sign || sign.approxDistanceFt > lastSign + 50)) { await adv(page, 0.25 + (rnd() - 0.5) * 0.16); await page.keyboard.press('l'); laps++; }
    lastSign = sign ? sign.approxDistanceFt : null;
    await adv(page, sign && sign.approxDistanceFt < 300 ? 0.05 : 0.5); o = await obs(page); if (o && typeof o.tod === 'number') lastTod = o.tod;
  }
  return laps;
}
async function noteBox(s: string): Promise<void> { const ni = page.locator('input[placeholder^="note"]'); await ni.click(); await ni.type(s); await page.keyboard.press('Enter'); await page.locator('#view').focus().catch(() => {}); }

/** D10: card follower; if Dad goes off course, the lost doctrine (notice ~20 s, U, watch reset+start, stop it on "Back on course", note lost 2x). */
async function d10(tier: number, label: string): Promise<number> {
  const b = base(tier, { uturnOnDeadEnd: false });
  let r = await playHuman(page, { ...b, until: "o.driver.state === 'offcourse' || !!o.offCourseHint" });
  let wallS = r.wall; let o = await obs(page);
  if (o && o.phase !== 'finished' && !/debrief/.test(page.url())) {
    log(F, `OFF COURSE at tod ${o.tod.toFixed(1)} line ${o.currentLine}; driver: ${(await txt(page, '#driverlog')).split('\n').slice(-4).join(' / ')}`);
    await adv(page, 20); wallS += 20; o = await obs(page);
    await shot(page, `${label}-offcourse`);
    log(F, `+20 s: state ${o.driver.state}; alert: ${await txt(page, '#alert')}; perf: ${(await txt(page, '#perfcard')).slice(0, 400)}`);
    await page.keyboard.press('u'); await page.keyboard.press('Shift+R'); await page.keyboard.press(' ');
    const t0 = o.tod;
    for (let i = 0; i < 3000; i++) { await adv(page, 0.2); wallS += 0.2; if (/Back on course/.test(await txt(page, '#driverlog'))) break; }
    await page.keyboard.press(' '); o = await obs(page);
    const secs = o.stopwatch?.reading ?? (o.tod - t0); const lost = Math.round(2 * secs);
    log(F, `back on course at ${o.tod.toFixed(1)}: watch ${secs.toFixed(1)} s, lost ${lost}`);
    await noteBox(`lost ${lost}`); await page.keyboard.press(' ');
    r = await playHuman(page, { ...b, keepState: true }); wallS += r.wall;
  }
  return wallS;
}
/** D06 Bronze: copy the printed Packard cell for every MARK pair from the C overlay (as the objective says), typed in the notes box, then drive by the card. */
async function d06Copy(label: string): Promise<number> {
  const o = await obs(page); const book = o.book as any[];
  await page.keyboard.press('c'); await page.waitForTimeout(200);
  const ov = await page.locator('body').innerText(); await page.keyboard.press('Escape'); await page.locator('#view').focus().catch(() => {});
  const table = (tag: string): Record<string, number> => {   // a grid from the overlay text: the header row of OUT speeds, then one row per IN speed (blank diagonal cells kept)
    const i = ov.indexOf(tag); const blk = ov.slice(i, i + 3000).split('\n'); const out: Record<string, number> = {}; let cols: number[] = [];
    for (const line of blk) { if (cols.length && /^\(/.test(line.trim())) break; const c = line.split('\t').map(x => x.trim()); const ne = c.filter(Boolean);
      if (!cols.length) { if (ne.length >= 8 && ne.every(x => !isNaN(Number(x)))) cols = ne.map(Number); continue; }
      if (c.length >= cols.length + 1) { const vals = c.slice(c.length - cols.length); const row = Number(c[c.length - cols.length - 1]); if (!isNaN(row) && c[c.length - cols.length - 1] !== '') cols.forEach((cv, k) => { if (vals[k] !== '' && !isNaN(Number(vals[k]))) out[`${row}>${cv}`] = Number(vals[k]); }); } }
    return out; };
  const A = table('(a) ACCELERATION'), B = table('(b) STOP & GO'), C = table('(c) TURNS');
  log(F, `chart parse sizes a ${Object.keys(A).length} b ${Object.keys(B).length} c ${Object.keys(C).length}; a 0>40 ${A['0>40']} b 50>40 ${B['50>40']} c 40>35 ${C['40>35']}`);
  const notes: string[] = [];
  for (const m of book.filter(x => /^MARK \w\d (in|out)/.test(x.text ?? ''))) {
    const p = /(Stop & go|Accel|Turn|Stop in the middle) (\d+) > (\d+)/.exec(m.text); if (!p) continue;
    const [_, kind, vi, vo] = p; const k = `${vi}>${vo}`;
    const note = kind === 'Stop & go' ? `stopgo ${k} = ${B[k]}` : kind === 'Accel' ? `accel ${k} = ${A[k]}` : kind === 'Turn' ? `turn ${k} = ${C[k]}` : `stopmid ${k} = ${(15 - (B[k] ?? NaN)).toFixed(1)}`;
    if (!notes.includes(note)) notes.push(note);
  }
  log(F, 'D06 copied notes: ' + notes.join(' | '));
  for (const n of notes) await noteBox(n);
  const r = await playHuman(page, base(0)); return r.wall + notes.length * 20;   // ~20 s to find and copy each cell
}
/** D07: watch reset+start at the asterisk, L at every calibration box, notes "cal N = i / c", k = printed / mine set while parked at the restart. */
async function d07(tier: number, label: string): Promise<number> {
  const o0 = await obs(page); const cal = (o0.book as any[]).filter(b => b.section === 'calibration');
  let first = true; let lastCum = 0; let lastPrinted = 0; let prevCum = 0; let wallS = 0;
  for (let i = 0; i < cal.length; i++) {
    const c = cal[i];
    const r = await playHuman(page, { ...base(tier), keepState: !first, until: `o.ahead.some(f => f.nodeId === '${c.nodeId}' && f.approxDistanceFt <= 12) || (S.lastPassedLine || 0) >= ${c.n}` }); first = false; wallS = r.wall;
    const o = await obs(page); if (o.phase === 'finished') break;
    if (i === 0) { await page.keyboard.press('Shift+R'); await page.keyboard.press(' '); continue; }
    await page.keyboard.press('l'); await page.waitForTimeout(50);
    const w = await obs(page); const laps = w.stopwatch?.laps ?? []; const lp = laps[laps.length - 1];
    const cum = typeof lp === 'number' ? lp : lp ? (lp.cumulative ?? lp.total ?? lp.split ?? null) : null; const iv = cum !== null ? cum - prevCum : null; if (cum !== null) prevCum = cum;
    const fmt = (x: number) => `${Math.floor(x / 60)}m${(x % 60).toFixed(1).padStart(4, '0')}`;
    if (cum !== null && iv !== null) { await noteBox(`cal ${i} = ${fmt(iv)} / ${fmt(cum)}`); lastCum = cum; lastPrinted = c.perfectCumulative ?? 0; }
  }
  const k = lastCum ? Math.round(lastPrinted / lastCum * 10000) / 10000 : 1; log(F, `D07 k = ${lastPrinted} / ${lastCum.toFixed(1)} = ${k}`);
  let r = await playHuman(page, { ...base(tier), keepState: true, until: "o.driver.state === 'waiting:hold'" }); wallS = r.wall;
  await page.locator('#cal-k').fill(String(k)).catch(() => {}); await page.locator('#cal-setk').click().catch(() => {}); await page.locator('#view').focus().catch(() => {});
  log(F, 'set factor: ' + await txt(page, '#alert'));
  r = await playHuman(page, { ...base(tier), keepState: true }); return r.wall + 180;   // + 3 min for the arithmetic and the notes
}
async function drive(id: string, tier: number): Promise<{ min: number; res: string }> {
  const label = `e${evening}-${id}-t${tier}-${(tries[`${id}/${tier}`] = (tries[`${id}/${tier}`] ?? 0) + 1)}`;
  const o0 = await preread(label);
  log(F, `launch ${JSON.stringify(o0.launch)} lines ${o0.book.length}`);
  let wallS = 0;
  if (id === 'D01') { const b = page.locator('#skip'); log(F, 'D01 pre-read button: ' + await b.innerText().catch(() => 'none')); await b.click().catch(() => {}); let o = await obs(page); for (let i = 0; i < 1200 && o.phase === 'preread'; i++) { await adv(page, 0.1); o = await obs(page); } const t0 = o.tod; const laps = await lapLoop(); log(F, 'D01 laps ' + laps); wallS = (lastTod - t0) + 60; }
  else if (id === 'D10') wallS = await d10(tier, label);
  else if (id === 'D06' && tier === 0) wallS = await d06Copy(label);
  else if (id === 'D07' || id === 'D17') wallS = await d07(tier, label);
  else {
    const extra: Record<string, unknown> = {};
    if (id === 'D03') { extra.scale = 1; extra.countAloud = true; }
    if (['D08', 'D18', 'D08b', 'D11'].includes(id)) { extra.makeUp = true; extra.countAloud = true; }
    { const pc = await txt(page, '#perfcard'); if (/Legal mode/.test(pc) && id !== 'D16') {   // PT-11: a legal-rung drill (no computed card, no start count): Josh launches on his own time minus the 0 > speed cell of the simple chart, K at holds
        const v = (o0.book as any[])[0]?.speed ?? 35; const row = pc.split('\n').map(r => r.trim().split(/\s+/)).find(c => Number(c[0]) === v && c.length >= 4); const lead = row ? Math.round(Number(row[2])) : 4;
        Object.assign(extra, { mode: 'legal', start: 'own', lead, kAtHolds: true, countAloud: true, ta: true }); log(F, `legal rung: own start, lead ${lead} s (0 > ${v} on the simple chart)`); } }
    if (id === 'D16') extra.scale = 8;   // PT-11: D16 runs at 8x by default (PLAY-040); Josh keeps the default
    if (id === 'D16' && tier > 0) { extra.mode = 'legal'; extra.kAtHolds = true; extra.start = 'own'; extra.lead = 4; }
    if (id === 'D16' && tier === 0) {   // the fast-forward on a full start (PLAY-026): where does it land?
      const b = page.locator('#skip'); const bt = await b.innerText().catch(() => 'none'); await b.click().catch(() => {}); await page.waitForTimeout(150);
      const o = await obs(page); log(F, `D16 fast-forward "${bt}" -> tod ${o.tod} secondsToLaunch ${o.launch?.secondsToLaunch?.toFixed(1)} count "${await txt(page, '#start-count')}"`); await shot(page, `${label}-after-ff`); await page.locator('#view').focus().catch(() => {});
      record({ kind: 'probe', what: 'D16 ff', secondsToLaunch: o.launch?.secondsToLaunch });
    }
    const r = await playHuman(page, { ...base(tier, extra), snap: async (n: string) => { await shot(page, `${label}-${n}`); } });
    wallS = r.wall;
  }
  const d = await debrief(label);
  const min = wallS / 60 + 4;
  return { min, res: `${d.stars}; Debrief Next: ${d.next}` };
}

// ---------- the evening
log(F, `######## EVENING ${evening}, budget ${budget} min`);
await goto(page, '#/');
await shot(page, `e${evening}-home-start`);
log(F, '== HOME at the start of the evening ==\n' + await txt(page, '#starthere-panel'));
if (evening === 2) log(F, 'resume banner / last runs: ' + await txt(page, '#lastruns'));
for (let step = 0; step < 60; step++) {
  await goto(page, '#/'); await page.waitForTimeout(150);
  const btn = await txt(page, '#starthere'); const kind = await page.locator('#starthere').getAttribute('data-next').catch(() => null);
  if (btn === '(none)') { const end = await txt(page, '#starthere-locked, #path-complete'); log(F, 'NO NEXT BUTTON: ' + end); record({ kind: 'end', wall, text: end }); await shot(page, `e${evening}-home-end`); break; }
  if (wall >= budget - 5) { log(F, `budget spent at ${wall.toFixed(0)} min; Home says ${btn}`); record({ kind: 'stop', wall, next: btn }); await shot(page, `e${evening}-home-end`); break; }
  await page.locator('#starthere').click(); await page.waitForTimeout(300);
  const url = page.url(); log(F, `\n######## step ${step} at ${wall.toFixed(0)} min: Home "${btn}" (${kind}) -> ${url}`);
  let out: { min: number; res: string } = { min: 1, res: '?' };
  try {
    let m: RegExpExecArray | null;
    if ((m = /#\/school\/([\w-]+)/.exec(url))) out = await lesson(m[1]!);
    else if (/#\/quiz\/D09/.test(url)) out = await d09();
    else if ((m = /#\/cockpit\/drill\/(\w+)\/(\d)\//.exec(url))) {
      const k = `${m[1]}/${m[2]}`; if ((tries[k] ?? 0) >= 3) { log(F, 'third failure on ' + k + ': Josh stops for the night'); record({ kind: 'stuck', wall, step: btn }); break; }
      out = await drive(m[1]!, Number(m[2]));
    } else { log(F, 'unknown destination ' + url); record({ kind: 'unknown', url }); break; }
  } catch (e) { log(F, 'STEP ERROR ' + String(e).slice(0, 500)); record({ kind: 'error', step: btn, err: String(e).slice(0, 300) }); await shot(page, `e${evening}-error-${step}`); await h.save(); break; }
  wall += out.min;
  record({ kind: 'step', step, home: btn, url, min: Math.round(out.min * 10) / 10, wall: Math.round(wall), res: out.res });
  log(F, `>> ${btn}: ${out.res} (${out.min.toFixed(1)} min, evening ${wall.toFixed(0)} min)`);
  await h.save();
}
await goto(page, '#/'); log(F, '== HOME at the end of the evening ==\n' + await txt(page, '#starthere-panel'));
log(F, 'errors: ' + JSON.stringify(h.errors) + ' dialogs ' + JSON.stringify(h.dialogs));
await h.close();
