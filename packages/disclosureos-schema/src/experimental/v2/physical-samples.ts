import { z } from "zod";
import { parseExperimentalClaimHistory } from "@disclosureos/records/experimental/v2";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const sourceRef = z
  .string()
  .regex(/^source:[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const unknown = z.strictObject({ state: z.literal("unknown"), reason: text });
export const PHYSICAL_SAMPLE_SELECTION_SCHEMA_ID =
  "urn:disclosureos:experimental:physical-sample-selection:0.1.0";
export const PHYSICAL_SAMPLE_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:physical-sample-provenance",
  version: "0.1.0",
  scope: "selected_collected_specimen_custody_declarations",
  maturity: "experimental",
} as const);
export const PhysicalSampleSelectionSchema = z.strictObject({
  kind: z.literal("physical_sample_selection"),
  schemaVersion: z.literal("0.1.0"),
  id,
  historyId: id,
  observationId: id,
  samples: z
    .array(
      z.strictObject({
        id,
        lineage: z.enum([
          "collected_specimen",
          "derived_sample",
          "mixture",
          "unknown",
        ]),
        label: z.discriminatedUnion("state", [
          z.strictObject({ state: z.literal("known"), value: text }),
          unknown,
        ]),
        collection: z.discriminatedUnion("state", [
          z.strictObject({
            state: z.literal("known"),
            collectedBy: text,
            recordRef: sourceRef,
          }),
          unknown,
        ]),
        custody: z.discriminatedUnion("state", [
          z.strictObject({
            state: z.literal("documented"),
            transfers: z.array(
              z.strictObject({ id, from: text, to: text, recordRef: sourceRef })
            ),
          }),
          unknown,
        ]),
        currentCustodian: z.discriminatedUnion("state", [
          z.strictObject({
            state: z.literal("known"),
            holder: text,
            recordRef: sourceRef,
          }),
          unknown,
        ]),
        catalogIdentifier: text.optional(),
      })
    )
    .min(1),
});
export type PhysicalSampleSelection = z.infer<
  typeof PhysicalSampleSelectionSchema
>;
export function physicalSampleSelectionJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(PhysicalSampleSelectionSchema, {
      target: "draft-2020-12",
    }),
    $id: PHYSICAL_SAMPLE_SELECTION_SCHEMA_ID,
  };
}
export const PHYSICAL_SAMPLE_REQUIREMENTS = Object.freeze(
  (
    [
      {
        id: "sample_scope",
        importance: "required",
        label: "Declared collected specimen",
      },
      {
        id: "sample_identity",
        importance: "required",
        label: "Recorded specimen label",
      },
      {
        id: "collection_record",
        importance: "required",
        label: "Attributed collection record",
      },
      {
        id: "custody_record",
        importance: "required",
        label: "Declared handoff continuity",
      },
      {
        id: "current_custodian",
        importance: "required",
        label: "Cited current custodian",
      },
      {
        id: "record_integrity",
        importance: "required",
        label: "Exact cited record bytes",
      },
      {
        id: "catalog_identifier",
        importance: "recommended",
        label: "External catalog identifier",
      },
    ] as const
  ).map((r) => Object.freeze(r))
);
export type PhysicalSampleRequirementId =
  (typeof PHYSICAL_SAMPLE_REQUIREMENTS)[number]["id"];
