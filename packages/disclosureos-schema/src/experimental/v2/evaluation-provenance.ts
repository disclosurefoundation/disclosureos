import { z } from "zod";
import {
  ReproductionPacketSchema,
  evaluateReproductionPacket,
  REPRODUCTION_PACKET_PROFILE,
} from "./reproduction-packet";
import type {
  ReproductionPacketResult,
  ReproductionFileCheck,
} from "./reproduction-packet";
import {
  evaluateInstrumentResearchCompletion,
  INSTRUMENT_RESEARCH_COMPLETION_POLICY,
} from "./research-completion";
import type { InstrumentResearchCompletionResult } from "./research-completion";
import { INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE } from "./research-prerequisites";
import { ASSESSMENT_DOCUMENTATION_PROFILE } from "./assessment-documentation";
import { ACQUISITION_BINDINGS_PROFILE } from "./acquisition-bindings";
import { MEASUREMENT_BINDINGS_PROFILE } from "./measurement-bindings";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const pin = z.strictObject({
  sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  byteLength: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
const dependency = z.strictObject({
  ref: id,
  id: text,
  version: text,
  ...pin.shape,
});
export const RESEARCH_EVALUATION_SCHEMA_ID =
  "urn:disclosureos:experimental:research-evaluation:0.1.0";
export const RESEARCH_EVALUATION_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:research-evaluation",
  version: "0.1.0",
  scope: "local_byte_identity_and_computed_prerequisites",
} as const);
export const ResearchEvaluationSchema = z.strictObject({
  kind: z.literal("research_evaluation"),
  schemaVersion: z.literal("0.1.0"),
  id,
  workflow: z.literal("research-completion:0.1.0"),
  packet: pin,
  dependencies: z.strictObject({
    vocabularies: z.array(dependency).min(1),
    implementation: dependency,
    environment: dependency,
  }),
});
export type ResearchEvaluation = z.infer<typeof ResearchEvaluationSchema>;
export function researchEvaluationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ResearchEvaluationSchema, { target: "draft-2020-12" }),
    $id: RESEARCH_EVALUATION_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface ResearchEvaluationOptions {
  packetBytes?: Uint8Array;
  files?: ReadonlyMap<string, Uint8Array>;
  dependencyFiles?: ReadonlyMap<string, Uint8Array>;
}
export interface ResearchEvaluationOutput {
  packet: ReproductionPacketResult;
  completion: InstrumentResearchCompletionResult;
}
export interface ResearchEvaluationReceipt {
  format: "disclosureos-research-evaluation-receipt:0.1.0";
  serialization: "sorted-json-utf8:0.1.0";
  request: { sha256: string; byteLength: number };
  output: { sha256: string; byteLength: number };
  /** These exact strings are hashed as UTF-8; no trailing newline is added. */
  requestJson: string;
  outputJson: string;
}
export interface ResearchEvaluationResult {
  success: boolean;
  policy: typeof RESEARCH_EVALUATION_POLICY;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    evaluation: Status;
    receipt: Status;
  };
  issues: { code: string; pointer: string; message: string }[];
  files: ReproductionFileCheck[];
  packetValidation: ReproductionPacketResult | null;
  output: ResearchEvaluationOutput | null;
  receipt: ResearchEvaluationReceipt | null;
  implementationExecution: "not_attested";
  environmentExecution: "not_attested";
  vocabularyMembership: "not_checked";
  scientificEligibility: "not_checked";
}
// JSON values only: sorted object keys, preserved array order, standard JSON number/string encoding.
function serialize(value: unknown): string {
  if (Array.isArray(value))
    return (
      "[" +
      value.map((v) => serialize(v === undefined ? null : v)).join(",") +
      "]"
    );
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .filter((k) => record[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + serialize(record[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}
async function digest(bytes: Uint8Array): Promise<string> {
  const buffer = Uint8Array.from(bytes);
  return [
    ...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", buffer)),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
function decode(bytes: Uint8Array): unknown {
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  ) as unknown;
}
/** Executes only the fixed built-in workflow. Supplied artifacts are pinned, never fetched or executed. */
export async function evaluateResearchEvaluation(
  input: unknown,
  options: ResearchEvaluationOptions = {}
): Promise<ResearchEvaluationResult> {
  const parsed = ResearchEvaluationSchema.safeParse(input);
  const result: ResearchEvaluationResult = {
    success: false,
    policy: RESEARCH_EVALUATION_POLICY,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
      evaluation: "not_checked",
      receipt: "not_checked",
    },
    issues: [],
    files: [],
    packetValidation: null,
    output: null,
    receipt: null,
    implementationExecution: "not_attested",
    environmentExecution: "not_attested",
    vocabularyMembership: "not_checked",
    scientificEligibility: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  if (!parsed.success) {
    result.checks.structural = "failed";
    for (const i of parsed.error.issues)
      issue(
        "EVALUATION.STRUCTURE",
        "/" +
          i.path
            .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
            .join("/"),
        i.message
      );
    return result;
  }
  const request = parsed.data;
  const dependencies = [
    ...request.dependencies.vocabularies,
    request.dependencies.implementation,
    request.dependencies.environment,
  ];
  const refs = new Set<string>(),
    vocabularies = new Set<string>();
  for (const [i, d] of dependencies.entries()) {
    if (refs.has(d.ref))
      issue(
        "EVALUATION.DUPLICATE",
        "/dependencies",
        `Dependency reference ${d.ref} is duplicated.`
      );
    refs.add(d.ref);
    if (i < request.dependencies.vocabularies.length) {
      if (vocabularies.has(d.id))
        issue(
          "EVALUATION.VOCABULARY",
          "/dependencies/vocabularies",
          "Each vocabulary identity must have exactly one declared version."
        );
      vocabularies.add(d.id);
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  // Copy every document/file namespace before the first asynchronous hash.
  const packetBytes = options.packetBytes
    ? Uint8Array.from(options.packetBytes)
    : undefined;
  const files = new Map(
    [...(options.files ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const dependencyFiles = new Map(
    [...(options.dependencyFiles ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const checks = [
    {
      id: "packet",
      pin: request.packet,
      bytes: packetBytes,
      pointer: "/packet",
    },
    ...dependencies.map((d, i) => ({
      id: `dependency:${d.ref}`,
      pin: d,
      bytes: dependencyFiles.get(d.ref),
      pointer:
        i < request.dependencies.vocabularies.length
          ? `/dependencies/vocabularies/${i}`
          : i === request.dependencies.vocabularies.length
          ? "/dependencies/implementation"
          : "/dependencies/environment",
    })),
  ];
  for (const item of checks) {
    const check: ReproductionFileCheck = {
      id: item.id,
      status: "not_checked",
      expectedSha256: item.pin.sha256,
      expectedByteLength: item.pin.byteLength,
    };
    result.files.push(check);
    if (!item.bytes) {
      issue(
        "EVALUATION.MISSING_FILE",
        item.pointer,
        "Required local bytes are unavailable."
      );
      continue;
    }
    check.actualByteLength = item.bytes.byteLength;
    if (item.bytes.byteLength !== item.pin.byteLength) {
      check.status = "failed";
      issue(
        "EVALUATION.SIZE",
        item.pointer,
        "Bytes differ from the declared length."
      );
      continue;
    }
    try {
      check.actualSha256 = await digest(item.bytes);
      check.status =
        check.actualSha256 === item.pin.sha256 ? "passed" : "failed";
      if (check.status === "failed")
        issue(
          "EVALUATION.DIGEST",
          item.pointer,
          "Bytes differ from the declared SHA-256."
        );
    } catch {
      issue(
        "EVALUATION.HASH_UNAVAILABLE",
        item.pointer,
        "SHA-256 unavailable; byte identity remains unchecked."
      );
    }
  }
  if (result.files.some((c) => c.status !== "passed")) {
    if (result.files.some((c) => c.status === "failed"))
      result.checks.external = "failed";
    return result;
  }
  let packetInput: unknown;
  try {
    packetInput = decode(packetBytes!);
  } catch {
    result.checks.semantic = "failed";
    issue(
      "EVALUATION.JSON",
      "/packet",
      "Packet must be valid UTF-8 JSON without a BOM."
    );
    return result;
  }
  const packet = ReproductionPacketSchema.safeParse(packetInput);
  const packetResult = await evaluateReproductionPacket(packetInput, { files });
  result.packetValidation = packetResult;
  // Packet diagnostics are preserved even when no computed completion can be produced.
  if (!packet.success || packetResult.research === null) {
    result.checks.semantic =
      packetResult.checks.structural === "failed" ||
      packetResult.checks.semantic === "failed"
        ? "failed"
        : result.checks.semantic;
    result.checks.external = packetResult.files.some(
      (c) => c.status === "failed"
    )
      ? "failed"
      : packet.success &&
        packetResult.files.length === packet.data.files.length &&
        packetResult.files.every((c) => c.status === "passed")
      ? "passed"
      : "not_checked";
    result.issues.push(
      ...packetResult.issues.map((i) => ({
        ...i,
        pointer: "/packet" + i.pointer,
      }))
    );
    // Expose inner file failures so callers can distinguish missing bytes from invalid documents.
    result.files.push(
      ...packetResult.files.map((f) => ({ ...f, id: `packet-file:${f.id}` }))
    );
    return result;
  }
  result.files.push(
    ...packetResult.files.map((f) => ({ ...f, id: `packet-file:${f.id}` }))
  );
  result.checks.external = "passed";
  const documents = Object.fromEntries(
    Object.entries(packet.data.documents).map(([name, ref]) => [
      name,
      decode(files.get(ref)!),
    ])
  );
  const maps = Object.fromEntries(
    Object.entries(packet.data.assets).map(([ns, entries]) => [
      ns,
      new Map(entries.map((e) => [e.ref, files.get(e.fileRef)!])),
    ])
  );
  const completion = await evaluateInstrumentResearchCompletion(
    documents.history,
    documents.context,
    documents.acquisitionBindings,
    documents.measurementBindings,
    documents.review,
    {
      observationAssets: maps.observation!,
      contextAssets: maps.context!,
      reviewAssets: maps.review!,
    }
  );
  result.output = { packet: packetResult, completion };
  result.checks.evaluation =
    packetResult.success && completion.validation.success
      ? "passed"
      : Object.values(packetResult.checks).includes("failed") ||
        Object.values(completion.validation.checks).includes("failed")
      ? "failed"
      : "not_checked";
  result.issues.push(
    ...packetResult.issues.map((i) => ({
      ...i,
      pointer: "/output/packet" + i.pointer,
    }))
  );
  // Rule identities are generated from this evaluator, never accepted as caller-supplied success flags or callbacks.
  const requestJson = serialize({
    manifest: request,
    rules: {
      evaluation: RESEARCH_EVALUATION_POLICY,
      packet: REPRODUCTION_PACKET_PROFILE,
      research: INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE,
      completion: INSTRUMENT_RESEARCH_COMPLETION_POLICY,
      documentation: ASSESSMENT_DOCUMENTATION_PROFILE,
      acquisition: ACQUISITION_BINDINGS_PROFILE,
      measurements: MEASUREMENT_BINDINGS_PROFILE,
    },
    limits: {
      implementationExecution: result.implementationExecution,
      environmentExecution: result.environmentExecution,
      vocabularyMembership: result.vocabularyMembership,
      scientificEligibility: result.scientificEligibility,
    },
  });
  const outputJson = serialize(result.output),
    encoder = new TextEncoder();
  try {
    const requestBytes = encoder.encode(requestJson),
      outputBytes = encoder.encode(outputJson);
    result.receipt = {
      format: "disclosureos-research-evaluation-receipt:0.1.0",
      serialization: "sorted-json-utf8:0.1.0",
      request: {
        sha256: await digest(requestBytes),
        byteLength: requestBytes.byteLength,
      },
      output: {
        sha256: await digest(outputBytes),
        byteLength: outputBytes.byteLength,
      },
      requestJson,
      outputJson,
    };
    result.checks.receipt = "passed";
  } catch {
    issue(
      "EVALUATION.HASH_UNAVAILABLE",
      "/receipt",
      "Output hashing unavailable; no receipt was produced."
    );
  }
  result.success =
    result.checks.evaluation === "passed" && result.checks.receipt === "passed";
  return result;
}
