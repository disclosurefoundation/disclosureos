import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'completeness/index': 'src/completeness/index.ts',
    'compellingness/index': 'src/compellingness/index.ts',
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
