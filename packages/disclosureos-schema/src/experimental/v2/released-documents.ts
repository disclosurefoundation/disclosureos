import { z } from "zod";
import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
const text = z.string().min(1).regex(/\S/),
  id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
export const RELEASED_DOCUMENT_SELECTION_SCHEMA_ID =
  "urn:disclosureos:experimental:released-document-selection:0.1.0";
export const RELEASED_DOCUMENT_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:released-document-provenance",
  version: "0.1.0",
  scope: "selected_document_sources_and_direct_extractions",
  maturity: "experimental",
} as const);
export const ReleasedDocumentSelectionSchema = z.strictObject({
  kind: z.literal("released_document_selection"),
  schemaVersion: z.literal("0.1.0"),
  id,
  historyId: id,
  observationId: id,
  documents: z
    .array(
      z.strictObject({
        sourceRef: z
          .string()
          .regex(/^source:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/),
        release: z.discriminatedUnion("state", [
          z.strictObject({
            state: z.literal("known"),
            releasedBy: text,
            reference: text,
          }),
          z.strictObject({ state: z.literal("unknown"), reason: text }),
        ]),
      })
    )
    .min(1),
});
export type ReleasedDocumentSelection = z.infer<
  typeof ReleasedDocumentSelectionSchema
>;
export function releasedDocumentSelectionJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ReleasedDocumentSelectionSchema, {
      target: "draft-2020-12",
    }),
    $id: RELEASED_DOCUMENT_SELECTION_SCHEMA_ID,
  };
}
export const RELEASED_DOCUMENT_REQUIREMENTS = Object.freeze(
  (
    [
      {
        id: "document_source",
        importance: "required",
        label: "Declared public document source",
      },
      {
        id: "release_citation",
        importance: "required",
        label: "Attributed release citation",
      },
      {
        id: "content_digest",
        importance: "required",
        label: "Declared document SHA-256",
      },
      {
        id: "content_integrity",
        importance: "required",
        label: "Exact local document bytes",
      },
      {
        id: "extraction_traceability",
        importance: "required",
        label:
          "Locators and extractor identities for supplied direct extractions",
      },
      {
        id: "source_title",
        importance: "recommended",
        label: "Human-readable source title",
      },
      {
        id: "source_uri",
        importance: "recommended",
        label: "Source retrieval reference",
      },
      {
        id: "source_attribution",
        importance: "recommended",
        label: "Source-side attribution for supplied direct extractions",
      },
    ] as const
  ).map((v) => Object.freeze(v))
);
export type ReleasedDocumentRequirementId =
  (typeof RELEASED_DOCUMENT_REQUIREMENTS)[number]["id"];
type Status = "passed" | "failed" | "not_checked";
export type ReleasedDocumentCompletionStatus =
  | "satisfied"
  | "missing"
  | "failed"
  | "not_checked"
  | "not_applicable";
