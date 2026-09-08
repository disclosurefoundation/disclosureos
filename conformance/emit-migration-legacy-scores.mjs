import { writeFileSync } from "node:fs";
import { migrationLegacyScoresJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/migration-legacy-scores-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(migrationLegacyScoresJsonSchema(), null, 2) + "\n"
);
