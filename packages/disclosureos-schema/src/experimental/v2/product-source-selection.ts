import { z } from "zod";
import {
  parseExperimentalObservation,
  compareUtcInstants,
} from "@disclosureos/records/experimental/v2";
import {
  readProductSourceSelection,
  sourceElementBytes,
} from "./product-source-reader";
import type { ProductSourceRead } from "./product-source-reader";
const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = integer.min(1);
const rational = z.strictObject({ numerator: positive, denominator: positive });
const digest = z.strictObject({
  algorithm: z.literal("sha256"),
  value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
});
const axis = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("index"),
    name: id,
    length: positive,
    firstIndex: integer,
  }),
  z.strictObject({
    kind: z.literal("regular"),
    name: id,
    length: positive,
    origin: z.number(),
    step: z.number().positive(),
    unit: text,
  }),
  z.strictObject({
    kind: z.literal("time"),
    name: id,
    length: positive,
    start: text,
    stepSeconds: rational,
  }),
]);
const common = {
  id,
  productRef: ref("product"),
  digest,
  byteLength: positive,
  mediaType: text,
};
export const ProductSourceLayoutSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("binary_array"),
    elementType: z.enum(["float32", "float64", "int16", "uint16", "uint8"]),
    byteOrder: z.enum(["little", "big"]),
    order: z.literal("row_major"),
    byteOffset: integer,
    axes: z.array(axis).min(1).max(8),
    quantity: text,
    unit: text,
  }),
  z.strictObject({
    ...common,
    kind: z.literal("csv_table"),
    encoding: z.literal("utf-8"),
    delimiter: z.literal(","),
    header: z.literal(true),
    rowCount: positive,
    columns: z.array(text).min(1),
    partition: z.strictObject({ column: text, equals: text }).optional(),
    sample: z
      .strictObject({
        valueColumn: text,
        unitColumn: text,
        quantityColumn: text,
        timeColumn: text,
      })
      .optional(),
  }),
  z.strictObject({
    ...common,
    kind: z.literal("video"),
    frameCount: positive,
    framesPerSecond: rational,
    start: text,
  }),
]);
export const ProductSourceSelectorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("array_element"),
    indices: z.array(integer).min(1).max(8),
  }),
  z.strictObject({ kind: z.literal("table_row"), row: integer }),
  z.strictObject({ kind: z.literal("video_frame"), frame: integer }),
]);
export const PRODUCT_SOURCE_SELECTION_SCHEMA_ID =
  "urn:disclosureos:experimental:product-source-selection:0.1.0";
