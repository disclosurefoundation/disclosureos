import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import { MeasurementBindingsSchema } from "./measurement-bindings";
import type { MeasurementBindingIssue } from "./measurement-bindings";
import {
  InstrumentResearchReviewSchema,
  evaluateInstrumentResearchPrerequisites,
} from "./research-prerequisites";
import type {
  InstrumentResearchOptions,
  InstrumentResearchResult,
} from "./research-prerequisites";

export const INSTRUMENT_RESEARCH_COMPLETION_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:instrument-research-completion",
  version: "0.1.0",
  scope: "selected_instrument_research_prerequisites",
} as const);
export const INSTRUMENT_RESEARCH_REQUIREMENTS = Object.freeze(
  (
    [
      {
        id: "input_consistency",
        label: "Reported structural and semantic consistency",
      },
      { id: "review_scope", label: "Nonempty mapped measurement review scope" },
      {
        id: "reviewed_context",
        label: "Calibration, uncertainty and interpreted timing prerequisites",
      },
      {
        id: "assessment_documentation",
        label: "Assessment documentation and supporting bytes",
      },
      {
        id: "measurement_acquisition",
        label: "Measurement and acquisition bindings with supporting bytes",
      },
      {
        id: "report_integrity",
        label: "Calibration-use and timing review report integrity",
      },
    ] as const
  ).map((v) => Object.freeze(v))
);
export type ResearchRequirementId =
  (typeof INSTRUMENT_RESEARCH_REQUIREMENTS)[number]["id"];
export type ResearchCompletionStatus =
  | "satisfied"
  | "missing"
  | "failed"
  | "not_checked";
