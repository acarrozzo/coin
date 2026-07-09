import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The Svelte plugin lets component tests compile .svelte files. Engine tests
// run in the default 'node' env; component tests opt into jsdom per-file via
// `// @vitest-environment jsdom`.
//
// Kept out of tsconfig.node.json's type-check on purpose: Vitest bundles its own
// Vite whose plugin types clash with the app's Vite 8 + Svelte plugin. That's a
// type-only conflict; at runtime this config works fine.
export default defineConfig({
  plugins: [svelte()],
  // Resolve Svelte's browser/client build so component tests can mount().
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
