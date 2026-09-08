import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateProfileEvaluation } from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
export const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
export function profileEvaluationExample(
  workflow = "released-documents:0.1.0"
) {
  const fixtures = {
    "released-documents:0.1.0": ["released-document-demo", "document.txt"],
    "historical-testimony:0.1.0": ["historical-testimony-demo", "account.txt"],
    "physical-samples:0.1.0": ["physical-sample-demo", "custody.txt"],
  };
  if (!Object.hasOwn(fixtures, workflow))
    throw Error("Unsupported profile workflow");
  const [folder, assetName] = fixtures[workflow];
  const read = (path) =>
    new Uint8Array(readFileSync(new URL(path, import.meta.url)));
  const historyBytes = read(`./${folder}/history.json`),
    selectionBytes = read(`./${folder}/selection.json`),
    assetBytes = read(`./${folder}/${assetName}`),
    vocabulary = read("./profile-evaluation-vocabulary.json"),
    implementation = read(
      "../../packages/disclosureos-schema/dist/experimental/v2/index.js"
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
    kind: "profile_evaluation",
    schemaVersion: "0.1.0",
    id: "synthetic-profile-evaluation",
    workflow,
    history: pin(historyBytes),
    selection: pin(selectionBytes),
    assets: [{ ref: "source:report", fileRef: "record", ...pin(assetBytes) }],
    dependencies: {
      vocabularies: [
        {
          ref: "vocabulary",
          id: "urn:disclosureos:synthetic:vocabulary:provenance-example",
          version: "0.1.0",
          ...pin(vocabulary),
        },
      ],
      implementation: {
        ref: "implementation",
        id: "@disclosureos/schema/experimental/v2",
        version: "profile-evaluation-0.1.0",
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
  return {
    manifest,
    options: {
      historyBytes,
      selectionBytes,
      assetFiles: new Map([["record", assetBytes]]),
      dependencyFiles,
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (
    process.argv.length !== 4 ||
    process.argv[2]?.startsWith("-") ||
    process.argv[3]?.startsWith("-")
  )
    throw Error(
      "Usage: node examples/v2/profile-evaluation-demo.mjs <workflow> <new-bundle-directory>"
    );
  const { manifest, options } = profileEvaluationExample(process.argv[2]);
  const result = await evaluateProfileEvaluation(manifest, options);
  if (process.argv[3]) {
    if (!result.receipt) throw Error("No receipt produced");
    const root = resolve(process.argv[3]);
    mkdirSync(root);
    writeFileSync(
      join(root, "evaluation.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx" }
    );
    mkdirSync(join(root, "dependencies"));
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "selection.json"), options.selectionBytes, {
      flag: "wx",
    });
    for (const [ref, bytes] of options.assetFiles)
      writeFileSync(join(root, "assets", ref), bytes, { flag: "wx" });
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
        profileSuccess: result.success,
      })
    );
  } else console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}