export interface ResearchCompletionAction extends MeasurementBindingIssue {
  nextAction: string;
  measurementRef?: string;
}
export interface ResearchCompletionRequirement {
  id: ResearchRequirementId;
  label: string;
  importance: "required";
  status: ResearchCompletionStatus;
  reason: string;
  blockedBy: ResearchRequirementId[];
  actions: ResearchCompletionAction[];
}
export interface InstrumentResearchCompletionResult {
  policy: typeof INSTRUMENT_RESEARCH_COMPLETION_POLICY;
  applicability: { state: "selected"; reason: string };
  validation: InstrumentResearchResult;
  requirements: ResearchCompletionRequirement[];
  counts: Record<ResearchCompletionStatus, number>;
  actions: ResearchCompletionAction[];
  scientificEligibility: "not_checked";
  calibrationAdequacy: "not_checked";
  timingModel: "not_checked";
  reviewerAuthenticity: "not_checked";
}
const missingCodes = new Set([
  "RESEARCH.REVIEW_MISSING",
  "RESEARCH.REVIEW_REQUIRED",
  "RESEARCH.TIMING_REQUIRED",
  "RESEARCH.NOMINAL_TIME",
  "RESEARCH.WINDOW_UNKNOWN",
  "RESEARCH.MEASUREMENT_UNCERTAINTY",
  "RESEARCH.REPORT_UNAVAILABLE",
  "EXTERNAL.ASSET_UNAVAILABLE",
  "BINDING.CONTEXT_INCOMPLETE",
  "BINDING.DIGEST_REQUIRED",
  "BINDING.PRODUCT_REQUIRED",
  "BINDING.SOURCE_REQUIRED",
  "MEASUREMENT.TIME_UNKNOWN",
  "MEASUREMENT.CAPTURE_UNKNOWN",
  "MEASUREMENT.REQUIRED",
  "PROFILE.INPUTS_REQUIRED",
  "PROFILE.METHOD_CONTEXT",
  "PROFILE.LOCATOR_REQUIRED",
  "PROFILE.DIGEST_REQUIRED",
  "PROFILE.MEASUREMENT_REQUIRED",
  "PROFILE.MEASUREMENT_UNCERTAINTY",
  "PROFILE.INSTRUMENT_PRODUCT_REQUIRED",
  "PROFILE.EVENT_TIME",
  "PROFILE.FRAME_CONTEXT",
]);
const advice: Record<string, string> = {
  "RESEARCH.DOCUMENT_ID":
    "Resolve the document/version mismatch using the original review and input inventory; do not relabel unrelated inputs.",
  "RESEARCH.DUPLICATE":
    "Resolve duplicate measurement reviews explicitly; do not select an arbitrary first entry.",
  "RESEARCH.MEASUREMENT":
    "Identify the reviewed measurement and its documented mapping before evaluating research prerequisites.",
  "RESEARCH.CALIBRATION_PIN":
    "Resolve the exact calibration pinned by the captured channel. Do not substitute a later or more favorable calibration.",
  "RESEARCH.REVIEW_MISSING":
    "Supply the missing measurement review when available. Preserve the gap rather than fabricating a review.",
  "RESEARCH.REVIEW_REQUIRED":
    "Obtain the purpose-specific review and its supporting report; retain unreviewed status until that work exists.",
  "RESEARCH.REVIEW_NOT_ACCEPTED":
    "Preserve the rejected or inconclusive review. Resolve its findings through documented further work; do not relabel it accepted to pass.",
  "RESEARCH.REVIEW_TIME":
    "Correct the review timestamp from the review record using a valid UTC instant.",
  "RESEARCH.REVIEW_ORDER":
    "Resolve the review chronology against the actual input and review records; do not backdate or invent an evaluation.",
  "RESEARCH.MEASUREMENT_UNCERTAINTY":
    "Obtain the documented measurement uncertainty model and magnitude; retain unknown uncertainty until characterized.",
  "RESEARCH.TIMING_REQUIRED":
    "Obtain an explicitly interpreted timing interval, assumptions and review. A clock magnitude alone does not define an interval.",
  "RESEARCH.TIME_INVALID":
    "Correct the interval limits from the documented timing interpretation using valid UTC instants.",
  "RESEARCH.TIME_ORDER":
    "Resolve the reversed interval limits against the timing record; do not silently swap them.",
  "RESEARCH.NOMINAL_TIME":
    "Obtain the nominal capture time and its meaning from the source metadata; retain unknown timing until established.",
  "RESEARCH.NOMINAL_ENCLOSURE":
    "Resolve why the timing interval does not enclose the whole nominal measurement; do not shift a measurement into a convenient window.",
  "RESEARCH.WINDOW_UNKNOWN":
    "Obtain the applicable capture, deployment or calibration interval identified in the diagnostic; retain unresolved history.",
  "RESEARCH.TIMING_OUTSIDE_WINDOW":
    "Resolve timing and validity against the original capture, deployment and calibration records; do not trim uncertainty bounds to fit.",
  "RESEARCH.REPORT_UNAVAILABLE":
    "Supply exact local bytes for the named review report. A declared digest or review label is not byte verification.",
  "RESEARCH.REPORT_SIZE":
    "Resolve the report/version mismatch against the source; do not change the expected length merely to pass.",
  "RESEARCH.REPORT_DIGEST":
    "Resolve the report/version mismatch against the source; do not replace the digest merely to pass.",
  "RESEARCH.HASH_UNAVAILABLE":
    "Rerun report verification in a runtime with SHA-256 support; verification remains unchecked.",
  "EXTERNAL.ASSET_UNAVAILABLE":
    "Supply the exact local supporting bytes in the indicated namespace; do not infer verification from a URL.",
  "EXTERNAL.HASH_UNAVAILABLE":
    "Rerun byte verification in a runtime with SHA-256 support; verification remains unchecked.",
  "EXTERNAL.DIGEST_MISMATCH":
    "Resolve the content/version mismatch against the original source rather than replacing the pin to pass.",
  "EXTERNAL.SIZE_MISMATCH":
    "Resolve the source artifact/version mismatch rather than adjusting the expected length to pass.",
  "EXTERNAL.EMPTY_ASSET":
    "Obtain the nonempty supporting source content; an empty file cannot supply this support.",
  "BINDING.CONTEXT_INCOMPLETE":
    "Resolve the specific acquisition-context gaps in the nested binding result, preserving unknown clock and calibration history.",
  "MEASUREMENT.UNIT":
    "Resolve the channel/unit mismatch from documented definitions. This profile performs no implicit unit conversion.",
  "MEASUREMENT.QUANTITY":
    "Resolve the quantity/channel meaning against the manifest; do not equate different quantities by their labels.",
};

