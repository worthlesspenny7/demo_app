/** What time the player actually said go at every start, restart, exact-transit OUT and promoted-stop departure (DRILL-021, DRILL-013). */
import type { Scenario, Instruction } from '../course.js';
import type { StageResult } from '../sim.js';
import { exactTransitBegin } from '../ghost.js';
import { accelLoss } from '../perf-table.js';
import { formatClock } from '../units.js';

export interface Departure {
  kind: 'start' | 'restart' | 'transitOut' | 'promoted';
  line: number;
  /** The second the book says to leave (restart time, IN + interval, scheduled departure). */
  target: number;
  /** When the navigator said go (or the car left the start); null if the hold was never released. */
  actual: number | null;
  /** The navigator may say go this many seconds early to lead the car's standing-start loss. */
  lead: number;
  /** Seconds outside the window [target - lead, target]; Infinity when the departure never happened. */
  err: number;
  text: string;
}

const KIND_LABEL: Record<Departure['kind'], string> = { start: 'Start', restart: 'Restart', transitOut: 'Exact-transit OUT', promoted: 'Lunch departure' };

/** START-001: one line per start / restart against its launch time (own time minus the standing-start net loss), plus the debrief findings it produced. */
export function startFeedback(r: StageResult): string[] {
  const out: string[] = [];
  for (const d of r.startDeltas ?? []) {
    if (d.actual === null || d.delta === null) { out.push(`${d.kind === 'start' ? 'Start' : 'Restart'} (line ${d.line}): never left.`); continue; }
    out.push(`${d.kind === 'start' ? 'Start' : 'Restart'} (line ${d.line}): your time ${formatClock(d.ownTime)}, launch ${formatClock(d.launchTime)} (minus ${Math.round(d.ownTime - d.launchTime)} s for the ${d.netLoss.toFixed(1)} s standing-start loss), left ${formatClock(d.actual)} (${d.delta > 0 ? '+' : ''}${d.delta.toFixed(1)} s against the launch time${d.warned || d.auto ? '' : '; no 30-second warning was given'}).`);
  }
  for (const f of r.findings ?? []) if (f.kind === 'oneMinuteMistake' || f.kind === 'lateLaunch' || f.kind === 'earlyLaunch') out.push(f.text);
  return out;
}

export function departuresOf(r: StageResult, sc: Scenario): Departure[] {
  const out: Departure[] = []; const ev = r.events; const book = sc.book;
  const mk = (kind: Departure['kind'], ins: Instruction, target: number, actual: number | null, lead: number): void => {
    const err = actual === null ? Infinity : actual < target - lead ? target - lead - actual : actual > target ? actual - target : 0;
    const when = actual === null ? 'never left' : `left ${formatClock(actual)}`;
    out.push({ kind, line: ins.n, target, actual, lead, err, text: `${KIND_LABEL[kind]} (line ${ins.n}): ${when}, due ${formatClock(target)}${actual === null ? '' : err === 0 ? ' (on the second)' : ` (${actual > target ? '+' : '-'}${Math.abs(actual > target ? actual - target : target - lead - actual).toFixed(1)} s)`}` });
  };
  let speed = book[0]?.speed ?? 0;
  for (const ins of book) {
    if (ins.n === 1) {
      const dep = ev.find(e => e.type === 'depart');
      mk('start', ins, ins.restartTime ?? sc.startTime, dep ? dep.tod : null, ins.speed ? accelLoss(ins.speed, sc.car) : 0);
      speed = ins.speed ?? speed; continue;
    }
    const vOut = ins.speed ?? speed;
    const isRestart = ins.section === 'restart' && ins.restartTime !== undefined;
    const isExactEnd = !!(ins.transit?.end && ins.transit.exact && ins.restartTime === undefined);
    if (isRestart || isExactEnd || ins.promotedStop) {
      const i0 = ev.findIndex(e => e.type === 'wait' && e.detail?.nodeId === ins.nodeId);
      const rel = i0 < 0 ? undefined : ev.slice(i0 + 1).find(e => e.type === 'release');
      const actual = rel ? rel.tod : null;
      const outFor = (endIns: Instruction): number | null => {
        const begin = exactTransitBegin(book, book.indexOf(endIns)); if (!begin) return null;
        const inEv = ev.find(e => e.type === 'transit.in' && e.detail?.n === begin.n);
        return inEv ? Number(inEv.detail!.tod) + begin.transit!.seconds : null;
      };
      let target: number | null = null; let lead = vOut > 0 ? accelLoss(vOut, sc.car) : 0; let kind: Departure['kind'] = 'restart';
      if (isRestart) target = ins.restartTime!;
      else if (isExactEnd) { target = outFor(ins); kind = 'transitOut'; }
      else if (ins.promotedStop) {
        kind = 'promoted';   // N6: the lunch departure follows the launch rule of every hold: leave at the out-time minus the standing-start loss (lead = accelLoss), same tolerance
        for (let j = book.indexOf(ins) + 1; j < book.length; j++) {
          const x = book[j]!;
          if (x.restartTime !== undefined) { target = x.restartTime - ins.promotedStop.leaveBeforeEndSeconds; break; }
          if (x.transit?.end) { const o = x.transit.exact ? outFor(x) : null; target = o === null ? null : o - ins.promotedStop.leaveBeforeEndSeconds; break; }
        }
      }
      if (target !== null) mk(kind, ins, target, actual, lead);
      else out.push({ kind, line: ins.n, target: 0, actual: null, lead, err: Infinity, text: `${KIND_LABEL[kind]} (line ${ins.n}): the car never got there` });
    }
    speed = ins.timed ? ins.timed.thenSpeed : ins.speed ?? speed;
  }
  return out;
}
