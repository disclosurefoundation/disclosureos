import { writeFileSync } from "node:fs";
import { physicalSampleSelectionJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/physical-sample-selection-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(physicalSampleSelectionJsonSchema(), null, 2) + "\n"
);
