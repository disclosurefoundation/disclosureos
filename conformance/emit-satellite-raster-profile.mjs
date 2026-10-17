import { writeFileSync } from "node:fs";
import { satelliteRasterProfileJsonSchema } from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
writeFileSync(
  new URL(
    "../packages/disclosureos-schema/schema/experimental/satellite-raster-profile-0.1.0.schema.json",
    import.meta.url
  ),
  JSON.stringify(satelliteRasterProfileJsonSchema(), null, 2) + "\n"
);
