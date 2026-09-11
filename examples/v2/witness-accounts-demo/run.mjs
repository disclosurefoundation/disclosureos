import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateResearchClaimHistory } from "@disclosureos/schema/experimental/v2";
const read = (name) => readFileSync(new URL(name, import.meta.url));
const documents = new Map(
  ["observation", "context", "entities"].map((name) => {
    const b = read(`${name}.json`);
    return [createHash("sha256").update(b).digest("hex"), b];
  })
);
const result = await evaluateResearchClaimHistory(
  JSON.parse(read("history.json")),
  { documents }
);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;
