/** Request/response protocol for external agents (LLM playtesters, scripts). DESIGN §15.
 *  Time only advances on `advance`. The book is sent once in `hello`. */
import { Simulator, type Action, type Observation, type StageResult, type SimOptions } from '../core/sim.js';
import type { Scenario } from '../core/course.js';

export type Request =
  | { type: 'hello' }
  | { type: 'act'; action: Action }
  | { type: 'advance'; seconds?: number; untilEvent?: boolean; maxSeconds?: number }
  | { type: 'observe' }
  | { type: 'result' }
  | { type: 'truth' };

export interface HelloReply {
  type: 'hello'; scenario: { id: string; name: string; startTime: number; prereadSeconds: number; car: string; speedo: string; driver: string; rules: Scenario['rules']; aids: Scenario['aids'] };
  book: Scenario['book']; instructions: string; actions: string[];
}
export type Reply =
  | HelloReply
  | { type: 'ack'; ok: true; observation: Omit<Observation, 'book'> }
  | { type: 'advanced'; seconds: number; stoppedOn: string | null; observation: Omit<Observation, 'book'> }
  | { type: 'observation'; observation: Omit<Observation, 'book'> }
  | { type: 'result'; result: StageResult }
  | { type: 'truth'; pace: number; carS: number; carMph: number }
  | { type: 'error'; message: string };

const ACTIONS = ['watch.start', 'watch.stop', 'watch.toggle', 'watch.lap', 'watch.reset', 'watch.bezel{seconds}', 'bezel.set{seconds}', 'ledger.set{seconds}',
  'call.speed{mph}', 'call.turn{dir:L|R|S|BL|BR|AL|AR|JL|JR}', 'call.stop', 'call.go', 'call.uturn', 'call.pass', 'call.pullover',
  'line.set{n}', 'note{text}', 'ta.declare{seconds}', 'speedo.setFactor{k}', 'card.set{card}', 'start', 'skipPreread'];

const INSTRUCTIONS = `You are the NAVIGATOR. The driver holds whatever indicated speed you call and obeys traffic controls, but will not turn unless you call it (at a T he stops and asks). Call turns before the intersection. At a STOP the driver waits for call.go: the printed Pause is what the ghost car spends; your car also loses time braking/accelerating, so wait less than the printed pause. Hidden timing checkpoints end each leg; 1 point per second early or late; the next leg's clock starts at your actual arrival. Use advance to move time; observe to look; act to do. Features ahead are listed with approximate distance in feet. You cannot see hidden positions; you must track which instruction line you are on (line.set).`;

export class Session {
  readonly sim: Simulator;
  private eventCount = 0;
  constructor(readonly scenario: Scenario, opts: SimOptions = {}) { this.sim = new Simulator(scenario, opts); this.eventCount = this.sim.events.length; }

  private obs(): Omit<Observation, 'book'> { const { book: _b, ...rest } = this.sim.observe(); void _b; return rest; }

  handle(req: Request): Reply {
    try {
      switch (req.type) {
        case 'hello': {
          const sc = this.scenario;
          return { type: 'hello', scenario: { id: sc.id, name: sc.name, startTime: sc.startTime, prereadSeconds: sc.prereadSeconds, car: sc.car.name, speedo: sc.speedo.kind, driver: `${sc.driver.name} (${sc.driver.skill})`, rules: sc.rules, aids: sc.aids }, book: sc.book, instructions: INSTRUCTIONS, actions: ACTIONS };
        }
        case 'act': this.sim.act(req.action); return { type: 'ack', ok: true, observation: this.obs() };
        case 'observe': return { type: 'observation', observation: this.obs() };
        case 'result': return { type: 'result', result: this.sim.result() };
        case 'truth': return { type: 'truth', pace: this.sim.pace(), carS: this.sim.car.s, carMph: this.sim.car.mph() };
        case 'advance': {
          const max = req.untilEvent ? (req.maxSeconds ?? 120) : Math.max(0, req.seconds ?? 1);
          let t = 0; let stoppedOn: string | null = null;
          const interesting = new Set(['driver', 'wait', 'checkpoint', 'node', 'release', 'offCourse', 'rejoin', 'finished', 'traffic']);
          while (t < max - 1e-9 && this.sim.phase !== 'finished') {
            this.sim.step(0.1); t += 0.1;
            if (req.untilEvent) {
              const ev = this.sim.events.slice(this.eventCount).find(e => interesting.has(e.type));
              if (ev) { stoppedOn = ev.type === 'driver' ? `driver:${String(ev.detail?.text ?? '')}` : ev.type; break; }
              // also stop when a new feature comes into view
            }
          }
          if (this.sim.phase === 'finished') stoppedOn = stoppedOn ?? 'finished';
          this.eventCount = this.sim.events.length;
          return { type: 'advanced', seconds: Math.round(t * 10) / 10, stoppedOn, observation: this.obs() };
        }
      }
    } catch (e) { return { type: 'error', message: (e as Error).message }; }
    return { type: 'error', message: 'unknown request' };
  }
}
