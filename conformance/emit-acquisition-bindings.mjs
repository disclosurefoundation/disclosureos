import {writeFileSync} from 'node:fs';
import {acquisitionBindingsJsonSchema} from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
writeFileSync(new URL('../packages/disclosureos-schema/schema/experimental/acquisition-bindings-0.1.0.schema.json',import.meta.url),`${JSON.stringify(acquisitionBindingsJsonSchema(),null,2)}\n`);
