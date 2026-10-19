/** Optional source mapping. MCAP owns its container and message encodings;
 * this document connects retained messages to DisclosureOS measurements. */
import { z } from "zod";
import { parseExperimentalObservation } from "@disclosureos/records/experimental/v2";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const text = z.string().min(1).regex(/\S/);
const digest = z.strictObject({
  algorithm: z.literal("sha256"),
  value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
});
// A decimal uint64, with the same exact bound in TypeScript and JSON Schema.
// Never coerce source offsets or nanosecond timestamps through a JS number.
const max64 = "18446744073709551615";
const belowMax = [...max64].flatMap((digit, i) => {
  const low = i === 0 ? 1 : 0,
    high = Number(digit) - 1;
  return high < low
    ? []
    : [`${max64.slice(0, i)}[${low}-${high}][0-9]{${19 - i}}`];
});
const uint64 = z
  .string()
  .regex(
    new RegExp(
      `^(?:0|[1-9][0-9]{0,18}|${belowMax.join("|")}|${max64})(?![\\s\\S])`
    )
  );
const uint16 = z.number().int().min(0).max(65535);
const uint32 = z.number().int().min(0).max(4294967295);
const schemaIdentity = z.union([
  z.strictObject({ id: z.literal(0) }),
  z.strictObject({
    id: uint16.min(1),
    name: z.string(),
    encoding: z.string(),
    digest,
  }),
]);
const location = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("file"), offset: uint64 }),
  z.strictObject({
    kind: z.literal("chunk"),
    chunkOffset: uint64,
    recordOffset: uint64,
  }),
]);
const message = z.strictObject({
  location,
  sequence: uint32,
  logTimeNs: uint64,
  publishTimeNs: uint64,
});
export const MCAP_SOURCE_MAPPING_SCHEMA_ID =
  "urn:disclosureos:experimental:mcap-source-mapping:0.1.0";
export const McapSourceMappingSchema = z.strictObject({
  kind: z.literal("mcap_source_mapping"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  recordings: z
    .array(
      z.strictObject({
        id,
        productRef: ref("product"),
        digest,
        byteLength: uint64,
        mediaType: z.literal("application/mcap"),
      })
    )
    .min(1),
  channels: z
    .array(
      z.strictObject({
        id,
        recordingRef: ref("recording"),
        channelId: uint16,
        topic: z.string(),
        messageEncoding: text,
        schema: schemaIdentity,
        decoder: z.strictObject({
          methodRef: ref("method"),
          methodVersion: text,
        }),
      })
    )
    .min(1),
  selections: z.array(
    z.strictObject({
      id,
      measurementRef: ref("measurement"),
      channelRef: ref("channel"),
      message,
      payloadPointer: z.string().regex(/^(?:\/(?:[^~]|~[01])*)?(?![\s\S])/),
    })
  ),
});
export type McapSourceMapping = z.infer<typeof McapSourceMappingSchema>;
export function mcapSourceMappingJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(McapSourceMappingSchema, { target: "draft-2020-12" }),
    $id: MCAP_SOURCE_MAPPING_SCHEMA_ID,
  };
}
export type McapResolvedMessage = {
  channelId: number;
  topic: string;
  messageEncoding: string;
  schema: McapSourceMapping["channels"][number]["schema"];
  message: McapSourceMapping["selections"][number]["message"];
  decoded: unknown;
};
/** A caller-supplied, trusted MCAP reader and versioned payload decoder. Locate
 * by byte location, never by time alone. No network access is performed here. */
export type McapMessageResolver = (request: {
  recording: McapSourceMapping["recordings"][number];
  channel: McapSourceMapping["channels"][number];
  message: McapSourceMapping["selections"][number]["message"];
  bytes: Uint8Array;
}) => McapResolvedMessage | Promise<McapResolvedMessage>;
type Status = "passed" | "failed" | "not_checked";
export type McapSourceMappingResult = {
  success: boolean;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    content: Status;
  };
  issues: { code: string; pointer: string; message: string }[];
  selections: { id: string; status: Status; value?: number }[];
  scientific: "not_checked";
  calibration: "not_checked";
  units: "not_checked";
};
const hash = async (bytes: Uint8Array) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every(
      (k) => Object.prototype.hasOwnProperty.call(y, k) && equal(x[k], y[k])
    )
  );
}
function scalarAt(value: unknown, pointer: string): number {
  for (const token of pointer === "" ? [] : pointer.slice(1).split("/")) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      !value ||
      typeof value !== "object" ||
      !Object.prototype.hasOwnProperty.call(value, key) ||
      (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key))
    )
      throw new Error("Payload pointer does not resolve.");
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Selected payload must be a finite numeric scalar.");
  return value;
}

