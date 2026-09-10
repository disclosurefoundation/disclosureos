import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateContextClaimHistory } from "@disclosureos/schema/experimental/v2";
const read = (name) => readFileSync(new URL(name, import.meta.url));
const history = JSON.parse(read("history.json"));
const documents = new Map(
  ["observation.json", "context.json", "acquisition.json"].map((name) => {
    const data = read(name);
    return [createHash("sha256").update(data).digest("hex"), data];
  }),
);
const result = await evaluateContextClaimHistory(history, { documents });
console.log(JSON.stringify(result, null, 2));
if (!result.success) process.exitCode = 1;
