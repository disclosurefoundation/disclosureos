import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
import type { ClaimSubject } from "@disclosureos/records/experimental/v2";
import { evaluateAssessmentDocumentation } from "./assessment-documentation";
import type {
  DocumentationOptions,
  DocumentationResult,
  DocumentationIssue,
} from "./assessment-documentation";

export const DOCUMENTATION_COMPLETION_POLICY = Object.freeze({
  id: "urn:disclosureos:experimental:policy:documentation-completion",
  version: "0.1.0",
  scope: "assessment_documentation_requirements",
} as const);
export const DOCUMENTATION_REQUIREMENTS = Object.freeze(
  (
    [
      { id: "assessment", label: "Attributed evaluator assessment" },
      {
        id: "documentary_support",
        label: "Traceable support, method descriptions and passage locators",
      },
      { id: "content_digests", label: "Supporting content digests" },
      {
        id: "content_integrity",
        label: "Local supporting content verification",
      },
      {
        id: "measurement",
        label: "Measurement matching the confirmed subject",
      },
      { id: "event_time", label: "Supplied event time" },
      {
        id: "measurement_uncertainty",
        label: "Characterized measurement uncertainty",
      },
      {
        id: "raw_product_lineage",
        label: "Primary instrument product lineage",
      },
      { id: "reference_frames", label: "Declared measurement frame context" },
    ] as const
  ).map((value) => Object.freeze(value))
);
export type DocumentationRequirementId =
  (typeof DOCUMENTATION_REQUIREMENTS)[number]["id"];
export type CompletionStatus =
  | "satisfied"
  | "missing"
  | "failed"
  | "not_checked"
  | "not_applicable";
