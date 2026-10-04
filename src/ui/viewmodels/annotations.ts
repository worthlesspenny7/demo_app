/**
 * Pre-read annotations (UI-013, PREREAD-001, GRIID-012): highlighter colours, GO-time column, cheat card, and the hand marks navigators really write on the book (11a section 3,
 * 11b): "P10.2" beside a struck "0m15s", a circled negative loss under the OUT speed, the speed carried at the top of a page and in an empty Column C box, "COMES QUICK" at the
 * bottom of the previous page with the circled number of the quick row, the time of day in Column D at each restart and checkpoint, and "TRAIN Delay 3:47" with a star at the row
 * where a delay ended. The marks are sent to the engine as `line.annotate` text, which D15 and D16 grade.
 */
import type { Instruction } from '../../core/course.js';
import { formatClockFace } from '../../core/griid.js';

export type Highlight = 'pause' | 'speed' | 'turn' | 'sign';
export const HIGHLIGHTS: Highlight[] = ['pause', 'speed', 'turn', 'sign'];

/** The hand marks a navigator writes: see MARK_PRESETS. */
export type MarkKind = 'pause' | 'loss' | 'carry' | 'quick' | 'tod' | 'cp' | 'train';
export interface Mark { kind: MarkKind; text: string; /** a star drawn beside the note ("TRAIN Delay 3:47" + star) */ star?: boolean }

export interface AnnotationData { highlights: Record<number, Highlight[]>; goTimes: Record<number, string>; notes: Record<number, string>; card: Record<string, number>; marks: Record<number, Mark[]> }

export interface Annotations {
  data(): AnnotationData;
  toggleHighlight(n: number, h: Highlight): Highlight[];
  highlights(n: number): Highlight[];
  setGoTime(n: number, text: string): void;
  goTime(n: number): string;
  setNote(n: number, text: string): void;
  note(n: number): string;
  /** Add a hand mark to a row (replacing an earlier mark of the same kind on that row). */
  addMark(n: number, mark: Mark): void;
  removeMark(n: number, kind: MarkKind): void;
  marks(n: number): Mark[];
  setCard(card: Record<string, number>): void;
  card(): Record<string, number>;
  /** Fraction of pause lines that carry a GO time or a pause highlight (SIM-028 "pre-read coverage"). */
  coverage(book: Instruction[] | null | undefined): number;
  /** Lines the auto-triage would mark (pause / speed / turn / quoted sign), for the "show answers" aid. */
  suggested(book: Instruction[] | null | undefined): Record<number, Highlight[]>;
  serialize(): string;
}

export function createAnnotations(initial?: string | Partial<AnnotationData> | null): Annotations {
  let d: AnnotationData = { highlights: {}, goTimes: {}, notes: {}, card: {}, marks: {} };
  try {
    const src = typeof initial === 'string' ? JSON.parse(initial) as Partial<AnnotationData> : initial;
    if (src && typeof src === 'object') d = { highlights: obj(src.highlights), goTimes: obj(src.goTimes), notes: obj(src.notes), card: obj(src.card), marks: obj(src.marks) };
  } catch { /* corrupt: start empty */ }
  const api: Annotations = {
    data: () => d,
    toggleHighlight(n, h) {
      if (!Number.isFinite(n) || !HIGHLIGHTS.includes(h)) return api.highlights(n);
      const cur = new Set(d.highlights[n] ?? []);
      if (cur.has(h)) cur.delete(h); else cur.add(h);
      if (cur.size) d.highlights[n] = [...cur]; else delete d.highlights[n];
      return api.highlights(n);
    },
    highlights: n => [...(d.highlights[n] ?? [])],
    setGoTime(n, text) { if (!Number.isFinite(n)) return; if (text && text.trim()) d.goTimes[n] = text.trim(); else delete d.goTimes[n]; },
    goTime: n => d.goTimes[n] ?? '',
    setNote(n, text) { if (!Number.isFinite(n)) return; if (text && text.trim()) d.notes[n] = text.trim(); else delete d.notes[n]; },
    note: n => d.notes[n] ?? '',
    addMark(n, mark) {
      if (!Number.isFinite(n) || !mark || !MARK_KINDS.includes(mark.kind) || !String(mark.text ?? '').trim()) return;
      const rest = (d.marks[n] ?? []).filter(m => m.kind !== mark.kind);
      d.marks[n] = [...rest, { kind: mark.kind, text: String(mark.text).trim().slice(0, 60), ...(mark.star ? { star: true } : {}) }];
    },
    removeMark(n, kind) { const rest = (d.marks[n] ?? []).filter(m => m.kind !== kind); if (rest.length) d.marks[n] = rest; else delete d.marks[n]; },
    marks: n => (d.marks[n] ?? []).map(m => ({ ...m })),
    setCard(card) { d.card = {}; for (const [k, v] of Object.entries(card ?? {})) if (Number.isFinite(v)) d.card[k] = v; },
    card: () => ({ ...d.card }),
    coverage(book) {
      const pauses = (Array.isArray(book) ? book : []).filter(i => typeof i?.pause === 'number' && i.pause > 0);
      if (!pauses.length) return 1;
      const marked = pauses.filter(i => !!d.goTimes[i.n] || (d.highlights[i.n] ?? []).includes('pause')).length;
      return marked / pauses.length;
    },
    suggested(book) {
      const out: Record<number, Highlight[]> = {};
      for (const i of Array.isArray(book) ? book : []) {
        const hs: Highlight[] = [];
        if (typeof i?.pause === 'number' && i.pause > 0) hs.push('pause');
        if (typeof i?.speed === 'number' || i?.timed) hs.push('speed');
        if (i?.turn && i.turn !== 'S') hs.push('turn');
        if (typeof i?.text === 'string' && /"[^"]+"/.test(i.text)) hs.push('sign');
        if (hs.length) out[i.n] = hs;
      }
      return out;
    },
    serialize: () => JSON.stringify(d),
  };
  return api;
}
function obj<T>(x: unknown): Record<string, T> { return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, T>) : {}; }

