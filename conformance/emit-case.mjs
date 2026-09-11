import { writeFileSync } from "node:fs";
import { caseRecordJsonSchema } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-records/schema/experimental/case-record-0.1.0.schema.json",
    import.meta.url,
  ),
  JSON.stringify(caseRecordJsonSchema(), null, 2) + "\n",
);
