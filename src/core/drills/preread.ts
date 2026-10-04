/** PREREAD-001: pre-read and run-time notes in Column D that D15 and D16 grade: checkpoint arrival times and the chart losses written beside stops and turns. */
import type { Instruction, Scenario } from '../course.js';
import type { StageResult } from '../sim.js';
import { stopLoss, turnLoss } from '../perf-table.js';
import { formatClock } from '../units.js';

export interface NoteGrade { attempted: boolean; good: number; total: number; lines: string[] }

/** "CP3 09:14:22" (or "CP 3 9:14:22 AM"): the checkpoint number and the exact time of day written in Column D at a Timing Checkpoint. */
export function parseCpNotes(texts: string[]): { cp: number; tod: number }[] {
  const out: { cp: number; tod: number }[] = [];
  // ENG-025: "CP1 arrived 9:14:22" and "Checkpoint 1 9:14:22" parse too (up to 12 filler characters)
  for (const t of texts) for (const m of t.matchAll(/\b(?:CP|checkpoint)\s*#?\s*(\d+)\b\D{0,12}?(\d{1,2}):(\d{2}):(\d{2})/gi)) out.push({ cp: Number(m[1]), tod: (Number(m[2]) % 12) * 3600 + Number(m[3]) * 60 + Number(m[4]) });
  return out;
}
const sameWithin = (a: number, b: number, tol: number): boolean => { const d = Math.abs(((a - b) % 43200 + 43200) % 43200); return Math.min(d, 43200 - d) <= tol + 1e-9; };

const annotations = (r: StageResult, opts: { beforeStart?: boolean } = {}): { n: number; text: string }[] => {
  const startTick = r.actions.find(a => a.action.type === 'start')?.tick ?? Infinity;
  return r.actions.filter(a => a.action.type === 'line.annotate' && (!opts.beforeStart || a.tick <= startTick)).map(a => ({ n: (a.action as { n: number }).n, text: (a.action as { text: string }).text })).filter(x => x.text.trim() !== '');
};

/** Timing checkpoint notes ("CP3 09:14:22") graded within 2 s of the actual crossing time (rounded to the second). Graded only when the player wrote at least one. */
export function gradeCheckpointNotes(r: StageResult): NoteGrade {
  const notes = parseCpNotes(annotations(r).map(a => a.text));
  const timing = r.records.filter(x => x.kind === 'timing');
  const lines: string[] = []; let good = 0;
  timing.forEach((rec, i) => {
    const cp = i + 1; const mine = notes.filter(n => n.cp === cp);
    if (rec.actualTod === null) return;
    if (!mine.length) { lines.push(`CP${cp}: no arrival time written (it was ${formatClock(rec.actualTod)}).`); return; }
    const ok = mine.some(n => sameWithin(n.tod, rec.actualTod!, 2));
    if (ok) good++; else lines.push(`CP${cp}: you wrote ${mine.map(n => formatClock(n.tod)).join(' / ')}, the crossing was ${formatClock(rec.actualTod)} (within 2 s needed).`);
  });
  const total = timing.filter(x => x.actualTod !== null).length;
  return { attempted: notes.length > 0, good, total, lines };
}

export interface LineSpeeds { vIn: number; vOut: number }
/** The assigned speed before and after each line (by line number). */
export function lineSpeeds(sc: Scenario): Map<number, LineSpeeds> {
  const out = new Map<number, LineSpeeds>(); let v = 0;
  for (const ins of sc.book) { const vOut = ins.timed ? ins.timed.holdSpeed : ins.speed ?? v; out.set(ins.n, { vIn: v, vOut }); v = ins.timed ? ins.timed.thenSpeed : vOut; }
  return out;
}
const turnAngle = (t: NonNullable<Instruction['turn']>): number => ({ L: 90, R: 90, S: 0, BL: 45, BR: 45, AL: 150, AR: 150, JL: 90, JR: 90 }[t]);

/** The chart loss to pre-write beside a stop (stop & go loss) or a turn (turn loss) for its IN and OUT speeds; null for other lines. */
export function chartLossFor(sc: Scenario, ins: Instruction, sp: LineSpeeds): number | null {
  if (sp.vIn <= 0 || sp.vOut <= 0) return null;
  if (ins.pause) {
    const ang = ins.turn ? turnAngle(ins.turn) : 0; const cap = ang >= 20 ? (ang > 120 ? sc.car.turnSpeedMph.acute : ang >= 60 ? sc.car.turnSpeedMph.turn : sc.car.turnSpeedMph.bear) : undefined;
    return Math.round(stopLoss(sp.vIn, sp.vOut, sc.car, cap) * 10) / 10;
  }
  if (ins.turn && ins.turn !== 'S' && ins.section !== 'start') return Math.round(turnLoss(turnAngle(ins.turn), sp.vIn, sp.vOut, sc.car) * 10) / 10;
  return null;
}
/** Numbers written as chart losses: "loss 10.2", "chart: 2.3", or a signed value like "-2.3" / "+10.2". */
export function lossNumbers(text: string): number[] {
  const out: number[] = []; const used = new Set<number>();
  for (const m of text.matchAll(/(?:loss|lost|chart)\s*[:=]?\s*([-+]?\d+(?:\.\d+)?)/gi)) { out.push(Math.abs(Number(m[1]))); used.add(m.index! + m[0].length - m[1]!.length); }
  // ENG-025: a signed number counts once (not again after "loss:"), and never inside a note that carries a time of day ("restart 9:41:00 -2")
  const hasTime = /\d{1,2}:\d{2}/.test(text);
  if (!hasTime) for (const m of text.matchAll(/(?<![\d.:A-Za-z])[-+](\d+(?:\.\d+)?)(?![\d:])/g)) { if (used.has(m.index!)) continue; out.push(Number(m[1])); }
  // ENG-025: the card's own example, a bare decimal on its own ("10.2"); a whole number alone is a carried speed ("30"), not a loss
  if (!out.length) { const b = /^\s*(\d+\.\d+)\s*$/.exec(text); if (b) out.push(Number(b[1])); }
  return out;
}
/** Chart losses pre-written beside every stop and turn, graded within 1 s of the chart value. Graded only when the player wrote at least one loss. */
export function gradeChartLossNotes(r: StageResult, sc: Scenario): NoteGrade {
  const sp = lineSpeeds(sc); const notes = annotations(r, { beforeStart: true });
  const lines: string[] = []; let good = 0, total = 0;
  const attempted = notes.some(n => lossNumbers(n.text).length > 0);
  for (const ins of sc.book) {
    const s = sp.get(ins.n)!; const loss = chartLossFor(sc, ins, s); if (loss === null) continue;
    total++; const mine = notes.filter(n => n.n === ins.n).flatMap(n => lossNumbers(n.text));
    if (mine.some(x => Math.abs(x - loss) <= 1)) good++; else lines.push(`Line ${ins.n}: ${ins.pause ? 'stop' : 'turn'} ${s.vIn}>${s.vOut}: write the chart loss (${loss.toFixed(1)} s), within 1 s${mine.length ? `; you wrote ${mine.join(' / ')}` : ''}.`);
  }
  return { attempted, good, total, lines };
}
