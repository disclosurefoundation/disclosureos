import { writeFileSync } from "node:fs";
import { migrationCompatibilityJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/migration-compatibility-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(migrationCompatibilityJsonSchema(), null, 2) + "\n"
);
