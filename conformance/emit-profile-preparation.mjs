import { writeFileSync } from "node:fs";
import { profilePreparationJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/profile-preparation-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(profilePreparationJsonSchema(), null, 2) + "\n"
);
