import { writeFileSync } from "node:fs";
import {
  observationContextJsonSchema,
  contextClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["observation-context-0.1.0", observationContextJsonSchema()],
  ["claim-history-0.2.0", contextClaimHistoryJsonSchema()],
])
  writeFileSync(
    new URL(
      `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
      import.meta.url,
    ),
    JSON.stringify(schema, null, 2) + "\n",
  );
