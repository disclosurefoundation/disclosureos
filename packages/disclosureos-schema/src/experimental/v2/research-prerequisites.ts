import { z } from "zod";
import {
  compareUtcInstants,
  parseExperimentalClaimHistory,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import { AcquisitionBindingsSchema } from "./acquisition-bindings-schema";
import {
  MeasurementBindingsSchema,
  evaluateMeasurementBindings,
} from "./measurement-bindings";
import type {
  MeasurementBindingIssue,
  MeasurementBindingResult,
} from "./measurement-bindings";
import { evaluateAssessmentDocumentation } from "./assessment-documentation";
import type { DocumentationResult } from "./assessment-documentation";

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
// This package owns its schemas; only plain data crosses package boundaries.
const artifact = z.strictObject({
  digest: z.strictObject({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  }),
  mediaType: text,
  byteLength: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
const method = z.strictObject({ id: text, version: text, description: text });
const review = z.union([
  z.strictObject({ state: z.literal("unreviewed") }),
  z.strictObject({
    state: z.literal("reviewed"),
    reviewedBy: text,
    reviewedAt: text,
    outcome: z.enum(["accepted", "rejected", "inconclusive"]),
    rationale: text,
    method,
    report: artifact,
  }),
]);
const timingFields = {
  lower: text,
  upper: text,
  timeScale: z.literal("UTC"),
  assumptions: z.array(text).min(1),
  review,
};
const timing = z.union([
  z.strictObject({ kind: z.literal("unknown"), reason: text }),
  z.strictObject({ kind: z.literal("bound"), ...timingFields }),
  z.strictObject({
    kind: z.literal("coverage_interval"),
    ...timingFields,
    coverageProbability: z.number().gt(0).lt(1),
  }),
]);
export const INSTRUMENT_RESEARCH_REVIEW_SCHEMA_ID =
  "urn:disclosureos:experimental:instrument-research-review:0.1.0";
export const INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:instrument-research-prerequisites",
  version: "0.1.0",
  scope: "reviewed_declared_inputs",
} as const);
export const InstrumentResearchReviewSchema = z.strictObject({
  kind: z.literal("instrument_research_review"),
  schemaVersion: z.literal("0.1.0"),
  id,
  historyId: id,
  observationId: id,
  contextId: id,
  acquisitionBindingsId: id,
  measurementBindingsId: id,
  purpose: method,
  measurements: z.array(
    z.strictObject({
      measurementRef: ref("measurement"),
      calibrationRef: ref("calibration"),
      calibrationUse: review,
      timing,
    })
  ),
  extensions: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/),
      z.json()
    )
    .optional(),
});
export type InstrumentResearchReview = z.infer<
  typeof InstrumentResearchReviewSchema
