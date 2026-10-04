/** PT-07 human navigator model (copy of pt05-human with the PLAY-003 hold fast-forward in the wall estimate, 'leave AT' lunch cards and the red Done button). Decisions are made in the page from what a person can see (book rows, perf card text, the road's
 *  "ahead" list at its approximate distances, Dad's lines, the clock/watch), then pressed as REAL keys with a human latency.
 *  Sim time moves only through window.__rally.advance. Wall time is estimated from the cockpit's own scale chip (#scale).
 *  Modes: naive = wait the printed pause, call speeds at the sign, count timed segments from the sign/go;
 *         card  = follow the perf card (dwell, lead ft, call time, launch time, press N when told);
 *         legal = no card: dwell from the handbook chart overlay (C) values the player read beforehand (opts.dwellTable). */
import type { Page } from 'playwright';
export interface HumanOpts {
  mode: 'naive' | 'card' | 'legal';
  start?: 'count' | 'immediate' | 'own';   // count: D on the visible GO; immediate: D at once; own: D at own time minus opts.lead
  lead?: number; reaction?: number; turnFt?: number; scale?: number; stopAtFinish?: boolean; warn?: boolean; pullUp?: boolean;
  dwellTable?: Record<string, number>;      // legal: "vin>vout" -> dwell for a 15 s pause (chart (b) sit value)
  turnCapLoss?: number;                     // legal: extra seconds Josh subtracts at a turning stop
  useStopwatch?: boolean;                   // Space at "Stopped", G when the watch shows the dwell (else count in his head = sim time + noise)
  countAloud?: boolean;                     // X once per stop (PROTO-001)
  pressNWhenBehind?: boolean;               // cross off lines himself (Gold, legal)
  maxSim?: number; log?: (s: string) => void; snap?: (name: string) => Promise<void>; snapAtStop?: number;
  ta?: boolean; until?: string; keepState?: boolean;                             // at a train/hazard hold: time it and press T at the TA point (D08b handles the form itself)
  uturnOnDeadEnd?: boolean;
}
export interface HumanLog { keys: string[]; notes: string[]; sim: number; wall: number; msgs: string[]; finished: boolean }

