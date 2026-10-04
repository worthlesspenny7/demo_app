/** LOST-001: the lost doctrine (10a 2024 95:29). On a wrong turn: start the stopwatch at the turn-around, double the time back to the junction for the lost time, rejoin 30 s behind a car known to be on course, write the leg off and reset at the next checkpoint. */
import type { StageResult } from '../sim.js';

export interface LostExcursion {
  /** TOD of the turn-around call and of the rejoin at the junction. */
  turnAroundTod: number; rejoinTod: number;
  /** Truth: doubling the time from the turn-around to the junction. */
  doubled: number;
  /** The stopwatch was started within 3 s of the turn-around. */
  watchStarted: boolean;
  /** The lost time the player wrote ("lost 94", "lost 1:34"), if any, and whether it is within 2 s of the doubled time. */
  noted: number | null; ok: boolean;
}

/** "lost 94", "lost 1:34", "doubled 1:34.5": the doubled turn-around time in seconds (m:ss allowed). */
export function parseLostNote(text: string): number | null {
  const m = /(?:lost|double[d]?)\D{0,12}?(\d+):(\d{2}(?:\.\d+)?)|(?:lost|double[d]?)\D{0,12}?(\d+(?:\.\d+)?)/i.exec(text);
  if (!m) return null;
  return m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[3]);
}

/** One entry per wrong-turn excursion the player turned around from (call.uturn) and returned from. */
export function lostProcedure(r: StageResult): LostExcursion[] {
  const out: LostExcursion[] = []; const ev = r.events;
  const notes = r.actions.filter(a => a.action.type === 'note').map(a => (a.action as { text: string }).text);
  let from = 0;
  for (;;) {
    const u = ev.findIndex((e, i) => i >= from && e.type === 'call.uturn'); if (u < 0) break;
    const rj = ev.findIndex((e, i) => i > u && e.type === 'rejoin'); if (rj < 0) break;
    const turnAroundTod = ev[u]!.tod, rejoinTod = ev[rj]!.tod; const doubled = 2 * (rejoinTod - turnAroundTod);
    const watchStarted = r.instrumentLog.some(e => e.kind === 'watch.start' && Math.abs(e.tod - turnAroundTod) <= 3);
    const noted = notes.map(parseLostNote).filter((x): x is number => x !== null).sort((a, b) => Math.abs(a - doubled) - Math.abs(b - doubled))[0] ?? null;
    out.push({ turnAroundTod, rejoinTod, doubled, watchStarted, noted, ok: noted !== null && Math.abs(noted - doubled) <= 2 });
    from = rj + 1;
  }
  return out;
}
export const LOST_GUIDANCE = 'Lost doctrine (LOST-001): start the stopwatch at the turn-around, double the time back to the junction for the lost time, rejoin 30 s behind a car you know is on course, throw the leg away and reset at the next checkpoint. Never ask for a Time Allowance for a wrong turn.';
