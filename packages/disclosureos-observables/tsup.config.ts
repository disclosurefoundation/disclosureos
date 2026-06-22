import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'technology/index': 'src/technology/index.ts',
    'biologics/index': 'src/biologics/index.ts',
    'assessment/index': 'src/assessment/index.ts',
    'labels/index': 'src/labels/index.ts',
    'constants/index': 'src/constants/index.ts',
    'guards/index': 'src/guards/index.ts',
    'factories/index': 'src/factories/index.ts',
    'formatters/index': 'src/formatters/index.ts',
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
