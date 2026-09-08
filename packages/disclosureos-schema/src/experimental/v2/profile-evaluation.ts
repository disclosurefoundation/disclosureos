import { z } from "zod";
import {
  evaluateReleasedDocuments,
  RELEASED_DOCUMENT_PROFILE,
} from "./released-documents";
import type { ReleasedDocumentResult } from "./released-documents";
import {
  evaluateHistoricalTestimony,
  HISTORICAL_TESTIMONY_PROFILE,
} from "./historical-testimony";
import type { HistoricalTestimonyResult } from "./historical-testimony";
import {
  evaluatePhysicalSamples,
  PHYSICAL_SAMPLE_PROFILE,
} from "./physical-samples";
import type { PhysicalSampleResult } from "./physical-samples";
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
export const PROFILE_EVALUATION_SCHEMA_ID =
  "urn:disclosureos:experimental:profile-evaluation:0.1.0";
export const PROFILE_EVALUATION_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:profile-evaluation",
  version: "0.1.0",
  scope: "pinned_inputs_and_computed_provenance_profile",
} as const);
export const ProfileEvaluationSchema = z.strictObject({
  kind: z.literal("profile_evaluation"),
  schemaVersion: z.literal("0.1.0"),
  id,
  workflow: z.enum([
    "released-documents:0.1.0",
    "historical-testimony:0.1.0",
    "physical-samples:0.1.0",
  ]),
  history: pin,
  selection: pin,
  assets: z.array(
    z.strictObject({
      ref: z.string().regex(/^source:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
      fileRef: id,
      ...pin.shape,
    })
  ),
  dependencies: z.strictObject({
    vocabularies: z.array(dependency).min(1),
    implementation: dependency,
    environment: dependency,
  }),
});
export type ProfileEvaluation = z.infer<typeof ProfileEvaluationSchema>;
export function profileEvaluationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ProfileEvaluationSchema, {
      target: "draft-2020-12",
    }),
    $id: PROFILE_EVALUATION_SCHEMA_ID,
  };
}
export interface ProfileEvaluationOptions {
  historyBytes?: Uint8Array;
  selectionBytes?: Uint8Array;
  assetFiles?: ReadonlyMap<string, Uint8Array>;
  dependencyFiles?: ReadonlyMap<string, Uint8Array>;
}
type Status = "passed" | "failed" | "not_checked";
export interface ProfileEvaluationReceipt {
  format: "disclosureos-profile-evaluation-receipt:0.1.0";
  serialization: "sorted-json-utf8:0.1.0";
  request: { sha256: string; byteLength: number };
  output: { sha256: string; byteLength: number };
  requestJson: string;
  outputJson: string;
}
export interface ProfileEvaluationResult {
  success: boolean;
  policy: typeof PROFILE_EVALUATION_POLICY;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    profile: Status;
    receipt: Status;
  };
  issues: { code: string; pointer: string; message: string }[];
  files: {
    ref: string;
    status: Status;
    expectedSha256: string;
    expectedByteLength: number;
    actualSha256?: string;
    actualByteLength?: number;
  }[];
  profile:
    | ReleasedDocumentResult
    | HistoricalTestimonyResult
    | PhysicalSampleResult
    | null;
  receipt: ProfileEvaluationReceipt | null;
  unselectedArtifactIntegrity: "not_checked";
  vocabularyMembership: "not_checked";
  scientificEligibility: "not_checked";
  statisticalIndependence: "not_checked";
  implementationExecution: "not_attested";
  environmentExecution: "not_attested";
}
function serialize(value: unknown): string {
  if (Array.isArray(value))
    return (
      "[" +
      value.map((v) => serialize(v === undefined ? null : v)).join(",") +
      "]"
    );
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(v)
        .filter((k) => v[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + serialize(v[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}
async function digest(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
/** Runs only a fixed built-in provenance profile over pinned local inputs. Supplied dependencies are never executed. */
export async function evaluateProfileEvaluation(
  input: unknown,
  options: ProfileEvaluationOptions = {}
): Promise<ProfileEvaluationResult> {
  const parsed = ProfileEvaluationSchema.safeParse(input);
  const result: ProfileEvaluationResult = {
    success: false,
    policy: PROFILE_EVALUATION_POLICY,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
      profile: "not_checked",
      receipt: "not_checked",
    },
    issues: [],
    files: [],
    profile: null,
    receipt: null,
    unselectedArtifactIntegrity: "not_checked",
    vocabularyMembership: "not_checked",
    scientificEligibility: "not_checked",
    statisticalIndependence: "not_checked",
    implementationExecution: "not_attested",
    environmentExecution: "not_attested",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  if (!parsed.success) {
    result.checks.structural = "failed";
    for (const i of parsed.error.issues)
      issue(
        "PROFILE_EVALUATION.STRUCTURE",
        "/" +
          i.path
            .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
            .join("/"),
        i.message
      );
    return result;
  }
  const manifest = parsed.data;
  const dependencies = [
    ...manifest.dependencies.vocabularies.map((value, i) => ({
      value,
      pointer: `/dependencies/vocabularies/${i}`,
    })),
    {
      value: manifest.dependencies.implementation,
      pointer: "/dependencies/implementation",
    },
    {
      value: manifest.dependencies.environment,
      pointer: "/dependencies/environment",
    },
  ];
  const refs = new Set<string>(),
    vocabularies = new Set<string>();
  for (const d of dependencies) {
    if (refs.has(d.value.ref))
      issue(
        "PROFILE_EVALUATION.DUPLICATE",
        d.pointer + "/ref",
        "Dependency references must be unique"
      );
    refs.add(d.value.ref);
  }
  for (const [i, v] of manifest.dependencies.vocabularies.entries()) {
    if (vocabularies.has(v.id))
      issue(
        "PROFILE_EVALUATION.VOCABULARY",
        `/dependencies/vocabularies/${i}/id`,
        "Each vocabulary identity requires one declared version"
      );
    vocabularies.add(v.id);
  }
  const assetRefs = new Set<string>(),
    fileRefs = new Set<string>();
  for (const [i, a] of manifest.assets.entries()) {
    if (assetRefs.has(a.ref) || fileRefs.has(a.fileRef))
      issue(
        "PROFILE_EVALUATION.ASSET_DUPLICATE",
        `/assets/${i}`,
        "Asset source and file references must each be unique"
      );
    assetRefs.add(a.ref);
    fileRefs.add(a.fileRef);
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  const historyBytes = options.historyBytes
    ? Uint8Array.from(options.historyBytes)
    : undefined;
  const selectionBytes = options.selectionBytes
    ? Uint8Array.from(options.selectionBytes)
    : undefined;
  const assetFiles = new Map(
    [...(options.assetFiles ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const files = new Map(
    [...(options.dependencyFiles ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const inputs = [
    {
      ref: "history",
      pin: manifest.history,
      bytes: historyBytes,
      pointer: "/history",
    },
    {
      ref: "selection",
      pin: manifest.selection,
      bytes: selectionBytes,
      pointer: "/selection",
    },
    ...manifest.assets.map((a, i) => ({
      ref: `asset:${a.fileRef}`,
      pin: a,
      bytes: assetFiles.get(a.fileRef),
      pointer: `/assets/${i}`,
    })),
    ...dependencies.map((d) => ({
      ref: `dependency:${d.value.ref}`,
      pin: d.value,
      bytes: files.get(d.value.ref),
      pointer: d.pointer,
    })),
  ];
  for (const input of inputs) {
    const check: ProfileEvaluationResult["files"][number] = {
      ref: input.ref,
      status: "not_checked",
      expectedSha256: input.pin.sha256,
      expectedByteLength: input.pin.byteLength,
    };
    result.files.push(check);
    if (!input.bytes) {
      issue(
        "PROFILE_EVALUATION.MISSING_FILE",
        input.pointer,
        "Required local bytes are unavailable"
      );
      continue;
    }
    check.actualByteLength = input.bytes.byteLength;
    if (input.bytes.byteLength !== input.pin.byteLength) {
      check.status = "failed";
      issue(
        "PROFILE_EVALUATION.SIZE",
        input.pointer,
        "Byte length differs from the declared input"
      );
      continue;
    }
    try {
      check.actualSha256 = await digest(input.bytes);
      check.status =
        check.actualSha256 === input.pin.sha256 ? "passed" : "failed";
      if (check.status === "failed")
        issue(
          "PROFILE_EVALUATION.DIGEST",
          input.pointer,
          "SHA-256 differs from the declared input"
        );
    } catch {
      issue(
        "PROFILE_EVALUATION.HASH_UNAVAILABLE",
        input.pointer,
        "SHA-256 unavailable; byte identity remains unchecked"
      );
    }
  }
  if (result.files.some((f) => f.status !== "passed")) {
    if (result.files.some((f) => f.status === "failed"))
      result.checks.external = "failed";
    return result;
  }
  result.checks.external = "passed";
  const documents: Record<string, unknown> = {};
  for (const [name, bytes] of [
    ["history", historyBytes!],
    ["selection", selectionBytes!],
  ] as const) {
    try {
      documents[name] = JSON.parse(
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
      ) as unknown;
    } catch {
      result.checks.semantic = "failed";
      issue(
        "PROFILE_EVALUATION.JSON",
        "/" + name,
        name + " must be valid UTF-8 JSON without a BOM"
      );
      return result;
    }
  }
  const { history, selection } = documents;
  const assets = new Map(
    manifest.assets.map((a) => [a.ref, assetFiles.get(a.fileRef)!])
  );
  result.profile =
    manifest.workflow === "released-documents:0.1.0"
      ? await evaluateReleasedDocuments(history, selection, { assets })
      : manifest.workflow === "historical-testimony:0.1.0"
      ? await evaluateHistoricalTestimony(history, selection, { assets })
      : await evaluatePhysicalSamples(history, selection, { assets });
  result.checks.profile = result.profile.success
    ? "passed"
    : Object.values(result.profile.checks).includes("failed")
    ? "failed"
    : "not_checked";
  result.issues.push(
    ...result.profile.issues.map((i) => ({
      code: i.code,
      pointer: "/profile" + i.pointer,
      message: i.message,
    }))
  );
  const requestJson = serialize({
    manifest,
    rules: {
      evaluation: PROFILE_EVALUATION_POLICY,
      profile:
        manifest.workflow === "released-documents:0.1.0"
          ? RELEASED_DOCUMENT_PROFILE
          : manifest.workflow === "historical-testimony:0.1.0"
          ? HISTORICAL_TESTIMONY_PROFILE
          : PHYSICAL_SAMPLE_PROFILE,
    },
    limits: {
      unselectedArtifactIntegrity: result.unselectedArtifactIntegrity,
      vocabularyMembership: result.vocabularyMembership,
      scientificEligibility: result.scientificEligibility,
      statisticalIndependence: result.statisticalIndependence,
      implementationExecution: result.implementationExecution,
      environmentExecution: result.environmentExecution,
    },
  });
  const outputJson = serialize({ profile: result.profile });
  try {
    const requestBytes = new TextEncoder().encode(requestJson),
      outputBytes = new TextEncoder().encode(outputJson);
    result.receipt = {
      format: "disclosureos-profile-evaluation-receipt:0.1.0",
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
      "PROFILE_EVALUATION.HASH_UNAVAILABLE",
      "/receipt",
      "Receipt hashing unavailable; no receipt was produced"
    );
  }
  result.success =
    result.checks.profile === "passed" && result.checks.receipt === "passed";
  return result;
}
