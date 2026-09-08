import { writeFileSync } from "node:fs";
import { instrumentResearchReviewJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/instrument-research-review-0.1.0.schema.json",
    import.meta.url
  ),
  `${JSON.stringify(instrumentResearchReviewJsonSchema(), null, 2)}\n`
);
