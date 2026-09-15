import { writeFileSync } from "node:fs";
import { productSourceSelectionJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/product-source-selection-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(productSourceSelectionJsonSchema(), null, 2) + "\n"
);
