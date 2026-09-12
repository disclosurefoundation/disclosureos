import {
  parseCaseLinks,
  parseCaseRecord,
  parseExperimentalObservation,
  parseObservationContext,
  parseResearchEntities,
  parseArchivalEntities,
  parseMaterialEntities,
  parseLaboratoryEntities,
  caseSnapshotKey,
  type DocumentSnapshotRef,
  type ContextIssue,
  type ExperimentalObservation,
} from "@disclosureos/records/experimental/v2";
import { evaluateCaseRecord, type CaseReviewOptions } from "./case-review";
import { SourceIntakeSchema, evaluateSourceIntake } from "./source-intake";

export interface CaseLinksReviewResult {
  success: boolean;
  issues: ContextIssue[];
  snapshots: Array<
    DocumentSnapshotRef & { status: "passed" | "failed" | "unavailable" }
  >;
  checks: {
    structural: "passed" | "failed";
    semantic: "passed" | "failed" | "not_checked";
    external: "passed" | "failed" | "not_checked";
    profile: "not_checked";
  };
  resolvedLinkIds: string[];
  supplements: Array<{
    linkId: string;
    uncheckedRefs: string[];
    referenceValidation: "not_checked";
  }>;
  integrityScope: "supplied_case_observation_and_linked_document_bytes";
  supplementReferenceValidation: "not_checked";
  sourceArtifactIntegrity: "not_checked";
  authorization: "not_checked";
  scientificInterpretation: "not_checked";
}
/** Association integrity only. Linked research documents retain their own full reference/profile checks. */
export async function evaluateCaseLinks(
  input: unknown,
  options: CaseReviewOptions,
): Promise<CaseLinksReviewResult> {
  const parsed = parseCaseLinks(input);
  const result: CaseLinksReviewResult = {
    success: false,
    issues: [...parsed.issues],
    snapshots: [],
    checks: { ...parsed.checks },
    resolvedLinkIds: [],
    supplements: [],
    integrityScope: "supplied_case_observation_and_linked_document_bytes",
    supplementReferenceValidation: "not_checked",
    sourceArtifactIntegrity: "not_checked",
    authorization: "not_checked",
    scientificInterpretation: "not_checked",
  };
  if (!parsed.success) return result;
  const data = parsed.data,
    copies = new Map<string, Uint8Array>();
  const copy = (hash: string) => {
    if (!copies.has(hash)) {
      const bytes = options.documents.get(hash);
      if (bytes) copies.set(hash, Uint8Array.from(bytes));
    }
  };
  copy(data.caseRef.sha256);
  data.links.forEach((l) =>
    copy(l.kind === "intake" ? l.document.sha256 : l.reference.document.sha256),
  );
  try {
    const bytes = copies.get(data.caseRef.sha256);
    if (bytes) {
      const peek = parseCaseRecord(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
      );
      if (peek.success)
        peek.data.observationRefs.forEach((r) => copy(r.sha256));
    }
  } catch {
    /* Verified loader reports malformed input. */
  }
  const problem = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, stage: "external", pointer, message });
  const snapshots = new Map<
    string,
    CaseLinksReviewResult["snapshots"][number]
  >();
  const loaded = new Map<string, unknown>();
  async function load(ref: DocumentSnapshotRef, p: string): Promise<unknown> {
    const key = caseSnapshotKey(ref);
    if (loaded.has(key)) return loaded.get(key);
    const snapshot = {
      ...ref,
      status: "failed" as "passed" | "failed" | "unavailable",
    };
    snapshots.set(key, snapshot);
    const bytes = copies.get(ref.sha256);
    if (!bytes) {
      snapshot.status = "unavailable";
      problem(
        "SNAPSHOT.UNAVAILABLE",
        p,
        "Required snapshot bytes were not supplied.",
      );
      return;
    }
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== ref.sha256) {
      problem(
        "SNAPSHOT.DIGEST",
        p,
        "Supplied bytes differ from the declared digest.",
      );
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      problem("SNAPSHOT.JSON", p, "Snapshot is not valid UTF-8 JSON.");
      return;
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      !("id" in raw) ||
      raw.id !== ref.documentId
    ) {
      problem(
        "SNAPSHOT.IDENTITY",
        p,
        "Document ID differs from the declared reference.",
      );
      return;
    }
    loaded.set(key, raw);
    return raw;
  }
  const finish = () => {
    result.snapshots = [...snapshots.values()];
    result.success = result.issues.length === 0;
    result.checks.external = result.success ? "passed" : "failed";
    result.resolvedLinkIds = result.success ? data.links.map((l) => l.id) : [];
    return result;
  };
  const rawCase = await load(data.caseRef, "/caseRef");
  if (rawCase === undefined) return finish();
  const owner = parseCaseRecord(rawCase);
  if (!owner.success) {
    problem(
      "SNAPSHOT.CONTRACT",
      "/caseRef",
      "Case snapshot does not satisfy its explicit contract and local semantics.",
    );
    return finish();
  }
  snapshots.get(caseSnapshotKey(data.caseRef))!.status = "passed";
  const checked = await evaluateCaseRecord(owner.data, { documents: copies });
  result.issues.push(
    ...checked.issues.map((i) => ({ ...i, pointer: "/caseRef" + i.pointer })),
  );
  const observations = new Map<string, ExperimentalObservation>();
  for (const s of checked.snapshots) {
    snapshots.set(caseSnapshotKey(s), s);
    if (s.status === "passed") {
      const o = parseExperimentalObservation(
        JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(
            copies.get(s.sha256)!,
          ),
        ),
      );
      if (o.success) observations.set(s.documentId, o.data);
    }
  }
  for (const [i, l] of data.links.entries()) {
    const p = `/links/${i}`,
      observationRef = owner.data.observationRefs.find(
        (r) => r.documentId === l.observationId,
      ),
      observation = observations.get(l.observationId);
    if (!observationRef) {
      problem(
        "CASE.OBSERVATION_SCOPE",
        p,
        "Link observation is outside the case snapshot.",
      );
      continue;
    }
    const prov = l.basis.provenance,
      sourceOwner = observations.get(prov.observationId);
    if (
      !owner.data.observationRefs.some(
        (r) => r.documentId === prov.observationId,
      )
    )
      problem(
        "CASE.OBSERVATION_SCOPE",
        `${p}/basis`,
        "Basis provenance is outside the case snapshot.",
      );
    else if (sourceOwner) {
      const [kind, id] = prov.sourceRef.split(":");
      const source = (
        kind === "source" ? sourceOwner.sources : sourceOwner.products
      ).find((s) => s.id === id);
      if (!source)
        problem(
          "CASE.SOURCE_SCOPE",
          `${p}/basis`,
          "Basis source does not resolve in the selected observation.",
        );
      else if (
        source.digest &&
        prov.sourceDigest &&
        source.digest.value !== prov.sourceDigest.value
      )
        problem(
          "SOURCE.DIGEST_MISMATCH",
          `${p}/basis`,
          "Declared source digests differ.",
        );
    }
    const ref = l.kind === "intake" ? l.document : l.reference.document,
      raw = await load(ref, p);
    if (raw === undefined) continue;
    if (l.kind === "intake") {
      const intake = SourceIntakeSchema.safeParse(raw);
      if (!intake.success) {
        problem(
          "SNAPSHOT.CONTRACT",
          p,
          "Intake snapshot does not satisfy its explicit contract.",
        );
        continue;
      }
      const validation = await evaluateSourceIntake(intake.data);
      const invalid = validation.issues.filter((i) => i.stage !== "external");
      if (invalid.length) {
        result.issues.push(
          ...invalid.map((i) => ({ ...i, pointer: p + i.pointer })),
        );
        continue;
      }
      snapshots.get(caseSnapshotKey(ref))!.status = "passed";
      for (const [j, a] of (l.artifactLinks ?? []).entries()) {
        const q = `${p}/artifactLinks/${j}`,
          artifact = intake.data.artifacts.find(
            (item) => item.id === a.artifactId,
          );
        if (!artifact) {
          problem(
            "INTAKE.ARTIFACT_RESOLUTION",
            q,
            "Receipt artifact identity does not resolve.",
          );
          continue;
        }
        if (!observation) continue;
        const [kind, id] = a.observationRef.split(":");
        const inventory = (
          kind === "source" ? observation.sources : observation.products
        ).find((item) => item.id === id);
        if (!inventory)
          problem(
            "CASE.INPUT_RESOLUTION",
            q,
            "Observation artifact reference does not resolve.",
          );
        else if (!inventory.digest)
          problem(
            "INTAKE.DIGEST_UNAVAILABLE",
            q,
            "Observation inventory needs a declared SHA-256 for this explicit artifact association.",
          );
        else if (inventory.digest.value !== artifact.sha256)
          problem(
            "INTAKE.DIGEST_MISMATCH",
            q,
            "Receipt and observation inventory declare different artifact bytes.",
          );
      }
      continue;
    }
    const supplement =
      l.kind === "context"
        ? parseObservationContext(raw)
        : ref.schemaId ===
            "urn:disclosureos:experimental:research-entities:0.1.0"
          ? parseResearchEntities(raw)
          : ref.schemaId ===
              "urn:disclosureos:experimental:research-entities:0.2.0"
            ? parseArchivalEntities(raw)
            : ref.schemaId ===
                "urn:disclosureos:experimental:research-entities:0.3.0"
              ? parseMaterialEntities(raw)
              : parseLaboratoryEntities(raw);
    if (!supplement.success) {
      problem(
        "SNAPSHOT.CONTRACT",
        p,
        "Supplement does not satisfy its explicit contract and local semantics.",
      );
      continue;
    }
    snapshots.get(caseSnapshotKey(ref))!.status = "passed";
    result.supplements.push({
      linkId: l.id,
      uncheckedRefs: [...supplement.uncheckedRefs],
      referenceValidation: "not_checked",
    });
    if (
      caseSnapshotKey(supplement.data.observationRef) !==
      caseSnapshotKey(observationRef)
    )
      problem(
        "CASE.SUPPLEMENT_SCOPE",
        p,
        "Supplement selects different observation bytes from the case scope.",
      );
    const target = l.reference.target;
    if (target) {
      const e = supplement.data.entities.find(
        (e) => e.id === target.id && e.kind === target.kind,
      );
      if (!e)
        problem(
          "CASE.ENTITY_RESOLUTION",
          p,
          "Supplement entity kind or identity does not resolve.",
        );
      else if (
        target.field &&
        !Object.prototype.hasOwnProperty.call(e.fields, target.field)
      )
        problem(
          "CASE.FIELD_RESOLUTION",
          p,
          "Selected field is not supplied on this entity.",
        );
    }
  }
  return finish();
}