export interface DocumentationAction extends DocumentationIssue {
  nextAction: string;
}
export interface DocumentationRequirement {
  id: DocumentationRequirementId;
  label: string;
  importance: "required";
  applicability: "applicable" | "not_applicable" | "not_checked";
  status: CompletionStatus;
  reason: string;
  actions: DocumentationAction[];
  blockedBy: DocumentationRequirementId[];
}
export interface AssessmentDocumentationCompletion {
  claimRef: string;
  topic: string;
  subject: ClaimSubject;
  /** The existing documentary profile remains authoritative. */
  documentationStatus: "passed" | "failed" | "not_checked";
  requirements: DocumentationRequirement[];
  /** Counts of checklist groups, not evidence volume, percentages, weights or scores. */
  counts: Record<CompletionStatus, number>;
}
export interface DocumentationCompletionResult {
  policy: typeof DOCUMENTATION_COMPLETION_POLICY;
  applicability: {
    state: "applicable" | "not_applicable" | "not_checked";
    reason: string;
  };
  validation: DocumentationResult;
  assessments: AssessmentDocumentationCompletion[];
  actions: DocumentationAction[];
  scientificEligibility: "not_checked";
  artifactContents: "not_checked";
  methodExecution: "not_checked";
}
const nextActions: Partial<Record<DocumentationIssue["code"], string>> = {
  "PROFILE.NO_ASSESSMENTS":
    "Preserve source assertions as supplied. Use this profile when an evaluator assessment exists; do not fabricate one.",
  "PROFILE.UNASSESSED":
    "Retain unassessed status until an attributed evaluation and method are available.",
  "PROFILE.INPUTS_REQUIRED":
    "Link the assessment to actual source content or data products. Instrument descriptors alone do not supply support.",
  "PROFILE.METHOD_CONTEXT":
    "Add the referenced method description from its documentation; preserve the declared method version.",
  "PROFILE.LOCATOR_REQUIRED":
    "Supply a passage or product-value locator from the original source; do not invent a page, timestamp or value location.",
  "PROFILE.DIGEST_REQUIRED":
    "Compute and record SHA-256 from the exact supporting content when it is available. Keep unavailable content unresolved.",
  "PROFILE.MEASUREMENT_REQUIRED":
    "Link a supported measurement matching the declared subject. If unavailable, retain the declaration with this gap.",
  "PROFILE.MEASUREMENT_UNCERTAINTY":
    "Obtain the documented uncertainty model and magnitude. Keep unknown uncertainty explicit until it can be characterized.",
  "PROFILE.INSTRUMENT_PRODUCT_REQUIRED":
    "Provide the measurement provenance reaching a native raw product and its declared instrument-data source.",
  "PROFILE.EVENT_TIME":
    "Supply a documented known or approximate event time with its provenance. Do not substitute a default date.",
  "PROFILE.FRAME_CONTEXT":
    "Document the referenced measurement frame; retain unknown frame context if its definition is unavailable.",
  "EXTERNAL.ASSET_UNAVAILABLE":
    "Supply the exact local bytes for the referenced content. A URL or digest alone does not complete verification.",
  "EXTERNAL.DIGEST_MISMATCH":
    "Resolve the content/version mismatch against the original source. Do not replace a pin merely to make validation pass.",
  "EXTERNAL.EMPTY_ASSET":
    "Obtain the nonempty supporting content; an empty file cannot support this assessment.",
  "EXTERNAL.HASH_UNAVAILABLE":
    "Rerun byte verification in a runtime with SHA-256 support; verification remains unchecked.",
};
const action = (issue: DocumentationIssue): DocumentationAction => ({
  ...issue,
  nextAction:
    nextActions[issue.code] ??
    "Correct the structural or reference inconsistency at this pointer using the source record; preserve the original input for review.",
});
const codes = {
  documentary_support: [
    "PROFILE.INPUTS_REQUIRED",
    "PROFILE.METHOD_CONTEXT",
    "PROFILE.LOCATOR_REQUIRED",
  ],
  content_digests: ["PROFILE.DIGEST_REQUIRED"],
  content_integrity: [
    "EXTERNAL.ASSET_UNAVAILABLE",
    "EXTERNAL.DIGEST_MISMATCH",
    "EXTERNAL.EMPTY_ASSET",
    "EXTERNAL.HASH_UNAVAILABLE",
  ],
  measurement: ["PROFILE.MEASUREMENT_REQUIRED"],
  event_time: ["PROFILE.EVENT_TIME"],
  measurement_uncertainty: ["PROFILE.MEASUREMENT_UNCERTAINTY"],
  raw_product_lineage: ["PROFILE.INSTRUMENT_PRODUCT_REQUIRED"],
  reference_frames: ["PROFILE.FRAME_CONTEXT"],
  assessment: ["PROFILE.UNASSESSED"],
} satisfies Record<DocumentationRequirementId, string[]>;

