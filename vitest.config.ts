import { defineConfig } from 'vitest/config';

// Engine/systems are pure TS — the sim tests need no DOM or Svelte plugin.
// Kept separate from vite.config.ts so Vitest's bundled Vite types don't clash
// with the app's Vite 8 + Svelte plugin.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
