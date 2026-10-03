/** A modelled first-time-but-competent navigator. Reads the on-screen perf card text, presses REAL keys, has a human reaction latency, logs everything a human would feel. */
import type { Page } from 'playwright';
import { shot } from './rev-common.js';

export interface PlayOpts {
  name: string;
  reaction?: number;       // s of human latency before a key lands
  goNoise?: number;        // sd (s) of dwell error at stops
  lapMarkers?: boolean;    // D01
  pressN?: boolean;        // advance the book line by hand when Dad does not (Gold)
  stopAtFinish?: boolean;
  snapAt?: { when: string; file: string }[];
  maxSim?: number;
  dwellFull?: boolean;     // naive: wait the full printed pause
  bezel?: boolean;         // by the card with real [ ] bezel keys, Space at Stopped, G on the index
  noWatchStart?: boolean;
  restartAccel?: number;
  table?: { speeds: number[]; loss: number[][]; turnExtra: number };
  speedCal?: number;       // multiply assigned speeds to get indicated (cheat card), 1 = timewise
  verbose?: boolean;
}
export interface PlayLog { keys: number; keyList: string[]; simSeconds: number; wall1x: number; wallAdaptive4x: number; wallAdaptive8x: number; waitingSeconds: number; messages: string[]; notes: string[] }

const SETUP = `(() => { const w = window; w.__P = w.__P || { called: new Set(), timers: [], seenEv: 0, waitSince: null, hold: false, lastSpeed: null, lapped: new Set(), prevMarker: null, wall1: 0, wall4: 0, wall8: 0, waiting: 0, pendingKeys: [], seenMsg: 0, dwellTarget: null, rng: 12345 }; })()`;

export async function startRun(page: Page, o: { departEarly?: number; noWatch?: boolean } = {}): Promise<void> {
  await page.evaluate('window.__P = undefined'); await page.evaluate(SETUP);
  const lead = o.departEarly ?? 4;
  // advance through the pre-read to T-lead, then depart (D), start the watch (Space) like a navigator
  const toGo = await page.evaluate(() => (window as any).__rally.observe().secondsToStart);
  if (toGo > lead) await page.evaluate(s => (window as any).__rally.advance(s), toGo - lead);
  await page.keyboard.press('d');
  if (!o.noWatch) await page.keyboard.press(' ');
}

