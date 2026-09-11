import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tce/contracts': new URL('./libs/contracts/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
  },
});
