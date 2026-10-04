/** D16 "Start on the second": time-of-day discipline with base + ASP (DRILL-021, STAGE-002/003/005, WATCH-009). */
import { ScenarioBuilder, PERFECT_TIMEWISE } from '../builder.js';
import { FORD_1939 } from '../course.js';
import { hms, formatClock } from '../units.js';
import { rng } from '../rng.js';
import { annotatePerfectTimes } from '../ghost.js';
import type { Drill } from './types.js';
import { tiers, tierOf, bookStyleFor } from './common.js';
import { departuresOf, startFeedback } from './departures.js';
import { gradeCheckpointNotes } from './preread.js';
import { legErrors, meanAbs, instrumentFindingLines, headlineTip } from './rubrics.js';

const V = 35; const FPS = V * 1.4666666666666666; const FT = 5280;

/** Everything is derived from the seed so the card can print "base + ASP = your time" and the tests can predict the schedule. */
/** `trap` (aids rung <= 1, INST-002): the exact transit begins exactly two minutes after the start, so its OUT falls on a minute change, where the dash clock's minute hand is ambiguous. */
export function d16Plan(seed: number, trap = false): { asp: number; start: number; base: number; inEst: number; outEst: number; lunchDepart: number; restart: number; restartBase: number; arriveRestartEst: number } {
  const r = rng(`D16:${seed}`);
  // the printed base (the Example Rally's 8:55:00 style) and an ASP drawn from 1..120 such that the exact transit's IN falls in minute 41..57
  // (about 2m14s after the start), so IN + 20m00s rolls the hour
  const base = hms(r.pick([7, 8, 9]), r.pick([25, 40, 55]), 0);
  const fits = Array.from({ length: 120 }, (_, i) => i + 1).filter(a => { const m = Math.floor(((base + a * 60) % 3600) / 60); return m >= 39 && m <= 55; });
  const asp = r.pick(fits); const start = base + asp * 60;
  const inEst = trap ? start + 120 : start + (1.3 * FT) / FPS; const outEst = inEst + 1200;
  const cp2 = outEst + (1.4 * FT) / FPS; const beginAdv = cp2 + (0.3 * FT) / FPS;
  const lunchArrive = beginAdv + (1.0 * FT) / (15 * 1.4666666666666666) + 2;
  const lunchDepart = start + Math.ceil((lunchArrive + 240 - start) / 60) * 60; // a whole minute, so the restart (a whole minute) is exactly 45m later
  const restart = lunchDepart + 2700;
  const arriveRestartEst = lunchDepart + (9 * FT) / (15 * 1.4666666666666666) + 1;
  return { asp, start, base, inEst, outEst, lunchDepart, restart, restartBase: restart - asp * 60, arriveRestartEst };
}

