import { writeFileSync } from "node:fs";
import { videoFrameSourceMappingJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/video-frame-source-mapping-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(videoFrameSourceMappingJsonSchema(), null, 2) + "\n"
);
