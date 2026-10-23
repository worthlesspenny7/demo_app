/** Request/response protocol for external agents (LLM playtesters, scripts). DESIGN §15.
 *  Time only advances on `advance`. The book is sent once in `hello`. */
import { Simulator, type Action, type Observation, type StageResult, type SimOptions, validateAction, sanitizeAction, ACTION_LIST } from '../core/sim.js';
import type { Scenario } from '../core/course.js';
import { Scheduler, DecisionRun, playRun, SKILLS, type DecisionResponse, type RunResult, type RunStep, type Skill, type Verdict, type RunPlan } from '../core/decision/index.js';
import { DecisionBot, type DecisionBotName } from './bots.js';

/** MOB-007: how a decision-mode run is chosen (practice on skills, a daily-set run, or the boss leg). */
export interface DecisionRunSpec { mode?: RunPlan['mode']; seed?: number; skills?: Skill[]; rung?: 0 | 1 | 2 | 3; decisions?: number; day?: string; dailyIndex?: number }

export type Request =
  | { type: 'hello' }
  | { type: 'act'; action: Action; when?: { elapsed?: number; watchReads?: number; event?: 'featureVisible' | 'carStopped' | 'carStarted'; label?: string } }
  | { type: 'advance'; seconds?: number; untilEvent?: boolean; maxSeconds?: number }
  | { type: 'observe' }
  | { type: 'result' }
  | { type: 'truth' }
  | { type: 'cancel' }
  /** MOB-007 decision mode: the step on screen (a rule card is acknowledged by being returned; a decision stays until answered). `start` begins a new run. */
  | { type: 'decision.next'; start?: DecisionRunSpec }
  | { type: 'decision.answer'; response: DecisionResponse | null }
  /** Play a whole run with a bot (oracle or seeded random answers) and return its RunResult. */
  | { type: 'decision.run'; bot?: DecisionBotName; botSeed?: number } & DecisionRunSpec;

export interface HelloReply {
  type: 'hello'; scenario: { id: string; name: string; startTime: number; prereadSeconds: number; car: string; speedo: string; driver: string; rules: Scenario['rules']; aids: Scenario['aids'] };
  book: Scenario['book']; instructions: string; actions: string[];
  /** MOB-007: 'desk' (this scenario, act/advance) and 'decision' (decision.next / decision.answer / decision.run). */
  modes: ('desk' | 'decision')[];
}
export type Reply =
  | HelloReply
  | { type: 'ack'; ok: true; scheduled?: boolean; observation: Omit<Observation, 'book'> }
  | { type: 'advanced'; seconds: number; stoppedOn: string | null; events: string[]; scheduledFired: string[]; observation: Omit<Observation, 'book'> }
  | { type: 'observation'; observation: Omit<Observation, 'book'> }
  | { type: 'result'; result: StageResult }
  | { type: 'truth'; pace: number; carS: number; carMph: number }
  | { type: 'cancelled'; count: number }
  | { type: 'decision'; step: RunStep | null; done: boolean; plan: { seed: number; mode: RunPlan['mode']; skills: Skill[]; decisionCount: number } }
  | { type: 'verdict'; verdict: Verdict; done: boolean; result: RunResult | null }
  | { type: 'run'; bot: string; result: RunResult }
  | { type: 'error'; message: string };

const MAX_SCHEDULED = 100;
/** ENG-016: a `when` must name one finite, non-negative trigger or a known event. */
function validateWhen(w: unknown): string | null {
  if (!w || typeof w !== 'object') return 'when must be an object';
  const x = w as Record<string, unknown>;
  const fin = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (x.elapsed !== undefined) return fin(x.elapsed) ? null : 'when.elapsed must be a finite number of seconds >= 0';
  if (x.watchReads !== undefined) return fin(x.watchReads) ? null : 'when.watchReads must be a finite number of seconds >= 0';
  if (x.event !== undefined) { if (!['featureVisible', 'carStopped', 'carStarted'].includes(x.event as string)) return 'when.event must be featureVisible, carStopped or carStarted'; return x.label === undefined || (typeof x.label === 'string' && x.label.length <= 80) ? null : 'when.label must be a string'; }
  return 'when must carry elapsed, watchReads or event';
}
/**
 * ENG-018: what an agent sees at aids rung <= 1 is what the navigator could see: whole-second time of day, no launch arithmetic (UI-037 shows it at rung >= 2),
 * no hand angle finer than the visible minute while the minute is ambiguous, and no hidden ghost errors / car-ahead departure times until the stage has finished.
 */
