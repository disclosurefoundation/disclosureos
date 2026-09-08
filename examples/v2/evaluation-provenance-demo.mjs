import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { evaluateResearchEvaluation } from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
export const pin = (bytes) => ({
  sha256: createHash("sha256").update(bytes).digest("hex"),
  byteLength: bytes.byteLength,
});
export function researchEvaluationExample() {
  const folder = new URL("./reproduction-demo/", import.meta.url);
  const packetBytes = new Uint8Array(
    readFileSync(new URL("packet.json", folder))
  );
  const packet = JSON.parse(new TextDecoder().decode(packetBytes));
  const files = new Map(
    packet.files.map((f) => [
      f.id,
      new Uint8Array(readFileSync(new URL(`files/${f.id}`, folder))),
    ])
  );
  const vocabulary = new Uint8Array(
    readFileSync(new URL("./evaluation-vocabulary.json", import.meta.url))
  );
  const implementation = new Uint8Array(
    readFileSync(
      new URL(
        "../../packages/disclosureos-schema/dist/experimental/v2/index.js",
        import.meta.url
      )
    )
  );
  const lock = readFileSync(
    new URL("../../pnpm-lock.yaml", import.meta.url),
    "utf8"
  );
  const environment = new TextEncoder().encode(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      lockfile: lock,
    })
  );
  const dependencyFiles = new Map([
    ["synthetic-vocabulary", vocabulary],
    ["schema-implementation", implementation],
    ["local-environment", environment],
  ]);
  const manifest = {
    kind: "research_evaluation",
    schemaVersion: "0.1.0",
    id: "synthetic-research-evaluation",
    workflow: "research-completion:0.1.0",
    packet: pin(packetBytes),
    dependencies: {
      vocabularies: [
        {
          ref: "synthetic-vocabulary",
          id: "urn:disclosureos:synthetic:vocabulary:motion",
          version: "0.1.0",
          ...pin(vocabulary),
        },
      ],
      implementation: {
        ref: "schema-implementation",
        id: "@disclosureos/schema/experimental/v2",
        version: "research-evaluation-0.1.0",
        ...pin(implementation),
      },
      environment: {
        ref: "local-environment",
        id: "urn:disclosureos:local:node-and-lockfile",
        version: "0.1.0",
        ...pin(environment),
      },
    },
  };
  return { manifest, options: { packetBytes, files, dependencyFiles } };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { manifest, options } = researchEvaluationExample();
  const result = await evaluateResearchEvaluation(manifest, options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.success) process.exitCode = 1;
}
