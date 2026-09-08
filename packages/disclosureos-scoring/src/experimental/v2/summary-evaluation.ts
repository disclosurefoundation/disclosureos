import { z } from "zod";
import {
  summarizeClaimHistory,
  ASSESSMENT_SUMMARY_POLICY,
} from "./assessment-summary";
import type { AssessmentSummaryResult } from "./assessment-summary";
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
export const ASSESSMENT_SUMMARY_EVALUATION_SCHEMA_ID =
  "urn:disclosureos:experimental:assessment-summary-evaluation:0.1.0";
export const ASSESSMENT_SUMMARY_EVALUATION_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:assessment-summary-evaluation",
  version: "0.1.0",
  scope: "pinned_claim_history_and_computed_declarations",
} as const);
export const AssessmentSummaryEvaluationSchema = z.strictObject({
  kind: z.literal("assessment_summary_evaluation"),
  schemaVersion: z.literal("0.1.0"),
  id,
  workflow: z.literal("assessment-summary:0.1.0"),
  history: pin,
  dependencies: z.strictObject({
    vocabularies: z.array(dependency).min(1),
    implementation: dependency,
    environment: dependency,
  }),
});
export type AssessmentSummaryEvaluation = z.infer<
  typeof AssessmentSummaryEvaluationSchema
>;
export function assessmentSummaryEvaluationJsonSchema(): Record<
  string,
  unknown
> {
  return {
    ...z.toJSONSchema(AssessmentSummaryEvaluationSchema, {
      target: "draft-2020-12",
    }),
    $id: ASSESSMENT_SUMMARY_EVALUATION_SCHEMA_ID,
  };
}
export interface AssessmentSummaryEvaluationOptions {
  historyBytes?: Uint8Array;
  dependencyFiles?: ReadonlyMap<string, Uint8Array>;
}
type Status = "passed" | "failed" | "not_checked";
export interface AssessmentSummaryReceipt {
  format: "disclosureos-assessment-summary-receipt:0.1.0";
  serialization: "sorted-json-utf8:0.1.0";
  request: { sha256: string; byteLength: number };
  output: { sha256: string; byteLength: number };
  requestJson: string;
  outputJson: string;
}
export interface AssessmentSummaryEvaluationResult {
  success: boolean;
  policy: typeof ASSESSMENT_SUMMARY_EVALUATION_POLICY;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    summary: Status;
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
  summary: AssessmentSummaryResult | null;
  receipt: AssessmentSummaryReceipt | null;
  sourceArtifactIntegrity: "not_checked";
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
/** Pins the summary's declared history input. Referenced source/product bytes are not verified or fetched. */
export async function evaluateAssessmentSummaryEvaluation(
  input: unknown,
  options: AssessmentSummaryEvaluationOptions = {}
): Promise<AssessmentSummaryEvaluationResult> {
  const parsed = AssessmentSummaryEvaluationSchema.safeParse(input);
  const result: AssessmentSummaryEvaluationResult = {
    success: false,
    policy: ASSESSMENT_SUMMARY_EVALUATION_POLICY,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
      summary: "not_checked",
      receipt: "not_checked",
    },
    issues: [],
    files: [],
    summary: null,
    receipt: null,
    sourceArtifactIntegrity: "not_checked",
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
        "SUMMARY_EVALUATION.STRUCTURE",
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
        "SUMMARY_EVALUATION.DUPLICATE",
        d.pointer + "/ref",
        "Dependency references must be unique"
      );
    refs.add(d.value.ref);
  }
  for (const [i, v] of manifest.dependencies.vocabularies.entries()) {
    if (vocabularies.has(v.id))
      issue(
        "SUMMARY_EVALUATION.VOCABULARY",
        `/dependencies/vocabularies/${i}/id`,
        "Each vocabulary identity requires one declared version"
      );
    vocabularies.add(v.id);
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  const historyBytes = options.historyBytes
    ? Uint8Array.from(options.historyBytes)
    : undefined;
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
    ...dependencies.map((d) => ({
      ref: `dependency:${d.value.ref}`,
      pin: d.value,
      bytes: files.get(d.value.ref),
      pointer: d.pointer,
    })),
  ];
  for (const input of inputs) {
    const check: AssessmentSummaryEvaluationResult["files"][number] = {
      ref: input.ref,
      status: "not_checked",
      expectedSha256: input.pin.sha256,
      expectedByteLength: input.pin.byteLength,
    };
    result.files.push(check);
    if (!input.bytes) {
      issue(
        "SUMMARY_EVALUATION.MISSING_FILE",
        input.pointer,
        "Required local bytes are unavailable"
      );
      continue;
    }
    check.actualByteLength = input.bytes.byteLength;
    if (input.bytes.byteLength !== input.pin.byteLength) {
      check.status = "failed";
      issue(
        "SUMMARY_EVALUATION.SIZE",
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
          "SUMMARY_EVALUATION.DIGEST",
          input.pointer,
          "SHA-256 differs from the declared input"
        );
    } catch {
      issue(
        "SUMMARY_EVALUATION.HASH_UNAVAILABLE",
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
  let history: unknown;
  try {
    history = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        historyBytes!
      )
    ) as unknown;
  } catch {
    result.checks.semantic = "failed";
    issue(
      "SUMMARY_EVALUATION.JSON",
      "/history",
      "History must be valid UTF-8 JSON without a BOM"
    );
    return result;
  }
  result.summary = summarizeClaimHistory(history);
  result.checks.summary = result.summary.success
    ? "passed"
    : Object.values(result.summary.checks).includes("failed")
    ? "failed"
    : "not_checked";
  result.issues.push(
    ...result.summary.issues.map((i) => ({
      code: i.code,
      pointer: "/summary" + i.pointer,
      message: i.message,
    }))
  );
  const requestJson = serialize({
    manifest,
    rules: {
      evaluation: ASSESSMENT_SUMMARY_EVALUATION_POLICY,
      summary: ASSESSMENT_SUMMARY_POLICY,
      contract: result.summary.contract,
    },
    limits: {
      sourceArtifactIntegrity: result.sourceArtifactIntegrity,
      vocabularyMembership: result.vocabularyMembership,
      scientificEligibility: result.scientificEligibility,
      statisticalIndependence: result.statisticalIndependence,
      implementationExecution: result.implementationExecution,
      environmentExecution: result.environmentExecution,
    },
  });
  const outputJson = serialize({ summary: result.summary });
  try {
    const requestBytes = new TextEncoder().encode(requestJson),
      outputBytes = new TextEncoder().encode(outputJson);
    result.receipt = {
      format: "disclosureos-assessment-summary-receipt:0.1.0",
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
      "SUMMARY_EVALUATION.HASH_UNAVAILABLE",
      "/receipt",
      "Receipt hashing unavailable; no receipt was produced"
    );
  }
  result.success =
    result.checks.summary === "passed" && result.checks.receipt === "passed";
  return result;
}
