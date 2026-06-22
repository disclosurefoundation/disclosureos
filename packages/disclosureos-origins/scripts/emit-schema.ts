/**
 * Regenerate the committed JSON Schema artifact:
 *   pnpm --filter @disclosureos/origins emit:schema
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { originsJsonSchema } from '../src/schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'schema');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'origins.schema.json');
writeFileSync(outFile, `${JSON.stringify(originsJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${outFile}`);
