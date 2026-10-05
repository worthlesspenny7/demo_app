/** PT-12: list the generator's realism-v4 rows (12/15 mph, posted limits below the assigned speed, blinker pauses, two-row RR crossings, delayed and chained
 *  timed changes, the mid-stage exact transit) for a stage scenario, straight from the read-only engine (no UI). usage: npx tsx pt12-20-genrows.ts builtin 1 | D12 0 1 */
import { builtinScenario } from '../src/ui/state.ts';
import { allDrills } from '../src/core/drills/index.ts';
const [kind = 'builtin', a = '1', b = '1'] = process.argv.slice(2);
const sc: any = kind === 'builtin' ? builtinScenario('stage', Number(a)) : allDrills().find(d => d.id === kind)!.scenario(Number(b), Number(a));
const nodes = new Map<string, any>(sc.course.nodes.map((n: any) => [n.id, n]));
console.log(`${sc.id ?? sc.name}: ${sc.book.length} lines, aids rung ${sc.aids?.rung}, book style ${sc.bookStyle}, tags ${JSON.stringify(sc.tags)}`);
let v: number | null = null;
for (const ins of sc.book) {
  const nd: any = nodes.get(ins.nodeId) ?? {};
  const vin = v; if (ins.timed) v = ins.timed.chain?.length ? ins.timed.chain[ins.timed.chain.length - 1].thenSpeed : ins.timed.thenSpeed; else if (typeof ins.speed === 'number') v = ins.speed;
  const sign = nd.sign?.text ?? ''; const lim = /SPEED LIMIT (\d+)/.exec(sign);
  const tags: string[] = [];
  if (ins.speed === 12 || ins.speed === 15 || ins.timed?.holdSpeed === 15 || ins.timed?.thenSpeed === 15) tags.push('12/15');
  if (lim && typeof v === 'number' && Number(lim[1]) < (ins.speed ?? v)) tags.push(`LIMIT<${ins.speed ?? v}`);
  if (lim && typeof ins.speed === 'number' && Number(lim[1]) < ins.speed) tags.push('LIMIT-BELOW');
  if (nd.control === 'BLINKER') tags.push('BLINKER' + (ins.pause ? ` pause ${ins.pause}` : ''));
  if (nd.fullStop) tags.push('fullStop');
  if (/RR/.test(nd.label ?? '') || nd.control === 'RR') tags.push('RR:' + nd.label);
  if (ins.timed?.chain) tags.push('CHAIN ' + JSON.stringify(ins.timed));
  if (ins.timed?.delayed) tags.push('DELAYED ' + JSON.stringify(ins.timed));
  if (ins.transit?.exact || /exactly/i.test(ins.text ?? '')) tags.push('EXACT ' + JSON.stringify(ins.transit ?? {}));
  if (tags.length || process.env.ALL) console.log(`#${ins.n} [${ins.section ?? ''}] in ${vin} ${ins.turn ?? ''} sp ${ins.speed ?? ''} p ${ins.pause ?? ''} ${sign ? 'sign "' + sign + '"' : ''} ctl ${nd.control ?? ''} :: ${tags.join(' | ')} :: ${(ins.text ?? '').slice(0, 140)}`);
}
