import { z } from "zod";
import {
  compareUtcInstants,
  parseExperimentalClaimHistory,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import { AcquisitionBindingsSchema } from "./acquisition-bindings-schema";
import { evaluateAcquisitionBindings } from "./acquisition-bindings";
import type {
  AcquisitionBindingOptions,
  AcquisitionBindingResult,
} from "./acquisition-bindings";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
// Calendar validity and ordering are semantic rules, shared with the records UTC comparator.
const instant = z.string().min(1);
const time = z.union([
  z.strictObject({ state: z.literal("unknown"), reason: z.string().min(1) }),
  z.strictObject({
    state: z.literal("known"),
    kind: z.literal("instant"),
    value: instant,
    timeScale: z.literal("UTC"),
  }),
  z.strictObject({
    state: z.literal("known"),
    kind: z.literal("interval"),
    start: instant,
    end: instant,
    timeScale: z.literal("UTC"),
  }),
]);
export const MEASUREMENT_BINDINGS_SCHEMA_ID =
  "urn:disclosureos:experimental:measurement-bindings:0.1.0";
export const MEASUREMENT_BINDINGS_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:measurement-bindings",
  version: "0.1.0",
  scope: "single_channel_declared_capture",
} as const);
export const MeasurementBindingsSchema = z.strictObject({
  kind: z.literal("measurement_bindings"),
  schemaVersion: z.literal("0.1.0"),
  id,
  historyId: id,
  observationId: id,
  contextId: id,
  acquisitionBindingsId: id,
  measurements: z.array(
    z.strictObject({
      measurementRef: ref("measurement"),
      observationProductRef: ref("product"),
      channelId: id,
      time,
    })
  ),
  extensions: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+(?![\s\S])/),
      z.json()
    )
    .optional(),
});
export type MeasurementBindings = z.infer<typeof MeasurementBindingsSchema>;
export function measurementBindingsJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(MeasurementBindingsSchema, { target: "draft-2020-12" }),
    $id: MEASUREMENT_BINDINGS_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface MeasurementBindingIssue {
  code: string;
  stage: "structural" | "semantic" | "profile" | "external";
  severity: "error" | "warning";
  pointer: string;
  message: string;
}
export interface MeasurementBindingResult {
  success: boolean;
  profile: typeof MEASUREMENT_BINDINGS_PROFILE;
  contract: {
    schemaId: typeof MEASUREMENT_BINDINGS_SCHEMA_ID;
    rulesetVersion: "0.1.0";
  };
  checks: {
    structural: Status;
    semantic: Status;
    profile: Status;
    external: Status;
  };
  issues: MeasurementBindingIssue[];
  acquisition: AcquisitionBindingResult | null;
  scientific: "not_checked";
  clockUncertainty: "not_checked";
  artifactContents: "not_checked";
}
const pointer = (path: readonly PropertyKey[]) =>
  path
    .map((p) => `/${String(p).replace(/~/g, "~0").replace(/\//g, "~1")}`)
    .join("");