type Status = "passed" | "failed" | "not_checked";
export interface PhysicalSampleIssue {
  code: string;
  stage: "structural" | "semantic" | "profile" | "external" | "recommendation";
  severity: "error" | "warning";
  pointer: string;
  message: string;
  nextAction: string;
}
export interface PhysicalSampleRequirement {
  id: PhysicalSampleRequirementId;
  importance: "required" | "recommended";
  label: string;
  status: "satisfied" | "missing" | "failed" | "not_checked";
  reason: string;
  blockedBy: PhysicalSampleRequirementId[];
  issues: PhysicalSampleIssue[];
}
export interface PhysicalSampleRecordCheck {
  sourceRef: string;
  status: Status;
  expectedSha256?: string;
  actualSha256?: string;
  byteLength?: number;
}
export interface PhysicalSampleReport {
  sampleId: string;
  status: Status;
  requirements: PhysicalSampleRequirement[];
  records: PhysicalSampleRecordCheck[];
}
export interface PhysicalSampleResult {
  success: boolean;
  profile: typeof PHYSICAL_SAMPLE_PROFILE;
  selection: PhysicalSampleSelection | null;
  validation: ReturnType<typeof parseExperimentalClaimHistory>;
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  samples: PhysicalSampleReport[];
  issues: PhysicalSampleIssue[];
  specimenIdentity: "not_checked";
  collectionAuthenticity: "not_checked";
  custodyAuthenticity: "not_checked";
  custodyCompleteness: "not_checked";
  custodyChronology: "not_checked";
  recordContents: "not_checked";
  contaminationControl: "not_checked";
  composition: "not_checked";
  origin: "not_checked";
  redistributionRights: "not_checked";
  assessmentSupport: "not_checked";
  scientificEligibility: "not_checked";
}
function references(
  sample: PhysicalSampleSelection["samples"][number]
): string[] {
  return [
    ...new Set([
      ...(sample.collection.state === "known"
        ? [sample.collection.recordRef]
        : []),
      ...(sample.custody.state === "documented"
        ? sample.custody.transfers.map((t) => t.recordRef)
        : []),
      ...(sample.currentCustodian.state === "known"
        ? [sample.currentCustodian.recordRef]
        : []),
    ]),
  ];
}
/** Documentary declarations only; never establishes physical identity, custody truth or origin. */
export async function evaluatePhysicalSamples(
  historyInput: unknown,
  selectionInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<PhysicalSampleResult> {
  const validation = parseExperimentalClaimHistory(historyInput),
    parsed = PhysicalSampleSelectionSchema.safeParse(selectionInput);
  const result: PhysicalSampleResult = {
    success: false,
    profile: PHYSICAL_SAMPLE_PROFILE,
    selection: parsed.success ? parsed.data : null,
    validation,
    checks: {
      structural: validation.checks.structural,
      semantic: validation.checks.semantic,
      profile: "not_checked",
      external: "not_checked",
    },
    samples: [],
    issues: validation.issues.map((i) => ({
      ...i,
      nextAction:
        "Resolve the reported history inconsistency against the original records.",
    })),
    specimenIdentity: "not_checked",
    collectionAuthenticity: "not_checked",
    custodyAuthenticity: "not_checked",
    custodyCompleteness: "not_checked",
    custodyChronology: "not_checked",
    recordContents: "not_checked",
    contaminationControl: "not_checked",
    composition: "not_checked",
    origin: "not_checked",
    redistributionRights: "not_checked",
    assessmentSupport: "not_checked",
    scientificEligibility: "not_checked",
  };
  if (!parsed.success) {
    result.checks.structural = "failed";
    result.checks.semantic = "not_checked";
    for (const i of parsed.error.issues)
      result.issues.push({
        code: "SAMPLE.SELECTION",
        stage: "structural",
        severity: "error",
        pointer:
          "/selection/" +
          i.path
            .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
            .join("/"),
        message: i.message,
        nextAction:
          "Supply an explicit sample selection and retain unknown declarations with reasons.",
      });
    return result;
  }
  if (!validation.success) return result;
  const selection = parsed.data,
    history = validation.data;
  const problem = (code: string, pointer: string, message: string) =>
    result.issues.push({
      code,
      stage: "semantic",
      severity: "error",
      pointer,
      message,
      nextAction:
        "Resolve the selection against the exact history and source inventory; do not invent references.",
    });
  if (selection.historyId !== history.id)
    problem(
      "SAMPLE.HISTORY_ID",
      "/selection/historyId",
      "Selected history ID differs from supplied history."
    );
  if (selection.observationId !== history.observation.id)
    problem(
      "SAMPLE.OBSERVATION_ID",
      "/selection/observationId",
      "Selected observation ID differs from supplied history."
    );
  const sources = new Map(
    history.observation.sources.map((s) => [`source:${s.id}`, s])
  );
  const sampleIds = new Set<string>();
  for (const [i, s] of selection.samples.entries()) {
    const path = `/selection/samples/${i}`;
    if (sampleIds.has(s.id))
      problem(
        "SAMPLE.DUPLICATE",
        path + "/id",
        "Sample ID is selected more than once."
      );
    sampleIds.add(s.id);
    for (const ref of references(s))
      if (!sources.has(ref))
        problem(
          "SAMPLE.SOURCE_REF",
          path,
          `Cited record ${ref} is absent from this history.`
        );
    if (s.custody.state === "documented") {
      const ids = new Set<string>();
      for (const [j, t] of s.custody.transfers.entries()) {
        if (ids.has(t.id))
          problem(
            "SAMPLE.TRANSFER_ID",
            path + `/custody/transfers/${j}/id`,
            "Transfer ID is repeated within this sample."
          );
        ids.add(t.id);
      }
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, b]) => [ref, Uint8Array.from(b)])
  );
  for (const [i, s] of selection.samples.entries()) {
    const path = `/selection/samples/${i}`;
    const row: PhysicalSampleReport = {
      sampleId: s.id,
      status: "not_checked",
      requirements: PHYSICAL_SAMPLE_REQUIREMENTS.map((r) => ({
        ...r,
        status: "not_checked",
        reason: "Prerequisites have not been checked.",
        blockedBy: [],
        issues: [],
      })),
      records: [],
    };
    result.samples.push(row);
    const requirement = (id: PhysicalSampleRequirementId) =>
      row.requirements.find((r) => r.id === id)!;
    const pass = (id: PhysicalSampleRequirementId, reason: string) => {
      const r = requirement(id);
      r.status = "satisfied";
      r.reason = reason;
    };
    const gap = (
      id: PhysicalSampleRequirementId,
      status: PhysicalSampleRequirement["status"],
      code: string,
      pointer: string,
      message: string,
      nextAction: string,
      stage: PhysicalSampleIssue["stage"] = "profile",
      severity: PhysicalSampleIssue["severity"] = "error"
    ) => {
      const r = requirement(id);
      r.status = status;
      r.reason = message;
      const issue = { code, pointer, message, nextAction, stage, severity };
      r.issues.push(issue);
      result.issues.push(issue);
    };
    if (s.lineage !== "collected_specimen") {
      gap(
        "sample_scope",
        s.lineage === "unknown" ? "missing" : "failed",
        "SAMPLE.SCOPE",
        path + "/lineage",
        "This profile covers declared collected specimens only.",
        "Retain unknown, derived-sample or mixture lineage. A derivation/mixing profile is needed; do not relabel material to pass."
      );
      for (const r of row.requirements)
        if (r.id !== "sample_scope") {
          r.blockedBy = ["sample_scope"];
          r.reason = "The selected lineage is outside this profile or unknown.";
        }
      row.status = "failed";
      continue;
    }
    pass(
      "sample_scope",
      "A collected specimen is declared; its physical lineage is not authenticated."
    );
    if (s.label.state === "known")
      pass(
        "sample_identity",
        "A specimen label is declared; no physical object or global uniqueness is verified."
      );
    else
      gap(
        "sample_identity",
        "missing",
        "SAMPLE.LABEL",
        path + "/label",
        "The specimen label is unknown.",
        "Obtain the recorded specimen label or preserve its unknown state. Do not invent a physical identity."
      );
    if (s.collection.state === "known")
      pass(
        "collection_record",
        "A collector and source record are declared; collection contents and circumstances are unchecked."
      );
    else
      gap(
        "collection_record",
        "missing",
        "SAMPLE.COLLECTION",
        path + "/collection",
        "Collection attribution and its record are unknown.",
        "Obtain collection documentation and attribution from the actual records; retain gaps until available."
      );
    if (s.currentCustodian.state === "known")
      pass(
        "current_custodian",
        "A current custodian and source record are declared; actual possession is unchecked."
      );
    else
      gap(
        "current_custodian",
        "missing",
        "SAMPLE.CURRENT_CUSTODIAN",
        path + "/currentCustodian",
        "Current custodian and its supporting record are unknown.",
        "Obtain the current custody declaration with its source record; do not infer possession from an old handoff."
      );
    if (s.custody.state === "unknown")
      gap(
        "custody_record",
        "missing",
        "SAMPLE.CUSTODY",
        path + "/custody",
        "The handoff sequence is explicitly unknown.",
        "Obtain the recorded handoff sequence or retain unknown custody; an empty list must not stand for missing history."
      );
    else {
      // Local conflicts can be checked even when the collection or endpoint is unknown.
      let previous =
        s.collection.state === "known" ? s.collection.collectedBy : undefined;
      for (const [j, t] of s.custody.transfers.entries()) {
        if (t.from === t.to)
          gap(
            "custody_record",
            "failed",
            "SAMPLE.SELF_TRANSFER",
            path + `/custody/transfers/${j}`,
            "A declared handoff has the same sender and recipient.",
            "Resolve the handoff against the source record; an inventory check is not a custody transfer."
          );
        if (previous !== undefined && t.from !== previous)
          gap(
            "custody_record",
            "failed",
            "SAMPLE.CUSTODY_BREAK",
            path + `/custody/transfers/${j}/from`,
            "The handoff sender differs from the preceding declared holder.",
            "Reconcile the actual holder identifiers or document missing transfers. Do not fabricate a bridging handoff."
          );
        previous = t.to;
      }
      if (
        previous !== undefined &&
        s.currentCustodian.state === "known" &&
        previous !== s.currentCustodian.holder
      )
        gap(
          "custody_record",
          "failed",
          "SAMPLE.CUSTODY_ENDPOINT",
          path + "/currentCustodian/holder",
          "The declared current custodian differs from the final holder in the supplied sequence.",
          "Reconcile the endpoint against the source records; preserve missing custody history."
        );
      const r = requirement("custody_record");
      if (!r.issues.length) {
        if (
          s.collection.state !== "known" ||
          s.currentCustodian.state !== "known"
        ) {
          r.blockedBy = [
            ...(s.collection.state !== "known"
              ? ["collection_record" as const]
              : []),
            ...(s.currentCustodian.state !== "known"
              ? ["current_custodian" as const]
              : []),
          ];
          r.reason =
            "Collection and current-custodian declarations are needed to check both sequence endpoints.";
        } else
          pass(
            "custody_record",
            s.custody.transfers.length
              ? "Supplied handoff identifiers connect from collector to declared current custodian; completeness and chronology are unchecked."
              : "An explicit zero-handoff declaration retains the collector as current custodian; actual custody is unchecked."
          );
      }
    }
    const refs = references(s);
    if (!refs.length) {
      const r = requirement("record_integrity");
      r.blockedBy = ["collection_record", "current_custodian"];
      r.reason = "No collection, handoff or current-custody records are cited.";
    } else {
      for (const ref of refs) {
        const source = sources.get(ref)!,
          check: PhysicalSampleRecordCheck = {
            sourceRef: ref,
            status: "not_checked",
          };
        row.records.push(check);
        const pointer = `/observation/sources/${history.observation.sources.indexOf(
          source
        )}`;
        if (!source.digest) {
          gap(
            "record_integrity",
            "missing",
            "SAMPLE.DIGEST_REQUIRED",
            pointer + "/digest",
            "A cited record lacks a SHA-256 pin.",
            "Pin the exact preserved record bytes with their provenance; never hash the sample label as a substitute."
          );
          continue;
        }
        check.expectedSha256 = source.digest.value;
        const bytes = assets.get(ref);
        if (!bytes) {
          gap(
            "record_integrity",
            "missing",
            "SAMPLE.BYTES_UNAVAILABLE",
            pointer,
            "Exact cited record bytes are unavailable.",
            "Supply the cited record locally under its source reference, respecting access restrictions. URLs are not fetched.",
            "external",
            "warning"
          );
          continue;
        }
        check.byteLength = bytes.length;
        if (!bytes.length) {
          check.status = "failed";
          gap(
            "record_integrity",
            "failed",
            "SAMPLE.EMPTY_BYTES",
            pointer,
            "An empty file cannot supply this record.",
            "Obtain the nonempty original record; do not change its pin to accept empty bytes.",
            "external"
          );
          continue;
        }
        try {
          const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
          check.actualSha256 = [...new Uint8Array(hash)]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          if (check.actualSha256 === source.digest.value)
            check.status = "passed";
          else {
            check.status = "failed";
            gap(
              "record_integrity",
              "failed",
              "SAMPLE.DIGEST_MISMATCH",
              pointer,
              "Supplied record bytes differ from the declared digest.",
              "Resolve the source/version mismatch against preserved records; do not replace the pin merely to pass.",
              "external"
            );
          }
        } catch {
          gap(
            "record_integrity",
            "not_checked",
            "SAMPLE.HASH_UNAVAILABLE",
            pointer,
            "SHA-256 is unavailable.",
            "Rerun record-byte checks in a runtime with SHA-256 support.",
            "external",
            "warning"
          );
        }
      }
      const r = requirement("record_integrity");
      // Aggregate every cited record: a later warning must never hide an earlier failure.
      if (row.records.every((v) => v.status === "passed"))
        pass(
          "record_integrity",
          "All cited record bytes match their declared pins; the specimen and record contents remain unchecked."
        );
      else if (r.issues.some((v) => v.severity === "error"))
        r.status =
          r.issues.some((v) => v.code === "SAMPLE.DIGEST_REQUIRED") &&
          !row.records.some((v) => v.status === "failed")
            ? "missing"
            : "failed";
      else
        r.status = r.issues.some((v) => v.code === "SAMPLE.BYTES_UNAVAILABLE")
          ? "missing"
          : "not_checked";
      if (r.status !== "satisfied")
        r.reason = r.issues.some((i) => i.severity === "error")
          ? "At least one cited record lacks its pin or failed byte comparison; inspect all record diagnostics."
          : "At least one cited record could not be checked; inspect all record diagnostics.";
    }
    if (s.catalogIdentifier)
      pass(
        "catalog_identifier",
        "An external catalog identifier is declared; registration, resolution and uniqueness are unchecked."
      );
    else
      gap(
        "catalog_identifier",
        "missing",
        "SAMPLE.CATALOG_RECOMMENDED",
        path + "/catalogIdentifier",
        "An external catalog identifier is not supplied.",
        "Retain an existing catalog or persistent sample identifier when available. Do not invent registration.",
        "recommendation",
        "warning"
      );
    const required = row.requirements.filter(
      (r) => r.importance === "required"
    );
    row.status = required.some((r) =>
      r.issues.some((i) => i.severity === "error")
    )
      ? "failed"
      : required.every((r) => r.status === "satisfied")
      ? "passed"
      : "not_checked";
  }
  const records = result.samples.flatMap((s) => s.records);
  result.checks.external = records.some((r) => r.status === "failed")
    ? "failed"
    : result.samples.every(
        (s) =>
          s.records.length > 0 && s.records.every((r) => r.status === "passed")
      )
    ? "passed"
    : "not_checked";
  result.checks.profile = result.samples.some((s) => s.status === "failed")
    ? "failed"
    : result.samples.every((s) => s.status === "passed")
    ? "passed"
    : "not_checked";
  result.success = result.checks.profile === "passed";
  return result;
}