/** Returns when finished or when `stopOn` reports true. Keys are pressed for real (physical keyboard events). */
export async function drive(page: Page, opts: PlayOpts, until?: string): Promise<PlayLog> {
  await page.evaluate(SETUP);
  const log: PlayLog = { keys: 0, keyList: [], simSeconds: 0, wall1x: 0, wallAdaptive4x: 0, wallAdaptive8x: 0, waitingSeconds: 0, messages: [], notes: [] };
  for (let guard = 0; guard < 4000; guard++) {
    const r: any = await page.evaluate(({ opts, until }) => {
      const w = window as any; const R = w.__rally; const P = w.__P;
      if (!R) return { done: 'gone' };
      const reaction = opts.reaction ?? 0.3;
      const rnd = () => { P.rng = (P.rng * 1664525 + 1013904223) % 4294967296; return P.rng / 4294967296; };
      const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / 0.7071; };
      const card = () => (document.querySelector('#perfcard') as HTMLElement | null)?.innerText ?? '';
      const strip = (n: number) => { const a = document.querySelector('#book .row[data-n="' + n + '"] .ann') as HTMLElement | null; const m = a ? /card ([0-9.]+) s/.exec(a.innerText) : null; return m ? Number(m[1]) : null; };
      const book = R.observe().book as any[];
      const scale = (req: number, o: any) => { const near = o.ahead.length ? Math.min(...o.ahead.map((f: any) => f.approxDistanceFt)) : null; const haz = o.ahead.some((f: any) => f.kind === 'slow' || f.kind === 'construction' || f.gateDown || f.signalColor === 'red'); if (o.phase !== 'running') return req; if (o.carStopped || o.driver.waitingForGo) return 1; if (near !== null && near <= 800) return 1; if (haz) return 1; if (o.aids.countdown != null && o.aids.countdown >= 0 && o.aids.countdown <= 15) return 1; if (o.stopwatch.running && o.stopwatch.bezelRemaining > 0 && o.stopwatch.bezelRemaining <= 15) return 1; return req; };
      const calc = (n: number): number | null => { const T = opts.table; if (!T) return null; let vin: number | null = null; for (let q = 0; q < n - 1; q++) { const b = book[q]; if (typeof b.speed === 'number') vin = b.speed; else if (b.timed) vin = b.timed.thenSpeed; } const ins = book[n - 1]; const vout = typeof ins.speed === 'number' ? ins.speed : ins.timed ? ins.timed.holdSpeed : null; if (vin === null || vout === null) return null; const near = (v: number) => { let bi = 0; T.speeds.forEach((x: number, i: number) => { if (Math.abs(x - v) < Math.abs(T.speeds[bi] - v)) bi = i; }); return bi; }; const loss = T.loss[near(vin)][near(vout)]; const extra = ins.turn && ins.turn !== 'S' ? T.turnExtra : 0; return Math.round(Math.max(0, ins.pause - loss - extra) * 10) / 10; };
      let simSpent = 0;
      for (let k = 0; k < 400; k++) {
        let o = R.observe();
        if (o.phase === 'finished') return { done: 'finished' };
        if (until && eval(until)) return { done: 'until' };
        const keys: string[][] = []; const notes: string[] = [];
        // --- timers (timed changes)
        for (const t of P.timers) if (!t.done && o.tod >= t.at) { t.done = true; keys.push(['speed', String(t.mph)]); P.lastSpeed = t.mph; notes.push('timed call ' + t.mph + ' at ' + o.tod.toFixed(1)); }
        // node crossing events -> timed schedule
        const evs = R.sim.events; for (let i = P.seenEv; i < evs.length; i++) { const e = evs[i]; if (e.type === 'node') { const ins = book.find((b: any) => b.nodeId === e.detail?.nodeId); if (ins?.timed) { const m = /call (\d+) at (\d+\.\d)/.exec(card()); /* card is for current line; fall back to book */ const lead = 2.0; P.timers.push({ at: e.tod + (ins.pause ?? 0) + ins.timed.seconds - lead - (opts.reaction ?? 0.3) * 0 + (gauss() * (opts.goNoise ?? 0.4)), mph: ins.timed.thenSpeed, n: ins.n }); } } } P.seenEv = evs.length;
        // book line following (Gold: no check-off)
        if (opts.pressN && o.driver.lastExecutedLine !== null && o.currentLine <= o.driver.lastExecutedLine) keys.push(['n']);
        // --- features
        for (const f of o.ahead) {
          if (opts.lapMarkers && f.kind === 'sign') { P.prevMarker = { d: f.approxDistanceFt }; }
          if (f.kind === 'finish' && opts.stopAtFinish !== false && f.approxDistanceFt < 900 && !P.hold) { keys.push(['s']); P.hold = true; notes.push('S at finish ' + f.approxDistanceFt); }
          if (!f.nodeId) continue;
          const ins = book.find((b: any) => b.nodeId === f.nodeId); if (!ins) continue;
          if (opts.pressN === true && ins.n > o.currentLine && f.approxDistanceFt <= 700 && !P.called.has(ins.n + 20000)) { P.called.add(ins.n + 20000); for (let q = o.currentLine; q < ins.n; q++) keys.push(['n']); }
          if (ins.turn && !P.called.has(ins.n) && f.approxDistanceFt <= 400) { P.called.add(ins.n); keys.push(['turn', ins.turn]); }
          if (typeof ins.speed === 'number' && !ins.timed && !P.called.has(ins.n + 10000)) {
            const c = card(); const m = /Speed (\d+) → (\d+): call it (\d+\.\d) s before the landmark \((\d+) ft\)/.exec(c);
            const lead = (m && Number(m[4])) || 100;
            if (f.approxDistanceFt <= Math.max(100, lead + 40)) { P.called.add(ins.n + 10000); if (P.lastSpeed !== ins.speed) { keys.push(['speed', String(Math.round(ins.speed * (opts.speedCal ?? 1) * 10) / 10)]); P.lastSpeed = ins.speed; } }
          }
          if (ins.timed && !P.called.has(ins.n + 10000) && f.approxDistanceFt <= 100) { P.called.add(ins.n + 10000); keys.push(['speed', String(ins.timed.holdSpeed)]); P.lastSpeed = ins.timed.holdSpeed; }
        }
        // --- stops
        if (opts.bezel) {
          // pre-set the bezel on the approach to a pause line, from the book strip's "card x s"
          for (const f of o.ahead) {
            const ins = f.nodeId ? book.find((b: any) => b.nodeId === f.nodeId) : null;
            if (ins && ins.pause && !P.preset?.[ins.n] && f.approxDistanceFt <= 900 && !o.driver.waitingForGo && !o.stoppedAtLine && !o.stopwatch.running && !P.needStop) {
              const d = opts.table ? calc(ins.n) : strip(ins.n); if (d !== null) {
                P.preset = P.preset || {}; P.preset[ins.n] = true; P.bezelFor = ins.n; P.bezelTarget = d;
                const cur = o.stopwatch.bezel as number; let need = (((d - cur) % 60) + 60) % 60; let steps = Math.round(need * 5); let neg = false; if (steps > 150) { steps = 300 - steps; neg = true; }
                const big = Math.floor(steps / 5), small = steps % 5;
                keys.push(['bezel', String(neg ? -big : big), String(neg ? -small : small)]); notes.push('bezel to ' + d + ' for line ' + ins.n + ' (' + (neg ? '-' : '+') + big + ' and ' + small + ' small)');
              }
            }
          }
          if (o.driver.waitingForGo && /stop/.test(o.driver.state) && !P.hold && o.stoppedAtLine !== P.lastGo) {
            if (P.waitSince === null) { P.waitSince = o.tod; P.watchOn = false; }
            if (P.armed !== o.stoppedAtLine && !o.stopwatch.running) { P.armed = o.stoppedAtLine; const rj = 0.25; R.advance(rj); simSpent += rj; P.wall1 += rj; keys.push(['space']); notes.push('Space at Stopped (line ' + o.stoppedAtLine + ', card line shown: ' + (/Line (\d+)/.exec(card())?.[1]) + ')'); }
            else if (P.armed === o.stoppedAtLine && o.stopwatch.running && (o.stopwatch.bezelRemaining <= 0.12 || o.stopwatch.bezelRemaining >= 59.9)) { const rj = 0.15; R.advance(rj); simSpent += rj; P.wall1 += rj; keys.push(['g']); notes.push('G at index, dwell so far ' + (o.tod - P.waitSince).toFixed(1) + ' target ' + P.bezelTarget); P.waitSince = null; P.needStop = true; P.lastGo = o.stoppedAtLine; }
          } else if (!o.driver.waitingForGo) { P.waitSince = null; P.lastGo = null; if (P.needStop && o.stopwatch.running) { P.needStop = false; keys.push(['space']); keys.push(['reset']); } }
        } else if (o.driver.waitingForGo && o.stoppedAtLine && book[o.stoppedAtLine - 1]?.restartTime !== undefined && book[o.stoppedAtLine - 1]?.section === 'restart' && !P.hold) {
          const m = /standing-start loss \((\d+\.\d) s\)/.exec(card()); const acc = m ? Number(m[1]) : (opts.restartAccel ?? 5.5); const rt = book[o.stoppedAtLine - 1].restartTime;
          if (!P.restartNoted) { P.restartNoted = true; notes.push('restart hold at tod ' + o.tod.toFixed(1) + ' out-time ' + rt + ' accel ' + acc + ' state ' + o.driver.state); }
          if (o.tod + 0.3 >= rt - acc) { keys.push(['g']); notes.push('G at restart tod ' + o.tod.toFixed(1)); }
      } else if (o.driver.waitingForGo && /stop/.test(o.driver.state) && !P.hold) {
          if (P.waitSince === null) { P.waitSince = o.tod; const c = card(); const m = /dwell (\d+\.\d) s after/.exec(c); const pm = /Pause (\d+)/.exec(book[o.currentLine - 1]?.text ?? ''); const bl = book[(o.stoppedAtLine ?? o.currentLine) - 1]; const bp = bl?.pause ?? (pm ? Number(pm[1]) : 15); const target = opts.dwellFull ? bp : (m ? Number(m[1]) : Math.max(0, bp - (bl?.turn && bl.turn !== 'S' ? 10 : 8))); P.dwellTarget = Math.max(0, target + gauss() * (opts.goNoise ?? 0.5)); notes.push('stop dwell target ' + P.dwellTarget.toFixed(1) + ' card:' + (m ? m[1] : 'none') + ' stopped-line ' + o.stoppedAtLine + ' cur ' + o.currentLine); }
          if (o.tod - P.waitSince >= P.dwellTarget) { keys.push(['g']); P.waitSince = null; }
        } else if (!o.driver.waitingForGo) P.waitSince = null;
        if (o.driver.waitingForGo) P.waiting += 0.1;
        // --- marker lapping (D01): lap when a sign has just passed (disappeared)
        if (opts.lapMarkers) { const cur = o.ahead.find((f: any) => f.kind === 'sign'); if (P.prevMarker && P.prevMarker.d <= 100 && !cur) { P.prevMarker = null; keys.push(['lap']); } else if (!cur) P.prevMarker = null; }
        if (keys.length) {
          // human latency, then hand the keys to the physical keyboard
          const rj = Math.max(0.12, reaction + gauss() * 0.06); const a = R.advance(rj); simSpent += rj; P.wall1 += reaction; P.wall4 += reaction / scale(4, a); P.wall8 += reaction / scale(8, a);
          return { keys, notes, simSpent, tod: a.tod };
        }
        // step size: fine near features, coarse otherwise
        const near = o.ahead.length ? Math.min(...o.ahead.map((f: any) => f.approxDistanceFt)) : 9999;
        const dt = (opts.lapMarkers && near < 400) || near < 500 || o.driver.waitingForGo ? 0.1 : 0.5;
        const a = R.advance(dt); simSpent += dt; P.wall1 += dt; P.wall4 += dt / scale(4, o); P.wall8 += dt / scale(8, o);
      }
      return { simSpent, tod: R.observe().tod, cont: true };
    }, { opts: { reaction: opts.reaction, goNoise: opts.goNoise, lapMarkers: opts.lapMarkers, pressN: opts.pressN, stopAtFinish: opts.stopAtFinish, speedCal: opts.speedCal, dwellFull: opts.dwellFull, bezel: opts.bezel, table: opts.table }, until });
    if (r.notes) for (const n of r.notes) { log.notes.push(n); if (opts.verbose) console.log('   note', n); }
    if (r.keys) for (const k of r.keys as string[][]) await press(page, k, log);
    if (r.done) { await finalize(page, log); return log; }
  }
  await finalize(page, log);
  return log;
}

