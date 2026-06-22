import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'observation/index': 'src/observation/index.ts',
    'source/index': 'src/source/index.ts',
    'source/sensor/index': 'src/source/sensor/index.ts',
    'extensions/provenance/index': 'src/extensions/provenance/index.ts',
    'extensions/identifiers/index': 'src/extensions/identifiers/index.ts',
    'extensions/testimony/index': 'src/extensions/testimony/index.ts',
    'extensions/physical/index': 'src/extensions/physical/index.ts',
    'extensions/document/index': 'src/extensions/document/index.ts',
    'temporal/index': 'src/temporal/index.ts',
    'geo/index': 'src/geo/index.ts',
    'media/index': 'src/media/index.ts',
    'labels/index': 'src/labels/index.ts',
    'constants/index': 'src/constants/index.ts',
    'guards/index': 'src/guards/index.ts',
    'factories/index': 'src/factories/index.ts',
    'formatters/index': 'src/formatters/index.ts',
    'validators/index': 'src/validators/index.ts',
    'shared/index': 'src/shared/index.ts',
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
