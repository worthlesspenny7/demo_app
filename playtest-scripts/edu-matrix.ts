/** EDUCATION validation: bot x drill x tier x seed matrix graded by drill.rubric. */
import '../src/core/drills/index.js';
import { drillById } from '../src/core/drills/registry.js';
import { Simulator } from '../src/core/sim.js';
import { makeBot, runBot, OracleBot, type BotName } from '../src/agent/bots.js';

const drills = (process.argv[2] ?? 'D03,D04,D05,D07,D08,D08b,D10,D15,D16,D17,D18,D11').split(',');
const tiers = (process.argv[3] ?? '0,2').split(',').map(Number);
const seeds = (process.argv[4] ?? '1,2,3').split(',').map(Number);
const botNames = (process.argv[5] ?? 'oracle,rookie,noPause,goCount,lateCall,random').split(',');
const rows: string[] = [];
for (const id of drills) {
  const d = drillById(id)!;
  for (const t of tiers) for (const bn of botNames) {
    const cells: string[] = []; let tip = ''; let stars: number[] = []; let errsAll: string[] = [];
    for (const s of seeds) {
      try {
        const sc = d.scenario(s, t);
        const sim = new Simulator(sc);
        let bot;
        if (bn === 'oracleNoRec') bot = new OracleBot(sim, { useWatch: true, noRecovery: true }); else bot = makeBot(bn as BotName, sim, s);
        const r = runBot(sim, bot);
        const rb = d.rubric(r, sc);
        stars.push(rb.stars);
        const legs = r.score.legs.map(l => l.error === null ? 'M' : (l.error > 0 ? '+' : '') + l.error).join(',');
        errsAll.push(`s${s}[${legs}]oc${r.offCourseCount}`);
        if (!tip) tip = rb.feedback[0] ?? '';
        if (s === seeds[0]) tip = rb.feedback[0] ?? '';
      } catch (e) { errsAll.push(`s${s}ERR ${(e as Error).message.slice(0, 60)}`); stars.push(-1); }
    }
    rows.push(`${id} t${t} ${bn.padEnd(8)} stars=${stars.join('/')} ${errsAll.join(' ')} | tip(s${seeds[0]}): ${tip.slice(0, 110)}`);
  }
}
console.log(rows.join('\n'));