export function redactForAgent(o: Omit<Observation, 'book'>, rung: number, finished: boolean): Omit<Observation, 'book'> {
  const out = { ...o };
  if (!finished) {
    out.paceCars = { ahead: o.paceCars.ahead ? { ...o.paceCars.ahead, errorSeconds: undefined as unknown as number } : null, behind: o.paceCars.behind ? { ...o.paceCars.behind, errorSeconds: undefined as unknown as number } : null };
    if (o.startQueue) out.startQueue = { ...o.startQueue, carAheadLeavesTod: null, cars: o.startQueue.cars.map(c => ({ ...c, leavesTod: undefined as unknown as number, sitting: undefined as unknown as boolean })) };
  }
  if (rung <= 1) {
    out.tod = Math.floor(o.tod); out.secondsToStart = Math.round(o.secondsToStart);
    out.launch = null;
    if (o.clock.minuteAmbiguous) out.clock = { ...o.clock, hourAngle: Math.floor(o.clock.hourAngle / 2.5) * 2.5 }; // the hour hand read by eye (to 5 minutes): it must not settle the ambiguous minute
  }
  return out;
}
const PARAMS: Record<string, string> = { 'watch.bezel': '{seconds}', 'bezel.set': '{seconds}', 'ledger.set': '{seconds?, entries?: [{seconds, source}]} (entries = the make-up list; seconds defaults to their total)', 'clock.read': '{source?: clock|stopwatch} (stopwatch = the digital watch in TOD mode)', 'pullUp': '' , 'call.warn': '{seconds?} (the "about 30 seconds" warning before a start / restart)', 'call.identify': '{text} (ICE: the driver answers "I see it too" and says "mark" at the sign)', 'count': '{n} (one number of the stop count; he echoes it)', 'call.speed': '{mph}', 'call.turn': '{dir:L|R|S|BL|BR|AL|AR|JL|JR}', 'line.set': '{n}', 'line.annotate': '{n,text}', note: '{text}', 'ta.declare': '{seconds, legIndex?} (deprecated alias of ta.request for the current leg)', 'ta.request': '{legIndex, seconds (multiple of 10, max 1770), fromLine, toLine, note?, carNumber?, password? (4 digits), phone?, stage?, cause?, witnesses?: {ahead?, behind?}} only inside a TA point window (rules.taMode paper: at a red checkpoint stop)', 'speed.emergency': '{mph}', 'watch.mode': '{mode?: chrono|tod}', 'watch.reset': '{force?}', 'scorecard.ack': '', 'speedo.setFactor': '{k}', 'card.set': '{card:{assigned:indicated}}', skipPreread: '{secondsBefore?}' };
const ACTIONS = ACTION_LIST.map(t => t + (PARAMS[t] ?? ''));

const INSTRUCTIONS = `You are the NAVIGATOR. The driver holds whatever indicated speed you call and obeys traffic controls, but will not turn unless you call it (at a T he stops and asks). Call turns before the intersection. At a STOP the driver waits for call.go: the printed Pause is what the ghost car spends; your car also loses time braking/accelerating, so wait less than the printed pause. Hidden timing checkpoints end each leg; 1 point per second early or late; the next leg's clock starts at your actual arrival. Use advance to move time (max 3600 s per request; untilEvent stops at the first notable event); observe to look; act to do (an act may carry "when": {elapsed|watchReads|event:featureVisible/carStopped/carStarted, label} to schedule it); truth returns hidden pace for debugging only; result ends a CLI session. Features ahead are listed with approximate distance in feet; sign text is readable only within half the sight distance. You cannot see hidden positions; you must track which instruction line you are on (line.set). Time Allowance: at a TA point (a yellow-box instruction after "End timed portion") you have 15 minutes to file ta.request {legIndex, seconds, fromLine, toLine} for each delayed leg, in multiples of 10 s up to 1770; the committee credits at most the measured delay (trains, accident scenes, hazard-forced stops, speed.emergency reduced speed; never navigation errors) minus what you could have made up, and never turns a late leg early. At the end-of-stage TA point send scorecard.ack. Transits: no assigned speed; an exact transit ("take exactly 20 minutes") must be left at IN + interval, a time-of-day restart at base + your ASP minutes. ta.declare is a deprecated alias. Starts and restarts: you leave at your own time (base + ASP minutes) minus the car's standing-start net loss (observe().launch.launchTime); give the driver "about 30 seconds" (call.warn) and count down so the last count lands on the launch second; pullUp is refused while the car ahead is still at the sign. The dash clock's minute hand is ambiguous within 5 s of the minute change (observe().clock): take the time of day from the stopwatch's TOD mode (watch.mode tod, clock.read {source:"stopwatch"}) and the seconds from the clock.`;

