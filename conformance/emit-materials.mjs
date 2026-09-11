import { writeFileSync } from "node:fs";
import { materialEntitiesJsonSchema } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-records/schema/experimental/research-entities-0.3.0.schema.json",
    import.meta.url,
  ),
  JSON.stringify(materialEntitiesJsonSchema(), null, 2) + "\n",
);
