import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateAssessmentSummaryEvaluation } from "../../packages/disclosureos-scoring/dist/experimental/v2/index.js";
export const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
export function summaryEvaluationExample() {
  const read = (path) =>
    new Uint8Array(readFileSync(new URL(path, import.meta.url)));
  const historyBytes = read("./claim-history.json"),
    vocabulary = read("./summary-evaluation-vocabulary.json"),
    implementation = read(
      "../../packages/disclosureos-scoring/dist/experimental/v2/index.js"
    );
  const environment = new TextEncoder().encode(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      lockfile: readFileSync(
        new URL("../../pnpm-lock.yaml", import.meta.url),
        "utf8"
      ),
    })
  );
  const dependencyFiles = new Map([
    ["vocabulary", vocabulary],
    ["implementation", implementation],
    ["environment", environment],
  ]);
  const manifest = {
    kind: "assessment_summary_evaluation",
    schemaVersion: "0.1.0",
    id: "synthetic-summary-evaluation",
    workflow: "assessment-summary:0.1.0",
    history: pin(historyBytes),
    dependencies: {
      vocabularies: [
        {
          ref: "vocabulary",
          id: "urn:disclosureos:synthetic:vocabulary:radial-motion",
          version: "0.1.0",
          ...pin(vocabulary),
        },
      ],
      implementation: {
        ref: "implementation",
        id: "@disclosureos/scoring/experimental/v2",
        version: "summary-evaluation-0.1.0",
        ...pin(implementation),
      },
      environment: {
        ref: "environment",
        id: "urn:disclosureos:local:node-and-lockfile",
        version: "0.1.0",
        ...pin(environment),
      },
    },
  };
  return { manifest, options: { historyBytes, dependencyFiles } };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length > 3 || process.argv[2]?.startsWith("-"))
    throw Error(
      "Usage: node examples/v2/summary-evaluation-demo.mjs [new-bundle-directory]"
    );
  const { manifest, options } = summaryEvaluationExample();
  const result = await evaluateAssessmentSummaryEvaluation(manifest, options);
  if (process.argv[2]) {
    if (!result.receipt) throw Error("No receipt produced");
    const root = resolve(process.argv[2]);
    mkdirSync(root);
    mkdirSync(join(root, "dependencies"));
    writeFileSync(
      join(root, "receipt.json"),
      JSON.stringify(result.receipt, null, 2) + "\n",
      { flag: "wx" }
    );
    writeFileSync(join(root, "history.json"), options.historyBytes, {
      flag: "wx",
    });
    for (const [ref, bytes] of options.dependencyFiles)
      writeFileSync(join(root, "dependencies", ref), bytes, { flag: "wx" });
    console.log(
      JSON.stringify({
        directory: root,
        synthetic: true,
        summarySuccess: result.success,
      })
    );
  } else console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}