export interface ReleasedDocumentIssue {
  code: string;
  stage: "structural" | "semantic" | "profile" | "external" | "recommendation";
  severity: "error" | "warning";
  pointer: string;
  message: string;
  nextAction: string;
}
export interface ReleasedDocumentRequirement {
  id: ReleasedDocumentRequirementId;
  label: string;
  importance: "required" | "recommended";
  status: ReleasedDocumentCompletionStatus;
  reason: string;
  blockedBy: ReleasedDocumentRequirementId[];
  issues: ReleasedDocumentIssue[];
}
export interface ReleasedDocumentReport {
  sourceRef: string;
  status: Status;
  requirements: ReleasedDocumentRequirement[];
  extractionRefs: string[];
  asset: {
    status: Status;
    expectedSha256?: string;
    actualSha256?: string;
    byteLength?: number;
  };
}
export interface ReleasedDocumentResult {
  success: boolean;
  profile: typeof RELEASED_DOCUMENT_PROFILE;
  selection: ReleasedDocumentSelection | null;
  validation: ReturnType<typeof parseExperimentalClaimHistory>;
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  documents: ReleasedDocumentReport[];
  issues: ReleasedDocumentIssue[];
  releaseAuthenticity: "not_checked";
  redistributionRights: "not_checked";
  locatorContents: "not_checked";
  extractionAccuracy: "not_checked";
  assessmentSupport: "not_checked";
  scientificEligibility: "not_checked";
}
/** Selected documentary provenance only. Assessments and scientific sufficiency are not evaluated. */
export async function evaluateReleasedDocuments(
  historyInput: unknown,
  selectionInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<ReleasedDocumentResult> {
  const validation = parseExperimentalClaimHistory(historyInput),
    selection = ReleasedDocumentSelectionSchema.safeParse(selectionInput);
  const result: ReleasedDocumentResult = {
    success: false,
    profile: RELEASED_DOCUMENT_PROFILE,
    selection: selection.success ? selection.data : null,
    validation,
    checks: {
      structural: validation.checks.structural,
      semantic: validation.checks.semantic,
      profile: "not_checked",
      external: "not_checked",
    },
    documents: [],
    issues: validation.issues.map((i) => ({
      ...i,
      nextAction:
        "Resolve the reported history inconsistency against the original records.",
    })),
    releaseAuthenticity: "not_checked",
    redistributionRights: "not_checked",
    locatorContents: "not_checked",
    extractionAccuracy: "not_checked",
    assessmentSupport: "not_checked",
    scientificEligibility: "not_checked",
  };
  if (!selection.success) {
    result.checks.structural = "failed";
    result.checks.semantic = "not_checked";
    for (const i of selection.error.issues)
      result.issues.push({
        code: "DOCUMENT.SELECTION",
        stage: "structural",
        severity: "error",
        pointer:
          "/selection/" +
          i.path
            .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
            .join("/"),
        message: i.message,
        nextAction:
          "Supply a nonempty explicit document selection using existing source references; do not invent release metadata.",
      });
    return result;
  }
  if (!validation.success) return result;
  const chosen = selection.data,
    history = validation.data;
  const problem = (code: string, pointer: string, message: string) =>
    result.issues.push({
      code,
      stage: "semantic",
      severity: "error",
      pointer,
      message,
      nextAction:
        "Resolve the selection against the exact history and source inventory.",
    });
  if (chosen.historyId !== history.id)
    problem(
      "DOCUMENT.HISTORY_ID",
      "/selection/historyId",
      "Selected history ID differs from the supplied history"
    );
  if (chosen.observationId !== history.observation.id)
    problem(
      "DOCUMENT.OBSERVATION_ID",
      "/selection/observationId",
      "Selected observation ID differs from the supplied history"
    );
  const selected = new Set<string>();
  for (const [i, d] of chosen.documents.entries()) {
    if (selected.has(d.sourceRef))
      problem(
        "DOCUMENT.DUPLICATE",
        `/selection/documents/${i}/sourceRef`,
        "A source may be selected only once"
      );
    selected.add(d.sourceRef);
    if (
      !history.observation.sources.some((s) => `source:${s.id}` === d.sourceRef)
    )
      problem(
        "DOCUMENT.SOURCE_REF",
        `/selection/documents/${i}/sourceRef`,
        "Selected source is absent from this history"
      );
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, b]) => [ref, Uint8Array.from(b)])
  );
  const current = new Set(validation.currentClaimRefs);
  for (const [i, d] of chosen.documents.entries()) {
    const sourceIndex = history.observation.sources.findIndex(
        (s) => `source:${s.id}` === d.sourceRef
      ),
      source = history.observation.sources[sourceIndex]!,
      path = `/observation/sources/${sourceIndex}`;
    const row: ReleasedDocumentReport = {
      sourceRef: d.sourceRef,
      status: "not_checked",
      requirements: RELEASED_DOCUMENT_REQUIREMENTS.map((r) => ({
        ...r,
        status: "not_checked",
        reason: "Prerequisites not checked yet",
        blockedBy: [],
        issues: [],
      })),
      extractionRefs: [],
      asset: { status: "not_checked" },
    };
    result.documents.push(row);
    const requirement = (id: ReleasedDocumentRequirementId) =>
      row.requirements.find((r) => r.id === id)!;
    const pass = (id: ReleasedDocumentRequirementId, reason: string) => {
      const r = requirement(id);
      r.status = "satisfied";
      r.reason = reason;
    };
    const gap = (
      id: ReleasedDocumentRequirementId,
      status: ReleasedDocumentCompletionStatus,
      code: string,
      pointer: string,
      message: string,
      nextAction: string,
      stage: ReleasedDocumentIssue["stage"] = "profile",
      severity: ReleasedDocumentIssue["severity"] = "error"
    ) => {
      const r = requirement(id);
      r.status = status;
      r.reason = message;
      const issue = { code, pointer, message, nextAction, stage, severity };
      r.issues.push(issue);
      result.issues.push(issue);
    };
    if (source.kind !== "document" || source.access !== "public") {
      gap(
        "document_source",
        (source.kind !== "document" && source.kind !== "unknown") ||
          (source.access !== "public" && source.access !== "unknown")
          ? "failed"
          : "missing",
        "DOCUMENT.SOURCE_KIND_ACCESS",
        path,
        "This selected profile requires a declared public document source.",
        "Check source kind and access against the source record. Retain restrictions and unknown states; do not relabel a source to pass."
      );
      for (const r of row.requirements)
        if (r.id !== "document_source") {
          r.blockedBy = ["document_source"];
          r.reason =
            "Selected source does not yet establish the declared applicability of this profile.";
        }
      row.status = "failed";
      continue;
    }
    pass(
      "document_source",
      "The record declares a public document; this is not verification of release authenticity or rights."
    );
    if (d.release.state === "known")
      pass(
        "release_citation",
        "A release attribution and reference are declared; their truth is not independently verified."
      );
    else
      gap(
        "release_citation",
        "missing",
        "DOCUMENT.RELEASE_CITATION",
        `/selection/documents/${i}/release`,
        "Release attribution/reference is explicitly unknown.",
        "Obtain the release authority or publisher and its citation from the source record; preserve unknown status until available."
      );
    if (source.digest) {
      pass("content_digest", "SHA-256 is declared on the selected source.");
      row.asset.expectedSha256 = source.digest.value;
    } else
      gap(
        "content_digest",
        "missing",
        "DOCUMENT.DIGEST_REQUIRED",
        path + "/digest",
        "The selected document has no SHA-256 pin.",
        "Compute a digest from the exact preserved source bytes and record their provenance; do not invent a pin."
      );
    if (!source.digest) {
      const r = requirement("content_integrity");
      r.blockedBy = ["content_digest"];
      r.reason = "A declared source digest is required before byte comparison.";
    } else {
      const bytes = assets.get(d.sourceRef);
      if (!bytes)
        gap(
          "content_integrity",
          "missing",
          "DOCUMENT.BYTES_UNAVAILABLE",
          path,
          "Exact local document bytes are unavailable.",
          "Supply the original document bytes locally under the selected source reference. URLs are not fetched.",
          "external",
          "warning"
        );
      else {
        row.asset.byteLength = bytes.length;
        if (!bytes.length) {
          row.asset.status = "failed";
          gap(
            "content_integrity",
            "failed",
            "DOCUMENT.EMPTY_BYTES",
            path,
            "Empty bytes cannot supply this document.",
            "Obtain the nonempty source file; do not change the pin to accept an empty file.",
            "external"
          );
        } else
          try {
            const hash = await globalThis.crypto.subtle.digest(
              "SHA-256",
              bytes
            );
            row.asset.actualSha256 = [...new Uint8Array(hash)]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            if (row.asset.actualSha256 === source.digest.value) {
              row.asset.status = "passed";
              pass(
                "content_integrity",
                "The exact supplied nonempty bytes match the declared digest."
              );
            } else {
              row.asset.status = "failed";
              gap(
                "content_integrity",
                "failed",
                "DOCUMENT.DIGEST_MISMATCH",
                path,
                "Supplied bytes differ from the selected document pin.",
                "Resolve the source/version mismatch; do not replace the digest merely to pass.",
                "external"
              );
            }
          } catch {
            gap(
              "content_integrity",
              "not_checked",
              "DOCUMENT.HASH_UNAVAILABLE",
              path,
              "SHA-256 is unavailable.",
              "Rerun byte comparison in a runtime with SHA-256 support.",
              "external",
              "warning"
            );
          }
      }
    }
    const extractions = [
      ...history.claims.flatMap((c, index) =>
        c.kind === "source_assertion" &&
        current.has(`claim:${c.id}`) &&
        c.provenance.sourceRef === d.sourceRef
          ? [
              {
                ref: `claim:${c.id}`,
                provenance: c.provenance,
                pointer: `/claims/${index}/provenance`,
              },
            ]
          : []
      ),
      ...history.observation.assertions.flatMap((a, index) =>
        a.provenance.sourceRef === d.sourceRef
          ? [
              {
                ref: `assertion:${a.id}`,
                provenance: a.provenance,
                pointer: `/observation/assertions/${index}/provenance`,
              },
            ]
          : []
      ),
    ];
    row.extractionRefs = extractions.map((e) => e.ref);
    if (!extractions.length) {
      for (const id of [
        "extraction_traceability",
        "source_attribution",
      ] as const) {
        const r = requirement(id);
        r.status = "not_applicable";
        r.reason =
          "No current source statements or value assertions directly cite this selected document.";
      }
    } else {
      pass(
        "extraction_traceability",
        "Supplied direct extractions declare locators and extractor identities; passage content is unchecked."
      );
      pass(
        "source_attribution",
        "Supplied direct extractions declare source-side attribution."
      );
      for (const e of extractions) {
        if (!e.provenance.locator)
          gap(
            "extraction_traceability",
            "missing",
            "DOCUMENT.LOCATOR_REQUIRED",
            e.pointer + "/locator",
            "A direct extraction lacks a locator.",
            "Identify the actual source passage or value location; do not invent a page, pointer or time range."
          );
        if (!e.provenance.extractedBy)
          gap(
            "extraction_traceability",
            "missing",
            "DOCUMENT.EXTRACTOR_REQUIRED",
            e.pointer + "/extractedBy",
            "A direct extraction lacks an extractor identity.",
            "Record who or what actually made the extraction; do not attribute it to an assumed reviewer."
          );
        if (!e.provenance.attributedTo)
          gap(
            "source_attribution",
            "missing",
            "DOCUMENT.ATTRIBUTION_RECOMMENDED",
            e.pointer + "/attributedTo",
            "Source-side attribution is not supplied.",
            "Add source-side attribution when the document identifies it; preserve unknown authorship.",
            "recommendation",
            "warning"
          );
      }
    }
    for (const [id, value, field] of [
      ["source_title", source.title, "title"],
      ["source_uri", source.uri, "uri"],
    ] as const) {
      if (value)
        pass(
          id,
          "The source supplies this citation aid; correctness and availability are unchecked."
        );
      else
        gap(
          id,
          "missing",
          "DOCUMENT." + field.toUpperCase() + "_RECOMMENDED",
          path + "/" + field,
          "This non-blocking citation aid is absent.",
          "Add the " +
            field +
            " from the source record when available; do not fabricate metadata.",
          "recommendation",
          "warning"
        );
    }
    const required = row.requirements.filter(
      (r) => r.importance === "required"
    );
    row.status = required.some((r) =>
      r.issues.some((i) => i.severity === "error")
    )
      ? "failed"
      : required.some(
          (r) => r.status !== "satisfied" && r.status !== "not_applicable"
        )
      ? "not_checked"
      : "passed";
  }
  result.checks.external = result.documents.some(
    (r) => r.asset.status === "failed"
  )
    ? "failed"
    : result.documents.every((r) => r.asset.status === "passed")
    ? "passed"
    : "not_checked";
  result.checks.profile = result.documents.some((r) => r.status === "failed")
    ? "failed"
    : result.documents.every((r) => r.status === "passed")
    ? "passed"
    : "not_checked";
  result.success = result.checks.profile === "passed";
  return result;
}
