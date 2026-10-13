import { writeFileSync } from "node:fs";
import { passiveSonarProfileJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/passive-sonar-profile-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(passiveSonarProfileJsonSchema(), null, 2) + "\n"
);
