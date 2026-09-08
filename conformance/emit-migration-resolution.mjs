import { writeFileSync } from "node:fs";
import { migrationResolutionJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/migration-resolution-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(migrationResolutionJsonSchema(), null, 2) + "\n"
);
