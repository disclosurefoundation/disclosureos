/**
 * Regenerate the committed composed JSON Schema artifact:
 *   pnpm --filter @disclosureos/schema emit:schema
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeObservationSchema } from '../src/compose';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'schema');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'enriched-observation.schema.json');
writeFileSync(outFile, `${JSON.stringify(composeObservationSchema(), null, 2)}\n`);
console.log(`Wrote ${outFile}`);