export const D16: Drill = {
  id: 'D16', title: 'Start on the second', objective: 'Your start is the printed time plus your ASP minutes. Leave on that second, take exactly 20 minutes where told (OUT = IN + 20m00s), leave lunch 45 minutes before the restart, and restart on your minute. One wrong minute fails the drill, and a start or restart with no launch lead (leaving on the minute itself, so the car is still accelerating at it) holds it at one star.', skills: ['P9'], minutes: 85, kind: 'drive',
  tiers: tiers([2, 1, 0]), unlock: [], readFirst: ['transits', 'which-timer'],
  scenario(seed, t) {
    const tier = tierOf(D16, t); const trap = tier.aids.rung <= 1; const p = d16Plan(seed, trap);
    const b = new ScenarioBuilder({ id: `D16-${seed}-${tier.name}`, name: 'Time of day', seed, startTime: p.base, asp: p.asp, timeZone: 'CDT', bookStyle: bookStyleFor(tier.aids), driver: tier.driver, aids: tier.aids, speedo: PERFECT_TIMEWISE, car: FORD_1939, prereadSeconds: 180 }).start(V);
    b.advanceMiles(0.9).checkpoint();
    if (trap) b.advanceFt(Math.round(120 * FPS) - Math.round(0.9 * FT)); else b.advanceMiles(0.4);   // the trap: IN lands on start + 2m00s, so OUT falls on a minute change
    // one exact transit inside the leg: IN at its first instruction, OUT = IN + 20m00s, leave on the OUT second
    b.transit({ exact: true, seconds: 1200, miles: 1.8 });
    b.advanceMiles(1.8);
    b.endTransit({ speed: V });
    b.advanceMiles(1.4).checkpoint();
    b.advanceMiles(0.3);
    // one advisory transit before the time-of-day restart, with a hosted lunch in it: leave 45 minutes before the end-of-transit time
    const advisory = Math.ceil((p.restart - (p.inEst + 1200 + (1.7 * FT) / FPS + (0.3 * FT) / FPS)) / 300) * 300;
    b.transit({ exact: false, seconds: advisory });
    b.advanceMiles(1.0);
    b.promotedStop('meal', 2700);
    b.advanceMiles(9.0);
    b.restart(V, p.restartBase);
    b.advanceMiles(1.5).checkpoint().advanceMiles(0.3);
    const sc = b.finish().build();
    sc.tags = [...(sc.tags ?? []), 'd16', `asp:${p.asp}`, 'watch:digital'];
    if (trap) { const outLine = sc.book.find(i => i.transit?.end && i.transit.exact); const rl = sc.book.find(i => i.n > 1 && i.section === 'restart'); sc.tags.push(`trap:oneMinute:${outLine?.n ?? 0}`, `trap:oneMinute:${rl?.n ?? 0}`); }
    annotatePerfectTimes(sc);
    return sc;
  },
  rubric(r, sc) {
    const deps = departuresOf(r, sc); const errs = deps.map(d => d.err); const worst = errs.length ? Math.max(...errs) : Infinity;
    const clock = r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'));
    const missing = deps.filter(d => d.actual === null).length;
    const base3: 0 | 1 | 2 | 3 = !isFinite(worst) ? 0 : worst <= 1 ? 3 : worst <= 3 ? 2 : worst <= 10 ? 1 : 0;
    const lateF = (r.findings ?? []).filter(f => f.kind === 'lateLaunch');
    const minuteF = (r.findings ?? []).find(f => f.kind === 'oneMinuteMistake');
    // START-001 / EDU-006: a start or restart left a few seconds after its launch time (no lead for the standing-start loss) is capped at one star,
    // so the D12 gate (D16 >= 2) means the launch count is learned; a clock finding alone costs the third star
    const stars = (lateF.length ? Math.min(1, base3) : base3 === 3 && clock.length ? 2 : base3) as 0 | 1 | 2 | 3;
    const wrongMinute = deps.filter(d => d.err > 10);
    const feedback: string[] = [];
    if (wrongMinute.length) feedback.push(`Wrong time: ${wrongMinute.map(d => `${d.kind === 'start' ? 'the start' : d.kind === 'restart' ? 'the restart' : d.kind === 'promoted' ? 'the lunch departure' : 'the exact-transit OUT'} (line ${d.line})`).join(', ')}. Four S's, Start on time: read the minute twice (base + ASP, IN + 20m00s, restart - 45m) and do not pull up to the restart point before your minute.`);
    else feedback.push(worst <= 1 ? 'Every departure was on its second.' : `Closest to a perfect score: the worst departure was ${worst.toFixed(1)} s off. Leave on the second; lead the car by the standing-start loss only.`);
    feedback.push(...deps.map(d => d.text));
    feedback.push(...startFeedback(r));
    { const cp = gradeCheckpointNotes(r); if (cp.attempted && cp.total) feedback.push(`Checkpoint times (PREREAD-001): ${cp.good}/${cp.total} within 2 s.`, ...cp.lines.slice(0, 3)); }
    feedback.push(`Card: base ${formatClock(sc.baseStartTime ?? sc.startTime)} + ASP ${sc.asp} min = your start ${formatClock(sc.startTime)}. Exact transit: OUT = IN + 20m00s (an hour can roll over). Lunch: restart minus 45 minutes.`);
    if (clock.length) feedback.push(...instrumentFindingLines(r.instrumentDiscipline.filter(f => f.kind.startsWith('clock'))), 'Time of day comes from the clock (or the watch in TOD mode), never from a running chrono: three stars need no clock finding.');
    const legs = legErrors(r); if (legs.length) feedback.push(`Leg errors: ${legs.map(e => `${e > 0 ? '+' : ''}${e}`).join(', ')} s (mean ${meanAbs(legs).toFixed(1)} s).`);
    if (missing) feedback.push(`${missing} departure(s) never happened.`);
    // EDU-001: the headline tip names the departure finding (a wrong minute, a late launch) whenever the stars come from the departures
    const wm = wrongMinute[0]; const what = (d: { kind: string; line: number }): string => `${d.kind === 'start' ? 'the start' : d.kind === 'restart' ? 'the restart' : d.kind === 'promoted' ? 'the lunch departure' : 'the exact-transit OUT'} (line ${d.line})`;
    const tip = minuteF ? `Start on time (the second S): ${minuteF.text}`
      : wm ? `Start on time (the second S): ${what(wm)} left ${wm.actual === null ? 'never' : `${Math.round(wm.err)} s off its second`}. Read the minute twice (base + ASP, IN + 20m00s, restart minus 45m) from the stopwatch's TOD mode and the seconds from the clock, and do not pull up before your minute.`
        : !isFinite(worst) ? `A departure never happened (${deps.filter(d => d.actual === null).map(what).join(', ')}): at every hold, count down and say GO on the launch second.`
          : lateF.length ? `${lateF[0]!.text} Give the driver "about 30 seconds", then count down so GO lands on the launch second (your minute minus the car's standing-start loss), not on the minute itself.`
            : stars < 3 ? (clock.length ? `Every departure was close, but time of day was read off a running chrono: ${clock[0]!.text}.` : `The worst departure was ${worst.toFixed(1)} s off its second: lead the car by the standing-start loss only, and say GO on the launch second.`)
              : headlineTip(r, sc, { stars });
    feedback.unshift(tip);
    return { score: isFinite(worst) ? Math.round(worst * 10) / 10 : 999, stars, tip, headline: !isFinite(worst) ? 'A departure never happened' : wrongMinute.length ? 'Wrong minute at a start, restart, lunch or transit OUT' : `worst departure ${worst.toFixed(1)} s off the second, ${deps.length} departures${clock.length ? `, ${clock.length} clock finding(s)` : ''}`, feedback };
  },
};
