import { writeFileSync } from 'node:fs';
import { acquisitionContextJsonSchema } from '../packages/disclosureos-instruments/dist/experimental/v2/index.js';
writeFileSync(new URL('../packages/disclosureos-instruments/schema/experimental/acquisition-context-0.1.0.schema.json',import.meta.url),`${JSON.stringify(acquisitionContextJsonSchema(),null,2)}\n`);