export async function evaluateMcapSourceMapping(
  observationInput: unknown,
  mappingInput: unknown,
  options: {
    assets?: ReadonlyMap<string, Uint8Array>;
    resolveMessage?: McapMessageResolver;
  } = {}
): Promise<McapSourceMappingResult> {
  const observation = parseExperimentalObservation(observationInput),
    parsed = McapSourceMappingSchema.safeParse(mappingInput);
  const result: McapSourceMappingResult = {
    success: false,
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
    units: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  if (!parsed.success)
    for (const e of parsed.error.issues)
      issue("STRUCT.VALUE", "/mapping/" + e.path.join("/"), e.message);
  if (!observation.success)
    for (const e of observation.issues.filter((i) => i.severity === "error"))
      issue(e.code, "/observation" + e.pointer, e.message);
  if (!parsed.success || observation.checks.structural === "failed") {
    result.checks.structural = "failed";
    return result;
  }
  if (!observation.success) {
    result.checks.semantic = "failed";
    return result;
  }
  const data = parsed.data,
    record = observation.data;
  const products = new Map(record.products.map((p) => [`product:${p.id}`, p]));
  const assertions = new Map(
    record.assertions.map((a) => [`assertion:${a.id}`, a])
  );
  const processing = new Map(
    record.processing.map((p) => [`process:${p.id}`, p])
  );
  const measurements = new Map(
    record.measurements.map((m) => [`measurement:${m.id}`, m])
  );
  const methods = new Map(record.methods.map((m) => [`method:${m.id}`, m]));
  function supports(
    refs: string[],
    target: string,
    seen = new Set<string>()
  ): boolean {
    return refs.some((r) => {
      if (r === target) return true;
      if (seen.has(r)) return false;
      seen.add(r);
      const a = assertions.get(r),
        p = products.get(r);
      if (a) return supports([a.provenance.sourceRef], target, seen);
      if (p?.kind === "derived")
        return supports(
          processing.get(p.generatedBy)?.inputRefs ?? [],
          target,
          seen
        );
      return false;
    });
  }
  const recordings = new Map<string, McapSourceMapping["recordings"][number]>();
  const channels = new Map<string, McapSourceMapping["channels"][number]>();
  const schemaIds = new Map<
    string,
    McapSourceMapping["channels"][number]["schema"]
  >();
  const productIds = new Set<string>(),
    channelIds = new Set<string>(),
    selectionIds = new Set<string>(),
    measurementIds = new Set<string>();
  if (data.observationId !== record.id)
    issue(
      "MCAP.OBSERVATION",
      "/mapping/observationId",
      "Mapping identifies a different observation."
    );
  for (const [i, r] of data.recordings.entries()) {
    const p = `/mapping/recordings/${i}`,
      product = products.get(r.productRef);
    if (recordings.has(`recording:${r.id}`) || productIds.has(r.productRef))
      issue(
        "MCAP.UNIQUE",
        p,
        "Recording IDs and product mappings must be unique."
      );
    recordings.set(`recording:${r.id}`, r);
    productIds.add(r.productRef);
    if (
      !product ||
      product.format !== r.mediaType ||
      !equal(product.digest, r.digest) ||
      BigInt(r.byteLength) < 8n
    )
      issue(
        "MCAP.PRODUCT",
        p,
        "Recording must pin an existing MCAP product and its exact digest and length."
      );
  }
  for (const [i, c] of data.channels.entries()) {
    const p = `/mapping/channels/${i}`,
      key = `${c.recordingRef}/${c.channelId}`;
    if (channels.has(`channel:${c.id}`) || channelIds.has(key))
      issue(
        "MCAP.UNIQUE",
        p,
        "Channel IDs and recording/channel mappings must be unique."
      );
    channels.set(`channel:${c.id}`, c);
    channelIds.add(key);
    const schemaKey = `${c.recordingRef}/${c.schema.id}`;
    if (schemaIds.has(schemaKey) && !equal(schemaIds.get(schemaKey), c.schema))
      issue(
        "MCAP.SCHEMA",
        p,
        "A recording-local schema ID must retain one identity."
      );
    schemaIds.set(schemaKey, c.schema);
    if (!recordings.has(c.recordingRef))
      issue("MCAP.RECORDING", p, "Channel recording does not exist.");
    if (methods.get(c.decoder.methodRef)?.version !== c.decoder.methodVersion)
      issue(
        "MCAP.DECODER",
        p,
        "Decoder must name a declared method and exact version."
      );
  }
  for (const [i, s] of data.selections.entries()) {
    const p = `/mapping/selections/${i}`,
      c = channels.get(s.channelRef),
      r = c && recordings.get(c.recordingRef),
      m = measurements.get(s.measurementRef);
    if (selectionIds.has(s.id) || measurementIds.has(s.measurementRef))
      issue(
        "MCAP.UNIQUE",
        p,
        "Selection IDs and measurement mappings must be unique."
      );
    selectionIds.add(s.id);
    measurementIds.add(s.measurementRef);
    if (!c || !r) issue("MCAP.CHANNEL", p, "Selected channel does not exist.");
    else {
      if (!m || !supports(m.sourceRefs, r.productRef))
        issue(
          "MCAP.MEASUREMENT",
          p,
          "Selected recording must be in the measurement's source or processing lineage."
        );
      const l = s.message.location,
        outer = BigInt(l.kind === "file" ? l.offset : l.chunkOffset);
      if (outer < 8n || outer + 9n > BigInt(r.byteLength))
        issue("MCAP.LOCATION", p, "Record location is outside the recording.");
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  // Snapshot caller input before the first await. The trusted resolver must not
  // mutate these bytes; one snapshot is shared to avoid copying a recording per message.
  const assets = new Map(
    [...(options.assets ?? [])].map(([key, bytes]) => [
      key,
      Uint8Array.from(bytes),
    ])
  );
  const valid = new Set<string>();
  for (const r of data.recordings) {
    const bytes = assets.get(r.productRef);
    if (!bytes) continue;
    if (
      BigInt(bytes.length) !== BigInt(r.byteLength) ||
      (await hash(bytes)) !== r.digest.value
    )
      issue(
        "MCAP.ARTIFACT",
        r.productRef,
        "Source byte length or digest differs."
      );
    else valid.add(r.productRef);
  }
  result.checks.external = result.issues.length
    ? "failed"
    : valid.size === recordings.size
    ? "passed"
    : "not_checked";
  const cache = new Map<string, Promise<McapResolvedMessage>>();
  for (const [i, s] of data.selections.entries()) {
    const c = channels.get(s.channelRef)!,
      r = recordings.get(c.recordingRef)!;
    if (!valid.has(r.productRef) || !options.resolveMessage) {
      result.selections.push({
        id: s.id,
        status:
          valid.has(r.productRef) || !assets.has(r.productRef)
            ? "not_checked"
            : "failed",
      });
      continue;
    }
    try {
      // Cache by actual source location and decoder, not sequence or timestamp.
      const key = JSON.stringify([r.id, c.id, s.message.location]);
      if (!cache.has(key))
        cache.set(
          key,
          Promise.resolve(
            options.resolveMessage({
              recording: structuredClone(r),
              channel: structuredClone(c),
              message: structuredClone(s.message),
              bytes: assets.get(r.productRef)!,
            })
          ).then((v) => structuredClone(v))
        );
      const found = await cache.get(key)!;
      if (
        found.channelId !== c.channelId ||
        found.topic !== c.topic ||
        found.messageEncoding !== c.messageEncoding ||
        !equal(found.schema, c.schema) ||
        !equal(found.message, s.message)
      )
        throw new Error("Located message identity differs from the reference.");
      const value = scalarAt(found.decoded, s.payloadPointer);
      if (value !== measurements.get(s.measurementRef)!.value.value)
        throw new Error("Selected payload value differs from the measurement.");
      result.selections.push({ id: s.id, status: "passed", value });
    } catch (error) {
      issue("MCAP.CONTENT", `/mapping/selections/${i}`, String(error));
      result.selections.push({ id: s.id, status: "failed" });
    }
  }
  result.checks.content = result.selections.some((s) => s.status === "failed")
    ? "failed"
    : result.selections.length > 0 &&
      result.selections.every((s) => s.status === "passed")
    ? "passed"
    : "not_checked";
  result.success =
    result.checks.external === "passed" && result.checks.content === "passed";
  return result;
}
