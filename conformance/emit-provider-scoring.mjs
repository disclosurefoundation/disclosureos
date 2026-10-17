import { writeFileSync } from "node:fs";
import {
  providerScorePolicyJsonSchema,
  providerScoreResultJsonSchema,
} from "../packages/disclosureos-scoring/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["provider-score-policy", providerScorePolicyJsonSchema()],
  ["provider-score-result", providerScoreResultJsonSchema()],
]) {
  writeFileSync(
    new URL(
      `../packages/disclosureos-scoring/schema/experimental/${name}-0.1.0.schema.json`,
      import.meta.url
    ),
    `${JSON.stringify(schema, null, 2)}\n`
  );
}
