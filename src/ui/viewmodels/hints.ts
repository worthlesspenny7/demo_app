/** Per-drill objective restatement and the keys that matter (UI-019): shown in the pre-read overlay and as a one-line hint bar. */
export interface DrillHint { keys: [string, string][]; preread: string | null }

const GENERIC: DrillHint = { keys: [['Space', 'start / stop the watch'], ['arrows (B/A/J)', 'call the turn'], ['G', 'go on the count']], preread: null };

const HINTS: Record<string, DrillHint> = {
  D01: { keys: [['Space', 'start the watch as the car launches'], ['L', 'lap as the front bumper passes each sign'], ['R', 'recall: release a frozen split']], preread: 'D01 is a reaction drill. The "book" is just signs. The car launches itself on its printed second (a drill start: no queue, no count; fast-forward if you like). Start the watch with Space as it goes, then press L the instant the front bumper passes each sign. Consistency matters more than being perfect: a steady 0.3 s late can be calibrated out.' },
  D03: { keys: [['G', 'go when your count reaches the card dwell'], ['Space', 'start the watch at "Stopped"'], ['L', 'digital watch: lap L when you say go, to read your dwell']], preread: null },
  D04: { keys: [['L', 'lap at the landmark'], ['digits + Enter', 'call the new speed on the count'], ['Space', 'watch']], preread: null },
  D05: { keys: [['digits + Enter', 'call the speed half a ramp early'], ['L', 'lap at the sign'], ['Space', 'watch']], preread: null },
  D16: { keys: [['Q', 'pull up once the car ahead has left'], ['W', 'warn the driver: about 30 s'], ['G', 'go on the launch second'], ['M', 'watch TOD mode: the time of day'], ['K', 'read the clock at every IN, OUT and restart']], preread: null },
  D07: { keys: [['L', 'lap at each calibration mark'], ['digits + Enter', 'hold 50 on the speedo'], ['Calibration box', 'set the Timewise factor or card']], preread: null },
};
/** PT-10 N-C12: the bezel keys are for the analog stopwatch only; the digital watch (the default, HB p.5) takes the lap key instead. */
const D03_ANALOG: DrillHint = { keys: [['G', 'go when the bezel hits the card dwell'], ['[ ]', 'set the bezel (Shift = 0.2 s)'], ['Space', 'start the watch at "Stopped"']], preread: null };
export function drillHint(drillId: string | null | undefined, watch: 'digital' | 'analog' = 'digital'): DrillHint { if (drillId === 'D03' && watch === 'analog') return D03_ANALOG; return (drillId && HINTS[drillId]) || GENERIC; }
export function hintBarText(objective: string, h: DrillHint): string { return `${objective}  ·  ${h.keys.map(([k, d]) => `${k}: ${d}`).join('  ·  ')}`; }

/** Time-scale keys for the cockpit hint bar (UI-011: `>` or `.` faster, `<` or `,` slower; `?` opens the key list). */
export function scaleHintText(lockedTo1x: boolean): string { return lockedTo1x ? 'time scale locked at 1x on this drill' : '> faster / < slower (or . / ,)'; }
