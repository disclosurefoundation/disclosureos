import { writeFileSync } from "node:fs";
import { mcapSourceMappingJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/mcap-source-mapping-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(mcapSourceMappingJsonSchema(), null, 2) + "\n"
);
