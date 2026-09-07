import { writeFileSync } from 'node:fs';
import { experimentalClaimHistoryJsonSchema } from '../packages/disclosureos-records/dist/experimental/v2/index.js';
writeFileSync(new URL('../packages/disclosureos-records/schema/experimental/claim-history-0.1.0.schema.json', import.meta.url), `${JSON.stringify(experimentalClaimHistoryJsonSchema(), null, 2)}\n`);
