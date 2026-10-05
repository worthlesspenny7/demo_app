/** PT-12: copy of the PT-11 script, port 4183, scratch pt12. */
/** PT-12 (copy of pt11; copy of pt10-human + the TS/G turning-stop column at Silver/legal). PT-10 (copy of pt07-human). PT-07 human navigator model (copy of pt05-human with the PLAY-003 hold fast-forward in the wall estimate, 'leave AT' lunch cards and the red Done button). Decisions are made in the page from what a person can see (book rows, perf card text, the road's
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
  turnStops?: boolean;                       // PT-11: at a stop that turns, take TS/G - S/G (the simple chart's turning-stop column) off the dwell, as the pause-arithmetic lesson teaches (default on)
  makeUp?: boolean;                          // PT-10: Bronze pace aid > 3 s late and cruising free: the 10 % rule (call v x 1.1 for 10 x the seconds), then back to v
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
    const go = li ? li.launchTime : (node ? R.sim.holdGoTod(node) : null); if (go !== null && go - o.tod > 45) return req; }   // PT-11: HOLD_FF_MARGIN_S 45
  if (o.carStopped || o.driver.waitingForGo) return 1;
  const near = o.ahead.length ? Math.min(...o.ahead.map(f => f.approxDistanceFt)) : null; if (near !== null && near <= 800) return 1;
  if (o.ahead.some(f => f.kind === 'slow' || f.kind === 'construction' || f.gateDown || f.signalColor === 'red')) return 1;
  const cd = o.aids && o.aids.countdown; if (cd !== undefined && cd !== null && cd >= 0 && cd <= 15) return 1;
  return req; };
const rnd = () => { S.rng = (S.rng * 1664525 + 1013904223) % 4294967296; return S.rng / 4294967296; };
const book = R.observe().book;
let simSpent = 0;
if (O.chart && !S.chartT) { const t = card(); const m = {}; for (const row of t.split('\\n')) { const c = row.trim().split(/\\s+/); if (c.length >= 4 && /^\\d+$/.test(c[0]) && /^[\\d.]+$/.test(c[1]) && /^[\\d.]+$/.test(c[2])) { const up = c.find(x => x.startsWith('\u2191')); const dn = c.find(x => x.startsWith('\u2193')); m[Number(c[0])] = { dec: Number(c[1]), acc: Number(c[2]), sg: Number(c[3]), tsg: Number(c[4]), up: up ? Number(up.slice(1)) : null, dn: dn ? Number(dn.slice(1)) : null }; } } if (Object.keys(m).length) S.chartT = m; }
const CH = (v) => (S.chartT && S.chartT[v]) || null;
const leadCol = (a, b) => { const d = b - a; const k = d > 0 ? 'up' : 'dn'; const fig = (v) => { const r = CH(v); return r && typeof r[k] === 'number' && !isNaN(r[k]) ? r[k] : null; };   // PT-12: the simple chart's Lead column, read the way the Silver card says (leadSource)
  if (Math.abs(d) === 10) return fig(a); if (Math.abs(d) % 10 === 0) { let t = 0; for (let v = a; d > 0 ? v < b : v > b; v += d > 0 ? 10 : -10) { const f = fig(v); if (f === null) return null; t += f; } return Math.round(t * 10) / 10; }
  const f = fig(a); return f === null ? null : Math.round(f * (Math.abs(d) < 10 ? 0.5 : 1.5) * 10) / 10; };
const leadOf = (a, b) => { if (a === b || a == null || b == null) return null; if ((O.leadRule || 'lead') === 'lead' && S.chartT) { const L = leadCol(a, b); if (L !== null) return L; } const CA = (O.leadRule || 'lead') === 'lead' ? null : (O.chartA || S.chartA); const cell = CA ? CA[a + '>' + b] : undefined; if (cell !== undefined) { const L = O.leadRule === 'convert' ? cell * b / Math.abs(b - a) : cell; return Math.round(L * 10) / 10; } const A = CH(a), B = CH(b); if (!A || !B) return null; return Math.round((b > a ? Math.max(0, B.acc - A.acc) : Math.max(0, A.dec - B.dec)) * 10) / 10; };   // PT-11 Silver: the withheld card says 'minus the ramp lead (chart (a), X to Y; press C)': leadRule 'cardA' (default) takes the chart (a) cell as printed; 'convert' turns the net loss into the lead that cancels it (loss x OUT / |OUT - IN|)   // PT-11 Silver: half a ramp = the chart loss difference (timed-leads lesson)
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
  // PT-10: a card follower presses K when the Bronze card asks for the clock read (N7 fix: "Read the clock now (K)")
  if (O.mode === 'card' && o.phase === 'running') { const c = card(); if (/Read the clock now \\(K\\)/.test(c)) { const kk = 'k' + o.currentLine + (/IN time/.test(c) ? 'in' : 'out') + (o.stoppedAtLine || 0); if (!S.called[kk]) { S.called[kk] = 1; keys.push(['k']); notes.push('K: card asked for the clock read at line ' + o.currentLine + ' tod ' + o.tod.toFixed(1) + ' ahead ' + JSON.stringify(o.ahead.slice(0, 2).map(f => [f.label || f.kind, Math.round(f.approxDistanceFt)]))); } } }
  // PT-12 harness fix: in a transit (warm-up, after the calibration run, lunch) nothing is timed: a card follower calls the card's "call/drive about N mph" and never makes up against the pace aid there
  const curN = o.currentLine || 1; let lastRs = 0, lastTr = 0; for (const b of book) { if (b.n > curN) break; if (b.restartTime !== undefined || b.section === 'restart') lastRs = b.n; if ((b.transit && !b.transit.end) || b.section === 'calibration' || b.section === 'transit' || b.section === 'warmup') lastTr = b.n; }
  S.untimed = lastTr > 0 && lastTr >= lastRs;
  if (O.mode === 'card' && o.phase === 'running' && !o.driver.waitingForGo) { const tp = ((document.querySelector('#transitpace') || {}).innerText || '') + ' ' + card(); const m = /(?:call|drive) about (\d+) mph/.exec(tp); if (m && o.driver.targetIndicated !== Number(m[1]) && !S.called['tp' + curN + '-' + m[1]]) { S.called['tp' + curN + '-' + m[1]] = 1; keys.push(['speed', m[1]]); S.lastSpeed = Number(m[1]); notes.push('transit: the card says about ' + m[1] + ' mph (line ' + curN + ')'); } }
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
    if (f.approxDistanceFt < 8) { S.lineTod = S.lineTod || {}; if (!S.lineTod[ins.n]) { S.lineTod[ins.n] = Math.round(o.tod); if (O.kAtHolds && ins.section === 'transit' && /Begin Transit/i.test(ins.text || '')) { keys.push(['k']); notes.push('K passing the transit sign, line ' + ins.n + ' (IN time ' + Math.round(o.tod) + ')'); } } }
    if (ins.turn && ins.turn !== 'S' && !S.called['t' + ins.n] && f.approxDistanceFt <= (O.turnFt || 500)) { S.called['t' + ins.n] = 1; keys.push(['turn', ins.turn]); }
    if (ins.turn === 'S' && !S.called['t' + ins.n] && f.approxDistanceFt <= (O.turnFt || 500) && !ins.pause) { S.called['t' + ins.n] = 1; keys.push(['turn', 'S']); }
    // speed changes at a landmark (not after a stop: the driver takes the out speed on GO)
    if (typeof ins.speed === 'number' && !ins.pause && !ins.timed && ins.section !== 'restart' && ins.section !== 'start' && !S.called['v' + ins.n]) {
      let ft = 15;
      if (O.mode === 'card') { const m = /Speed (\\d+) → (\\d+): call it ([\\d.]+) s before the landmark \\((\\d+) ft\\)/.exec(card()); if (m && Number(m[2]) === ins.speed) ft = Number(m[4]); else { ft = 15; const ld = O.chart && S.lastSpeed ? leadOf(S.lastSpeed, ins.speed) : null; if (ld !== null) { ft = Math.max(15, ld * S.lastSpeed * 1.4667); if (!S.called['ln' + ins.n]) { S.called['ln' + ins.n] = 1; notes.push('Silver ramp lead line ' + ins.n + ' ' + S.lastSpeed + '>' + ins.speed + ': ' + ld + ' s = ' + Math.round(ft) + ' ft'); } } } }
      if (O.mode === 'legal') { ft = 60; const ld = O.chart && S.lastSpeed ? leadOf(S.lastSpeed, ins.speed) : null; if (ld !== null) ft = Math.max(15, ld * S.lastSpeed * 1.4667); }   // PT-11: legal + simple chart: half a ramp from the chart   // Josh's own rule of thumb: half a ramp is about a car length or four at 35
      if (f.approxDistanceFt <= ft) { S.called['v' + ins.n] = 1; if (S.lastSpeed !== ins.speed) { keys.push(['speed', String(ins.speed)]); S.lastSpeed = ins.speed; } }
    }
    if (ins.timed && !S.called['ts' + ins.n] && f.approxDistanceFt <= 15 && !ins.pause) {
      S.called['ts' + ins.n] = 1; const T = ins.timed;
      let at = T.seconds; if (O.mode === 'card') { const m = /call (\\d+) at ([\\d.]+) s(?! minus)/.exec(card()); if (m) at = Number(m[2]); else if (O.chart) { const ld = leadOf(T.holdSpeed ?? ins.speed ?? S.lastSpeed, T.thenSpeed ?? T.then ?? T.nextSpeed); if (ld !== null) { at = T.seconds - ld; notes.push('Silver timed lead line ' + ins.n + ': ' + T.seconds + ' - ' + ld + ' = ' + at.toFixed(1)); } } } if (O.mode === 'legal') { at = T.seconds - 2; const ld = O.chart ? leadOf(T.holdSpeed ?? ins.speed ?? S.lastSpeed, T.thenSpeed ?? T.then ?? T.nextSpeed) : null; if (ld !== null) at = T.seconds - ld; }
      if (ins.speed !== undefined || T.holdSpeed !== undefined) { const hs = T.holdSpeed ?? ins.speed; if (hs && S.lastSpeed !== hs) { keys.push(['speed', String(hs)]); S.lastSpeed = hs; } }
      if (O.mode !== 'naive') keys.push(['l']);   // PT-10: 'L lap at the landmark' (D04 keys)
      S.timers.push({ at: o.tod + at, mph: T.thenSpeed ?? T.then ?? T.nextSpeed, line: ins.n, lead: T.seconds - at }); notes.push('timed line ' + ins.n + ': call at +' + at.toFixed(1) + ' s from the sign');
    }
  }
  for (const t of S.timers.slice()) if (!t.done && o.tod >= t.at) { t.done = true; if (t.lap) { keys.push(['l']); notes.push('lap at the ghost departure, line ' + t.line); } else if (t.mph) { keys.push(['speed', String(t.mph)]); const prevV = S.lastSpeed; S.lastSpeed = t.mph;
    // PT-12 GEN-017: a chained timed change: Column C "35 / 1m25s / 45 / 1m02s / 55": the next step is counted from the ghost's change (this call + its lead), minus the next lead
    const ins = book.find(b => b.n === t.line); const ch = !O.noChain && ins && ins.timed && ins.timed.chain; const k = (t.step || 0); if (ch && ch[k]) { const ld1 = t.lead || 0; const ld2 = O.mode === 'naive' ? 0 : (leadOf(t.mph, ch[k].thenSpeed) ?? (O.mode === 'card' ? 1.4 : 2)); const at = t.at + ld1 + ch[k].seconds - ld2; S.timers.push({ at, mph: ch[k].thenSpeed, line: t.line, step: k + 1, lead: ld2 }); notes.push('chain step ' + (k + 1) + ' line ' + t.line + ': ' + t.mph + ' for ' + ch[k].seconds + ' s, then ' + ch[k].thenSpeed + ': call at +' + (at - o.tod).toFixed(1) + ' s (lead ' + ld2 + ')'); } } }
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
        if (O.chart && ins.pause && !(O.mode === 'card' && /dwell ([\\d.]+) s after/.test(card()))) { const outV = ins.timed ? ins.timed.holdSpeed : ins.speed; const a = CH(vin), b = CH(outV ?? vin); if (a && b) { dwell = ins.pause - a.dec - b.acc; const turns = O.turnStops !== false && ins.turn && ins.turn !== 'S' && b.tsg > 0 && b.sg > 0; const add = turns ? Math.round((b.tsg - b.sg) * 10) / 10 : 0; dwell -= add; notes.push('chart dwell ' + vin + '>' + (outV ?? vin) + ' = ' + ins.pause + ' - ' + a.dec + ' - ' + b.acc + (turns ? ' - turn ' + add + ' (TS/G - S/G at ' + (outV ?? vin) + ')' : '') + ' = ' + dwell.toFixed(1)); } }
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
        if (ins.timed) { let at = ins.timed.seconds; if (O.mode === 'card') { const m = /call (\\d+) at ([\\d.]+) s(?! minus)/.exec(card()); if (m) at = Number(m[2]); else if (O.chart) { const ld = leadOf(ins.timed.holdSpeed, ins.timed.thenSpeed); if (ld !== null) at = ins.timed.seconds - ld; } } if (O.mode === 'legal') { at = ins.timed.seconds - 2; const ld = O.chart ? leadOf(ins.timed.holdSpeed, ins.timed.thenSpeed) : null; if (ld !== null) at = ins.timed.seconds - ld; } const fg = O.mode === 'card' ? /\\(([\\d.]+) s after "Stopped"\\), not from your go: call \\d+ [\\d.]+ s after that = ([\\d.]+) s after "Stopped"/.exec(card()) : null; if (fg) { S.timers.push({ at: S.stopAt + Number(fg[1]), lap: true, line: ins.n }); S.timers.push({ at: S.stopAt + Number(fg[2]), mph: ins.timed.thenSpeed, line: ins.n }); notes.push('timed after stop line ' + ins.n + ': card anchor, lap at +' + fg[1] + ', call ' + ins.timed.thenSpeed + ' at +' + fg[2] + ' s after Stopped'); } else if ((O.mode === 'card' || O.mode === 'legal') && O.chart && ins.pause && CH(S.vin || 35)) { const gd = S.stopAt - CH(S.vin || 35).dec + ins.pause; S.timers.push({ at: gd + at, mph: ins.timed.thenSpeed, line: ins.n }); notes.push('Silver: timed after stop line ' + ins.n + ' counted from the ghost departure (Stopped - DEC + pause) +' + at.toFixed(1)); } else S.timers.push({ at: o.tod + 0.3 + at, mph: ins.timed.thenSpeed, line: ins.n }); notes.push('timed after stop line ' + ins.n + ': call ' + ins.timed.thenSpeed + ' at +' + at + ' s from my GO'); }
      }
    } else if (st === 'waiting:hold') {
      const line = o.stoppedAtLine || o.currentLine; const ins = book[line - 1] || {};
      if (O.kAtHolds && !S.called['kin' + line]) { S.called['kin' + line] = 1; keys.push(['k']); notes.push('K on pulling into the hold at line ' + line); }
      if (ins.restartTime !== undefined && !S.called['rs' + line]) {
        let lead = 4; if (O.mode === 'card') { const m = /launch at (\\d\\d):(\\d\\d):(\\d\\d)/.exec(card()); if (m) lead = ins.restartTime - (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])); }
        if (O.mode === 'naive') lead = 0;
        if (O.chart && O.mode !== 'card') { const c0 = CH(ins.speed); if (c0) lead = Math.round(c0.acc); }
        if (O.kAtHolds && !S.called['kr' + line] && o.tod >= ins.restartTime - lead - 8) { S.called['kr' + line] = 1; keys.push(['k']); notes.push('K before the restart, line ' + line); }
        if (!S.restartNoted) { S.restartNoted = 1; notes.push('restart hold line ' + line + ' out ' + ins.restartTime + ' lead ' + lead); }
        if (O.warn && !S.called['rw' + line] && o.tod >= ins.restartTime - lead - 31) { S.called['rw' + line] = 1; keys.push(['w']); }
        if (o.tod >= ins.restartTime - lead - 0.2) { S.called['rs' + line] = 1; keys.push(['g']); if (typeof ins.speed === 'number' && ins.speed !== S.lastSpeed) { keys.push(['speed', String(ins.speed)]); S.lastSpeed = ins.speed; } notes.push('G at restart line ' + line + ' tod ' + o.tod.toFixed(1)); }
      }
      else if (ins.restartTime === undefined && !S.called['hold' + line]) {
        const c = card(); const m = /= OUT (\\d\\d):(\\d\\d):(\\d\\d)/.exec(c);
        if (m) { const out = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]); const lead = O.mode === 'naive' ? 0 : 4; if (o.tod >= out - lead - 0.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('G at exact-transit OUT line ' + line + ' tod ' + o.tod.toFixed(1) + ' (OUT ' + out + ')'); } }
        else if (/leave (?:by|AT) (\\d\\d):(\\d\\d):(\\d\\d)/.test(c) && O.mode === 'card') { const q = /leave (?:by|AT) (\\d\\d):(\\d\\d):(\\d\\d)/.exec(c); const t = Number(q[1]) * 3600 + Number(q[2]) * 60 + Number(q[3]); if (o.tod >= t - 4.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('G at lunch leave-by time line ' + line + ' tod ' + o.tod.toFixed(1)); } }
        else if (O.mode === 'legal' && /Leave this point (\\d+) minutes after instruction #(\\d+)/.test(ins.text || '') && S.lineTod && S.lineTod[Number(/instruction #(\\d+)/.exec(ins.text)[1])]) { const q = /Leave this point (\\d+) minutes after instruction #(\\d+)/.exec(ins.text); const out = S.lineTod[Number(q[2])] + Number(q[1]) * 60; const c0 = CH(ins.speed); const lead = c0 ? Math.round(c0.acc) : 4; if (O.kAtHolds && !S.called['kout' + line] && o.tod >= out - lead - 8) { S.called['kout' + line] = 1; keys.push(['k']); } if (o.tod >= out - lead - 0.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('legal: G at exact-transit OUT line ' + line + ' = IN ' + S.lineTod[Number(q[2])] + ' + ' + q[1] + ' min - lead ' + lead + ', tod ' + o.tod.toFixed(1)); } }
        else if (O.mode === 'legal' && /leave here (\\d+) minutes prior to your end-of-transit time/i.test(ins.text || '')) { const q = /leave here (\\d+) minutes prior/i.exec(ins.text); const rs = book.find(b => b.n > line && b.restartTime !== undefined); if (rs) { const out = rs.restartTime - Number(q[1]) * 60; if (o.tod >= out - 4.2) { S.called['hold' + line] = 1; keys.push(['g']); notes.push('legal: G at lunch, restart ' + rs.restartTime + ' - ' + q[1] + ' min, tod ' + o.tod.toFixed(1)); } } }
        else if (/leave (by|AT)/.test(c) || O.mode === 'legal') { if (!S.holdAt) S.holdAt = o.tod; if (o.tod - S.holdAt > 5) { S.called['hold' + line] = 1; S.holdAt = null; keys.push(['g']); notes.push('G at hold line ' + line + ' (leave by / no time)'); } }
        else if (!S.holdNoted) { S.holdNoted = 1; notes.push('hold at line ' + line + ' with no time I can read: card=' + c.slice(0, 200)); }
      }
    } else if (st === 'waiting:ask') {
      const ins = book.find(b => b.n >= o.currentLine && b.turn) || {}; if (!S.called['ask' + o.tod.toFixed(0)]) { S.called['ask' + o.tod.toFixed(0)] = 1; keys.push(['turn', ins.turn || 'S']); notes.push('Dad asked left or right: called ' + (ins.turn || 'S')); }
    } else if (st === 'waiting:roadEnd' && O.uturnOnDeadEnd && !S.called['u' + o.tod.toFixed(0)]) { S.called['u' + o.tod.toFixed(0)] = 1; keys.push(['u']); notes.push('dead end: U'); }
  } else { if (S.stopLine) { S.stopLine = null; } }
  if (!o.driver.waitingForGo && o.driver.targetIndicated) S.vin = o.driver.targetIndicated;
  if (O.makeUp && o.phase === 'running' && !o.driver.waitingForGo && !o.carStopped) {
    const late = o.aids && typeof o.aids.earlyLate === 'number' ? o.aids.earlyLate : null;
    const blocked = o.ahead.some(f => f.kind === 'slow' || f.signalColor === 'red' || f.gateDown || (f.approxDistanceFt < 700 && f.nodeId));
    const cpNear = o.ahead.some(f => f.kind === 'checkpoint' && f.approxDistanceFt <= 50);
    if (o.ahead.some(f => f.kind === 'slow' && f.approxDistanceFt <= 150) && !S.called['p' + Math.floor(o.tod / 8)]) { S.called['p' + Math.floor(o.tod / 8)] = 1; keys.push(['p']); notes.push('P: asked Dad to pass when clear'); }
    if (S.mu && cpNear) { keys.push(['speed', String(S.mu.v)]); S.lastSpeed = S.mu.v; notes.push('checkpoint: stop making up, back to ' + S.mu.v); S.mu = null; S.muBlock = o.tod + 20; }
    else if (S.mu && o.tod >= S.mu.until) { keys.push(['speed', String(S.mu.v)]); S.lastSpeed = S.mu.v; notes.push('make-up done: back to ' + S.mu.v); S.mu = null; }
    else if (!S.mu && !S.untimed && !(S.muBlock > o.tod) && late !== null && late > 3 && late < 300 && !blocked && S.lastSpeed && !S.timers.some(t => !t.done)) {
      const v = S.lastSpeed; const up = Math.round(v * 1.1); const dur = 10 * late * (v * 1.1) / (up) ; S.mu = { v, until: o.tod + Math.min(dur, 300) };
      keys.push(['speed', String(up)]); notes.push('10 % rule: ' + late.toFixed(1) + ' s late at ' + v + ': ' + up + ' for ' + Math.min(dur, 300).toFixed(0) + ' s');
    }
  }
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
  if (opts.chart && !opts.keepState && !(opts as any).chartA) {   // PT-11: a Silver navigator reads chart (a) off the C overlay before the start, as the withheld card tells him
    await page.keyboard.press('c'); await page.waitForTimeout(200); const ov = await page.locator('body').innerText(); await page.keyboard.press('Escape'); await page.locator('#view').focus().catch(() => {});
    const i = ov.indexOf('(a) ACCELERATION'); const A: Record<string, number> = {};
    if (i >= 0) { let cols: number[] = []; for (const line of ov.slice(i, i + 4000).split('\n')) { if (cols.length && /^\(/.test(line.trim())) break; const c = line.split('\t').map(x => x.trim()); const ne = c.filter(Boolean);
      if (!cols.length) { if (ne.length >= 8 && ne.every(x => !isNaN(Number(x)))) cols = ne.map(Number); continue; }
      if (c.length >= cols.length + 1) { const vals = c.slice(c.length - cols.length); const row = Number(c[c.length - cols.length - 1]); if (!isNaN(row) && c[c.length - cols.length - 1] !== '') cols.forEach((cv, k) => { if (vals[k] !== '' && !isNaN(Number(vals[k]))) A[`${row}>${cv}`] = Number(vals[k]); }); } } }
    if (Object.keys(A).length) await page.evaluate(a => { (window as any).__HS.chartA = a; }, A);
    opts.log?.(`   . chart (a) read off the C overlay: ${Object.keys(A).length} cells (30>40 = ${A['30>40']}, 40>50 = ${A['40>50']}), lead rule ${(opts as any).leadRule ?? 'cardA'}`);
  }
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
    if (r.err) opts.log?.('BRAIN ERROR ' + r.err);
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
