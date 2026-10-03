import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', sourcemap: false },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: true },
});
