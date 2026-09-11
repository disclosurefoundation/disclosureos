import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateLaboratoryClaimHistory } from "@disclosureos/schema/experimental/v2";
const read = (name) => readFileSync(new URL(name, import.meta.url));
const documents = new Map(
  ["observation.json", "entities.json", "selection.json"].map((name) => {
    const bytes = read(name);
    return [createHash("sha256").update(bytes).digest("hex"), bytes];
  }),
);
const result = await evaluateLaboratoryClaimHistory(
  JSON.parse(read("history.json")),
  { documents },
);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;
