import {
  parseContextClaimHistory,
  parseObservationContext,
  parseExperimentalObservation,
  contextAssertions,
  type DocumentSnapshotRef,
  type ContextReference,
  type ContextIssue,
  type ObservationContext,
  type ExperimentalObservation,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";

export interface ContextReviewOptions {
  /** Exact UTF-8 document bytes keyed by SHA-256. Nothing is fetched or normalized. */
  documents: ReadonlyMap<string, Uint8Array>;
}
export interface ContextReviewResult {
  success: boolean;
  issues: ContextIssue[];
  snapshots: Array<
    DocumentSnapshotRef & { status: "passed" | "failed" | "unavailable" }
  >;
  checks: {
    structural: 'passed' | 'failed';
    semantic: 'passed' | 'failed' | 'not_checked';
    profile: 'not_checked';
    external: 'passed' | 'failed' | 'not_checked';
  };
  currentClaimRefs: string[];
  integrityScope: "supplied_context_observation_and_acquisition_snapshot_bytes";
  temporalNormalization: "not_checked";
  sourceArtifactIntegrity: "not_checked";
  scientificInterpretation: "not_checked";
  multiSensorFusion: "not_checked";
}
/** Closed C1 role table: no unit guessing, conversion or unrestricted quantity synonyms. */
export const CONTEXT_MEASUREMENT_ROLES = {
  size: {
    entities: ["reported_object"],
    quantities: ["size", "length"],
    units: ["m", "km"],
  },
  count: { entities: ["reported_object"], quantities: ["count"], units: ["1"] },
  speed: {
    entities: ["reported_object", "platform"],
    quantities: ["speed"],
    units: ["m/s", "km/h"],
  },
  altitude: {
    entities: ["reported_object", "platform", "place"],
    quantities: ["altitude", "elevation"],
    units: ["m", "km"],
  },
  heading: {
    entities: ["reported_object", "platform"],
    quantities: ["heading"],
    units: ["deg"],
  },
  ambient_temperature: {
    entities: ["environment"],
    quantities: ["temperature", "ambient_temperature"],
    units: ["Cel", "K"],
  },
  relative_humidity: {
    entities: ["environment"],
    quantities: ["relative_humidity"],
    units: ["%"],
  },
  wind_speed: {
    entities: ["environment"],
    quantities: ["wind_speed"],
    units: ["m/s", "km/h"],
  },
  moon_illumination: {
    entities: ["environment"],
    quantities: ["moon_illumination"],
    units: ["%", "1"],
  },
  duration: {
    entities: ["temporal", "collection"],
    quantities: ["duration"],
    units: ["s", "min", "h"],
  },
  distance: {
    entities: ["place"],
    quantities: ["distance"],
    units: ["m", "km"],
  },
  bearing: { entities: ["place"], quantities: ["bearing"], units: ["deg"] },
  water_depth: {
    entities: ["place"],
    quantities: ["water_depth"],
    units: ["m"],
  },
  coordinate_precision: {
    entities: ["place"],
    quantities: ["coordinate_precision"],
    units: ["m"],
  },
  time_alignment: {
    entities: ["collection"],
    quantities: ["time_alignment_uncertainty"],
    units: ["s", "ms"],
  },
} as const;
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => equal(v, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every(
      (k) => Object.prototype.hasOwnProperty.call(y, k) && equal(x[k], y[k]),
    )
  );
}
export async function evaluateContextClaimHistory(
  input: unknown,
  options: ContextReviewOptions,
): Promise<ContextReviewResult> {
  const history = parseContextClaimHistory(input);
  const issues: ContextIssue[] = history.issues.map((i) => ({
    code: i.code,
    stage: i.stage,
    pointer: i.pointer,
    message: i.message,
  }));
  const snapshots: ContextReviewResult["snapshots"] = [];
  const contexts = new Map<string, ObservationContext>();
  const problem = (
    code: string,
    pointer: string,
    message: string,
    stage: ContextIssue["stage"] = "semantic",
  ) => issues.push({ code, pointer, message, stage });
  async function load(
    ref: DocumentSnapshotRef,
    pointer: string,
  ): Promise<unknown> {
    const supplied = options.documents.get(ref.sha256);
    const bytes = supplied ? Uint8Array.from(supplied) : undefined;
    if (!bytes) {
      snapshots.push({ ...ref, status: "unavailable" });
      problem(
        "SNAPSHOT.UNAVAILABLE",
        pointer,
        "Required snapshot bytes were not supplied.",
        "external",
      );
      return;
    }
    if (
      [
        ...new Uint8Array(
          await globalThis.crypto.subtle.digest("SHA-256", bytes),
        ),
      ]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("") !== ref.sha256
    ) {
      snapshots.push({ ...ref, status: "failed" });
      problem(
        "SNAPSHOT.DIGEST",
        pointer,
        "Supplied bytes do not match the reference digest.",
        "external",
      );
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      snapshots.push({ ...ref, status: "failed" });
      problem(
        "SNAPSHOT.JSON",
        pointer,
        "Snapshot is not a UTF-8 JSON document.",
        "external",
      );
      return;
    }
    snapshots.push({ ...ref, status: "passed" });
    if (
      !value ||
      typeof value !== "object" ||
      (value as { id?: unknown }).id !== ref.documentId
    ) {
      problem(
        "SNAPSHOT.IDENTITY",
        pointer,
        "Snapshot document ID does not match its reference.",
      );
      return;
    }
    return value;
  }
  async function checkContext(
    context: ObservationContext,
    observation: ExperimentalObservation,
    p: string,
  ) {
    const sources = new Map<
      string,
      | ExperimentalObservation["sources"][number]
      | ExperimentalObservation["products"][number]
    >([
      ...observation.sources.map((s) => [`source:${s.id}`, s] as const),
      ...observation.products.map((s) => [`product:${s.id}`, s] as const),
    ]);
    const methods = new Map(
      observation.methods.map((m) => [`method:${m.id}`, m]),
    );
    const measurements = new Map(
      observation.measurements.map((m) => [m.id, m]),
    );
    let acquisitionIds: Set<string> | undefined;
    if (context.acquisitionRef) {
      const value = await load(context.acquisitionRef, `${p}/acquisitionRef`);
      if (value !== undefined) {
        const acquisition = parseAcquisitionContext(value);
        if (!acquisition.success)
          problem(
            "CONTEXT.ACQUISITION",
            `${p}/acquisitionRef`,
            "Acquisition snapshot does not satisfy its declared contract.",
            acquisition.checks.structural === "failed"
              ? "structural"
              : "semantic",
          );
        else
          acquisitionIds = new Set(
            acquisition.data.acquisitions.map((a) => a.id),
          );
      }
    }
    for (const [index, entity] of context.entities.entries()) {
      const ep = `${p}/entities/${index}`;
      for (const { field, assertion } of contextAssertions(entity)) {
        const prov = assertion.content.provenance;
        if (prov) {
          const source = sources.get(prov.sourceRef);
          if (!source)
            problem(
              "REF.LOCAL_RESOLUTION",
              ep,
              "Context source is absent from the scoped observation.",
            );
          else if (
            source.digest &&
            prov.sourceDigest &&
            source.digest.value !== prov.sourceDigest.value
          )
            problem(
              "SOURCE.DIGEST_MISMATCH",
              ep,
              "Source digest declarations differ.",
            );
        }
        const value = assertion.content.value;
        if (value === undefined) continue;
        if (field === "productRefs")
          for (const ref of value as string[])
            if (!sources.has(ref))
              problem(
                "REF.LOCAL_RESOLUTION",
                ep,
                "Collection artifact is not declared.",
              );
        if (field === "acquisitionIds")
          for (const id of value as string[])
            if (!acquisitionIds?.has(id))
              problem(
                "REF.ACQUISITION",
                ep,
                "Acquisition ID needs a supplied, valid acquisition snapshot.",
              );
        if (field === "position") {
          const checked = parseExperimentalObservation({
            ...observation,
            position: { state: "known", value, sourceRefs: [prov!.sourceRef] },
          });
          if (!checked.success)
            problem(
              "CONTEXT.POSITION",
              ep,
              "Context position must satisfy the observation frame, unit and source-reference rules.",
            );
        }
      }
      for (const selection of entity.selections ?? []) {
        if (
          methods.get(selection.methodRef)?.version !== selection.methodVersion
        )
          problem(
            "METHOD.VERSION_MISMATCH",
            ep,
            "Selection method/version must match the observation inventory.",
          );
      }
      const proximityLinks = contextAssertions(entity).flatMap(
        ({ field, assertion }) => {
          if (field !== "proximity" || !assertion.content.value) return [];
          const value = assertion.content.value as {
            targetPlaceId: string;
            distanceMeasurementId?: string;
            bearingMeasurementId?: string;
          };
          return [
            ...(value.distanceMeasurementId
              ? [
                  {
                    id: assertion.id,
                    role: "distance" as const,
                    measurementId: value.distanceMeasurementId,
                    relatedPlaceId: value.targetPlaceId,
                  },
                ]
              : []),
            ...(value.bearingMeasurementId
              ? [
                  {
                    id: assertion.id,
                    role: "bearing" as const,
                    measurementId: value.bearingMeasurementId,
                    relatedPlaceId: value.targetPlaceId,
                  },
                ]
              : []),
          ];
        },
      );
      for (const link of [...(entity.measurements ?? []), ...proximityLinks]) {
        const role = CONTEXT_MEASUREMENT_ROLES[link.role];
        const measurement = measurements.get(link.measurementId);
        if (!measurement) {
          problem(
            "REF.MEASUREMENT",
            ep,
            "Measurement is absent from the scoped observation.",
          );
          continue;
        }
        if (
          !(role.entities as readonly string[]).includes(entity.kind) ||
          !(role.quantities as readonly string[]).includes(
            measurement.quantity,
          ) ||
          !(role.units as readonly string[]).includes(measurement.value.unit)
        )
          problem(
            "CONTEXT.MEASUREMENT_ROLE",
            ep,
            "Measurement entity, quantity and unit must match the declared role.",
          );
        const value = measurement.value.value;
        if (
          [
            "count",
            "size",
            "speed",
            "wind_speed",
            "duration",
            "distance",
            "water_depth",
            "coordinate_precision",
            "time_alignment",
          ].includes(link.role) &&
          value < 0
        )
          problem(
            "CONTEXT.MEASUREMENT_RANGE",
            ep,
            "This role cannot be negative.",
          );
        if (link.role === "count" && !Number.isInteger(value))
          problem("CONTEXT.MEASUREMENT_RANGE", ep, "Count must be an integer.");
        if (
          ["heading", "bearing"].includes(link.role) &&
          (value < 0 || value > 360)
        )
          problem(
            "CONTEXT.MEASUREMENT_RANGE",
            ep,
            "Direction must lie between zero and 360 degrees.",
          );
        if (
          ["relative_humidity", "moon_illumination"].includes(link.role) &&
          (value < 0 || value > (measurement.value.unit === "1" ? 1 : 100))
        )
          problem(
            "CONTEXT.MEASUREMENT_RANGE",
            ep,
            "Fraction lies outside its unit range.",
          );
        if (["distance", "bearing"].includes(link.role) && !link.relatedPlaceId)
          problem(
            "CONTEXT.RELATED_PLACE",
            ep,
            "Distance and bearing must identify the other place.",
          );
      }
    }
  }
  if (history.success) {
    for (const [i, ref] of history.data.contextRefs.entries()) {
      const p = `/contextRefs/${i}`;
      const value = await load(ref, p);
      if (value === undefined) continue;
      const parsed = parseObservationContext(value);
      if (!parsed.success) {
        issues.push(
          ...parsed.issues.map((i) => ({ ...i, pointer: p + i.pointer })),
        );
        continue;
      }
      const context = parsed.data;
      const observationBytes = await load(
        context.observationRef,
        `${p}/observationRef`,
      );
      if (observationBytes === undefined) continue;
      const observation = parseExperimentalObservation(observationBytes);
      if (
        !observation.success ||
        !equal(observationBytes, history.data.observation)
      ) {
        problem(
          "CONTEXT.OBSERVATION_SCOPE",
          p,
          "Context must select the same complete observation snapshot as the history.",
          observation.checks.structural === "failed"
            ? "structural"
            : "semantic",
        );
        continue;
      }
      await checkContext(context, observation.data, p);
      contexts.set(ref.sha256, context);
    }
    function resolve(
      reference: ContextReference,
      pointer: string,
      assertionId?: string,
    ) {
      const context = contexts.get(reference.document.sha256);
      if (!context) return; // Missing/invalid required document was already reported.
      const entity = context.entities.find(
        (e) => e.kind === reference.target.kind && e.id === reference.target.id,
      );
      if (!entity) {
        problem(
          "REF.ENTITY",
          pointer,
          "Typed entity is absent from the selected snapshot.",
        );
        return;
      }
      const assertions = contextAssertions(entity);
      if (
        reference.target.field &&
        !assertions.some((a) => a.field === reference.target.field)
      )
        problem(
          "REF.FIELD",
          pointer,
          "Target field has no supplied assertions.",
        );
      if (
        assertionId &&
        (!reference.target.field ||
          !assertions.some(
            (a) =>
              a.field === reference.target.field &&
              a.assertion.id === assertionId,
          ))
      )
        problem(
          "REF.ASSERTION",
          pointer,
          "Assessment input must select an existing assertion on its named field.",
        );
    }
    for (const [i, claim] of history.data.claims.entries()) {
      if (claim.subject.kind === "context")
        resolve(claim.subject.reference, `/claims/${i}/subject`);
      if (claim.kind === "assessment")
        for (const [j, ref] of (claim.contextInputRefs ?? []).entries())
          resolve(ref, `/claims/${i}/contextInputRefs/${j}`, ref.assertionId);
    }
  }
  const external = snapshots.some((s) => s.status === "failed")
    ? "failed"
    : snapshots.some((s) => s.status === "unavailable") || !snapshots.length
      ? "not_checked"
      : "passed";
  return {
    success: history.success && issues.length === 0,
    issues,
    snapshots,
    checks: {
      structural: issues.some((i) => i.stage === "structural")
        ? "failed"
        : history.checks.structural,
      semantic:
        history.checks.structural === "failed" ||
        issues.some((i) => i.stage === "structural")
          ? "not_checked"
          : issues.some((i) => i.stage !== "external")
            ? "failed"
            : issues.length
              ? "not_checked"
              : "passed",
      profile: "not_checked",
      external,
    },
    currentClaimRefs:
      history.success && issues.length === 0 ? history.currentClaimRefs : [],
    integrityScope:
      "supplied_context_observation_and_acquisition_snapshot_bytes",
    temporalNormalization: "not_checked",
    sourceArtifactIntegrity: "not_checked",
    scientificInterpretation: "not_checked",
    multiSensorFusion: "not_checked",
  };
}
