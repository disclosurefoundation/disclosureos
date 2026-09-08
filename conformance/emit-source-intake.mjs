import { writeFileSync } from "node:fs";
import { sourceIntakeJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/source-intake-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(sourceIntakeJsonSchema(), null, 2) + "\n"
);
