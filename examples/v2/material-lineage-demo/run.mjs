import { readFileSync } from "node:fs";
import { parseMaterialEntities } from "@disclosureos/records/experimental/v2";
const input = JSON.parse(
  readFileSync(new URL("entities.json", import.meta.url)),
);
const result = parseMaterialEntities(input);
console.log(
  JSON.stringify(
    {
      success: result.success,
      checks: result.checks,
      issues: result.issues,
      uncheckedRefs: result.uncheckedRefs,
    },
    null,
    2,
  ),
);
if (!result.success) process.exitCode = 1;
