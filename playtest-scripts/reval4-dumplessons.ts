import { LESSONS, lessonText } from '../content/lessons.js';
import * as R from '../content/reference-data.js';
import { writeFileSync } from 'node:fs';
const out: string[] = [];
for (const l of LESSONS) { out.push(`\n######## LESSON ${l.id} (${l.title}) ${l.minutes} min\n` + lessonText(l)); }
writeFileSync('/tmp/claude-0/lessons.txt', out.join('\n'));
const ref: string[] = [];
for (const [k, v] of Object.entries(R)) { if (typeof v === 'function') continue; ref.push(`\n#### ${k}\n` + JSON.stringify(v, null, 0).slice(0, 6000)); }
writeFileSync('/tmp/claude-0/reference.txt', ref.join('\n'));
console.log(LESSONS.map(l => `${l.id} ${lessonText(l).split(/\s+/).length}w`).join(' | '));
