import { writeFileSync } from "node:fs";
import { historicalTestimonySelectionJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/historical-testimony-selection-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(historicalTestimonySelectionJsonSchema(), null, 2) + "\n"
);
