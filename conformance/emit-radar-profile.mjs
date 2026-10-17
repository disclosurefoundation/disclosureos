import { writeFileSync } from "node:fs";
import {
  radarProfileJsonSchema,
  steeredRadarProfileJsonSchema,
  secondaryRadarProfileJsonSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
for (const [name, schema] of [
  ["radar-profile", radarProfileJsonSchema()],
  ["steered-radar-profile", steeredRadarProfileJsonSchema()],
  ["secondary-radar-profile", secondaryRadarProfileJsonSchema()],
]) {
  writeFileSync(
    new URL(
      `../packages/disclosureos-schema/schema/experimental/${name}-0.1.0.schema.json`,
      import.meta.url
    ),
    JSON.stringify(schema, null, 2) + "\n"
  );
}
