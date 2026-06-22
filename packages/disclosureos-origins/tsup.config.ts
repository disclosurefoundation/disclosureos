import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'taxonomy/index': 'src/taxonomy/index.ts',
    'taxonomy/physical/index': 'src/taxonomy/physical/index.ts',
    'taxonomy/psychosocial/index': 'src/taxonomy/psychosocial/index.ts',
    'taxonomy/metaphysical/index': 'src/taxonomy/metaphysical/index.ts',
    'classification/index': 'src/classification/index.ts',
    'reference/index': 'src/reference/index.ts',
    'reference/hynek/index': 'src/reference/hynek/index.ts',
    'reference/vallee/index': 'src/reference/vallee/index.ts',
    'reference/aaro/index': 'src/reference/aaro/index.ts',
    'reference/geipan/index': 'src/reference/geipan/index.ts',
    'labels/index': 'src/labels/index.ts',
    'constants/index': 'src/constants/index.ts',
    'guards/index': 'src/guards/index.ts',
    'factories/index': 'src/factories/index.ts',
    'formatters/index': 'src/formatters/index.ts',
  },
  // ESM-only (Phase 4 Decision B): CJS consumers use dynamic `import()`.
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: 'es2020',
});
