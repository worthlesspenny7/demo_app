/** Small 240-degree speedometer: the driver's gauge, seen by the navigator at mark granularity. */
import type { SpeedoVm } from '../viewmodels/speedo.js';
import { type Theme, hand, label, polar } from './common.js';

export function drawSpeedo(ctx: CanvasRenderingContext2D, vm: SpeedoVm, size: number, th: Theme, target: number | null = null): void {
  const cx = size / 2, cy = size / 2 + size * 0.05, R = size / 2 - 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = th.dial; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  for (const t of vm.ticks) {
    const [x1, y1] = polar(cx, cy, R - 3, t.deg); const [x2, y2] = polar(cx, cy, R - (t.major ? R * 0.14 : R * 0.08), t.deg);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = t.major ? 2 : 1; ctx.strokeStyle = t.major ? th.tick : th.tickMinor; ctx.stroke();
    if (t.major && t.mph % 20 === 0) { const [x, y] = polar(cx, cy, R * 0.68, t.deg); label(ctx, String(t.mph), x, y, Math.max(8, R * 0.17), th.text, '600'); }
  }
  if (target !== null && Number.isFinite(target)) {
    const d = -120 + (Math.min(vm.maxMph, Math.max(0, target)) / vm.maxMph) * 240;
    const [x1, y1] = polar(cx, cy, R - 2, d); const [x2, y2] = polar(cx, cy, R * 0.8, d);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = 3; ctx.strokeStyle = th.accent2; ctx.stroke();
  }
  label(ctx, 'MPH', cx, cy + R * 0.45, Math.max(7, R * 0.12), th.tickMinor, '600');
  hand(ctx, cx, cy, vm.needleDeg, R * 0.82, Math.max(2, R * 0.03), th.danger, R * 0.12);
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, R * 0.06), 0, Math.PI * 2); ctx.fillStyle = '#333'; ctx.fill();
}
