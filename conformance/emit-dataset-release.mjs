import { writeFileSync } from "node:fs";
import { datasetReleaseJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/dataset-release-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(datasetReleaseJsonSchema(), null, 2) + "\n"
);
