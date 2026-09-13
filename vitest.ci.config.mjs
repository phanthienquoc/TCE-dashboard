export default {
  resolve: {
    alias: {
      '@tce/contracts': new URL('./libs/contracts/src/index.ts', import.meta.url).pathname,
      '@tce/ssi': new URL('./libs/ssi/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.ci.setup.mjs'],
  },
};
