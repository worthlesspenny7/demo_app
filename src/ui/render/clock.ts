/** Analog time-of-day clock (Heuer Master Time style) with a rotating seconds bezel. */
import type { ClockVm } from '../viewmodels/clock.js';
import { type Theme, hand, ticks, label, polar } from './common.js';

export function drawClock(ctx: CanvasRenderingContext2D, vm: ClockVm, size: number, th: Theme): void {
  const cx = size / 2, cy = size / 2, R = size / 2 - 2; const bezelW = Math.max(12, R * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#1c232e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(vm.bezelDeg * Math.PI / 180);
  for (let i = 0; i < 12; i++) { const [x, y] = polar(0, 0, R - bezelW * 0.5, i * 30); label(ctx, String(i * 5), x, y, bezelW * 0.6, i === 0 ? th.accent2 : th.tickMinor, '700'); }
  ticks(ctx, 0, 0, R - 1, 60, i => (i % 5 === 0 ? null : { len: bezelW * 0.3, width: 1, color: '#55637a' }));
  ctx.beginPath(); const [tx, ty] = polar(0, 0, R - bezelW - 2, 0); const [lx, ly] = polar(0, 0, R - 3, -4); const [rx, ry] = polar(0, 0, R - 3, 4);
  ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fillStyle = th.accent2; ctx.fill();
  ctx.restore();
  const rd = R - bezelW - 4;
  ctx.beginPath(); ctx.arc(cx, cy, rd, 0, Math.PI * 2); ctx.fillStyle = '#f3efe4'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = th.dialEdge; ctx.stroke();
  ticks(ctx, cx, cy, rd - 2, 60, i => (i % 5 === 0 ? { len: rd * 0.12, width: 2.2, color: '#1a1a1a' } : { len: rd * 0.06, width: 1, color: '#555' }));
  for (let i = 1; i <= 12; i++) { const [x, y] = polar(cx, cy, rd * 0.74, i * 30); label(ctx, String(i), x, y, Math.max(10, rd * 0.17), '#111', '700'); }
  label(ctx, 'TIME OF DAY', cx, cy + rd * 0.42, Math.max(7, rd * 0.08), '#555', '600');
  hand(ctx, cx, cy, vm.hourDeg, rd * 0.55, Math.max(3, rd * 0.05), '#111', rd * 0.08);
  hand(ctx, cx, cy, vm.minuteDeg, rd * 0.86, Math.max(2.5, rd * 0.035), '#111', rd * 0.1);
  hand(ctx, cx, cy, vm.secondDeg, rd * 0.92, Math.max(1, rd * 0.012), th.danger, rd * 0.15);
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(2.5, rd * 0.03), 0, Math.PI * 2); ctx.fillStyle = th.danger; ctx.fill();
}