export const MARK_KINDS: MarkKind[] = ['pause', 'loss', 'carry', 'quick', 'tod', 'cp', 'train'];

const r1s = (x: number): string => (Math.round(x * 10) / 10).toFixed(1);
/** "P10.2": the chart pause time written beside the struck printed pause ("0m15s"). */
export const formatPauseMark = (seconds: number): string => `P${r1s(seconds)}`;
/** "-2.9": the time the car loses, written as a negative and circled, under the OUT speed. */
export const formatLossMark = (seconds: number): string => `-${r1s(Math.abs(seconds))}`;
/** "30": the speed carried from the page before, at the page top (centre) or in an empty Column C box. */
export const formatCarryMark = (mph: number): string => `${Math.round(mph)}`;
/** "(12) COMES QUICK": at the bottom of the previous page, with the circled number of the quick row. */
export const formatQuickMark = (nextRow: number): string => `(${nextRow}) COMES QUICK`;
/** "9:34:00": a time of day in Column D (a restart, or a checkpoint crossing). */
export const formatTodMark = (tod: number): string => formatClockFace(tod);
/** "CP3 9:14:22": the checkpoint number and the exact arrival time of day in Column D (PREREAD-001, graded within 2 s). */
export const formatCpMark = (cp: number, tod: number): string => `CP${cp} ${formatClockFace(tod)}`;
/** "TRAIN Delay 3:47": the habit at the row where a delay ended (11a: with a star); the measured delay as m:ss. */
export function formatTrainMark(seconds: number, cause = 'TRAIN'): string { const s = Math.max(0, Math.round(seconds)); return `${cause.toUpperCase()} Delay ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/** One preset: what the button is called, where the mark goes, and what it writes. `star` presets draw a star beside the note. */
export interface MarkPreset { kind: MarkKind; label: string; where: string; example: string; star?: boolean }
export const MARK_PRESETS: MarkPreset[] = [
  { kind: 'pause', label: 'P (chart pause)', where: 'beside the struck pause "0m15s"', example: 'P10.2' },
  { kind: 'loss', label: 'Loss (circled)', where: 'circled, under the OUT speed', example: '-2.9' },
  { kind: 'carry', label: 'Speed carried', where: 'top centre of the page, or in an empty Column C box', example: '30' },
  { kind: 'quick', label: 'COMES QUICK', where: 'bottom of the previous page, with the circled row number', example: '(12) COMES QUICK' },
  { kind: 'tod', label: 'Time of day', where: 'in Column D at a restart', example: '9:34:00' },
  { kind: 'cp', label: 'Checkpoint time', where: 'in Column D at a timing checkpoint', example: 'CP3 9:14:22' },
  { kind: 'train', label: 'TRAIN delay + star', where: 'at the row where the delay ended', example: 'TRAIN Delay 3:47', star: true },
];

/**
 * The row a mark is written on. A "comes quick" row that heads a page is flagged on the LAST row of the page before (the row is `n - 1`, with the circled number n);
 * everywhere else, and for every other kind, the mark goes on the row itself. `pageTop`: the row heads a page after the first.
 */
export function markRow(kind: MarkKind, n: number, pageTop: boolean): number { return kind === 'quick' && pageTop && n > 1 ? n - 1 : n; }
/** The text a mark sends to the engine as a `line.annotate` (what D15 and D16 read): the mark's text, with " *" for a starred one. */
export const markAnnotation = (m: Mark): string => (m.star ? `${m.text} *` : m.text);
