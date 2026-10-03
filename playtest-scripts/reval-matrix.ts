/** RE-VALIDATION (education): oracle vs rookie across the curriculum, stars + rubric tip + VM tip + attribution totals. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { OracleBot, runBot } from '../src/agent/bots.js';
import { debriefViewModel } from '../src/ui/viewmodels/debrief.js';

const drills = (process.argv[2] ?? 'D03,D04,D05,D06,D07,D08,D08b,D10,D15,D16,D17,D18,D11,D12').split(',');
const tiers = (process.argv[3] ?? '0,2').split(',').map(Number);
const seeds = (process.argv[4] ?? '1,2,3,4,5').split(',').map(Number);
const bots = (process.argv[5] ?? 'oracle,rookie').split(',');
const json: any[] = [];
for (const id of drills) {
  const d = drillById(id)!;
  for (const t of tiers) for (const bn of bots) {
    const stars: number[] = []; const legs: string[] = []; let tip0 = '', vm0 = '', att0 = '', rightTips = [] as string[];
    for (const s of seeds) {
      try {
        const sc = d.scenario(s, t); const sim = new Simulator(sc);
        const bot = bn === 'oracle' ? new OracleBot(sim, { useWatch: true }) : bn === 'rookie' ? new OracleBot(sim, { ignoreLosses: true }) : new OracleBot(sim, { useWatch: true, noRecovery: true });
        const r = runBot(sim, bot); const rb = d.rubric(r, sc);
        stars.push(rb.stars);
        legs.push(`[${r.score.legs.map(l => l.error === null ? 'M' : (l.error > 0 ? '+' : '') + Math.round(l.error * 10) / 10).join(',')}]oc${r.offCourseCount}`);
        const tot: Record<string, number> = {}; for (const a of r.attribution) for (const [k, v] of Object.entries(a.buckets)) tot[k] = (tot[k] ?? 0) + v;
        const att = Object.entries(tot).filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ');
        let vmtip = ''; try { vmtip = debriefViewModel(r, sc, {}).tip ?? ''; } catch (e) { vmtip = 'VMERR ' + (e as Error).message.slice(0, 50); }
        const sh = (x: string) => x.slice(0, 48); rightTips.push(`s${s} ${rb.stars}* RUB[${sh(rb.feedback[0] ?? '')}] ${vmtip === rb.feedback[0] ? 'VM=same' : 'VM[' + sh(vmtip) + ']'} ATT[${att}] ${rb.headline.slice(0, 70)}`);
        if (s === seeds[0]) { tip0 = rb.feedback[0] ?? ''; vm0 = vmtip; att0 = att; }
      } catch (e) { stars.push(-1); legs.push('ERR ' + (e as Error).message.slice(0, 80)); }
    }
    console.log(`\n## ${id} t${t} ${bn}: stars=${stars.join('/')}  legs ${legs.join(' ')}`);
    for (const x of rightTips) console.log('   ' + x);
  }
}
