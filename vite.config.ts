import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * MOB-023: after the build, write the precache list (every emitted file but the worker itself and source maps) and a build hash into
 * dist/sw.js, so the service worker caches the whole app shell on its first install and a new build replaces the old cache.
 */
function rallyServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'rally-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      if (!existsSync(swPath)) return;
      const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
      const files = walk(outDir).map(p => relative(outDir, p).split(sep).join('/')).filter(f => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const list = ['./', ...files.map(f => `./${f}`)];
      const src = readFileSync(swPath, 'utf8')
        .replace('__RALLY_BUILD__', hash.digest('hex').slice(0, 12))
        .replace(/\/\*__RALLY_PRECACHE__\*\/\[[^\]]*\]/, JSON.stringify(list));
      writeFileSync(swPath, src);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [rallyServiceWorker()],
  build: { outDir: 'dist', target: 'es2022', sourcemap: false },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: true },
});
