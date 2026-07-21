/**
 * Regenerate the committed JSON Schema artifact:
 *   pnpm --filter @disclosureos/instruments emit:schema
 *
 * The drift test (`src/__tests__/schema.test.ts`) fails the build if the
 * committed file diverges from what the Zod schemas produce.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { instrumentsJsonSchema } from '../src/schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'schema');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'sensor-manifest.schema.json');
writeFileSync(outFile, `${JSON.stringify(instrumentsJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${outFile}`);
