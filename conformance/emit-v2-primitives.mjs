// Explicit regeneration only. Tests compare this emitter with the committed artifact.
import { mkdirSync, writeFileSync } from 'node:fs';
import { primitivesJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const directory = new URL('../packages/disclosureos-records/schema/experimental/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('v2-primitives-0.2.0.schema.json', directory), `${JSON.stringify(primitivesJsonSchema(), null, 2)}\n`);
