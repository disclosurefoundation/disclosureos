import { writeFileSync } from "node:fs";
import {
  archivalEntitiesJsonSchema,
  archivalClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["research-entities-0.2.0", archivalEntitiesJsonSchema()],
  ["claim-history-0.4.0", archivalClaimHistoryJsonSchema()],
])
  writeFileSync(
    new URL(
      `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
      import.meta.url,
    ),
    JSON.stringify(schema, null, 2) + "\n",
  );
