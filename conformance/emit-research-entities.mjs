import { writeFileSync } from "node:fs";
import {
  researchEntitiesJsonSchema,
  researchClaimHistoryJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["research-entities-0.1.0", researchEntitiesJsonSchema()],
  ["claim-history-0.3.0", researchClaimHistoryJsonSchema()],
])
  writeFileSync(
    new URL(
      `../packages/disclosureos-records/schema/experimental/${name}.schema.json`,
      import.meta.url
    ),
    JSON.stringify(schema, null, 2) + "\n"
  );
