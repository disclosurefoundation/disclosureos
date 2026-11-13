/** Optional video source mapping. Containers and codecs remain external;
 * this contract addresses decoded presentation-order frames without UTC. */
import { z } from "zod";
import { parseExperimentalObservation } from "@disclosureos/records/experimental/v2";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const ref = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}:[A-Za-z0-9][A-Za-z0-9._-]*(?![\\s\\S])`));
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positive = integer.min(1);
// Decimal strings preserve signed PTS beyond JavaScript's integer precision.
// The bound limits untrusted arithmetic input; this is not a codec integer type.
const tick = z
  .string()
  .max(100)
  .regex(/^(?:0|-?[1-9][0-9]*)(?![\s\S])/);
const timeBase = z.strictObject({ numerator: positive, denominator: positive });
const stream = z.strictObject({
  streamIndex: integer,
  timeBase,
  presentationTicks: z.array(tick).min(1),
});
export const VIDEO_FRAME_SOURCE_MAPPING_SCHEMA_ID =
  "urn:disclosureos:experimental:video-frame-source-mapping:0.1.0";
export const VideoFrameSourceMappingSchema = z.strictObject({
  kind: z.literal("video_frame_source_mapping"),
  schemaVersion: z.literal("0.1.0"),
  id,
  observationId: id,
  productRef: ref("product"),
  digest: z.strictObject({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  }),
  byteLength: positive,
  mediaType: z.string().regex(/^video\/[^\s]+(?![\s\S])/),
  indexer: z.strictObject({
    methodRef: ref("method"),
    methodVersion: z.string().min(1).regex(/\S/),
  }),
  streams: z.array(stream).min(1),
  selections: z
    .array(z.strictObject({ id, streamIndex: integer, frameIndex: integer }))
    .min(1),
});
export type VideoFrameSourceMapping = z.infer<
  typeof VideoFrameSourceMappingSchema
>;
export function videoFrameSourceMappingJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(VideoFrameSourceMappingSchema, {
      target: "draft-2020-12",
    }),
    $id: VIDEO_FRAME_SOURCE_MAPPING_SCHEMA_ID,
  };
}
export type VideoPresentationStream =
  VideoFrameSourceMapping["streams"][number];
/** Trusted external decoder returns complete frame timing for the requested
 * stream indexes, in presentation order. No seeking by rounded seconds. */
export type VideoFrameIndexResolver = (request: {
  bytes: Uint8Array;
  streamIndexes: number[];
  indexer: VideoFrameSourceMapping["indexer"];
}) => VideoPresentationStream[] | Promise<VideoPresentationStream[]>;
export type VideoFrameReference = {
  productRef: string;
  digest: VideoFrameSourceMapping["digest"];
  streamIndex: number;
  frameIndex: number;
  presentationTick: string;
  timeBase: VideoPresentationStream["timeBase"];
  presentationSeconds: { numerator: string; denominator: string };
  offsetFromFirstFrameSeconds: { numerator: string; denominator: string };
};
/** Pure lookup after validation. The original timestamp is never rebased or
 * coerced through floating point; the relative offset is returned separately. */
export function readVideoFrameReference(
  mapping: VideoFrameSourceMapping,
  streamIndex: number,
  frameIndex: number
): VideoFrameReference {
  const s = mapping.streams.find((s) => s.streamIndex === streamIndex);
  if (
    !s ||
    !Number.isSafeInteger(frameIndex) ||
    frameIndex < 0 ||
    frameIndex >= s.presentationTicks.length
  )
    throw new Error(
      "Video stream or presentation-order frame is outside the index."
    );
  const pts = s.presentationTicks[frameIndex]!;
  const numerator = BigInt(s.timeBase.numerator),
    denominator = String(s.timeBase.denominator);
  return {
    productRef: mapping.productRef,
    digest: { ...mapping.digest },
    streamIndex,
    frameIndex,
    presentationTick: pts,
    timeBase: { ...s.timeBase },
    presentationSeconds: {
      numerator: String(BigInt(pts) * numerator),
      denominator,
    },
    offsetFromFirstFrameSeconds: {
      numerator: String(
        (BigInt(pts) - BigInt(s.presentationTicks[0]!)) * numerator
      ),
      denominator,
    },
  };
}
type Status = "passed" | "failed" | "not_checked";
export type VideoFrameSourceMappingResult = {
  success: boolean;
  checks: {
    structural: Status;
    semantic: Status;
    external: Status;
    frameTiming: Status;
  };
  issues: { code: string; pointer: string; message: string }[];
  selections: { id: string; status: Status; reference?: VideoFrameReference }[];
  captureTime: "not_checked";
  scientific: "not_checked";
  calibration: "not_checked";
  pixelContent: "not_checked";
};
export async function evaluateVideoFrameSourceMapping(
  observationInput: unknown,
  mappingInput: unknown,
  options: {
    assets?: ReadonlyMap<string, Uint8Array>;
    resolveFrameIndex?: VideoFrameIndexResolver;
  } = {}
): Promise<VideoFrameSourceMappingResult> {
  const observation = parseExperimentalObservation(observationInput),
    parsed = VideoFrameSourceMappingSchema.safeParse(mappingInput);
  const result: VideoFrameSourceMappingResult = {
    success: false,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
      frameTiming: "not_checked",
    },
    issues: [],
    selections: [],
    captureTime: "not_checked",
    scientific: "not_checked",
    calibration: "not_checked",
    pixelContent: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) => {
    result.issues.push({ code, pointer, message });
  };
  if (!parsed.success)
    for (const e of parsed.error.issues)
      issue("STRUCT.VALUE", "/mapping/" + e.path.join("/"), e.message);
  if (!observation.success)
    for (const e of observation.issues.filter((e) => e.severity === "error"))
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
  if (data.observationId !== record.id)
    issue(
      "VIDEO.OBSERVATION",
      "/mapping/observationId",
      "Mapping identifies a different observation."
    );
  const product = record.products.find(
    (p) => `product:${p.id}` === data.productRef
  );
  if (
    !product ||
    product.format !== data.mediaType ||
    product.digest?.algorithm !== data.digest.algorithm ||
    product.digest?.value !== data.digest.value
  )
    issue(
      "VIDEO.PRODUCT",
      "/mapping/productRef",
      "Mapping must pin an existing video product and its exact digest and media type."
    );
  const method = record.methods.find(
    (m) => `method:${m.id}` === data.indexer.methodRef
  );
  if (!method || method.version !== data.indexer.methodVersion)
    issue(
      "VIDEO.INDEXER",
      "/mapping/indexer",
      "Indexer must name a declared method and exact version."
    );
  const streamIds = new Set<number>(),
    selectionIds = new Set<string>();
  for (const [i, s] of data.streams.entries()) {
    if (streamIds.has(s.streamIndex))
      issue(
        "VIDEO.UNIQUE",
        `/mapping/streams/${i}`,
        "Stream indexes must be unique within this product."
      );
    streamIds.add(s.streamIndex);
    for (let j = 1; j < s.presentationTicks.length; j++)
      if (
        BigInt(s.presentationTicks[j]!) < BigInt(s.presentationTicks[j - 1]!)
      ) {
        issue(
          "VIDEO.ORDER",
          `/mapping/streams/${i}/presentationTicks/${j}`,
          "Frames must be in nondecreasing presentation order, not packet decode order."
        );
        break;
      }
  }
  for (const [i, s] of data.selections.entries()) {
    if (selectionIds.has(s.id))
      issue(
        "VIDEO.UNIQUE",
        `/mapping/selections/${i}`,
        "Selection IDs must be unique."
      );
    selectionIds.add(s.id);
    try {
      readVideoFrameReference(data, s.streamIndex, s.frameIndex);
    } catch (e) {
      issue("VIDEO.LOCATOR", `/mapping/selections/${i}`, String(e));
    }
  }
  if (result.issues.length) {
    result.checks.semantic = "failed";
    return result;
  }
  result.checks.semantic = "passed";
  // Zod cloned the documents. Snapshot the selected asset and resolver before await.
  const supplied = options.assets?.get(data.productRef),
    bytes = supplied && Uint8Array.from(supplied);
  const resolveFrameIndex = options.resolveFrameIndex;
  if (bytes) {
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    result.checks.external =
      bytes.length === data.byteLength && hash === data.digest.value
        ? "passed"
        : "failed";
    if (result.checks.external === "failed")
      issue(
        "VIDEO.ARTIFACT",
        data.productRef,
        "Original byte length or digest differs."
      );
    else if (resolveFrameIndex) {
      try {
        const decoded = z
          .array(stream)
          .min(1)
          .parse(
            await resolveFrameIndex({
              bytes,
              streamIndexes: data.streams.map((s) => s.streamIndex),
              indexer: { ...data.indexer },
            })
          );
        if (
          decoded.length !== data.streams.length ||
          new Set(decoded.map((s) => s.streamIndex)).size !== decoded.length
        )
          throw new Error("Decoded stream set differs.");
        for (const s of data.streams) {
          const found = decoded.find((d) => d.streamIndex === s.streamIndex);
          if (
            !found ||
            found.timeBase.numerator !== s.timeBase.numerator ||
            found.timeBase.denominator !== s.timeBase.denominator ||
            found.presentationTicks.length !== s.presentationTicks.length ||
            found.presentationTicks.some((t, i) => t !== s.presentationTicks[i])
          )
            throw new Error(
              "Decoded stream identity, time base or frame timestamps differ."
            );
        }
        result.checks.frameTiming = "passed";
      } catch (e) {
        result.checks.frameTiming = "failed";
        issue("VIDEO.FRAME_TIMING", "/mapping/streams", String(e));
      }
    }
  }
  const status =
    result.checks.external === "failed" ||
    result.checks.frameTiming === "failed"
      ? "failed"
      : result.checks.frameTiming === "passed"
      ? "passed"
      : "not_checked";
  for (const s of data.selections)
    result.selections.push({
      id: s.id,
      status,
      ...(status === "passed"
        ? {
            reference: readVideoFrameReference(
              data,
              s.streamIndex,
              s.frameIndex
            ),
          }
        : {}),
    });
  result.success =
    result.checks.external === "passed" &&
    result.checks.frameTiming === "passed";
  return result;
}
