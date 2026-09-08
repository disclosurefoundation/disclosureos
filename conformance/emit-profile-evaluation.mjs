import { writeFileSync } from "node:fs";
import { profileEvaluationJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/profile-evaluation-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(profileEvaluationJsonSchema(), null, 2) + "\n"
);