const DECISION_INSTRUCTIONS = ` DECISION MODE (modes includes "decision"): decision.next returns the step on screen: a rule card (read it; the next decision.next moves on) or a decision {kind, prompt, context, options?, timing?, deadlineSeconds?}. Answer with decision.answer {response: {optionId} for option cards, {tapSeconds} (seconds after the card appeared) for tapAt / countdown timing, {taps: [start, call]} for startStop}; null is a timeout. The verdict gives secondsDelta (+ late), correct and the rule with its source; the last verdict carries the RunResult. decision.next {start: {mode: practice|daily|boss, seed, skills, rung}} begins a new run; decision.run {bot: oracle|random, ...} plays a whole run.`;
function checkSpec(x: DecisionRunSpec): string | null {
  if (!x || typeof x !== 'object') return 'start must be an object';
  if (x.mode !== undefined && x.mode !== 'practice' && x.mode !== 'daily' && x.mode !== 'boss') return 'mode must be practice, daily or boss';
  if (x.seed !== undefined && !(Number.isInteger(x.seed) && x.seed >= 0 && x.seed < 2 ** 31)) return 'seed must be an integer 0..2^31';
  if (x.skills !== undefined && (!Array.isArray(x.skills) || !x.skills.every(s => (SKILLS as readonly string[]).includes(s)))) return `skills must be a list of ${SKILLS.join(', ')}`;
  if (x.rung !== undefined && ![0, 1, 2, 3].includes(x.rung)) return 'rung must be 0..3';
  if (x.decisions !== undefined && !(Number.isInteger(x.decisions) && x.decisions >= 10 && x.decisions <= 15)) return 'decisions must be 10..15';
  if (x.day !== undefined && !(typeof x.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.day))) return 'day must be YYYY-MM-DD';
  if (x.dailyIndex !== undefined && ![0, 1, 2].includes(x.dailyIndex)) return 'dailyIndex must be 0, 1 or 2';
  return null;
}
function startRun(x: DecisionRunSpec, fallbackSeed: number): DecisionRun {
  const seed = x.seed ?? fallbackSeed; const rung = x.rung ?? 2;
  if (x.mode === 'boss') return Scheduler.boss(seed, null, x.rung).start();
  if (x.mode === 'daily') return Scheduler.daily(x.day ?? '2026-10-23', x.dailyIndex ?? 0, null, rung).start();
  return new Scheduler(x.skills?.length ? x.skills : [...SKILLS], seed, null, { mode: 'practice', rung, ...(x.decisions !== undefined ? { decisions: x.decisions } : {}) }).start();
}

export class Session {
  private run: DecisionRun | null = null;
  readonly sim: Simulator;
  private eventCount = 0;
  private scheduled: { action: Action; when: NonNullable<Extract<Request, { type: 'act' }>['when']>; armedTod: number }[] = [];
  constructor(readonly scenario: Scenario, opts: SimOptions = {}) { this.sim = new Simulator(scenario, opts); this.eventCount = this.sim.events.length; }

  /** Fire scheduled actions whose condition holds now; returns descriptions of those fired. */
  private fireScheduled(prevObs: Omit<Observation, 'book'> | null): string[] {
    const fired: string[] = []; const keep: typeof this.scheduled = [];
    const o = this.peek();
    for (const sch of this.scheduled) {
      const w = sch.when; let due = false;
      if (w.elapsed !== undefined) due = this.sim.tod >= sch.armedTod + w.elapsed - 1e-9;
      else if (w.watchReads !== undefined) due = this.sim.watch.elapsed(this.sim.tod) >= w.watchReads - 1e-9;
      else if (w.event === 'carStopped') due = o.carStopped && this.sim.phase === 'running'; // ENG-016: the car standing at the start in the pre-read is not "stopped"
      else if (w.event === 'carStarted') due = !o.carStopped && this.sim.phase === 'running';
      else if (w.event === 'featureVisible') due = o.ahead.some(f => !w.label || (f.label ?? f.kind).toLowerCase().includes(w.label.toLowerCase()) || (f.sign?.text ?? '').toLowerCase().includes(w.label.toLowerCase()) || (f.control ?? '').toLowerCase() === w.label.toLowerCase());
      if (due) { this.sim.act(sch.action); fired.push(sch.action.type); } else keep.push(sch);
    }
    this.scheduled = keep; void prevObs;
    return fired;
  }

