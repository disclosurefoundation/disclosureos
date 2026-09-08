import { writeFileSync } from "node:fs";
import { assessmentSummaryEvaluationJsonSchema } from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-scoring/schema/experimental/assessment-summary-evaluation-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(assessmentSummaryEvaluationJsonSchema(), null, 2) + "\n"
);
