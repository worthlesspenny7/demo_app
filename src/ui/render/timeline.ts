/** Debrief timeline: e(t) = actual - ghost across the run, ledger entries, checkpoint lines. */
import type { TimelinePoint, LedgerRow } from '../viewmodels/debrief.js';
import { type Theme, label, roundRect } from './common.js';

export function drawTimeline(ctx: CanvasRenderingContext2D, pts: TimelinePoint[], ledger: LedgerRow[], w: number, h: number, th: Theme): void {
  ctx.fillStyle = th.dial; roundRect(ctx, 0, 0, w, h, 8); ctx.fill();
  const P = { l: 48, r: 16, t: 20, b: 28 };
  if (!pts.length) { label(ctx, 'No timeline (the run never departed).', w / 2, h / 2, 13, th.muted); return; }
  const t0 = pts[0]!.tod, t1 = Math.max(pts[pts.length - 1]!.tod, t0 + 1);
  const es = [...pts.map(p => p.e), ...ledger.map(l => l.believed), 0];
  const emax = Math.max(5, Math.ceil(Math.max(...es.map(Math.abs)) / 5) * 5);
  const X = (t: number): number => P.l + ((t - t0) / (t1 - t0)) * (w - P.l - P.r);
  const Y = (e: number): number => P.t + (1 - (e + emax) / (2 * emax)) * (h - P.t - P.b);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let e = -emax; e <= emax; e += emax / 2) { ctx.beginPath(); ctx.moveTo(P.l, Y(e)); ctx.lineTo(w - P.r, Y(e)); ctx.stroke(); label(ctx, `${e > 0 ? '+' : ''}${e}`, P.l - 6, Y(e), 10, th.muted, '500', 'right'); }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(P.l, Y(0)); ctx.lineTo(w - P.r, Y(0)); ctx.stroke();
  label(ctx, 'ghost (0)', w - P.r - 4, Y(0) - 8, 10, th.muted, '500', 'right');
  for (let m = 0; m * 60 <= t1 - t0; m++) { const x = X(t0 + m * 60); label(ctx, `${m}:00`, x, h - 10, 10, th.muted, '500'); }
  // checkpoint lines
  for (const p of pts) if (p.kind === 'checkpoint') { ctx.strokeStyle = th.ok; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(p.tod), P.t); ctx.lineTo(X(p.tod), h - P.b); ctx.stroke(); ctx.setLineDash([]); label(ctx, `CP ${p.e > 0 ? '+' : ''}${p.e.toFixed(0)}`, X(p.tod) - 4, h - P.b - 8, 10, th.ok, '700', 'right'); }
  // truth curve
  ctx.strokeStyle = th.accent; ctx.lineWidth = 2; ctx.beginPath();
  let first = true;
  for (const p of pts) { const x = X(p.tod), y = Y(p.e); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
  ctx.stroke();
  for (const p of pts) { if (!p.label || p.kind === 'checkpoint') continue; ctx.fillStyle = p.label === 'wait' ? th.danger : p.label === 'release' || p.label === 'go' ? th.ok : th.accent2; ctx.beginPath(); ctx.arc(X(p.tod), Y(p.e), 3, 0, 7); ctx.fill(); }
  // ledger entries
  for (const l of ledger) { ctx.fillStyle = th.accent2; ctx.strokeStyle = th.accent2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(l.tod) - 5, Y(l.believed)); ctx.lineTo(X(l.tod) + 5, Y(l.believed)); ctx.moveTo(X(l.tod), Y(l.believed) - 5); ctx.lineTo(X(l.tod), Y(l.believed) + 5); ctx.stroke(); }
  label(ctx, 'seconds late (+) / early (-) vs the ghost · orange: truth · teal crosses: your ledger · green: checkpoints', P.l + 4, 8, 10, th.muted, '500', 'left');
}
