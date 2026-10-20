// Keep this config dependency-free so CI can invoke Vitest via npx without requiring
// a local `vitest` package just to resolve the config helper.
export default {
  resolve: {
    alias: {
      '@tce/contracts': new URL('./libs/contracts/src/index.ts', import.meta.url).pathname,
      '@tce/ssi': new URL('./libs/ssi/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
  },
};
