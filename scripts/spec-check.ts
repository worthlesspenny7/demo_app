// Fails if any spec id in docs/spec/SPECS.md does not appear in a test name under tests/.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const specs = readFileSync('docs/spec/SPECS.md', 'utf8');
const ids = [...specs.matchAll(/^([A-Z]+-\d{3})\s/gm)].map(m => m[1]!);
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}
let tests = '';
for (const dir of ['tests', 'e2e']) { try { tests += walk(dir).map(p => readFileSync(p, 'utf8')).join('\n'); } catch { /* none yet */ } }
const missing = ids.filter(id => !tests.includes(id));
const covered = ids.length - missing.length;
console.log(`specs: ${ids.length}, covered: ${covered}, missing: ${missing.length}`);
if (missing.length) { console.log(missing.join('\n')); process.exit(process.env.SPEC_CHECK_SOFT ? 0 : 1); }
