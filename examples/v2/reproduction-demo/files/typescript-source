import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  evaluateReproductionPacket,
  ReproductionPacketSchema,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { parseExperimentalClaimHistory } from "../packages/disclosureos-records/dist/experimental/v2/index.js";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected object");
  return value as Record<string, unknown>;
}
const folder = new URL("../examples/v2/reproduction-demo/", import.meta.url);
const packetBytes = readFileSync(new URL("packet.json", folder));
const packet = ReproductionPacketSchema.parse(JSON.parse(packetBytes.toString('utf8')));

const files = new Map(
  packet.files.map((file) => [
    file.id,
    new Uint8Array(readFileSync(new URL(`files/${file.id}`, folder))),
  ])
);
const verified = await evaluateReproductionPacket(packet, { files });
if (!verified.success) throw Error(JSON.stringify(verified.issues));
const implementation = packet.method.implementations.find(
  (v) => v.id === "typescript"
);
if (
  !implementation ||
  packet.method.id !== "synthetic-radial-velocity-mean" ||
  packet.method.version !== "1"
)
  throw Error("Unsupported fixed synthetic method");
if (
  packet.assets.context.find((a) => a.ref === "product:captured-raw")
    ?.fileRef !== packet.method.inputRef ||
  packet.assets.observation.find((a) => a.ref === "product:summary")
    ?.fileRef !== packet.method.expectedOutputRef
)
  throw Error("Method inputs differ from the synthetic packet mapping");
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
if (
  hash(readFileSync(new URL(import.meta.url))) !==
  hash(files.get(implementation.artifactRef)!)
)
  throw Error("Running source does not match pinned implementation");
const env = object(
  JSON.parse(
    new TextDecoder().decode(files.get(implementation.environmentRef)!)
  )
);
if (
  env.runtime !== "node" ||
  env.major !== Number(process.versions.node.split(".")[0]) ||
  env.arithmetic !== "binary64-ordered-sum"
)
  throw Error("Runtime differs from declared environment");
const input: unknown = JSON.parse(
  new TextDecoder("utf-8", { fatal: true }).decode(
    files.get(packet.method.inputRef)!
  )
);
if (
  !input ||
  typeof input !== "object" ||
  !("samples" in input) ||
  !Array.isArray(input.samples) ||
  !input.samples.length ||
  !input.samples.every(
    (v: unknown) => typeof v === "number" && Number.isFinite(v)
  )
)
  throw Error("Expected nonempty finite samples");
let sum = 0;
for (const sample of input.samples as number[]) sum += sample;
const value = sum / input.samples.length;
const expected = object(
  JSON.parse(
    new TextDecoder().decode(files.get(packet.method.expectedOutputRef)!)
  )
);
if (
  packet.method.unit !== "m/s" ||
  typeof expected.velocity !== "number" ||
  !Number.isFinite(expected.velocity) ||
  !Number.isFinite(value) ||
  Math.abs(value - expected.velocity) > packet.method.absoluteTolerance
)
  throw Error("Reproduction differs from expected output");
const history = parseExperimentalClaimHistory(
  JSON.parse(new TextDecoder().decode(files.get(packet.documents.history)!))
);
if (!history.success) throw Error("Invalid history");
const measurement = history.data.observation.measurements.find(
  (m) => `measurement:${m.id}` === packet.method.measurementRef
);
if (
  !measurement ||
  measurement.value.unit !== packet.method.unit ||
  Math.abs(value - measurement.value.value) > packet.method.absoluteTolerance
)
  throw Error("Reproduction differs from mapped measurement");
console.log(
  JSON.stringify({
    packetId: packet.id,
    packetSha256: hash(packetBytes),
    implementationSha256: hash(files.get(implementation.artifactRef)!),
    environmentSha256: hash(files.get(implementation.environmentRef)!),
    method: packet.method.id,
    version: packet.method.version,
    value,
    unit: packet.method.unit,
    absoluteTolerance: packet.method.absoluteTolerance,
    implementation: "typescript",
    runtime: process.version,
    fileIdentityVerified: true,
    researchPrerequisites: verified.success,
    scientificEligibility: "not_checked",
  })
);
