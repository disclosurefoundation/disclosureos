import { writeFileSync } from "node:fs";
import { migrationReviewJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/migration-review-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(migrationReviewJsonSchema(), null, 2) + "\n"
);