const BRAIN = `(() => {
const w = window; const R = w.__rally; const O = w.__HO; const S = w.__HS;
const card = () => (document.querySelector('#perfcard') || {}).innerText || '';
const chip = () => ((document.querySelector('#scale') || {}).textContent || '1x');
const scaleNow = (o) => { // the cockpit's effectiveScale rules (src/ui/viewmodels/timescale.ts) + the launch-count rule, computed because the UI loop is held
  const req = O.scale || 1; if (O.locked) return 1;
  if (o.launch && o.launch.secondsToLaunch !== undefined && o.launch.secondsToLaunch <= 40 && o.launch.secondsToLaunch > -3) return 1;
  if (o.phase === 'preread') return req; if (o.phase !== 'running') return 1;
  if (o.driver.waitingForGo && R.sim.waitReason === 'hold' && o.stoppedAtLine) { // PLAY-003 hold fast-forward (cockpit.ts holdSecondsLeft)
    const ins = book[o.stoppedAtLine - 1]; const node = ins && R.sim.sc.course.nodes.find(n => n.id === ins.nodeId); const li = R.sim.launchInfo();
    const go = li ? li.launchTime : (node ? R.sim.holdGoTod(node) : null); if (go !== null && go - o.tod > 60) return req; }
  if (o.carStopped || o.driver.waitingForGo) return 1;
  const near = o.ahead.length ? Math.min(...o.ahead.map(f => f.approxDistanceFt)) : null; if (near !== null && near <= 800) return 1;
  if (o.ahead.some(f => f.kind === 'slow' || f.kind === 'construction' || f.gateDown || f.signalColor === 'red')) return 1;
  const cd = o.aids && o.aids.countdown; if (cd !== undefined && cd !== null && cd >= 0 && cd <= 15) return 1;
  return req; };
const rnd = () => { S.rng = (S.rng * 1664525 + 1013904223) % 4294967296; return S.rng / 4294967296; };
const book = R.observe().book;
let simSpent = 0;
for (let k = 0; k < 600; k++) {
  const o = R.observe();
  if (o.phase === 'finished') return { wall: S.wall, done: 'finished', simSpent };
  if (simSpent + S.sim >= O.maxSim) return { wall: S.wall, done: 'maxSim', simSpent };
  if (O.until && (new Function('o', 'S', 'return (' + O.until + ');'))(o, S)) return { wall: S.wall, done: 'until', simSpent };
  const keys = []; const notes = [];
  // --- before the start
  if (o.phase === 'preread') {
    const left = o.secondsToStart; const L = o.launch;
    if (O.warn && !S.warned && L && L.secondsToLaunch <= 31) { S.warned = true; keys.push(['w']); }
    if (O.pullUp && !S.pulled && o.startQueue && !o.startQueue.carAheadAtSign && L && L.secondsToLaunch <= 25) { S.pulled = true; keys.push(['q']); }
    if (O.start === 'immediate') keys.push(['d']);
    else if (O.start === 'own' && left <= (O.lead || 0)) keys.push(['d']);
    else if (O.start === 'count') { const c = (document.querySelector('#start-count') || {}).textContent || ''; if (c === 'GO') keys.push(['d']); else if (!L && left <= 0.3) keys.push(['d']); }
    if (keys.length) return { wall: S.wall, keys, notes, simSpent };
  }
  if (o.phase === 'running' && !S.watchOn && O.useStopwatch !== false) { S.watchOn = true; if (!o.stopwatch.running) keys.push([' ']); }
  // --- book following (a human crosses off lines)
  if (/press N to jump/.test(card())) keys.push(['n']);
  else if (O.pressNWhenBehind && o.driver.lastExecutedLine == null) {
    // no check-off from Dad: advance when a feature for a later line is nearer than the current one
    const lastPassed = S.lastPassedLine || 0; if (o.currentLine <= lastPassed) keys.push(['n']);
  }
  // --- the road ahead
  for (const f of o.ahead) {
    if (f.kind === 'finish' && O.stopAtFinish !== false && f.approxDistanceFt < 700 && !S.sAtFinish && /Observation/i.test(book[book.length - 1].text || '')) { S.sAtFinish = true; keys.push(['s']); notes.push('S for the observation checkpoint at ' + Math.round(f.approxDistanceFt) + ' ft'); }
    if (!f.nodeId) continue;
    const ins = book.find(b => b.nodeId === f.nodeId); if (!ins) continue;
    if (f.approxDistanceFt < 30) S.lastPassedLine = Math.max(S.lastPassedLine || 0, ins.n);
    if (ins.turn && ins.turn !== 'S' && !S.called['t' + ins.n] && f.approxDistanceFt <= (O.turnFt || 500)) { S.called['t' + ins.n] = 1; keys.push(['turn', ins.turn]); }
    if (ins.turn === 'S' && !S.called['t' + ins.n] && f.approxDistanceFt <= (O.turnFt || 500) && !ins.pause) { S.called['t' + ins.n] = 1; keys.push(['turn', 'S']); }
    // speed changes at a landmark (not after a stop: the driver takes the out speed on GO)
    if (typeof ins.speed === 'number' && !ins.pause && !ins.timed && ins.section !== 'restart' && ins.section !== 'start' && !S.called['v' + ins.n]) {
      let ft = 15;
      if (O.mode === 'card') { const m = /Speed (\\d+) → (\\d+): call it ([\\d.]+) s before the landmark \\((\\d+) ft\\)/.exec(card()); if (m && Number(m[2]) === ins.speed) ft = Number(m[4]); else ft = 15; }
      if (O.mode === 'legal') ft = 60;   // Josh's own rule of thumb: half a ramp is about a car length or four at 35
      if (f.approxDistanceFt <= ft) { S.called['v' + ins.n] = 1; if (S.lastSpeed !== ins.speed) { keys.push(['speed', String(ins.speed)]); S.lastSpeed = ins.speed; } }
    }
    if (ins.timed && !S.called['ts' + ins.n] && f.approxDistanceFt <= 15 && !ins.pause) {
      S.called['ts' + ins.n] = 1; const T = ins.timed;
      let at = T.seconds; if (O.mode === 'card') { const m = /call (\\d+) at ([\\d.]+) s/.exec(card()); if (m) at = Number(m[2]); } if (O.mode === 'legal') at = T.seconds - 2;
      if (ins.speed !== undefined || T.holdSpeed !== undefined) { const hs = T.holdSpeed ?? ins.speed; if (hs && S.lastSpeed !== hs) { keys.push(['speed', String(hs)]); S.lastSpeed = hs; } }
      S.timers.push({ at: o.tod + at, mph: T.thenSpeed ?? T.then ?? T.nextSpeed, line: ins.n }); notes.push('timed line ' + ins.n + ': call at +' + at.toFixed(1) + ' s from the sign');
    }
  }
  for (const t of S.timers) if (!t.done && o.tod >= t.at) { t.done = true; if (t.mph) { keys.push(['speed', String(t.mph)]); S.lastSpeed = t.mph; } }
  if (O.ta && o.ta && o.ta.windowOpen && !S.taSeen['w' + Math.floor(o.ta.windowEndsTod)]) { S.taSeen['w' + Math.floor(o.ta.windowEndsTod)] = 1; return { wall: S.wall, taOpen: o.ta, simSpent }; }
  // --- holds
  const st = o.driver.state;
  if (o.driver.waitingForGo) {
    if (st === 'waiting:stop') {
      const line = o.stoppedAtLine; const ins = book[line - 1] || {};
      if (S.stopLine !== line) {
        S.stopLine = line; S.stopAt = o.tod; S.goSent = false; S.curCalled = S.lastSpeed; S.lastSpeed = ins.timed ? ins.timed.holdSpeed : ins.speed;
        let dwell = ins.pause || 0; const vin = S.vin || 35;
        if (O.mode === 'card') { const m = /dwell ([\\d.]+) s after/.exec(card()); if (m) dwell = Number(m[1]); }
        if (O.mode === 'legal' && O.dwellTable) { const key = vin + '>' + (ins.speed ?? S.curCalled ?? vin); const sit = O.dwellTable[key]; if (sit !== undefined) dwell = (ins.pause || 15) - (15 - sit) - (ins.turn && ins.turn !== 'S' ? (O.turnCapLoss || 0) : 0); notes.push('legal dwell for ' + key + ' = ' + dwell.toFixed(1)); }
        if (!ins.pause) dwell = 0.6;   // STOP without a pause: go as soon as stopped
        S.dwell = dwell + (rnd() - 0.5) * 0.3;
        notes.push('stopped line ' + line + ' pause ' + ins.pause + ' dwell plan ' + S.dwell.toFixed(1) + ' (card: ' + (card().match(/dwell [\\d.]+ s after/) || ['-'])[0] + ')');
        if (O.useStopwatch) { if (o.stopwatch.running) keys.push(['shift+r']); keys.push([' ']); }
        if (O.countAloud) keys.push(['x']);
        if (O.snapAtStop === line) return { wall: S.wall, keys, notes, simSpent, snap: 'stop' + line };
        if (keys.length) return { wall: S.wall, keys, notes, simSpent };
      }
      if (!S.goSent && o.tod - S.stopAt >= S.dwell) {
        S.goSent = true; keys.push(['g']);
        const outV = ins.timed ? ins.timed.holdSpeed : ins.speed; if (typeof outV === 'number' && outV !== S.curCalled) { keys.push(['speed', String(outV)]); S.curCalled = outV; }
        if (ins.timed) { let at = ins.timed.seconds; if (O.mode === 'card') { const m = /call (\\d+) at ([\\d.]+) s/.exec(card()); if (m) at = Number(m[2]); } if (O.mode === 'legal') at = ins.timed.seconds - 2; S.timers.push({ at: o.tod + 0.3 + at, mph: ins.timed.thenSpeed, line: ins.n }); notes.push('timed after stop line ' + ins.n + ': call ' + ins.timed.thenSpeed + ' at +' + at + ' s from my GO'); }
      }
    } else if (st === 'waiting:hold') {
      const line = o.stoppedAtLine || o.currentLine; const ins = book[line - 1] || {};
      if (ins.restartTime !== undefined && !S.called['rs' + line]) {
        let lead = 4; if (O.mode === 'card') { const m = /launch at (\\d\\d):(\\d\\d):(\\d\\d)/.exec(card()); if (m) lead = ins.restartTime - (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])); }
        if (O.mode === 'naive') lead = 0;
        if (!S.restartNoted) { S.restartNoted = 1; notes.push('restart hold line ' + line + ' out ' + ins.restartTime + ' lead ' + lead); }
        if (O.warn && !S.called['rw' + line] && o.tod >= ins.restartTime - lead - 31) { S.called['rw' + line] = 1; keys.push(['w']); }
        if (o.tod >= ins.restartTime - lead - 0.2) { S.called['rs' + line] = 1; keys.push(['g']); notes.push('G at restart line ' + line + ' tod ' + o.tod.toFixed(1)); }
      }
      else if (ins.restartTime === undefined && !S.called['hold' + line]) {
        const c = card(); const m = /= OUT (\\d\\d):(\\d\\d):(\\d\\d)/.exec(c);
        if (m) { const out = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]); const lead = O.mode === 'naive' ? 0 : 4; if (o.tod >= out - lead - 0.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('G at exact-transit OUT line ' + line + ' tod ' + o.tod.toFixed(1) + ' (OUT ' + out + ')'); } }
        else if (/leave (?:by|AT) (\\d\\d):(\\d\\d):(\\d\\d)/.test(c) && O.mode === 'card') { const q = /leave (?:by|AT) (\\d\\d):(\\d\\d):(\\d\\d)/.exec(c); const t = Number(q[1]) * 3600 + Number(q[2]) * 60 + Number(q[3]); if (o.tod >= t - 4.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('G at lunch leave-by time line ' + line + ' tod ' + o.tod.toFixed(1)); } }
        else if (/leave (by|AT)/.test(c) || O.mode === 'legal') { if (!S.holdAt) S.holdAt = o.tod; if (o.tod - S.holdAt > 5) { S.called['hold' + line] = 1; S.holdAt = null; keys.push(['g']); notes.push('G at hold line ' + line + ' (leave by / no time)'); } }
        else if (!S.holdNoted) { S.holdNoted = 1; notes.push('hold at line ' + line + ' with no time I can read: card=' + c.slice(0, 200)); }
      }
    } else if (st === 'waiting:ask') {
      const ins = book.find(b => b.n >= o.currentLine && b.turn) || {}; if (!S.called['ask' + o.tod.toFixed(0)]) { S.called['ask' + o.tod.toFixed(0)] = 1; keys.push(['turn', ins.turn || 'S']); notes.push('Dad asked left or right: called ' + (ins.turn || 'S')); }
    } else if (st === 'waiting:roadEnd' && O.uturnOnDeadEnd && !S.called['u' + o.tod.toFixed(0)]) { S.called['u' + o.tod.toFixed(0)] = 1; keys.push(['u']); notes.push('dead end: U'); }
  } else { if (S.stopLine) { S.stopLine = null; } }
  if (!o.driver.waitingForGo && o.driver.targetIndicated) S.vin = o.driver.targetIndicated;
  // a transit (warm-up, untimed) has no assigned speed: Josh works one out from "approximately N miles ... M minutes" and calls it
  if (o.phase === 'running' && st === 'stopped' && !o.driver.waitingForGo && !o.driver.targetIndicated && !S.called['tr' + Math.floor(o.tod / 20)]) {
    S.called['tr' + Math.floor(o.tod / 20)] = 1; const cur = book.slice(0, Math.max(1, o.currentLine)).reverse().find(b => b.transit && b.transit.miles && b.transit.seconds);
    const mph = cur ? Math.max(20, Math.min(50, Math.round(cur.transit.miles / (cur.transit.seconds / 3600)))) : 35;
    keys.push(['speed', String(mph)]); S.lastSpeed = mph; notes.push('car sitting with no speed at tod ' + o.tod.toFixed(0) + ': called ' + mph + ' (transit miles/time)');
  }
  if (st === 'offcourse' && O.uturnOnDeadEnd && !S.called['off' + Math.floor(o.tod / 30)]) { S.called['off' + Math.floor(o.tod / 30)] = 1; keys.push(['u']); notes.push('offcourse: U'); }
  if (keys.length) { const lat = Math.max(0.12, (O.reaction || 0.3) + (rnd() - 0.5) * 0.12); R.advance(lat); simSpent += lat; S.wall += lat / scaleNow(o); return { wall: S.wall, keys, notes, simSpent }; }
  const near = o.ahead.length ? Math.min(...o.ahead.map(f => f.approxDistanceFt)) : 9999;
  const dt = near < 600 || o.driver.waitingForGo || o.phase === 'preread' ? 0.1 : 0.5;
  R.advance(dt); simSpent += dt; S.wall += dt / scaleNow(o);
}
return { wall: S.wall, simSpent };
})()`;

