/**
 * Regenerate the committed composed JSON Schema artifact:
 *   pnpm --filter @disclosureos/schema emit:schema
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeObservationSchema } from '../src/compose';
import { steeredRadarProfileJsonSchema, secondaryRadarProfileJsonSchema } from '../src/experimental/v2/advanced-radar-profile-schema';
import { radarProfileJsonSchema } from '../src/experimental/v2/radar-profile-schema';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'schema');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'enriched-observation.schema.json');
writeFileSync(outFile, `${JSON.stringify(composeObservationSchema(), null, 2)}\n`);
console.log(`Wrote ${outFile}`);
const radarFile = join(outDir, 'experimental', 'radar-profile-0.1.0.schema.json');
mkdirSync(dirname(radarFile), { recursive: true });
writeFileSync(radarFile, `${JSON.stringify(radarProfileJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${radarFile}`);

for (const [name, schema] of [["steered-radar-profile", steeredRadarProfileJsonSchema()], ["secondary-radar-profile", secondaryRadarProfileJsonSchema()]] as const) {
  const path = join(outDir, "experimental", `${name}-0.1.0.schema.json`);
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`Wrote ${path}`);
}
