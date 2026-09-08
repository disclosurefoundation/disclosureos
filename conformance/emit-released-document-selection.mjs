import { writeFileSync } from "node:fs";
import { releasedDocumentSelectionJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/released-document-selection-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(releasedDocumentSelectionJsonSchema(), null, 2) + "\n"
);