/** Checks declared single-channel support and nominal capture containment, then verifies local acquisition bytes. */
export async function evaluateMeasurementBindings(
  historyInput: unknown,
  contextInput: unknown,
  acquisitionBindingsInput: unknown,
  measurementBindingsInput: unknown,
  options: AcquisitionBindingOptions = {}
): Promise<MeasurementBindingResult> {
  const h = parseExperimentalClaimHistory(historyInput);
  const c = parseAcquisitionContext(contextInput);
  const a = AcquisitionBindingsSchema.safeParse(acquisitionBindingsInput);
  const m = MeasurementBindingsSchema.safeParse(measurementBindingsInput);
  const result: MeasurementBindingResult = {
    success: false,
    profile: MEASUREMENT_BINDINGS_PROFILE,
    contract: {
      schemaId: MEASUREMENT_BINDINGS_SCHEMA_ID,
      rulesetVersion: "0.1.0",
    },
    checks: {
      structural: "passed",
      semantic: "not_checked",
      profile: "not_checked",
      external: "not_checked",
    },
    issues: [],
    acquisition: null,
    scientific: "not_checked",
    clockUncertainty: "not_checked",
    artifactContents: "not_checked",
  };
  const issue = (
    code: string,
    path: string,
    message: string,
    stage: MeasurementBindingIssue["stage"] = "semantic"
  ) =>
    result.issues.push({
      code,
      stage,
      severity: "error",
      pointer: path,
      message,
    });
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
    !m.success
  ) {
    result.checks.structural = "failed";
    result.issues = result.issues.filter((i) => i.stage === "structural");
    return result;
  }
  if (!h.success || !c.success) {
    result.checks.semantic = "failed";
    return result;
  }
  const observation = h.data.observation;
  for (const [field, expected] of [
    ["historyId", h.data.id],
    ["observationId", observation.id],
    ["contextId", c.data.id],
    ["acquisitionBindingsId", a.data.id],
  ] as const)
    if (m.data[field] !== expected)
      issue(
        "MEASUREMENT.DOCUMENT_ID",
        `/measurements/${field}`,
        "Mapping identifies a different input document."
      );
  const products = new Map(
    observation.products.map((p) => [`product:${p.id}`, p])
  );
  const sources = new Map(
    observation.sources.map((s) => [`source:${s.id}`, s])
  );
  const assertions = new Map(
    observation.assertions.map((s) => [`assertion:${s.id}`, s])
  );
  const processes = new Map(
    observation.processing.map((p) => [`process:${p.id}`, p])
  );
  const measurements = new Map(
    observation.measurements.map((m) => [`measurement:${m.id}`, m])
  );
  const lineage = (refs: readonly string[]) => {
    const queue = [...refs],
      seen = new Set<string>(),
      raw = new Set<string>();
    let instrument = false;
    while (queue.length) {
      const ref = queue.pop()!;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const source = sources.get(ref);
      if (source?.kind === "instrument_data") instrument = true;
      const assertion = assertions.get(ref);
      if (assertion) queue.push(assertion.provenance.sourceRef);
      const product = products.get(ref);
      if (product?.kind === "raw") {
        raw.add(ref);
        queue.push(...product.sourceRefs);
      } else if (product?.kind === "derived")
        queue.push(...processes.get(product.generatedBy)!.inputRefs);
    }
    return { raw, instrument };
  };
  const seen = new Set<string>();
  for (const [i, binding] of m.data.measurements.entries()) {
    const path = `/measurements/measurements/${i}`;
    if (seen.has(binding.measurementRef))
      issue(
        "MEASUREMENT.DUPLICATE",
        `${path}/measurementRef`,
        "One channel mapping per measurement is allowed in this profile."
      );
    seen.add(binding.measurementRef);
    const measurement = measurements.get(binding.measurementRef);
    if (!measurement) {
      issue(
        "MEASUREMENT.REFERENCE",
        `${path}/measurementRef`,
        "Measurement does not exist."
      );
      continue;
    }
    const support = lineage(measurement.sourceRefs);
    if (!support.raw.has(binding.observationProductRef))
      issue(
        "MEASUREMENT.LINEAGE",
        `${path}/observationProductRef`,
        "Bound raw product must occur in primary measurement lineage; uncertainty and unused assertions do not supply support."
      );
    const instrumentRaw = [...support.raw].filter(
      (ref) => products.get(ref)?.kind === "raw" && lineage([ref]).instrument
    );
    if (instrumentRaw.length > 1)
      issue(
        "MEASUREMENT.MULTI_PRODUCT",
        path,
        "Multiple instrument raw products require a future explicit fusion profile."
      );
    const link = a.data.products.find(
      (p) => p.observationProductRef === binding.observationProductRef
    );
    const product =
      link &&
      c.data.products.find((p) => `product:${p.id}` === link.contextProductRef);
    const acquisition =
      product &&
      c.data.acquisitions.find(
        (p) => `acquisition:${p.id}` === product.acquisitionRef
      );
    if (
      products.get(binding.observationProductRef)?.kind !== "raw" ||
      !acquisition
    ) {
      issue(
        "MEASUREMENT.PRODUCT",
        `${path}/observationProductRef`,
        "Mapping requires an explicitly acquisition-bound raw product."
      );
      continue;
    }
    const pin = acquisition.manifest;
    const manifest =
      pin.state === "pinned"
        ? c.data.manifests.find((p) => `manifest:${p.id}` === pin.ref)
        : undefined;
    const channel = manifest?.channels.find((p) => p.id === binding.channelId);
    if (
      !channel ||
      !acquisition.channels.some((p) => p.channelId === binding.channelId)
    )
      issue(
        "MEASUREMENT.CHANNEL",
        `${path}/channelId`,
        "Channel must be declared by the pinned manifest and captured by this acquisition."
      );
    if (channel && channel.quantity !== measurement.quantity)
      issue(
        "MEASUREMENT.QUANTITY",
        path,
        "Measurement quantity must exactly match the channel; no derived-quantity conversion is inferred."
      );
    if (channel && channel.unit !== measurement.value.unit)
      issue(
        "MEASUREMENT.UNIT",
        path,
        "Measurement unit must exactly match the channel; no unit conversion is inferred."
      );
    const t = binding.time,
      capture = acquisition.time;
    if (t.state === "unknown") {
      issue(
        "MEASUREMENT.TIME_UNKNOWN",
        `${path}/time`,
        "Explicit measurement capture time is required for this profile.",
        "profile"
      );
      continue;
    }
    const start = t.kind === "instant" ? t.value : t.start,
      end = t.kind === "instant" ? t.value : t.end;
    if (
      compareUtcInstants(start, start) === undefined ||
      compareUtcInstants(end, end) === undefined
    ) {
      issue(
        "MEASUREMENT.TIME_INVALID",
        `${path}/time`,
        "Time must be a valid Gregorian UTC instant with seconds and an explicit offset."
      );
      continue;
    }
    if (t.kind === "interval" && compareUtcInstants(start, end) !== -1) {
      issue(
        "MEASUREMENT.TIME_ORDER",
        `${path}/time`,
        "Intervals are nonempty and half-open."
      );
      continue;
    }
    if (capture.state === "unknown") {
      issue(
        "MEASUREMENT.CAPTURE_UNKNOWN",
        path,
        "Acquisition capture time is unknown.",
        "profile"
      );
      continue;
    }
    const contained =
      capture.kind === "instant"
        ? t.kind === "instant" && compareUtcInstants(start, capture.value) === 0
        : compareUtcInstants(start, capture.start) !== -1 &&
          (t.kind === "instant"
            ? compareUtcInstants(end, capture.end) === -1
            : compareUtcInstants(end, capture.end) !== 1);
    if (!contained)
      issue(
        "MEASUREMENT.OUTSIDE_CAPTURE",
        `${path}/time`,
        "Measurement time must lie within its acquisition; interval ends are exclusive."
      );
  }
  let applicable = 0;
  for (const [ref, measurement] of measurements)
    if (lineage(measurement.sourceRefs).instrument) {
      applicable++;
      if (!seen.has(ref))
        issue(
          "MEASUREMENT.REQUIRED",
          "/measurements/measurements",
          `Instrument-supported ${ref} needs an explicit channel and capture-time mapping.`,
          "profile"
        );
    }
  result.checks.semantic = result.issues.some(
    (i) => i.stage === "semantic" && i.severity === "error"
  )
    ? "failed"
    : "passed";
  if (result.issues.some((i) => i.severity === "error")) {
    result.checks.profile = "failed";
    return result;
  }
  // All parsers clone synchronously; the nested evaluator snapshots bytes before its first await.
  const acquisition = await evaluateAcquisitionBindings(
    h.data,
    c.data,
    a.data,
    options
  );
  result.acquisition = acquisition;
  result.issues.push(...acquisition.issues);
  result.checks.structural = acquisition.checks.structural;
  result.checks.semantic = acquisition.checks.semantic;
  result.checks.external = acquisition.checks.external;
  result.checks.profile =
    acquisition.checks.structural === "failed" ||
    acquisition.checks.semantic === "failed"
      ? "not_checked"
      : acquisition.checks.profile;
  if (!applicable && result.checks.profile === "passed") {
    result.checks.profile = "not_checked";
    result.issues.push({
      code: "MEASUREMENT.NOT_APPLICABLE",
      stage: "profile",
      severity: "warning",
      pointer: "/history/observation/measurements",
      message: "No instrument-supported measurements are present.",
    });
  }
  result.success = result.checks.profile === "passed";
  return result;
}
