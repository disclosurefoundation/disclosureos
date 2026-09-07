import { mkdirSync, writeFileSync } from 'node:fs';
import { experimentalObservationJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';

const directory = new URL('../packages/disclosureos-records/schema/experimental/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('observation-0.1.0.schema.json', directory), `${JSON.stringify(experimentalObservationJsonSchema(), null, 2)}\n`);
