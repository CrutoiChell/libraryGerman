/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    // Default to jsdom for component and API-slice tests; pure logic
    // suites opt back into the lighter `node` environment via the globs below.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    environmentMatchGlobs: [
      ['lib/db/**/*.test.ts', 'node'],
      ['lib/validation*.test.ts', 'node'],
      ['tests/property/**', 'node'],
    ],
    // Exclude Playwright E2E suites; they run via `npm run test:e2e`.
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
    css: false,
  },
});
