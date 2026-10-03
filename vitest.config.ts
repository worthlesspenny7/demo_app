import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    testTimeout: 30_000,   // full generated days run in 4-7 s on a loaded machine
    coverage: { provider: 'v8', include: ['src/core/**'] },
  },
});
