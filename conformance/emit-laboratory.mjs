import { writeFileSync } from "node:fs";
import {
  laboratoryEntitiesJsonSchema,
  laboratoryClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["research-entities-0.4.0", laboratoryEntitiesJsonSchema()],
  ["claim-history-0.5.0", laboratoryClaimHistoryJsonSchema()],
])
  writeFileSync(
    new URL(
      `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
      import.meta.url,
    ),
    JSON.stringify(schema, null, 2) + "\n",
  );
