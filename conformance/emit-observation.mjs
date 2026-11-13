import { mkdirSync, writeFileSync } from 'node:fs';
import { experimentalObservationJsonSchema, experimentalObservationV02JsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const directory = new URL('../packages/disclosureos-records/schema/experimental/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('observation-0.1.0.schema.json', directory), `${JSON.stringify(experimentalObservationJsonSchema(), null, 2)}\n`);

writeFileSync(new URL('observation-0.2.0.schema.json', directory), `${JSON.stringify(experimentalObservationV02JsonSchema(), null, 2)}\n`);
