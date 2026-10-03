/** Settings: watch kind, clock kind, default time scale, driver skill override, theme, audio. */
import { app, saveSettings, el, DEFAULT_SETTINGS } from '../state.js';

/** UI-033: instrument defaults follow the handbook (HB p.5): a digital stopwatch with lap/split and time of day, an analog dash clock. The analog stopwatch with countdown bezel stays selectable. */
export const STOPWATCH_NOTE = 'Default: digital stopwatch with lap/split and a time-of-day mode, as the Rookie Handbook recommends (HB p.5: "a necessity for accurate rallying"). The analog stopwatch with the countdown bezel is an option, not the handbook\'s recommendation; it stays selectable here.';
export const CLOCK_NOTE = 'The dash clock is analog by default: the handbook mounts one where both of you can read it, and time of day (starts, restarts, exact transits, the TA window) comes from it, synced to WWV. A digital readout is optional.';

export function renderSettings(root: HTMLElement): void {
  const s = app.settings;
  const page = el('div', { class: 'page' }, el('h1', {}, 'Settings'));
  const panel = el('div', { class: 'panel grid', style: 'max-width:620px' });
  const row = (labelText: string, control: HTMLElement, note?: string): HTMLElement => el('label', { style: 'display:grid;grid-template-columns:200px 1fr;gap:10px;align-items:center' }, el('span', {}, labelText), el('span', {}, control, note ? el('div', { class: 'muted', style: 'font-size:12px' }, note) : null));
  const sel = (value: string, opts: [string, string][], on: (v: string) => void): HTMLSelectElement => { const e = el('select', {}); for (const [v, t] of opts) e.append(el('option', { value: v, selected: v === value ? true : null }, t)); e.onchange = () => on(e.value); return e; };
  const chk = (value: boolean, on: (v: boolean) => void): HTMLInputElement => { const e = el('input', { type: 'checkbox' }) as HTMLInputElement; e.checked = value; e.onchange = () => on(e.checked); return e; };
  const commit = (): void => { saveSettings(app.settings); };
  panel.append(
    row('Stopwatch', sel(s.watch, [['digital', 'Digital, 1/100 s, lap/split, time of day (handbook default)'], ['analog', 'Analog, 1/5 s sweep, 60 s dial, countdown bezel (not the handbook\'s recommendation)']], v => { app.settings.watch = v as 'analog' | 'digital'; commit(); }), 'Great Race rules allow one stopwatch, digital or analog. The analog crown refuses a reset while running.'),
    row('Time scale (default)', sel(String(s.timeScale), [['1', '1x real time'], ['2', '2x'], ['4', '4x'], ['8', '8x']], v => { app.settings.timeScale = Number(v) || 1; commit(); }), 'Adaptive: the cockpit drops to 1x whenever a feature is within 800 ft, the car is stopped or a count is near.'),
    row('Driver', sel(s.driverSkill, [['scenario', 'As the drill tier says'], ['expert', 'Expert (steady, 0.2 mph)'], ['sportsman', 'Dad, sportsman (0.5 mph)'], ['rookie', 'Dad, rookie (1 mph wander)']], v => { app.settings.driverSkill = v as typeof s.driverSkill; commit(); })),
    row('Theme', sel(s.theme, [['dusk', 'Cockpit at dusk (dark)'], ['light', 'Daylight']], v => { app.settings.theme = v as 'dusk' | 'light'; commit(); })),
    row('Clock', sel(s.clock, [['analog', 'Analog dash clock (default)'], ['digital', 'Digital readout (optional)']], v => { app.settings.clock = v as 'analog' | 'digital'; commit(); }), undefined),
    row('Sound', chk(!s.muted, v => { app.settings.muted = !v; commit(); }), 'Watch clicks, 3-2-1 beeps (aid), train and signal.'),
    row("Dad's voice", chk(s.speech, v => { app.settings.speech = v; commit(); }), 'Read-backs through speechSynthesis when the browser has it; the text overlay always shows.'),
    row('Key help overlay', chk(s.showHelp, v => { app.settings.showHelp = v; commit(); })),
  );
  panel.append(el('div', { class: 'settings-note', id: 'stopwatch-note' }, STOPWATCH_NOTE), el('div', { class: 'settings-note', id: 'clock-note' }, CLOCK_NOTE));
  const reset = el('button', { class: 'danger' }, 'Reset progress and settings');
  reset.onclick = () => { if (confirm('Erase all stars, runs and settings?')) { app.progress.reset(); app.settings = { ...DEFAULT_SETTINGS }; saveSettings(app.settings); renderSettings(root); } };
  panel.append(el('div', {}, reset));
  page.append(panel);
  root.replaceChildren(page);
}
