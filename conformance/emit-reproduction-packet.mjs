import { writeFileSync } from "node:fs";
import { reproductionPacketJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/reproduction-packet-0.1.0.schema.json",
    import.meta.url
  ),
  `${JSON.stringify(reproductionPacketJsonSchema(), null, 2)}\n`
);
