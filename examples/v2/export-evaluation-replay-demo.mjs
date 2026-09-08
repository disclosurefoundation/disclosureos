import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { researchEvaluationExample } from "./evaluation-provenance-demo.mjs";
import { evaluateResearchEvaluation } from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
if (process.argv.length !== 3 || process.argv[2].startsWith("-"))
  throw Error(
    "Usage: node examples/v2/export-evaluation-replay-demo.mjs <new-directory>"
  );
const { manifest, options } = researchEvaluationExample();
const result = await evaluateResearchEvaluation(manifest, options);
if (!result.receipt)
  throw Error("Synthetic evaluation did not produce a receipt");
const root = resolve(process.argv[2]);
// Exclusive directory creation prevents overwriting an existing dataset or export.
mkdirSync(root);
mkdirSync(join(root, "files"));
mkdirSync(join(root, "dependencies"));
writeFileSync(
  join(root, "receipt.json"),
  JSON.stringify(result.receipt, null, 2) + "\n",
  { flag: "wx" }
);
writeFileSync(join(root, "packet.json"), options.packetBytes, { flag: "wx" });
for (const [name, map] of [
  ["files", options.files],
  ["dependencies", options.dependencyFiles],
])
  for (const [id, bytes] of map)
    writeFileSync(join(root, name, id), bytes, { flag: "wx" });
console.log(
  JSON.stringify({
    directory: root,
    synthetic: true,
    evaluationSuccess: result.success,
    receipt: result.receipt.output,
  })
);
