import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'experimental/v2/index': 'src/experimental/v2/index.ts',
  },
  // ESM-only (Phase 4 Decision B): CJS consumers use dynamic `import()`.
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  target: 'es2020',
});
