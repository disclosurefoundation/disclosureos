import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateArchivalClaimHistory } from "@disclosureos/schema/experimental/v2";
const read = (name) => readFileSync(new URL(name, import.meta.url));
const documents = new Map(
  ["observation.json", "entities.json"].map((name) => {
    const bytes = read(name);
    return [createHash("sha256").update(bytes).digest("hex"), bytes];
  }),
);
const result = await evaluateArchivalClaimHistory(
  JSON.parse(read("history.json")),
  { documents },
);
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;
