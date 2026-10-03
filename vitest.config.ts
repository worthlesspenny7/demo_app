import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    coverage: { provider: 'v8', include: ['src/core/**'] },
  },
});
