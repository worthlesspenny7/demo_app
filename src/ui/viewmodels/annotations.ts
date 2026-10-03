/** Pre-read annotations (UI-013): highlighter colours, GO-time column, cheat card. Kept in the UI; the engine has no line.annotate yet. */
import type { Instruction } from '../../core/course.js';

export type Highlight = 'pause' | 'speed' | 'turn' | 'sign';
export const HIGHLIGHTS: Highlight[] = ['pause', 'speed', 'turn', 'sign'];

export interface AnnotationData { highlights: Record<number, Highlight[]>; goTimes: Record<number, string>; notes: Record<number, string>; card: Record<string, number> }

export interface Annotations {
  data(): AnnotationData;
  toggleHighlight(n: number, h: Highlight): Highlight[];
  highlights(n: number): Highlight[];
  setGoTime(n: number, text: string): void;
  goTime(n: number): string;
  setNote(n: number, text: string): void;
  note(n: number): string;
  setCard(card: Record<string, number>): void;
  card(): Record<string, number>;
  /** Fraction of pause lines that carry a GO time or a pause highlight (SIM-028 "pre-read coverage"). */
  coverage(book: Instruction[] | null | undefined): number;
  /** Lines the auto-triage would mark (pause / speed / turn / quoted sign), for the "show answers" aid. */
  suggested(book: Instruction[] | null | undefined): Record<number, Highlight[]>;
  serialize(): string;
}

export function createAnnotations(initial?: string | Partial<AnnotationData> | null): Annotations {
  let d: AnnotationData = { highlights: {}, goTimes: {}, notes: {}, card: {} };
  try {
    const src = typeof initial === 'string' ? JSON.parse(initial) as Partial<AnnotationData> : initial;
    if (src && typeof src === 'object') d = { highlights: obj(src.highlights), goTimes: obj(src.goTimes), notes: obj(src.notes), card: obj(src.card) };
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