/** Guidance for the explicitly selected profile. All validation is delegated, including early exits. */
export async function evaluateInstrumentResearchCompletion(
  historyInput: unknown,
  contextInput: unknown,
  acquisitionBindingsInput: unknown,
  measurementBindingsInput: unknown,
  reviewInput: unknown,
  options: InstrumentResearchOptions = {}
): Promise<InstrumentResearchCompletionResult> {
  const review = InstrumentResearchReviewSchema.safeParse(reviewInput),
    mapping = MeasurementBindingsSchema.safeParse(measurementBindingsInput),
    context = parseAcquisitionContext(contextInput);
  const validation = await evaluateInstrumentResearchPrerequisites(
    historyInput,
    context.success ? context.data : contextInput,
    acquisitionBindingsInput,
    mapping.success ? mapping.data : measurementBindingsInput,
    review.success ? review.data : reviewInput,
    options
  );
  function reviewEntry(issue: MeasurementBindingIssue) {
    const match = /^\/review\/measurements\/(\d+)(?:\/|$)/.exec(issue.pointer);
    return match && review.success
      ? review.data.measurements[Number(match[1])]
      : undefined;
  }
  function calibrationRejected(issue: MeasurementBindingIssue): boolean {
    const entry = reviewEntry(issue),
      calibration =
        context.success && entry
          ? context.data.calibrations.find(
              (c) => `calibration:${c.id}` === entry.calibrationRef
            )
          : undefined;
    return (
      calibration?.review.state === "reviewed" &&
      calibration.review.outcome !== "accepted"
    );
  }
  function action(issue: MeasurementBindingIssue): ResearchCompletionAction {
    const entry = reviewEntry(issue);
    const nextAction =
      issue.code === "RESEARCH.CALIBRATION_REVIEW"
        ? calibrationRejected(issue)
          ? "Preserve the rejected or inconclusive calibration review. Resolve applicability through documented further review; do not relabel the outcome accepted."
          : "Obtain the review of the exact pinned calibration and its report; preserve unreviewed or unknown status while unavailable."
        : advice[issue.code] ??
          (issue.code.startsWith("PROFILE.")
            ? "Follow the documentary requirement at this pointer using original source content; preserve unknown or unassessed states rather than inventing support."
            : "Resolve the stated structural, reference or binding inconsistency using the source documents; preserve original inputs for review.");
    return {
      ...issue,
      nextAction,
      ...(entry ? { measurementRef: entry.measurementRef } : {}),
    };
  }
  const actions = validation.issues.map(action);
  function status(
    issues: readonly MeasurementBindingIssue[],
    fallback: ResearchCompletionStatus
  ): ResearchCompletionStatus {
    if (
      issues.some(
        (i) =>
          i.severity === "error" &&
          !missingCodes.has(i.code) &&
          (i.code !== "RESEARCH.CALIBRATION_REVIEW" || calibrationRejected(i))
      )
    )
      return "failed";
    if (
      issues.some(
        (i) =>
          missingCodes.has(i.code) || i.code === "RESEARCH.CALIBRATION_REVIEW"
      )
    )
      return "missing";
    return fallback;
  }
  const requirements: ResearchCompletionRequirement[] =
    INSTRUMENT_RESEARCH_REQUIREMENTS.map((r) => ({
      ...r,
      importance: "required",
      status: "not_checked",
      reason: "The prerequisite check has not completed.",
      blockedBy: [],
      actions: [],
    }));
  const item = (id: ResearchRequirementId) =>
    requirements.find((r) => r.id === id)!;
  const inputs = item("input_consistency");
  inputs.actions = actions.filter(
    (i) => i.stage === "structural" || i.stage === "semantic"
  );
  inputs.status =
    validation.checks.structural === "failed" ||
    validation.checks.semantic === "failed"
      ? "failed"
      : validation.checks.structural === "passed" &&
        validation.checks.semantic === "passed"
      ? "satisfied"
      : "not_checked";
  inputs.reason =
    "Describes only the structural and semantic checks actually reported. Binding checks that never ran remain unchecked in their own phase.";
  const scope = item("review_scope");
  scope.actions = actions.filter((i) => i.code === "RESEARCH.REVIEW_MISSING");
  const covered =
    review.success &&
    mapping.success &&
    review.data.measurements.length > 0 &&
    mapping.data.measurements.length > 0 &&
    mapping.data.measurements.every((m) =>
      review.data.measurements.some(
        (r) => r.measurementRef === m.measurementRef
      )
    );
  if (inputs.status !== "satisfied") {
    scope.blockedBy = ["input_consistency"];
    scope.reason =
      "Resolve input consistency before treating review membership as established.";
  } else {
    scope.status = covered ? "satisfied" : "missing";
    scope.reason = covered
      ? "A nonempty mapped review inventory is present; this does not establish that the inventory is exhaustive."
      : "A nonempty mapped measurement review scope is required. Omission is not an inapplicability exemption.";
  }
  const reviewed = item("reviewed_context");
  reviewed.actions = actions.filter(
    (i) =>
      i.code.startsWith("RESEARCH.") &&
      i.stage === "profile" &&
      i.code !== "RESEARCH.REVIEW_MISSING"
  );
  if (reviewed.actions.length) {
    reviewed.status = status(reviewed.actions, "not_checked");
    reviewed.reason =
      "Calibration, uncertainty or timing prerequisites have unresolved diagnostics; preserved review outcomes remain authoritative.";
  } else if (inputs.status !== "satisfied") {
    reviewed.blockedBy = ["input_consistency"];
    reviewed.reason =
      "Input consistency prevents a completed review-prerequisite determination.";
  } else if (scope.status !== "satisfied") {
    reviewed.blockedBy = ["review_scope"];
    reviewed.reason =
      "Establish the mapped review scope before claiming review-prerequisite completion.";
  } else if (
    validation.documentation !== null &&
    validation.measurements !== null
  ) {
    reviewed.status = "satisfied";
    reviewed.reason =
      "The review preflight passed and the validator proceeded to its downstream checks. Scientific adequacy remains unchecked.";
  } else {
    reviewed.blockedBy = ["input_consistency", "review_scope"];
  }
  for (const [id, nested] of [
    ["assessment_documentation", validation.documentation],
    ["measurement_acquisition", validation.measurements],
  ] as const) {
    const row = item(id);
    row.actions = nested
      ? nested.issues.map((i) =>
          action(
            id === "assessment_documentation"
              ? { ...i, pointer: "/documentation" + i.pointer }
              : i
          )
        )
      : [];
    if (!nested) {
      row.blockedBy =
        inputs.status !== "satisfied"
          ? ["input_consistency"]
          : scope.status !== "satisfied"
          ? ["review_scope"]
          : ["reviewed_context"];
      row.reason =
        "The research validator stopped before this phase; no positive result is inferred from absent diagnostics.";
    } else {
      row.status =
        nested.checks.profile === "passed"
          ? "satisfied"
          : status(
              row.actions,
              nested.checks.profile === "failed" ? "failed" : "not_checked"
            );
      row.reason =
        "Reports the invoked nested profile. Consult its full diagnostics and per-asset results in validation.";
    }
  }
  const reports = item("report_integrity");
  reports.actions = actions.filter(
    (i) => i.code.startsWith("RESEARCH.") && i.stage === "external"
  );
  if (!validation.reviewAssets.length) {
    reports.blockedBy =
      inputs.status !== "satisfied"
        ? ["input_consistency"]
        : scope.status !== "satisfied"
        ? ["review_scope"]
        : ["reviewed_context"];
    reports.reason =
      "No review-report verification completed; an empty check list is not a pass.";
  } else {
    reports.status = validation.reviewAssets.some((a) => a.status === "failed")
      ? "failed"
      : status(
          reports.actions,
          validation.reviewAssets.some((a) => a.status === "not_checked")
            ? "not_checked"
            : "satisfied"
        );
    reports.reason =
      "Reports only local calibration-use and timing report byte identity. Reviewer identity and scientific validity are unchecked.";
  }
  const counts: Record<ResearchCompletionStatus, number> = {
    satisfied: 0,
    missing: 0,
    failed: 0,
    not_checked: 0,
  };
  for (const r of requirements) counts[r.status]++;
  return {
    policy: INSTRUMENT_RESEARCH_COMPLETION_POLICY,
    applicability: {
      state: "selected",
      reason:
        "The caller explicitly selected the instrument-research profile. Empty inventories or missing reviews are not automatic exemptions.",
    },
    validation,
    requirements,
    counts,
    actions,
    scientificEligibility: "not_checked",
    calibrationAdequacy: "not_checked",
    timingModel: "not_checked",
    reviewerAuthenticity: "not_checked",
  };
}
