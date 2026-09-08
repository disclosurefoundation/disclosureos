import { createHash } from "node:crypto";
import {
  MigrationCompatibilitySchema,
  type MigrationCompatibility,
} from "@disclosureos/schema/experimental/v2";
import {
  parseAcquisitionContext,
  type AcquisitionContext,
} from "@disclosureos/instruments/experimental/v2";
import type { ParsedArgs } from "../utils/args";
import { readLocal } from "./packet";
import { reviewedJson } from "./migration-review";
import { buildMigrationReport } from "./migration-plan";
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
function unpack(blob: MigrationCompatibility["context"]) {
  const bytes = Buffer.from(blob.bytes, "base64");
  if (
    bytes.toString("base64") !== blob.bytes ||
    bytes.length !== blob.byteLength ||
    hash(bytes) !== blob.sha256
  )
    throw new Error(
      "Embedded artifact byte pin mismatch or noncanonical base64"
    );
  return bytes;
}
const fieldPolicy = (pointer: string) => {
  const root = pointer.split("/")[1];
  if (["temporal", "location"].includes(root ?? ""))
    return {
      disposition: "unresolved",
      reason:
        "Explicit time/frame review is available through migrate review; no sentinel or datum inference.",
    };
  if (root === "sensorEvidence")
    return {
      disposition: "unresolved",
      reason:
        "Sensor revision, acquisition, units and measurement provenance require explicit review; bare sensor labels and calibrated booleans are insufficient.",
    };
  if (
    [
      "observableAssessments",
      "origin",
      "investigation",
      "testimony",
      "physicalEvidence",
      "documents",
      "provenance",
      "media",
      "featuredMedia",
      "internalNotes",
      "extensions",
      "status",
      "schemaVersion",
      "identifiers",
      "dataSourceId",
      "description",
      "objectCharacteristics",
      "eventType",
      "sourceData",
      "movement",
      "witnesses",
      "responseImpact",
      "environment",
      "relations",
      "aviation",
    ].includes(root ?? "")
  )
    return {
      disposition: "retained_without_conversion",
      reason:
        "Retained in the original legacy envelope; no automatic v2 assertion, claim, measurement, publication or evaluation conversion is supported.",
    };
  return {
    disposition: "unresolved",
    reason:
      "No supported conversion for this field; original bytes remain authoritative.",
  };
};
export function compatibilityReport(
  source: Uint8Array,
  namespace: string,
  reviewBytes?: Uint8Array
) {
  reviewedJson(source);
  const base = buildMigrationReport(source, namespace);
  let plan: MigrationCompatibility | undefined;
  let context: ReturnType<typeof parseAcquisitionContext> | undefined;
  const decisions = new Map<
    string,
    MigrationCompatibility["decisions"][number]
  >();
  const rowsById = new Map<string | null, typeof base.records>();
  for (const row of base.records) {
    const group = rowsById.get(row.sourceId) ?? [];
    group.push(row);
    rowsById.set(row.sourceId, group);
  }
  if (reviewBytes) {
    plan = MigrationCompatibilitySchema.parse(reviewedJson(reviewBytes));
    if (
      plan.namespace !== namespace ||
      plan.source.sha256 !== base.source.sha256 ||
      plan.source.byteLength !== source.length
    )
      throw new Error("Sensor review namespace or source pin mismatch");
    context = parseAcquisitionContext(reviewedJson(unpack(plan.context)));
    if (!context.success)
      throw new Error(
        "Invalid acquisition context: " +
          context.issues.map((i) => i.message).join("; ")
      );
    for (const d of plan.decisions) {
      const key = JSON.stringify([d.sourceId, d.sensorPointer]);
      if (decisions.has(key))
        throw new Error("Duplicate sensor revision decision");
      const rows = rowsById.get(d.sourceId) ?? [];
      if (rows.length !== 1 || !rows[0]!.candidate)
        throw new Error("Sensor review requires a unique, valid legacy row");
      if (!rows[0]!.mapping.some((f) => f.pointer === d.sensorPointer))
        throw new Error("Unknown legacy sensor pointer");
      decisions.set(key, d);
    }
  }
  const acquisitions = new Map<
    string,
    AcquisitionContext["acquisitions"][number]
  >(
    context?.success
      ? context.data.acquisitions.map(
          (a) => [`acquisition:${a.id}`, a] as const
        )
      : []
  );
  const manifests = new Map<string, AcquisitionContext["manifests"][number]>(
    context?.success
      ? context.data.manifests.map((m) => [`manifest:${m.id}`, m] as const)
      : []
  );
  const records = base.records.map((row) => {
    const sensors = row.mapping
      .filter((f) =>
        /^\/sensorEvidence\/sensors\/(?:0|[1-9][0-9]*)\/sensorRef$/.test(
          f.pointer
        )
      )
      .map((f) => {
        const d = decisions.get(JSON.stringify([row.sourceId, f.pointer]));
        const unresolved = {
          sourcePointer: f.pointer,
          status: "unresolved" as const,
        };
        if (!d)
          return {
            ...unresolved,
            reason: "No explicit revision review supplied.",
          };
        try {
          if (!("data" in row.legacy))
            throw new Error("Legacy row data unavailable");
          const data = row.legacy.data as {
            sensorEvidence: { sensors: { sensorRef?: unknown }[] };
          };
          const sensor =
            data.sensorEvidence.sensors[Number(f.pointer.split("/")[3])];
          if (sensor?.sensorRef !== d.legacyRef)
            throw new Error("Declared legacy reference differs from source");
          const acquisition = acquisitions.get(d.acquisitionRef);
          if (!acquisition || acquisition.manifest.state !== "pinned")
            throw new Error(
              "Acquisition must explicitly pin a manifest; no automatic revision selection"
            );
          const manifestRef = acquisition.manifest.ref;
          const manifest = manifests.get(manifestRef);
          if (!manifest) throw new Error("Pinned manifest is unavailable");
          const manifestBytes = unpack(d.manifest);
          unpack(d.provenance);
          if (
            hash(manifestBytes) !== manifest.artifact.digest.value ||
            manifestBytes.length !== manifest.artifact.byteLength
          )
            throw new Error("Manifest bytes differ from acquisition revision");
          return {
            sourcePointer: f.pointer,
            status: "reviewed_revision_pin" as const,
            legacyRef: d.legacyRef,
            acquisitionRef: d.acquisitionRef,
            instrumentRef: acquisition.instrumentRef,
            manifestRef,
            manifestVersion: manifest.version,
            manifest: {
              sha256: d.manifest.sha256,
              byteLength: d.manifest.byteLength,
            },
            provenance: {
              sha256: d.provenance.sha256,
              byteLength: d.provenance.byteLength,
              locator: d.provenanceLocator,
            },
            rationale: d.rationale,
            associationSupport: "reviewer_declared_not_verified",
            calibration: "not_checked",
            measurementConversion: "not_performed",
          };
        } catch (error) {
          return {
            ...unresolved,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      });
    const fields = row.mapping.map((f) => ({
      pointer: f.pointer,
      ...(f.disposition === "mapped"
        ? { disposition: "mapped", target: f.target, reason: f.reason }
        : row.candidate
        ? fieldPolicy(f.pointer)
        : {
            disposition: "unresolved",
            reason: "Source row quarantined; no conversion supported.",
          }),
    }));
    return {
      sourcePointer: row.sourcePointer,
      sourceId: row.sourceId,
      rowStatus: row.decision,
      reasons: row.reasons,
      mappingComplete: row.mappingComplete,
      fields,
      sensors,
    };
  });
  const allFields = records.flatMap((r) => r.fields),
    sensors = records.flatMap((r) => r.sensors);
  return {
    kind: "legacy_migration_compatibility_report",
    schemaVersion: "0.1.0",
    policy: "legacy-migration-compatibility:0.1.0",
    namespace,
    source: base.source,
    ...(plan && reviewBytes
      ? {
          review: {
            sha256: hash(reviewBytes),
            byteLength: reviewBytes.length,
            encoding: "base64",
            bytes: Buffer.from(reviewBytes).toString("base64"),
            reviewedBy: plan.reviewedBy,
            reviewedAt: plan.reviewedAt,
            reviewerIdentity: "not_authenticated",
          },
        }
      : {}),
    records,
    counts: {
      input: records.length,
      candidates: base.counts.candidates,
      quarantined: base.counts.quarantined,
      fields: allFields.length,
      mapped: allFields.filter((f) => f.disposition === "mapped").length,
      retainedWithoutConversion: allFields.filter(
        (f) => f.disposition === "retained_without_conversion"
      ).length,
      unresolved: allFields.filter((f) => f.disposition === "unresolved")
        .length,
      sensorReferences: sensors.length,
      reviewedRevisionPins: sensors.filter(
        (s) => s.status === "reviewed_revision_pin"
      ).length,
      unresolvedSensorReferences: sensors.filter(
        (s) => s.status === "unresolved"
      ).length,
      indexImported: 0,
    },
    scientificValidity: "not_checked",
    applicationChanges: "none",
    scope: "compatibility_inventory_and_declared_revision_review",
  };
}
export function migrationCompatibility(args: ParsedArgs) {
  const usage =
    "migrate compatibility <legacy.json> [sensor-review.json] --id <namespace> [--json]";
  if (args.flags["help"]) {
    console.log(usage);
    return;
  }
  try {
    const namespace = args.flags["id"];
    if (
      ![1, 2].includes(args.positional.length) ||
      typeof namespace !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(namespace) ||
      Object.keys(args.flags).some((k) => !["id", "json"].includes(k))
    )
      throw new Error(usage);
    const report = compatibilityReport(
      readLocal(args.positional[0]!, 8 * 1024 * 1024),
      namespace,
      args.positional[1]
        ? readLocal(args.positional[1], 2 * 1024 * 1024)
        : undefined
    );
    if (args.flags["json"]) console.log(JSON.stringify(report, null, 2));
    else
      console.log(
        `Compatibility: ${report.counts.input} rows; ${report.counts.mapped} mapped fields, ${report.counts.retainedWithoutConversion} retained without conversion, ${report.counts.unresolved} unresolved.\nSensor references: ${report.counts.reviewedRevisionPins} reviewed pins, ${report.counts.unresolvedSensorReferences} unresolved. No application changes.`
      );
    if (
      report.counts.quarantined ||
      report.counts.unresolved ||
      report.counts.unresolvedSensorReferences
    )
      process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (args.flags["json"])
      console.log(
        JSON.stringify({
          success: false,
          stage: "migration_compatibility",
          error: message,
        })
      );
    else console.error(message);
    process.exitCode = 2;
  }
}
