import { writeFileSync } from "node:fs";
import { caseLinksJsonSchema } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-records/schema/experimental/case-links-0.1.0.schema.json",
    import.meta.url,
  ),
  JSON.stringify(caseLinksJsonSchema(), null, 2) + "\n",
);
