/** PT-06 protocol hygiene: unknown fields on an action pass validateAction, are copied into events[] and actions[] verbatim (Infinity/NaN reach result(); size is unbounded). */
import { builtinScenario } from '../src/agent/scenarios.js';
import { Session } from '../src/agent/protocol.js';
const s = new Session(builtinScenario('straight', 1), { watch: 'digital' });
const big = 'x'.repeat(5_000_000);
const a = s.handle({ type: 'act', action: { type: 'note', text: 'hi', junk: Infinity, blob: big } as never }); console.log('note with junk fields ->', a.type);
const l = s.handle({ type: 'act', action: { type: 'line.set', n: 1, fromLine: NaN } as never }); console.log('line.set with a NaN junk field ->', l.type);
const r = s.sim.result(); const bad = r.events.filter(e => JSON.stringify(e.detail ?? {}).length > 1e6 || Object.values(e.detail ?? {}).some(v => typeof v === 'number' && !Number.isFinite(v)));
console.log('events carrying non-finite numbers or > 1 MB:', bad.length, '| result() JSON bytes', JSON.stringify(r).length, '| actions kept verbatim:', r.actions.some(x => (x.action as any).blob === big));
