import { writeFileSync } from 'node:fs';
import { casePresentationJsonSchema, contextCasePresentationJsonSchema } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
writeFileSync(
  new URL(
    '../packages/disclosureos-schema/schema/experimental/case-presentation-0.1.0.schema.json',
    import.meta.url,
  ),
  JSON.stringify(casePresentationJsonSchema(), null, 2) + '\n',
);

writeFileSync(new URL('../packages/disclosureos-schema/schema/experimental/context-case-presentation-0.1.0.schema.json', import.meta.url), JSON.stringify(contextCasePresentationJsonSchema(), null, 2) + '\n');

import { testimonyCasePresentationJsonSchema } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
writeFileSync(new URL('../packages/disclosureos-schema/schema/experimental/testimony-case-presentation-0.1.0.schema.json', import.meta.url), JSON.stringify(testimonyCasePresentationJsonSchema(), null, 2) + '\n');

import { archivalCasePresentationJsonSchema } from '../packages/disclosureos-schema/dist/experimental/v2/index.js';
writeFileSync(new URL('../packages/disclosureos-schema/schema/experimental/archival-case-presentation-0.1.0.schema.json', import.meta.url), JSON.stringify(archivalCasePresentationJsonSchema(), null, 2) + '\n');
