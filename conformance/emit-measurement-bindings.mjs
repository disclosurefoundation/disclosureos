import { writeFileSync } from "node:fs";
import { measurementBindingsJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/measurement-bindings-0.1.0.schema.json",
    import.meta.url
  ),
  `${JSON.stringify(measurementBindingsJsonSchema(), null, 2)}\n`
);
