import {
  researchEntityAssertions,
  type LaboratoryEntities,
  type ExperimentalObservation,
  type DocumentSnapshotRef,
  type ContextIssue,
} from "@disclosureos/records/experimental/v2";
import { PhysicalSampleSelectionSchema } from "./physical-samples";
type Problem = (
  code: string,
  pointer: string,
  message: string,
  stage?: ContextIssue["stage"],
) => void;
/** Resolve declarations against supplied snapshots and the scoped inventory. Never fetch report bytes or evaluate laboratory competence. */
export async function checkLaboratoryDependencies(
  entities: LaboratoryEntities,
  observation: ExperimentalObservation,
  historyId: string,
  pointer: string,
  load: (ref: DocumentSnapshotRef, pointer: string) => Promise<unknown>,
  problem: Problem,
) {
  const sources = new Map<
    string,
    | ExperimentalObservation["sources"][number]
    | ExperimentalObservation["products"][number]
  >([
    ...observation.sources.map((s) => [`source:${s.id}`, s] as const),
    ...observation.products.map((s) => [`product:${s.id}`, s] as const),
  ]);
  const measurements = new Map(observation.measurements.map((m) => [m.id, m]));
  const methods = new Map(
    observation.methods.map((m) => [`method:${m.id}`, m]),
  );
  const selections = new Map<
    string,
    ReturnType<typeof PhysicalSampleSelectionSchema.parse>
  >();
  const known = (
    e: LaboratoryEntities["entities"][number],
    field: string,
  ): unknown => {
    const values = researchEntityAssertions(e).filter((a) => a.field === field);
    return values.length === 1 && values[0]!.assertion.content.state === "known"
      ? values[0]!.assertion.content.value
      : undefined;
  };
  for (const [i, e] of entities.entities.entries()) {
    const p = `${pointer}/entities/${i}`;
    if (e.kind === "material" && e.selectionRef) {
      const ref = e.selectionRef;
      // Validate every explicit reference identity even if its digest was seen before.
      const raw = await load(ref.document, `${p}/selectionRef/document`);
      if (raw === undefined) continue;
      const parsed = PhysicalSampleSelectionSchema.safeParse(raw);
      if (!parsed.success) {
        problem(
          "MATERIAL.SELECTION_CONTRACT",
          p,
          "Selection does not satisfy its explicit contract.",
          "structural",
        );
        continue;
      }
      const selection = parsed.data;
      if (
        selection.observationId !== observation.id ||
        selection.historyId !== historyId
      )
        problem(
          "MATERIAL.SELECTION_SCOPE",
          p,
          "Selection must belong to this observation and history identity.",
        );
      if (
        new Set(selection.samples.map((s) => s.id)).size !==
        selection.samples.length
      )
        problem("REF.UNIQUE_ID", p, "Selection specimen identities repeat.");
      for (const sample of selection.samples) {
        const refs: string[] = [];
        if (sample.collection.state === "known")
          refs.push(sample.collection.recordRef);
        if (sample.currentCustodian.state === "known")
          refs.push(sample.currentCustodian.recordRef);
        if (sample.custody.state === "documented") {
          if (
            new Set(sample.custody.transfers.map((t) => t.id)).size !==
            sample.custody.transfers.length
          )
            problem(
              "REF.UNIQUE_ID",
              p,
              "Selected transfer identities repeat within a specimen.",
            );
          refs.push(...sample.custody.transfers.map((t) => t.recordRef));
        }
        for (const r of refs)
          if (!sources.has(r))
            problem(
              "REF.LOCAL_RESOLUTION",
              p,
              "Selection record is absent from the scoped observation inventory.",
            );
      }
      const sample = selection.samples.find((s) => s.id === ref.sampleId);
      if (!sample)
        problem(
          "MATERIAL.SELECTION_SAMPLE",
          p,
          "Selected specimen does not exist in the exact snapshot.",
        );
      else if (e.lineage.kind !== "unknown" && sample.lineage !== "unknown") {
        const preparationId =
          e.lineage.kind === "derived" ? e.lineage.preparationId : undefined;
        const preparation = entities.entities.find(
          (p) => p.kind === "material_preparation" && p.id === preparationId,
        );
        const expected =
          e.lineage.kind === "collected"
            ? "collected_specimen"
            : preparation?.kind === "material_preparation" &&
                preparation.operation === "mixture"
              ? "mixture"
              : "derived_sample";
        if (sample.lineage !== expected)
          problem(
            "MATERIAL.SELECTION_LINEAGE",
            p,
            "Known specimen lineage differs from the selected specimen declaration.",
          );
      }
      selections.set(ref.document.sha256, selection);
    }
    if (e.kind !== "laboratory_analysis" && e.kind !== "laboratory_result")
      continue;
    for (const a of e.fields.reportArtifacts ?? [])
      if ("value" in a.content)
        for (const ref of a.content.value) {
          const source = sources.get(ref.sourceRef);
          if (!source?.digest || source.digest.value !== ref.digest.value)
            problem(
              "LAB.REPORT_IDENTITY",
              p,
              "Report must name the same SHA-256 declaration as the scoped inventory; report bytes remain unchecked.",
            );
        }
    if (e.kind === "laboratory_analysis") {
      for (const a of e.fields.method ?? [])
        if ("value" in a.content) {
          const method = a.content.value;
          if (methods.get(method.methodRef)?.version !== method.methodVersion)
            problem(
              "METHOD.VERSION_MISMATCH",
              `${p}/fields/method`,
              "Laboratory method and version must match the observation inventory.",
            );
        }
    } else {
      for (const a of e.fields.result ?? [])
        if ("value" in a.content && a.content.value.kind === "quantitative") {
          const result = a.content.value,
            measurement = measurements.get(result.measurementId);
          if (!measurement) {
            problem(
              "REF.MEASUREMENT",
              `${p}/fields/result`,
              "Quantitative result must resolve to the scoped observation measurement.",
            );
            continue;
          }
          if (
            result.limit.state === "reported" &&
            result.limit.value.unit !== measurement.value.unit
          )
            problem(
              "UNIT.MISMATCH",
              `${p}/fields/result`,
              "Analytical threshold and measurement units must agree exactly; no conversion is inferred.",
            );
        }
    }
  }
  for (const [i, e] of entities.entities.entries()) {
    if (e.kind !== "material_custody_action" || !e.transferRef) continue;
    const p = `${pointer}/entities/${i}/transferRef`,
      ref = e.transferRef;
    const sample = selections
      .get(ref.document.sha256)
      ?.samples.find((s) => s.id === ref.sampleId);
    // The required selection is loaded by its material; unavailable or invalid snapshots already fail.
    if (!sample) continue;
    const transfers =
      sample.custody.state === "documented" ? sample.custody.transfers : [];
    const index = transfers.findIndex((t) => t.id === ref.transferId),
      transfer = transfers[index];
    if (!transfer) {
      problem(
        "MATERIAL.SELECTION_TRANSFER",
        p,
        "Transfer is absent from the selected specimen's declared custody.",
      );
      continue;
    }
    for (const field of ["from", "to"] as const) {
      const declaration = known(e, field);
      if (typeof declaration === "string" && declaration !== transfer[field])
        problem(
          "MATERIAL.TRANSFER_PARTY",
          p,
          "An unambiguous transfer party differs from the selected transfer declaration.",
        );
    }
    if (e.predecessor.kind === "start" && index !== 0)
      problem(
        "MATERIAL.TRANSFER_ORDER",
        p,
        "A selected later transfer cannot be described as the start of its chain.",
      );
    if (e.predecessor.kind === "action") {
      const predecessorId = e.predecessor.id;
      const prior = entities.entities.find(
        (p) => p.kind === "material_custody_action" && p.id === predecessorId,
      );
      if (
        prior?.kind === "material_custody_action" &&
        prior.transferRef?.document.sha256 === ref.document.sha256 &&
        transfers[index - 1]?.id !== prior.transferRef.transferId
      )
        problem(
          "MATERIAL.TRANSFER_ORDER",
          p,
          "Selected predecessor order must agree with the existing specimen transfer sequence.",
        );
    }
  }
}
