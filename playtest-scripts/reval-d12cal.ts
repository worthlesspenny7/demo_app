import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator, type Action } from '../src/core/sim.js';
import { OracleBot, runBot, type Bot } from '../src/agent/bots.js';
import { calibrationFactor, cheatCard } from '../src/core/calibration.js';
const d = drillById('D12')!;
for (const t of [1, 2]) for (const mode of ['no cal', 'cal card']) {
  const out: string[] = [];
  for (const s of [1, 2, 3]) {
    const sc = d.scenario(s, t); const sim = new Simulator(sc, { useCard: false }); const inner = new OracleBot(sim, { useWatch: true }); let applied = mode === 'no cal';
    const bot: Bot = { name: 'c', onTick(ss) { inner.onTick(ss); if (applied) return; const cal = ss.sc.book.filter(b => b.section === 'calibration' && b.perfectCumulative !== undefined); const ev = ss.events.filter(e => e.type === 'node' && cal.some(c => c.nodeId === e.detail?.nodeId)); if (cal.length < 2 || ev.length < cal.length) return; applied = true; const iv = []; for (let i = 1; i < cal.length; i++) iv.push({ perfect: cal[i]!.perfectCumulative! - cal[i - 1]!.perfectCumulative!, actual: ev[i]!.tod - ev[i - 1]!.tod }); const k = calibrationFactor(iv); ss.act(sc.speedo.kind === 'timewise' ? { type: 'speedo.setFactor', k } as Action : { type: 'card.set', card: cheatCard(k) } as Action); } };
    const r = runBot(sim, bot); const rb = d.rubric(r, sc); out.push(`s${s}: raw ${r.score.raw} ${rb.stars}* oc${r.offCourseCount}`);
  }
  console.log(`D12 t${t} ${mode}: ${out.join(' | ')}`);
}