  private lastMsgId = 0;
  /** Observation for a reply: driver messages are every message since the previous reply (never drained by internal peeks). */
  private obs(): Omit<Observation, 'book'> {
    const { book: _b, ...rest } = this.sim.observe({ peek: true }); void _b;
    const messages = this.sim.driverMsgs.filter(m => m.id > this.lastMsgId);
    if (messages.length) this.lastMsgId = messages[messages.length - 1]!.id;
    return redactForAgent({ ...rest, driver: { ...rest.driver, messages } }, this.scenario.aids.rung, this.sim.phase === 'finished');
  }
  private peek(): Omit<Observation, 'book'> { const { book: _b, ...rest } = this.sim.observe({ peek: true }); void _b; return rest; }

  handle(req: Request): Reply {
    try {
      switch (req.type) {
        case 'hello': {
          const sc = this.scenario;
          return { type: 'hello', scenario: { id: sc.id, name: sc.name, startTime: sc.startTime, prereadSeconds: sc.prereadSeconds, car: sc.car.name, speedo: sc.speedo.kind, driver: `${sc.driver.name} (${sc.driver.skill})`, rules: sc.rules, aids: sc.aids }, book: sc.book, instructions: INSTRUCTIONS + DECISION_INSTRUCTIONS, actions: ACTIONS, modes: ['desk', 'decision'] };
        }
        case 'decision.next': {
          if (req.start !== undefined || !this.run) { const bad = checkSpec(req.start ?? {}); if (bad) return { type: 'error', message: bad }; this.run = startRun(req.start ?? {}, this.scenario.seed); }
          const run = this.run;
          let step = run.next();
          if (step?.type === 'rule') { run.ack(); }
          return { type: 'decision', step, done: step === null, plan: { seed: run.plan.seed, mode: run.plan.mode, skills: run.plan.skills, decisionCount: run.total } };
        }
        case 'decision.answer': {
          const run = this.run; if (!run) return { type: 'error', message: 'no decision run: send decision.next first' };
          let step = run.next(); while (step?.type === 'rule') { run.ack(); step = run.next(); }
          if (!step) return { type: 'error', message: 'the run is finished: send decision.next {start} for a new one' };
          const r = req.response;
          if (r !== null && r !== undefined && (typeof r !== 'object' || Array.isArray(r))) return { type: 'error', message: 'response must be an object {optionId?, tapSeconds?, taps?} or null' };
          const verdict = run.answer(r ?? null);
          const done = run.done();
          return { type: 'verdict', verdict, done, result: done ? run.result() : null };
        }
        case 'decision.run': {
          const bad = checkSpec(req); if (bad) return { type: 'error', message: bad };
          if (req.bot !== undefined && req.bot !== 'oracle' && req.bot !== 'random') return { type: 'error', message: 'decision.run bot must be oracle or random' };
          const run = startRun(req, this.scenario.seed); const bot = new DecisionBot(req.bot ?? 'oracle', Number.isFinite(req.botSeed) ? req.botSeed! : run.plan.seed);
          return { type: 'run', bot: bot.name, result: playRun(run, bot) };
        }
        case 'act':
          { const bad = validateAction(req.action); if (bad) return { type: 'error', message: bad }; }
          if (req.when !== undefined) {
            const bad = validateWhen(req.when); if (bad) return { type: 'error', message: bad };
            if (this.scheduled.length >= MAX_SCHEDULED) return { type: 'error', message: `at most ${MAX_SCHEDULED} scheduled actions (cancel some first)` };
            this.scheduled.push({ action: sanitizeAction(req.action), when: req.when, armedTod: this.sim.tod }); return { type: 'ack', ok: true, scheduled: true, observation: this.obs() };
          }
          this.sim.act(req.action); return { type: 'ack', ok: true, observation: this.obs() };
        case 'observe': return { type: 'observation', observation: this.obs() };
        // ENG-025: at aids rung <= 1 the run's answers (perfect times, the true pace) are not available until the finish: the same redaction as observe (ENG-018)
        case 'result': if (this.scenario.aids.rung <= 1 && this.sim.phase !== 'finished') return { type: 'error', message: 'result is available after the finish at aids rung <= 1' }; return { type: 'result', result: this.sim.result() };
        case 'cancel': { const n = this.scheduled.length; this.scheduled = []; return { type: 'cancelled', count: n }; }
        case 'truth': if (this.scenario.aids.rung <= 1 && this.sim.phase !== 'finished') return { type: 'error', message: 'truth is available after the finish at aids rung <= 1' }; return { type: 'truth', pace: this.sim.pace(), carS: this.sim.car.s, carMph: this.sim.car.mph() };
        case 'advance': {
          // ENG-015: with untilEvent, `seconds` (when given) also bounds the advance
          const want = req.untilEvent ? Math.min(req.maxSeconds ?? 120, req.seconds ?? Infinity) : (req.seconds ?? 1);
          if (typeof want !== 'number' || !Number.isFinite(want) || want < 0) return { type: 'error', message: 'advance seconds must be a finite non-negative number' };
          const max = Math.min(3600, want);
          let t = 0; let stoppedOn: string | null = null; const scheduledFired: string[] = [];
          const rung = this.scenario.aids.rung;
          const interesting = new Set(['driver', 'wait', 'release', 'finished', 'traffic', ...(rung >= 2 ? ['checkpoint', 'offCourse', 'rejoin'] : [])]);
          let prevVisible = new Set(this.peek().ahead.map(f => f.nodeId ?? f.label ?? f.kind));
          let prevStopped = this.peek().carStopped;
          // ENG-015: only events that happen during this advance stop it (an act's own depart / release are in its ack)
          const scanFrom = this.sim.events.length;
          // ENG-003: in the pre-read (or holding at a restart) an untilEvent advance wakes 30 s before the launch second and never runs past it
          const launch0 = this.sim.launchInfo(); const wasAbove30 = !!launch0 && launch0.secondsToLaunch > 30;
          while (t < max - 1e-9 && this.sim.phase !== 'finished') {
            this.sim.step(0.1); t += 0.1;
            scheduledFired.push(...this.fireScheduled(null));
            if (req.untilEvent) {
              const ev = this.sim.events.slice(scanFrom).find(e => interesting.has(e.type) && !(e.type === 'driver' && e.detail?.kind === 'readback'));
              const li = this.sim.launchInfo();
              if (li && ((wasAbove30 && li.secondsToLaunch <= 30) || li.secondsToLaunch <= 0)) { stoppedOn = 'launch'; break; }
              const o = this.peek();
              const nowVisible = new Set(o.ahead.map(f => f.nodeId ?? f.label ?? f.kind));
              const newFeature = [...nowVisible].find(k => !prevVisible.has(k));
              if (ev) { stoppedOn = ev.type === 'driver' ? `driverMessage:${String(ev.detail?.text ?? '')}` : ev.type; break; }
              if (newFeature) { stoppedOn = 'featureVisible'; break; }
              if (o.carStopped !== prevStopped) { stoppedOn = o.carStopped ? 'carStopped' : 'carStarted'; break; }
              if (scheduledFired.length) { stoppedOn = 'scheduledFired'; break; }
              prevVisible = nowVisible; prevStopped = o.carStopped;
            }
          }
          if (this.sim.phase === 'finished') stoppedOn = stoppedOn ?? 'phaseChange';
          const visible = rung >= 2 ? null : new Set(['driver', 'wait', 'release', 'depart', 'finished', 'traffic', 'abort', 'watchLost', 'ta.declare', 'ta.request', 'ta.refused', 'ta.point', 'scorecard.ack', 'speed.emergency', 'speed.resume', 'passed', 'call.speed', 'call.turn', 'call.stop', 'call.go', 'call.uturn', 'call.pass', 'call.pullover', 'pulledOver', 'restart', 'observation.stopped']);
          const events = this.sim.events.slice(this.eventCount).filter(e => visible ? visible.has(e.type) : e.type !== 'node').map(e => e.type === 'driver' ? `driver:${String(e.detail?.text ?? '')}` : e.type === 'passed' ? `passed:${String(e.detail?.what ?? '')}` : e.type);
          this.eventCount = this.sim.events.length;
          return { type: 'advanced', seconds: Math.round(t * 10) / 10, stoppedOn, events, scheduledFired, observation: this.obs() };
        }
      }
    } catch (e) { return { type: 'error', message: (e as Error).message }; }
    return { type: 'error', message: 'unknown request' };
  }
}


/** AGENT-004: in-process scripted play (no process spawn). */
export function playScript(scenario: Scenario, requests: Request[], opts: SimOptions = {}): Reply[] {
  const s = new Session(scenario, opts);
  return requests.map(r => s.handle(r));
}
