import { writeFileSync } from "node:fs";
import { radarProfileJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";

writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/radar-profile-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(radarProfileJsonSchema(), null, 2) + "\n"
);