async function finalize(page: Page, log: PlayLog): Promise<void> {
  const p: any = await page.evaluate(() => { const P = (window as any).__P; return P ? { w1: P.wall1, w4: P.wall4, w8: P.wall8, wait: P.waiting } : null; });
  if (p) { log.wall1x = p.w1; log.wallAdaptive4x = p.w4; log.wallAdaptive8x = p.w8; log.waitingSeconds = p.wait; }
}

const ARROW: Record<string, [string | null, string]> = { L: [null, 'ArrowLeft'], R: [null, 'ArrowRight'], S: [null, 'ArrowUp'], BL: ['b', 'ArrowLeft'], BR: ['b', 'ArrowRight'], AL: ['a', 'ArrowLeft'], AR: ['a', 'ArrowRight'], JL: ['j', 'ArrowLeft'], JR: ['j', 'ArrowRight'] };
export async function press(page: Page, k: string[], log?: PlayLog): Promise<void> {
  const rec = (s: string, n = 1) => { if (log) { log.keys += n; log.keyList.push(s); } };
  if (k[0] === 'turn') { const [mod, key] = ARROW[k[1]!] ?? [null, 'ArrowUp']; if (mod) await page.keyboard.down(mod); await page.keyboard.press(key); if (mod) await page.keyboard.up(mod); rec(`turn ${k[1]}`, mod ? 2 : 1); }
  else if (k[0] === 'speed') { for (const ch of k[1]!) await page.keyboard.press(ch); await page.keyboard.press('Enter'); rec(`speed ${k[1]}`, k[1]!.length + 1); }
  else if (k[0] === 'space') { await page.keyboard.press(' '); rec('space'); }
  else if (k[0] === 'reset') { await page.keyboard.press('Shift+R'); rec('Shift+R'); }
  else if (k[0] === 'bezel') { const big = Number(k[1]), small = Number(k[2]); for (let i = 0; i < Math.abs(big); i++) await page.keyboard.press(big > 0 ? ']' : '['); for (let i = 0; i < Math.abs(small); i++) await page.keyboard.press(small > 0 ? 'Shift+]' : 'Shift+['); rec(`bezel ${big}+${small}/5`, Math.abs(big) + Math.abs(small)); }
  else if (k[0] === 'lap') { await page.keyboard.press('l'); rec('lap'); }
  else { await page.keyboard.press(k[0]!); rec(k[0]!); }
}
