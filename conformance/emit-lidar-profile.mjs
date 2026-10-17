import { writeFileSync } from "node:fs";
import { lidarProfileJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/lidar-point-cloud-profile-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(lidarProfileJsonSchema(), null, 2) + "\n"
);