>;
export function instrumentResearchReviewJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(InstrumentResearchReviewSchema, {
      target: "draft-2020-12",
    }),
    $id: INSTRUMENT_RESEARCH_REVIEW_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface InstrumentResearchOptions {
  observationAssets?: ReadonlyMap<string, Uint8Array>;
  contextAssets?: ReadonlyMap<string, Uint8Array>;
  /** Separate namespace: measurement:ID/calibration-use and measurement:ID/timing. */
  reviewAssets?: ReadonlyMap<string, Uint8Array>;
}
export interface ResearchReviewAssetCheck {
  ref: string;
  status: Status;
  expectedSha256: string;
  expectedByteLength: number;
  actualSha256?: string;
  actualByteLength?: number;
}
export interface InstrumentResearchResult {
  success: boolean;
  profile: typeof INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE;
  contract: {
    schemaId: typeof INSTRUMENT_RESEARCH_REVIEW_SCHEMA_ID;
    rulesetVersion: "0.1.0";
  };
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  review: { id: string; purpose: InstrumentResearchReview["purpose"] } | null;
  issues: MeasurementBindingIssue[];
  documentation: DocumentationResult | null;
  measurements: MeasurementBindingResult | null;
  reviewAssets: ResearchReviewAssetCheck[];
  scientificEligibility: "not_checked";
  calibrationAdequacy: "not_checked";
  timingModel: "not_checked";
  reviewerAuthenticity: "not_checked";
}
const pointer = (path: readonly PropertyKey[]) =>
  path
    .map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`)
    .join("");
const snapshot = (assets?: ReadonlyMap<string, Uint8Array>) =>
  new Map(
    [...(assets ?? [])].map(([ref, bytes]) => [ref, Uint8Array.from(bytes)])
  );

/** Assesses documented prerequisites, not scientific validity or reviewer competence. */
export async function evaluateInstrumentResearchPrerequisites(
  historyInput: unknown,
  contextInput: unknown,
  acquisitionBindingsInput: unknown,
  measurementBindingsInput: unknown,
  reviewInput: unknown,
  options: InstrumentResearchOptions = {}
): Promise<InstrumentResearchResult> {
  const h = parseExperimentalClaimHistory(historyInput),
    c = parseAcquisitionContext(contextInput),
    a = AcquisitionBindingsSchema.safeParse(acquisitionBindingsInput),
    m = MeasurementBindingsSchema.safeParse(measurementBindingsInput),
    r = InstrumentResearchReviewSchema.safeParse(reviewInput);
  const result: InstrumentResearchResult = {
    success: false,
    profile: INSTRUMENT_RESEARCH_PREREQUISITES_PROFILE,
    contract: {
      schemaId: INSTRUMENT_RESEARCH_REVIEW_SCHEMA_ID,
      rulesetVersion: "0.1.0",
    },
    checks: {
      structural: "passed",
      semantic: "not_checked",
      profile: "not_checked",
      external: "not_checked",
    },
    review: r.success ? { id: r.data.id, purpose: r.data.purpose } : null,
    issues: [],
    documentation: null,
    measurements: null,
    reviewAssets: [],
    scientificEligibility: "not_checked",
    calibrationAdequacy: "not_checked",
    timingModel: "not_checked",
    reviewerAuthenticity: "not_checked",
  };
  const issue = (
    code: string,
    path: string,
    message: string,
    stage: MeasurementBindingIssue["stage"] = "profile",
    severity: "error" | "warning" = "error"
  ) => result.issues.push({ code, stage, severity, pointer: path, message });
  for (const [parsed, prefix] of [
    [h, "/history"],
    [c, "/context"],
  ] as const)
    result.issues.push(
      ...parsed.issues.map((i) => ({ ...i, pointer: prefix + i.pointer }))
    );
  for (const [parsed, prefix] of [
    [a, "/bindings"],
    [m, "/measurements"],
    [r, "/review"],
  ] as const)
    if (!parsed.success)
      for (const i of parsed.error.issues)
        issue(
          "STRUCT.VALUE",
          prefix + pointer(i.path),
          i.message,
          "structural"
        );
  if (
    h.checks.structural === "failed" ||
    c.checks.structural === "failed" ||
    !a.success ||
    !m.success ||
    !r.success
  ) {
    result.checks.structural = "failed";
    result.issues = result.issues.filter((i) => i.stage === "structural");
    return result;
  }
  if (!h.success || !c.success) {
    result.checks.semantic = "failed";
    return result;
  }
  for (const [field, expected] of [
    ["historyId", h.data.id],
    ["observationId", h.data.observation.id],
    ["contextId", c.data.id],
    ["acquisitionBindingsId", a.data.id],
    ["measurementBindingsId", m.data.id],
  ] as const)
    if (r.data[field] !== expected)
      issue(
        "RESEARCH.DOCUMENT_ID",
        `/review/${field}`,
        "Review identifies a different input document.",
        "semantic"
      );
  const artifacts = new Map<
    string,
    { value: z.infer<typeof artifact>; path: string }
  >();
  const inspectReview = (
    value: z.infer<typeof review>,
    ref: string,
    path: string,
    notBefore: string | undefined
  ) => {
    if (value.state !== "reviewed") {
      issue(
        "RESEARCH.REVIEW_REQUIRED",
        path,
        "An explicit review is required."
      );
      return;
    }
    if (compareUtcInstants(value.reviewedAt, value.reviewedAt) === undefined)
      issue(
        "RESEARCH.REVIEW_TIME",
        `${path}/reviewedAt`,
        "Review time must be a valid UTC instant.",
        "semantic"
      );
    else if (
      notBefore &&
      compareUtcInstants(value.reviewedAt, notBefore) === -1
    )
      issue(
        "RESEARCH.REVIEW_ORDER",
        `${path}/reviewedAt`,
        "Review cannot precede the inputs it evaluates.",
        "semantic"
      );
    if (value.outcome !== "accepted")
      issue(
        "RESEARCH.REVIEW_NOT_ACCEPTED",
        `${path}/outcome`,
        "Rejected or inconclusive review cannot satisfy the prerequisites."
      );
    artifacts.set(ref, { value: value.report, path: `${path}/report` });
  };
  const seen = new Set<string>();
  for (const [i, entry] of r.data.measurements.entries()) {
    const path = `/review/measurements/${i}`;
    if (seen.has(entry.measurementRef))
      issue(
        "RESEARCH.DUPLICATE",
        `${path}/measurementRef`,
        "Each measurement has one review in this document.",
        "semantic"
      );
    seen.add(entry.measurementRef);
    const binding = m.data.measurements.find(
      (b) => b.measurementRef === entry.measurementRef
    );
    const measurement = h.data.observation.measurements.find(
      (v) => `measurement:${v.id}` === entry.measurementRef
    );
    if (!binding || !measurement) {
      issue(
        "RESEARCH.MEASUREMENT",
        `${path}/measurementRef`,
        "Review must identify an existing mapped measurement.",
        "semantic"
      );
      continue;
    }
    const productRef = a.data.products.find(
      (p) => p.observationProductRef === binding.observationProductRef
    )?.contextProductRef;
    const product = c.data.products.find(
      (p) => `product:${p.id}` === productRef
    );
    const acquisition = c.data.acquisitions.find(
      (p) => `acquisition:${p.id}` === product?.acquisitionRef
    );
    const calibrationPin = acquisition?.channels.find(
      (channel) => channel.channelId === binding.channelId
    )?.calibration;
    const calibration = c.data.calibrations.find(
      (p) => `calibration:${p.id}` === entry.calibrationRef
    );
    if (
      !acquisition ||
      !calibration ||
      calibrationPin?.state !== "pinned" ||
      calibrationPin.ref !== entry.calibrationRef
    ) {
      issue(
        "RESEARCH.CALIBRATION_PIN",
        `${path}/calibrationRef`,
        "Use review must identify the exact calibration pinned by the captured channel.",
        "semantic"
      );
      continue;
    }
    if (
      calibration.review.state !== "reviewed" ||
      calibration.review.outcome !== "accepted"
    )
      issue(
        "RESEARCH.CALIBRATION_REVIEW",
        path,
        "The pinned calibration also requires an accepted calibration review."
      );
    if (measurement.value.uncertainty.kind === "unknown")
      issue(
        "RESEARCH.MEASUREMENT_UNCERTAINTY",
        path,
        "Measurement uncertainty must be explicitly quantified."
      );
    const nominal = binding.time;
    const nominalEnd =
      nominal.state === "known"
        ? nominal.kind === "instant"
          ? nominal.value
          : nominal.end
        : undefined;
    inspectReview(
      entry.calibrationUse,
      `${entry.measurementRef}/calibration-use`,
      `${path}/calibrationUse`,
      nominalEnd
    );
    if (
      entry.calibrationUse.state === "reviewed" &&
      calibration.review.state === "reviewed" &&
      compareUtcInstants(
        entry.calibrationUse.reviewedAt,
        calibration.review.reviewedAt
      ) === -1
    )
      issue(
        "RESEARCH.REVIEW_ORDER",
        `${path}/calibrationUse/reviewedAt`,
        "Use review cannot precede the pinned calibration review.",
        "semantic"
      );
    const t = entry.timing;
    if (t.kind === "unknown") {
      issue(
        "RESEARCH.TIMING_REQUIRED",
        `${path}/timing`,
        "An explicitly interpreted timing interval is required; no bound is inferred from clock magnitude."
      );
      continue;
    }
    inspectReview(
      t.review,
      `${entry.measurementRef}/timing`,
      `${path}/timing/review`,
      t.upper
    );
    if (
      compareUtcInstants(t.lower, t.lower) === undefined ||
      compareUtcInstants(t.upper, t.upper) === undefined
    ) {
      issue(
        "RESEARCH.TIME_INVALID",
        `${path}/timing`,
        "Interval limits must be valid UTC instants.",
        "semantic"
      );
      continue;
    }
    if (compareUtcInstants(t.lower, t.upper) === 1) {
      issue(
        "RESEARCH.TIME_ORDER",
        `${path}/timing`,
        "Closed timing interval lower limit must not exceed upper limit.",
        "semantic"
      );
      continue;
    }
    if (nominal.state === "unknown")
      issue(
        "RESEARCH.NOMINAL_TIME",
        path,
        "Nominal measurement time must be known."
      );
    else {
      const start = nominal.kind === "instant" ? nominal.value : nominal.start;
      const end = nominal.kind === "instant" ? nominal.value : nominal.end;
      if (
        compareUtcInstants(t.lower, start) === 1 ||
        compareUtcInstants(t.upper, end) === -1
      )
        issue(
          "RESEARCH.NOMINAL_ENCLOSURE",
          `${path}/timing`,
          "Reviewed interval must enclose the whole nominal measurement, not shift it elsewhere.",
          "semantic"
        );
    }
    const deploymentPin = acquisition.deployment;
    const deployment =
      deploymentPin.state === "pinned"
        ? c.data.deployments.find(
            (d) => `deployment:${d.id}` === deploymentPin.ref
          )
        : undefined;
    const windows = [
      ["capture", acquisition.time],
      ["calibration", calibration.validity],
      ["deployment", deployment?.period],
    ] as const;
    for (const [name, window] of windows) {
      if (!window || window.state === "unknown") {
        issue("RESEARCH.WINDOW_UNKNOWN", path, `${name} window is unresolved.`);
        continue;
      }
      const contained =
        "kind" in window && window.kind === "instant"
          ? compareUtcInstants(t.lower, window.value) === 0 &&
            compareUtcInstants(t.upper, window.value) === 0
          : "start" in window &&
            compareUtcInstants(t.lower, window.start) !== -1 &&
            compareUtcInstants(t.upper, window.end) === -1;
      if (!contained)
        issue(
          "RESEARCH.TIMING_OUTSIDE_WINDOW",
          `${path}/timing`,
          `Closed timing interval must fit inside the ${name} window; its end is exclusive.`
        );
    }
  }
  for (const binding of m.data.measurements)
    if (!seen.has(binding.measurementRef))
      issue(
        "RESEARCH.REVIEW_MISSING",
        "/review/measurements",
        `Missing review for ${binding.measurementRef}.`
      );
  result.checks.semantic = result.issues.some(
    (i) => i.stage === "semantic" && i.severity === "error"
  )
    ? "failed"
    : "passed";
  if (result.issues.some((i) => i.severity === "error")) {
    result.checks.profile = "failed";
    return result;
  }
  const observationAssets = snapshot(options.observationAssets),
    contextAssets = snapshot(options.contextAssets),
    reviewAssets = snapshot(options.reviewAssets);
  // Start both evaluators against cloned documents before yielding; neither accepts caller-provided success flags.
  const [documentation, measurements] = await Promise.all([
    evaluateAssessmentDocumentation(h.data, { assets: observationAssets }),
    evaluateMeasurementBindings(h.data, c.data, a.data, m.data, {
      assets: contextAssets,
    }),
  ]);
  result.documentation = documentation;
  result.measurements = measurements;
  result.issues.push(
    ...documentation.issues.map((i) => ({
      ...i,
      pointer: `/documentation${i.pointer}`,
    })),
    ...measurements.issues
  );
  for (const [ref, { value, path }] of artifacts) {
    const check: ResearchReviewAssetCheck = {
      ref,
      status: "not_checked",
      expectedSha256: value.digest.value,
      expectedByteLength: value.byteLength,
    };
    result.reviewAssets.push(check);
    const bytes = reviewAssets.get(ref);
    if (!bytes) {
      issue(
        "RESEARCH.REPORT_UNAVAILABLE",
        path,
        `No local bytes supplied for ${ref}.`,
        "external",
        "warning"
      );
      continue;
    }
    check.actualByteLength = bytes.byteLength;
    if (bytes.byteLength !== value.byteLength) {
      check.status = "failed";
      issue(
        "RESEARCH.REPORT_SIZE",
        path,
        "Review report byte length differs.",
        "external"
      );
      continue;
    }
    try {
      const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      check.actualSha256 = [...new Uint8Array(hash)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      check.status =
        check.actualSha256 === value.digest.value ? "passed" : "failed";
      if (check.status === "failed")
        issue(
          "RESEARCH.REPORT_DIGEST",
          path,
          "Review report digest differs.",
          "external"
        );
    } catch {
      issue(
        "RESEARCH.HASH_UNAVAILABLE",
        path,
        "SHA-256 unavailable; report is unchecked.",
        "external",
        "warning"
      );
    }
  }
  const nested = [documentation, measurements];
  result.checks.structural = nested.some(
    (n) => n.checks.structural === "failed"
  )
    ? "failed"
    : "passed";
  result.checks.semantic =
    result.checks.structural === "failed"
      ? "not_checked"
      : nested.some((n) => n.checks.semantic === "failed")
      ? "failed"
      : "passed";
  result.checks.external =
    nested.some((n) => n.checks.external === "failed") ||
    result.reviewAssets.some((v) => v.status === "failed")
      ? "failed"
      : "not_checked";
  result.checks.profile =
    result.checks.structural === "failed" || result.checks.semantic === "failed"
      ? "not_checked"
      : nested.some((n) => n.checks.profile === "failed") ||
        result.checks.external === "failed"
      ? "failed"
      : nested.some((n) => n.checks.profile === "not_checked") ||
        result.reviewAssets.some((v) => v.status === "not_checked") ||
        !r.data.measurements.length
      ? "not_checked"
      : "passed";
  result.success = result.checks.profile === "passed";
  return result;
}