/** Explain the existing documentary profile; never accept caller-asserted completion flags. */
export async function evaluateDocumentationCompletion(
  input: unknown,
  options: DocumentationOptions = {}
): Promise<DocumentationCompletionResult> {
  // Capture both applicability and validator input before asynchronous byte checks.
  const parsed = parseExperimentalClaimHistory(input);
  const validation = await evaluateAssessmentDocumentation(
    parsed.success ? parsed.data : input,
    options
  );
  const result: DocumentationCompletionResult = {
    policy: DOCUMENTATION_COMPLETION_POLICY,
    applicability: {
      state: "not_checked",
      reason:
        "A structurally and semantically valid claim history is required before determining applicability.",
    },
    validation,
    assessments: [],
    actions: validation.issues.map(action),
    scientificEligibility: "not_checked",
    artifactContents: "not_checked",
    methodExecution: "not_checked",
  };
  if (!parsed.success) return result;
  result.applicability = validation.assessments.length
    ? {
        state: "applicable",
        reason:
          "Current evaluator-assessment entries are present, including explicitly unassessed entries.",
      }
    : {
        state: "not_applicable",
        reason:
          "There are no current evaluator-assessment entries. Source assertions alone do not require an invented evaluation.",
      };
  const claims = new Map(parsed.data.claims.map((c) => [`claim:${c.id}`, c]));
  const measurements = new Map(
    parsed.data.observation.measurements.map((m) => [`measurement:${m.id}`, m])
  );
  for (const report of validation.assessments) {
    const claim = claims.get(report.claimRef);
    if (!claim || claim.kind !== "assessment") continue;
    const assessed = claim.status === "assessed",
      confirmed = assessed && claim.outcome === "confirmed";
    const subjectRef =
      claim.subject.kind === "measurement"
        ? `measurement:${claim.subject.measurementId}`
        : undefined;
    const relevant = report.measurementRefs.filter(
      (ref) => !subjectRef || ref === subjectRef
    );
    const requirements: DocumentationRequirement[] = [];
    for (const definition of DOCUMENTATION_REQUIREMENTS) {
      const id = definition.id;
      const issues = report.issues.filter((i) =>
        (codes[id] as readonly string[]).includes(i.code)
      );
      const row: DocumentationRequirement = {
        id,
        label: definition.label,
        importance: "required",
        applicability: "applicable",
        status: "satisfied",
        reason:
          "The pinned documentary profile completed this requirement without an unresolved diagnostic.",
        actions: issues.map(action),
        blockedBy: [],
      };
      if (id === "assessment") {
        if (!assessed) {
          row.status = "missing";
          row.reason =
            "No attributed evaluator assessment has been recorded; unassessed remains a valid state.";
        }
      } else {
        const instrument = ![
          "documentary_support",
          "content_digests",
          "content_integrity",
        ].includes(id);
        if (!assessed) {
          row.blockedBy = ["assessment"];
          row.status = "not_checked";
          row.reason =
            "The evaluator assessment is unassessed; dependent requirements have not been checked.";
          if (instrument) row.applicability = "not_checked";
        } else if (instrument && !confirmed) {
          row.status = "not_applicable";
          row.applicability = "not_applicable";
          row.reason =
            "This documentary profile applies this instrument requirement only to assessed confirmed declarations.";
        } else if (
          [
            "measurement_uncertainty",
            "raw_product_lineage",
            "reference_frames",
          ].includes(id) &&
          !relevant.length
        ) {
          row.blockedBy = ["measurement"];
          row.status = "not_checked";
          row.reason =
            "A measurement matching the subject is required before this check can run.";
        } else if (
          id === "reference_frames" &&
          !relevant.some((ref) => measurements.get(ref)?.frameRef)
        ) {
          row.status = "not_applicable";
          row.applicability = "not_applicable";
          row.reason =
            "No relevant measurement declares a frame reference; this does not establish that a frame is scientifically unnecessary.";
        } else if (
          ["content_digests", "content_integrity"].includes(id) &&
          !report.assets.length
        ) {
          row.blockedBy = ["documentary_support"];
          row.status = "not_checked";
          row.reason =
            "Traceable supporting content is required before pins and local bytes can be checked.";
        } else if (id === "content_integrity") {
          if (report.assets.some((a) => a.status === "failed")) {
            row.status = "failed";
            row.reason =
              "Supplied content is empty or differs from its pinned digest.";
          } else if (
            issues.some((i) => i.code === "EXTERNAL.ASSET_UNAVAILABLE")
          ) {
            row.status = "missing";
            row.reason =
              "Required local content was not supplied; byte verification is incomplete.";
          } else if (report.assets.some((a) => a.status === "not_checked")) {
            if (report.issues.some((i) => i.code === "PROFILE.DIGEST_REQUIRED"))
              row.blockedBy = ["content_digests"];
            row.status = "not_checked";
            row.reason =
              "Byte verification is incomplete; resolve missing pins or runtime hashing support first.";
          }
        } else if (issues.length) {
          row.status = "missing";
          row.reason =
            "Required documentation is missing or explicitly unknown.";
        }
      }
      requirements.push(row);
    }
    const counts: Record<CompletionStatus, number> = {
      satisfied: 0,
      missing: 0,
      failed: 0,
      not_checked: 0,
      not_applicable: 0,
    };
    for (const row of requirements) counts[row.status]++;
    result.assessments.push({
      claimRef: report.claimRef,
      topic: claim.topic,
      subject: claim.subject,
      documentationStatus: report.status,
      requirements,
      counts,
    });
  }
  return result;
}
