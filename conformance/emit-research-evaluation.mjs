import { writeFileSync } from "node:fs";
import { researchEvaluationJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/research-evaluation-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(researchEvaluationJsonSchema(), null, 2) + "\n"
);
