import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    pool: 'forks',
    environment: 'node',
    server: {
      deps: {
        external: ['pdf-parse'],
      },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['lib/types.ts'],
      reporter: ['text', 'lcov'],
      // Current baseline: 80/70/94/80 — keep the floor close so any
      // meaningful drop in test coverage fails the build.
      thresholds: {
        statements: 88,
        branches: 78,
        functions: 94,
        lines: 88,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
