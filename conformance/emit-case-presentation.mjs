import { writeFileSync } from 'node:fs';
import { casePresentationJsonSchema } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
writeFileSync(
  new URL(
    '../packages/disclosureos-schema/schema/experimental/case-presentation-0.1.0.schema.json',
    import.meta.url,
  ),
  JSON.stringify(casePresentationJsonSchema(), null, 2) + '\n',
);