const ARROW: Record<string, [string | null, string]> = { L: [null, 'ArrowLeft'], R: [null, 'ArrowRight'], S: [null, 'ArrowUp'], BL: ['b', 'ArrowLeft'], BR: ['b', 'ArrowRight'], AL: ['a', 'ArrowLeft'], AR: ['a', 'ArrowRight'], JL: ['j', 'ArrowLeft'], JR: ['j', 'ArrowRight'] };
export async function pressKey(page: Page, k: string[]): Promise<void> {
  if (k[0] === 'turn') { const [mod, key] = ARROW[k[1]!] ?? [null, 'ArrowUp']; if (mod) await page.keyboard.down(mod); await page.keyboard.press(key); if (mod) await page.keyboard.up(mod); }
  else if (k[0] === 'speed') { for (const ch of k[1]!) await page.keyboard.press(ch); await page.keyboard.press('Enter'); }
  else if (k[0] === 'shift+r') await page.keyboard.press('Shift+R');
  else await page.keyboard.press(k[0]!);
}
export async function playHuman(page: Page, opts: HumanOpts): Promise<HumanLog> {
  const O = { maxSim: 40000, reaction: 0.3, turnFt: 500, useStopwatch: true, ...opts }; delete (O as any).log; delete (O as any).snap;
  await page.evaluate(({ o, keep }) => { const w = window as any; w.__HO = o; if (!keep || !w.__HS) w.__HS = { rng: 12345, called: {}, timers: [], wall: 0, sim: 0, lastSpeed: null, taSeen: {} }; }, { o: O, keep: !!opts.keepState });
  if (opts.scale && opts.scale > 1 && !opts.keepState) { for (let i = 0; i < Math.round(Math.log2(opts.scale)); i++) await page.keyboard.press('>'); }
  const log: HumanLog = { keys: [], notes: [], sim: 0, wall: 0, msgs: [], finished: false };
  for (let guard = 0; guard < 20000; guard++) {
    const r: any = await page.evaluate(BRAIN).catch(e => ({ done: 'gone', err: String(e) }));
    if (r.simSpent) { log.sim += r.simSpent; await page.evaluate(s => { const S = (window as any).__HS; if (S) S.sim += s; }, r.simSpent).catch(() => {}); }
    for (const n of r.notes ?? []) { log.notes.push(n); opts.log?.('   . ' + n); }
    if (r.snap && opts.snap) await opts.snap(r.snap);
    for (const k of r.keys ?? []) { await pressKey(page, k); log.keys.push(k.join(' ')); }
    if (r.taOpen) await fileTa(page, r.taOpen, opts, log);
    if (typeof r.wall === 'number') log.wall = r.wall;
    if (r.done) { log.finished = r.done === 'finished' || r.done === 'gone'; break; }
  }
  return log;
}

