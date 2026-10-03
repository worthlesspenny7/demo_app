/** Cockpit geometry (UI-009): road view >= 45 % of the left pane, stopwatch the largest instrument (>= 240 px dial). */
export interface Rect { x: number; y: number; w: number; h: number }
export interface CockpitLayout {
  width: number; height: number;
  leftPane: Rect; book: Rect; drawer: Rect; road: Rect; instruments: Rect;
  clock: { rect: Rect; dial: number }; stopwatch: { rect: Rect; dial: number }; speedo: { rect: Rect; dial: number };
  /** Fraction of the left pane height taken by the road view. */
  roadFraction: number;
}

export const MIN_STOPWATCH_DIAL = 240;

export function cockpitLayout(width: number, height: number, opts: { drawerOpen?: boolean } = {}): CockpitLayout {
  const W = Math.max(640, Number.isFinite(width) ? width : 1280), H = Math.max(480, Number.isFinite(height) ? height : 720);
  const bookW = Math.round(Math.min(420, Math.max(300, W * 0.28)));
  const drawerH = opts.drawerOpen ? Math.round(Math.min(220, H * 0.26)) : 44;
  const leftW = W - bookW;
  const paneH = H - drawerH;
  const roadH = Math.round(paneH * 0.47);
  const instH = paneH - roadH;
  const leftPane: Rect = { x: 0, y: 0, w: leftW, h: paneH };
  const road: Rect = { x: 0, y: 0, w: leftW, h: roadH };
  const instruments: Rect = { x: 0, y: roadH, w: leftW, h: instH };
  // stopwatch takes the centre cell, as large as the row allows (lap list needs ~56 px under it)
  const swDial = Math.max(MIN_STOPWATCH_DIAL, Math.min(instH - 64, Math.round(leftW * 0.36)));
  const sideDial = Math.round(Math.min(swDial * 0.72, (leftW - swDial) / 2 - 24));
  const clockDial = Math.max(120, sideDial);
  const speedoDial = Math.max(100, Math.round(sideDial * 0.78));
  const cell = (leftW - swDial) / 2;
  const clock = { rect: { x: 0, y: roadH, w: cell, h: instH }, dial: clockDial };
  const stopwatch = { rect: { x: cell, y: roadH, w: swDial, h: instH }, dial: swDial };
  const speedo = { rect: { x: cell + swDial, y: roadH, w: cell, h: instH }, dial: speedoDial };
  const book: Rect = { x: leftW, y: 0, w: bookW, h: paneH };
  const drawer: Rect = { x: 0, y: paneH, w: W, h: drawerH };
  return { width: W, height: H, leftPane, book, drawer, road, instruments, clock, stopwatch, speedo, roadFraction: roadH / paneH };
}
