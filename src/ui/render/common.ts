/** Shared canvas helpers. */
export interface Theme { bg: string; dial: string; dialEdge: string; tick: string; tickMinor: string; text: string; hand: string; hand2: string; accent: string; accent2: string; danger: string; ok: string; muted: string; road: string; roadEdge: string; grass: string }

export function themeFromCss(el: Element | null = typeof document !== 'undefined' ? document.documentElement : null): Theme {
  const get = (name: string, fallback: string): string => {
    try { const v = el ? getComputedStyle(el).getPropertyValue(name).trim() : ''; return v || fallback; } catch { return fallback; }
  };
  return {
    bg: get('--bg', '#121821'), dial: get('--dial', '#0b0f15'), dialEdge: get('--dial-edge', '#3a4556'), tick: get('--tick', '#e9edf3'), tickMinor: get('--tick-minor', '#8d99ab'),
    text: get('--text', '#f2f4f7'), hand: get('--hand', '#f6f7f9'), hand2: get('--hand2', '#f0b35b'), accent: get('--accent', '#f0b35b'), accent2: get('--accent2', '#4fd1c5'),
    danger: get('--danger', '#ef5a5a'), ok: get('--ok', '#4cc38a'), muted: get('--muted', '#8d99ab'), road: get('--road', '#2a3140'), roadEdge: get('--road-edge', '#c9d1dc'), grass: get('--grass', '#182018'),
  };
}

/** Size a canvas for the device pixel ratio; returns the CSS-pixel 2D context (or null). */
export function prepare(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D | null {
  const dpr = Math.max(1, Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  const w = Math.max(1, Math.round(cssW)), h = Math.max(1, Math.round(cssH));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export const deg = (d: number): number => (d - 90) * Math.PI / 180;
export function polar(cx: number, cy: number, r: number, degCW: number): [number, number] { const a = deg(degCW); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }

export function hand(ctx: CanvasRenderingContext2D, cx: number, cy: number, degCW: number, len: number, width: number, color: string, tail = 0): void {
  const [x1, y1] = polar(cx, cy, -tail, degCW); const [x2, y2] = polar(cx, cy, len, degCW);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.stroke();
}
export function ticks(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOuter: number, count: number, every: (i: number) => { len: number; width: number; color: string } | null, startDeg = 0, sweepDeg = 360): void {
  for (let i = 0; i < count; i++) {
    const spec = every(i); if (!spec) continue;
    const a = startDeg + (i / count) * sweepDeg;
    const [x1, y1] = polar(cx, cy, rOuter, a); const [x2, y2] = polar(cx, cy, rOuter - spec.len, a);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = spec.width; ctx.strokeStyle = spec.color; ctx.lineCap = 'butt'; ctx.stroke();
  }
}
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, weight = '600', align: CanvasTextAlign = 'center', font = 'Inter, "Helvetica Neue", Arial, sans-serif'): void {
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
}
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
