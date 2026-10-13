import { writeFileSync } from "node:fs";
import {
  vocabularyCatalogJsonSchema,
  vocabularyTermReferenceJsonSchema,
  vocabularyBindingsJsonSchema,
} from "../packages/disclosureos-records/dist/experimental/v2/index.js";
for (const [name, emit] of Object.entries({
  "vocabulary-catalog": vocabularyCatalogJsonSchema,
  "vocabulary-term-reference": vocabularyTermReferenceJsonSchema,
  "vocabulary-bindings": vocabularyBindingsJsonSchema,
})) {
  for (const pkg of ["records", "schema"])
    writeFileSync(
      new URL(
        `../packages/disclosureos-${pkg}/schema/experimental/${name}-0.1.0.schema.json`,
        import.meta.url,
      ),
      JSON.stringify(emit(), null, 2) + "\n",
    );
}
