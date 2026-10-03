import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Session } from '../src/agent/protocol.js';
import { builtinScenario } from '../src/agent/scenarios.js';

describe('agent protocol', () => {
  it('AGENT-002 request/response: hello carries the book once; time moves only on advance', () => {
    const s = new Session(builtinScenario('onestop'));
    const hello = s.handle({ type: 'hello' });
    expect(hello.type).toBe('hello'); if (hello.type !== 'hello') return;
    expect(hello.book.length).toBeGreaterThan(1); expect(hello.actions.length).toBeGreaterThan(10);
    const o1 = s.handle({ type: 'observe' }); const o2 = s.handle({ type: 'observe' });
    expect(JSON.stringify(o1)).toBe(JSON.stringify(o2));
    expect('book' in (o1 as { observation: object }).observation).toBe(false);
    const a = s.handle({ type: 'advance', seconds: 5 });
    expect(a.type).toBe('advanced'); if (a.type !== 'advanced') return;
    expect(a.seconds).toBeCloseTo(5, 6); expect(a.observation.tod).toBeCloseTo(s.sim.sc.startTime - 30 + 5, 6);
    const ack = s.handle({ type: 'act', action: { type: 'start' } }); expect(ack.type).toBe('ack');
    const ev = s.handle({ type: 'advance', untilEvent: true, maxSeconds: 200 });
    expect(ev.type).toBe('advanced'); if (ev.type !== 'advanced') return;
    expect(ev.stoppedOn).not.toBeNull();
    const bad = s.handle({ type: 'act', action: { type: 'speedo.setFactor', k: 1 } }); expect(['ack', 'error']).toContain(bad.type);
    const r = s.handle({ type: 'result' }); expect(r.type).toBe('result');
  });
  it('AGENT-001 CLI runs a bot headless and prints result JSON', () => {
    const out = execFileSync('npx', ['tsx', 'src/agent/cli.ts', '--scenario', 'builtin:onestop', '--bot', 'oracle', '--json'], { encoding: 'utf8', timeout: 60000 });
    const r = JSON.parse(out.trim().split('\n').pop()!);
    expect(r.score.legs.length).toBe(1); expect(r.score.legs[0].penalty).toBeLessThanOrEqual(2);
  }, 60000);
});