/** At an open TA window: open the form (T), take the helper's claim for every leg with a suggestion, type the 2026 web form fields, file,
 *  and at the end of the stage press "Acknowledge scorecard" (the red "done" button). Real typing via Playwright fill/click. */
export async function fileTa(page: Page, ta: any, opts: HumanOpts, log: HumanLog): Promise<void> {
  const note = (s: string) => { log.notes.push(s); opts.log?.('   . ' + s); };
  await page.keyboard.press('t');
  const helper = await page.locator('#ta-helper').innerText().catch(() => '');
  note(`TA window open (end of stage ${ta.endOfStage}, legs ${JSON.stringify(ta.eligibleLegs)}): helper "${helper}"`);
  if (opts.snap) await opts.snap('ta-' + Math.floor(ta.windowEndsTod));
  const rows = await page.locator('#ta-panel tr').allInnerTexts().catch(() => [] as string[]);
  for (const row of rows) {
    const m = /^(\d+)\s+\S+\s+\S+\s+(\d+)m(\d\d)s\s+(\d+)-(\d+)/.exec(row.trim());
    if (!m || (Number(m[2]) * 60 + Number(m[3])) === 0) continue;
    const leg = m[1]!, sec = Number(m[2]) * 60 + Number(m[3]);
    await page.locator('#ta-car').fill('39').catch(() => {}); await page.locator('#ta-password').fill('1939').catch(() => {}); await page.locator('#ta-phone').fill('555-0139').catch(() => {});
    await page.locator('#ta-leg').selectOption(leg).catch(() => {});
    await page.locator('#ta-from').fill(m[4]!).catch(() => {}); await page.locator('#ta-to').fill(m[5]!).catch(() => {});
    await page.locator('#ta-request').fill(String(sec)).catch(() => {});
    await page.locator('#ta-submit').click().catch(e => note('submit failed ' + e));
    note(`filed leg ${leg}: ${sec} s (lines ${m[4]}-${m[5]}) -> ${await page.locator('#ta-filed').innerText().catch(() => '?')}`);
  }
  const ack = page.locator('#ta-panel button', { hasText: /Done|Acknowledge/i });
  if (ta.endOfStage && await ack.count()) { await ack.first().click().catch(() => {}); note('acknowledged the scorecard'); }
  await page.locator('#view').focus().catch(() => {});
}
