/** PT-06 area 9 / DET-001: rng.fork(name) must be reproducible from (seed, name); it hashes the parent's CURRENT state instead. */
import { rng } from '../src/core/rng.js';
const a = rng(5).fork('speedo').next();
const r = rng(5); r.next(); r.next();
const b = r.fork('speedo').next();
console.log('fork before consuming', a, 'fork after 2 draws', b, a === b ? 'same' : 'DIFFERENT');