export const PRODUCT_SOURCE_SELECTION_PROFILE = Object.freeze({
  id: "urn:disclosureos:experimental:profile:product-source-selection",
  version: "0.1.0",
  scope: "declared_layout_and_selected_source_content",
} as const);
export const ProductSourceSelectionSchema = z.strictObject({
  kind: z.literal("product_source_selection"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  layouts: z.array(ProductSourceLayoutSchema).min(1),
  selections: z
    .array(
      z.strictObject({
        id,
        layoutRef: ref("layout"),
        selector: ProductSourceSelectorSchema,
        measurementRef: ref("measurement").optional(),
      })
    )
    .min(1),
});
export type ProductSourceSelection = z.infer<
  typeof ProductSourceSelectionSchema
>;
export function productSourceSelectionJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ProductSourceSelectionSchema, {
      target: "draft-2020-12",
    }),
    $id: PRODUCT_SOURCE_SELECTION_SCHEMA_ID,
  };
}
type Status = "passed" | "failed" | "not_checked";
export interface ProductSourceSelectionIssue {
  code: string;
  stage: "structural" | "semantic" | "external";
  pointer: string;
  message: string;
}
export interface ProductSourceSelectionResult {
  success: boolean;
  profile: typeof PRODUCT_SOURCE_SELECTION_PROFILE;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    content: Status;
  };
  issues: ProductSourceSelectionIssue[];
  selections: {
    id: string;
    productRef: string;
    status: Status;
    content?: ProductSourceRead;
  }[];
  scientific: "not_checked";
  calibration: "not_checked";
  mediaDecoding: "not_checked";
}
export async function evaluateProductSourceSelection(
  observationInput: unknown,
  selectionInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<ProductSourceSelectionResult> {
  const observation = parseExperimentalObservation(observationInput),
    selection = ProductSourceSelectionSchema.safeParse(selectionInput);
  const result: ProductSourceSelectionResult = {
    success: false,
    profile: PRODUCT_SOURCE_SELECTION_PROFILE,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
      content: "not_checked",
    },
    issues: [],
    selections: [],
    scientific: "not_checked",
    calibration: "not_checked",
    mediaDecoding: "not_checked",
  };
  const issue = (
    code: string,
    stage: ProductSourceSelectionIssue["stage"],
    pointer: string,
    message: string
  ) => result.issues.push({ code, stage, pointer, message });
  if (!observation.success)
    for (const entry of observation.issues.filter(
      (i) => i.severity === "error"
    ))
      issue(
        entry.code,
        entry.stage === "structural" ? "structural" : "semantic",
        "/observation" + entry.pointer,
        entry.message
      );
  if (!selection.success)
    for (const entry of selection.error.issues)
      issue(
        "STRUCT.VALUE",
        "structural",
        "/selection/" + entry.path.join("/"),
        entry.message
      );
  if (observation.checks.structural === "failed" || !selection.success) {
    result.checks.structural = "failed";
    return result;
  }
  if (!observation.success) {
    result.checks.semantic = "failed";
    return result;
  }
  const data = selection.data,
    record = observation.data;
  if (data.observationId !== record.id)
    issue(
      "SELECTION.OBSERVATION",
      "semantic",
      "/selection/observationId",
      "Selection identifies a different observation."
    );
  const products = new Map(record.products.map((p) => [`product:${p.id}`, p]));
  const layouts = new Map<string, z.infer<typeof ProductSourceLayoutSchema>>(),
    productLayouts = new Set<string>(),
    selectionIds = new Set<string>();
  const validTime = (time: string) =>
    compareUtcInstants(time, time) !== undefined;
  for (const [i, layout] of data.layouts.entries()) {
    const pointer = `/selection/layouts/${i}`;
    if (
      layouts.has(`layout:${layout.id}`) ||
      productLayouts.has(layout.productRef)
    )
      issue(
        "SELECTION.UNIQUE",
        "semantic",
        pointer,
        "Layout IDs and product mappings must be unique."
      );
    layouts.set(`layout:${layout.id}`, layout);
    productLayouts.add(layout.productRef);
    const product = products.get(layout.productRef);
    if (
      !product ||
      product.digest?.value !== layout.digest.value ||
      product.format !== layout.mediaType
    )
      issue(
        "SELECTION.PRODUCT",
        "semantic",
        pointer,
        "Layout must pin an existing product digest and exact media type."
      );
    if (layout.kind === "binary_array") {
      let extent = sourceElementBytes[layout.elementType];
      const names = new Set<string>();
      let timeAxes = 0;
      for (const a of layout.axes) {
        extent *= a.length;
        if (names.has(a.name) || !Number.isSafeInteger(extent))
          issue(
            "SELECTION.AXIS",
            "semantic",
            pointer,
            "Unique axes and safe integer array extents are required."
          );
        names.add(a.name);
        if (
          a.kind === "index" &&
          !Number.isSafeInteger(a.firstIndex + a.length - 1)
        )
          issue(
            "SELECTION.AXIS",
            "semantic",
            pointer,
            "Index coordinate exceeds safe integer range."
          );
        if (
          a.kind === "regular" &&
          !Number.isFinite(a.origin + (a.length - 1) * a.step)
        )
          issue(
            "SELECTION.AXIS",
            "semantic",
            pointer,
            "Regular axis coordinate overflows."
          );
        if (a.kind === "time") {
          timeAxes++;
          if (
            !validTime(a.start) ||
            !Number.isSafeInteger((a.length - 1) * a.stepSeconds.numerator)
          )
            issue(
              "SELECTION.TIME",
              "semantic",
              pointer,
              "Time axis must have valid UTC origin and safe rational offsets."
            );
        }
      }
      if (
        timeAxes > 1 ||
        !Number.isSafeInteger(layout.byteOffset + extent) ||
        layout.byteOffset + extent !== layout.byteLength
      )
        issue(
          "SELECTION.EXTENT",
          "semantic",
          pointer,
          "Array extent plus leading offset must exactly cover the declared artifact; at most one time axis is allowed."
        );
    } else if (layout.kind === "csv_table") {
      if (
        new Set(layout.columns).size !== layout.columns.length ||
        (layout.partition &&
          !layout.columns.includes(layout.partition.column)) ||
        (layout.sample &&
          Object.values(layout.sample).some(
            (column) => !layout.columns.includes(column)
          ))
      )
        issue(
          "SELECTION.COLUMNS",
          "semantic",
          pointer,
          "CSV columns must be unique and include all selected fields."
        );
      if (layout.mediaType !== "text/csv")
        issue(
          "SELECTION.FORMAT",
          "semantic",
          pointer,
          "CSV layout requires text/csv."
        );
    } else if (
      !validTime(layout.start) ||
      !Number.isSafeInteger(
        layout.frameCount * layout.framesPerSecond.denominator
      ) ||
      !layout.mediaType.startsWith("video/")
    )
      issue(
        "SELECTION.VIDEO",
        "semantic",
        pointer,
        "Video requires a video media type, valid UTC origin and safe declared frame intervals."
      );
  }
  const measurements = new Map(
    record.measurements.map((m) => [`measurement:${m.id}`, m])
  );
  const processes = new Map(
    record.processing.map((p) => [`process:${p.id}`, p])
  );
  const supports = (refs: readonly string[], target: string): boolean => {
    const queue = [...refs],
      seen = new Set<string>();
    while (queue.length) {
      const ref = queue.pop()!;
      if (ref === target) return true;
      if (seen.has(ref)) continue;
      seen.add(ref);
      const p = products.get(ref);
      if (p?.kind === "derived")
        queue.push(...processes.get(p.generatedBy)!.inputRefs);
      const assertion = record.assertions.find(
        (a) => `assertion:${a.id}` === ref
      );
      if (assertion) queue.push(assertion.provenance.sourceRef);
    }
    return false;
  };
  for (const [i, item] of data.selections.entries()) {
    const pointer = `/selection/selections/${i}`,
      layout = layouts.get(item.layoutRef);
    if (selectionIds.has(item.id))
      issue(
        "SELECTION.UNIQUE",
        "semantic",
        pointer,
        "Selection IDs must be unique."
      );
    selectionIds.add(item.id);
    if (!layout) {
      issue("SELECTION.LAYOUT", "semantic", pointer, "Layout does not exist.");
      continue;
    }
    try {
      readProductSourceSelection(layout, item.selector);
    } catch (error) {
      issue("SELECTION.LOCATOR", "semantic", pointer, String(error));
    }
    if (item.measurementRef) {
      const measurement = measurements.get(item.measurementRef);
      if (
        !measurement ||
        !supports(measurement.sourceRefs, layout.productRef) ||
        layout.kind === "video" ||
        (layout.kind === "csv_table" && !layout.sample)
      )
        issue(
          "SELECTION.MEASUREMENT",
          "semantic",
          pointer,
          "Measurement requires scalar extraction from its primary product lineage."
        );
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  // Snapshot caller-owned assets before the first await; parsers cloned documents.
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, value]) => [
      ref,
      Uint8Array.from(value),
    ])
  );
  const verified = new Set<string>();
  for (const layout of data.layouts) {
    const value = assets.get(layout.productRef);
    if (!value) continue;
    if (value.byteLength !== layout.byteLength) {
      issue(
        "EXTERNAL.SIZE",
        "external",
        layout.productRef,
        "Artifact byte length differs."
      );
      continue;
    }
    const sha = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", value)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (sha !== layout.digest.value)
      issue(
        "EXTERNAL.DIGEST",
        "external",
        layout.productRef,
        "Artifact digest differs."
      );
    else verified.add(layout.productRef);
  }
  result.checks.external = result.issues.length
    ? "failed"
    : verified.size === data.layouts.length
    ? "passed"
    : "not_checked";
  for (const [i, item] of data.selections.entries()) {
    const layout = layouts.get(item.layoutRef)!;
    if (!verified.has(layout.productRef)) {
      result.selections.push({
        id: item.id,
        productRef: layout.productRef,
        status: assets.has(layout.productRef) ? "failed" : "not_checked",
      });
      continue;
    }
    try {
      const content = readProductSourceSelection(
        layout,
        item.selector,
        assets.get(layout.productRef)!
      );
      if (typeof content.time === "string" && !validTime(content.time))
        throw new Error("CSV sample time is not valid UTC");
      if (item.measurementRef) {
        const m = measurements.get(item.measurementRef)!;
        if (
          content.value !== m.value.value ||
          content.unit !== m.value.unit ||
          content.quantity !== m.quantity
        )
          throw new Error(
            "Selected source value, unit or quantity does not match the measurement"
          );
      }
      result.selections.push({
        id: item.id,
        productRef: layout.productRef,
        status: "passed",
        content,
      });
    } catch (error) {
      issue(
        "SELECTION.CONTENT",
        "external",
        `/selection/selections/${i}`,
        String(error)
      );
      result.selections.push({
        id: item.id,
        productRef: layout.productRef,
        status: "failed",
      });
    }
  }
  result.checks.content = result.selections.some((s) => s.status === "failed")
    ? "failed"
    : result.selections.every((s) => s.status === "passed")
    ? "passed"
    : "not_checked";
  result.success =
    result.checks.external === "passed" && result.checks.content === "passed";
  return result;
}
