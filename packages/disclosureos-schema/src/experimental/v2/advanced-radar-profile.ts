import {
  parseExperimentalObservation,
  compareUtcInstants,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ProductSourceSelectionSchema,
  evaluateProductSourceSelection,
} from "./product-source-selection";
import {
  SteeredRadarProfileSchema,
  SecondaryRadarProfileSchema,
  STEERED_RADAR_PROFILE,
  SECONDARY_RADAR_PROFILE,
  type SteeredRadarProfile,
  type SecondaryRadarProfile,
} from "./advanced-radar-profile-schema";
import {
  readSteeredRadarProducts,
  readSecondaryRadarProducts,
  type SteeredRadarDecodedProducts,
  type SecondaryRadarDecodedProducts,
} from "./advanced-radar-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";
export interface AdvancedRadarProfileIssue {
  code: string;
  pointer: string;
  message: string;
}
export interface AdvancedRadarProfileResult<P, D> {
  success: boolean;
  profile: typeof STEERED_RADAR_PROFILE | typeof SECONDARY_RADAR_PROFILE;
  issues: AdvancedRadarProfileIssue[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  trackingPerformance: "not_checked";
  identityVerification: "not_checked";
  data?: { declaration: P; layouts: ProductSourceLayout[]; products: D };
}
export type SteeredRadarProfileResult = AdvancedRadarProfileResult<
  SteeredRadarProfile,
  SteeredRadarDecodedProducts
>;
export type SecondaryRadarProfileResult = AdvancedRadarProfileResult<
  SecondaryRadarProfile,
  SecondaryRadarDecodedProducts
>;
const resultFor = <P, D>(
  profile: typeof STEERED_RADAR_PROFILE | typeof SECONDARY_RADAR_PROFILE
): AdvancedRadarProfileResult<P, D> => ({
  success: false,
  profile,
  issues: [],
  checks: {
    structure: "passed",
    sources: "not_checked",
    semantics: "not_checked",
  },
  scientific: "not_checked",
  physicalCalibration: "not_checked",
  trackingPerformance: "not_checked",
  identityVerification: "not_checked",
});
const near = (a: number, b: number) =>
  Math.abs(a - b) <=
  1e-6 + 32 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const powerNear = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const index = (n: number, length: number) =>
  Number.isSafeInteger(n) && n >= 0 && n < length;
const decimal = (value: string): { n: bigint; d: bigint } => {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value)!;
  const fraction = match[3] ?? "",
    exponent = Number(match[4] ?? 0) - fraction.length,
    coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  return exponent >= 0
    ? { n: coefficient * 10n ** BigInt(exponent), d: 1n }
    : { n: coefficient, d: 10n ** BigInt(-exponent) };
};
const epoch = (instant: string) => {
  const fraction = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/.exec(instant),
    whole = instant.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, ""),
    part = decimal(`0.${fraction?.[1] ?? "0"}`);
  return { n: BigInt(Date.parse(whole) / 1000) * part.d + part.n, d: part.d };
};
const compareOffset = (origin: string, seconds: number, boundary: string) => {
  const a = epoch(origin),
    offset = decimal(String(seconds)),
    b = epoch(boundary),
    delta = (a.n * offset.d + offset.n * a.d) * b.d - b.n * a.d * offset.d;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};
type Profile = SteeredRadarProfile | SecondaryRadarProfile;
async function prepare<P extends Profile, D>(
  profile: P,
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> },
  result: AdvancedRadarProfileResult<P, D>
) {
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  const observation = parseExperimentalObservation(observationInput),
    context = parseAcquisitionContext(contextInput),
    selection = ProductSourceSelectionSchema.safeParse(selectionInput);
  if (!observation.success || !context.success || !selection.success) {
    result.checks.structure = "failed";
    issue(
      "RADAR.PREREQUISITE",
      "/",
      "Observation, acquisition context and source selection must satisfy their contracts."
    );
    return;
  }
  const obs = observation.data,
    ctx = context.data,
    sources = selection.data;
  if (
    profile.observationId !== obs.id ||
    profile.contextId !== ctx.id ||
    profile.sourceSelectionId !== sources.id ||
    sources.observationId !== obs.id
  )
    issue(
      "RADAR.IDENTITY",
      "/",
      "Profile identifiers must select these exact documents."
    );
  const refs = Object.values(profile.products).filter(
    (r): r is string => r !== undefined
  );
  if (new Set(refs).size !== refs.length)
    issue(
      "RADAR.ROLE_ALIAS",
      "/products",
      "Every role requires a distinct retained product."
    );
  if (profile.products.truth && profile.dataOrigin !== "synthetic")
    issue(
      "RADAR.TRUTH_ORIGIN",
      "/products/truth",
      "Truth is only available for explicitly synthetic captures."
    );
  const frame = obs.frames.find((f) => `frame:${f.id}` === profile.frameRef);
  if (!frame || frame.kind !== "cartesian" || frame.unit !== "m")
    issue(
      "RADAR.FRAME",
      "/frameRef",
      "A declared Cartesian frame in meters is required."
    );
  const acquisition = ctx.acquisitions.find(
      (a) => `acquisition:${a.id}` === profile.acquisitionRef
    ),
    capture = ctx.products.find(
      (p) => `product:${p.id}` === profile.acquisitionProductRef
    );
  if (
    !acquisition ||
    !capture ||
    capture.acquisitionRef !== profile.acquisitionRef
  )
    issue(
      "RADAR.ACQUISITION",
      "/acquisitionProductRef",
      "Retained capture must belong to the selected acquisition."
    );
  const validOrigin =
    compareUtcInstants(profile.timeOrigin, profile.timeOrigin) !== undefined;
  if (!validOrigin)
    issue(
      "RADAR.TIME_ORIGIN",
      "/timeOrigin",
      "Time origin must be a valid UTC instant."
    );
  if (
    acquisition?.time.state !== "known" ||
    acquisition.time.kind !== "interval"
  )
    issue(
      "RADAR.ACQUISITION_TIME",
      "/acquisitionRef",
      "A known acquisition interval is required."
    );
  const within = (seconds: number) =>
    validOrigin &&
    Number.isFinite(seconds) &&
    seconds >= 0 &&
    acquisition?.time.state === "known" &&
    acquisition.time.kind === "interval" &&
    compareOffset(profile.timeOrigin, seconds, acquisition.time.start) >= 0 &&
    compareOffset(profile.timeOrigin, seconds, acquisition.time.end) <= 0;
  const layouts = new Map(sources.layouts.map((l) => [l.productRef, l]));
  for (const [role, ref] of Object.entries(profile.products))
    if (ref && !layouts.has(ref))
      issue(
        "RADAR.LAYOUT",
        `/products/${role}`,
        "Every profile role requires a source layout."
      );
  const captureRef =
      profile.kind === "steered_radar_profile"
        ? profile.products.returns
        : profile.products.decodedReplies,
    captureLayout = layouts.get(captureRef);
  if (
    capture &&
    captureLayout &&
    (capture.artifact.digest.value !== captureLayout.digest.value ||
      capture.artifact.byteLength !== captureLayout.byteLength ||
      capture.artifact.mediaType !== captureLayout.mediaType)
  )
    issue(
      "RADAR.CAPTURE_BINDING",
      "/acquisitionProductRef",
      "Acquisition capture and input layout must identify the same bytes."
    );
  const manifestRef =
      acquisition?.manifest.state === "pinned"
        ? acquisition.manifest.ref
        : undefined,
    manifest = ctx.manifests.find((m) => `manifest:${m.id}` === manifestRef),
    channel = manifest?.channels.find((c) => c.id === profile.channelId);
  const quantity =
    profile.kind === "steered_radar_profile"
      ? "normalized_return_power"
      : "decoded_reply";
  if (
    !acquisition?.channels.some((c) => c.channelId === profile.channelId) ||
    !channel ||
    channel.quantity !== quantity ||
    channel.unit !== "1"
  )
    issue(
      "RADAR.CHANNEL",
      "/channelId",
      "Capture channel must select the declared quantity and unit from its pinned manifest."
    );
  const products = new Map(obs.products.map((p) => [`product:${p.id}`, p])),
    processes = new Map(obs.processing.map((p) => [`process:${p.id}`, p]));
  if (products.get(captureRef)?.kind !== "raw")
    issue(
      "RADAR.CAPTURE_ORIGIN",
      "/products",
      "The input capture must be a retained raw product."
    );
  const ancestors = (ref: string) => {
    const found = new Set<string>(),
      queue = [ref];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      if (found.has(current)) continue;
      found.add(current);
      const p = products.get(current),
        process = processes.get(current);
      if (p?.kind === "derived") queue.push(p.generatedBy);
      if (p?.kind === "raw") queue.push(...p.sourceRefs);
      if (process) queue.push(...process.inputRefs);
    }
    return found;
  };
  const derived =
    profile.kind === "steered_radar_profile"
      ? (["thresholds", "detections", "tracks", "associations"] as const)
      : (["reports"] as const);
  const roleProducts = profile.products as Record<string, string | undefined>;
  for (const role of derived)
    if (products.get(roleProducts[role]!)?.kind !== "derived")
      issue(
        "RADAR.PROCESSING",
        `/products/${role}`,
        "Calculated products require explicit processing lineage."
      );
  const depend = (role: string, inputs: string[]) => {
    const all = ancestors(roleProducts[role]!);
    if (inputs.some((input) => !all.has(roleProducts[input]!)))
      issue(
        "RADAR.LINEAGE",
        `/products/${role}`,
        "Processing must declare every required retained input."
      );
  };
  if (profile.kind === "steered_radar_profile") {
    depend("thresholds", ["returns"]);
    depend("detections", ["returns", "thresholds", "beamSchedule"]);
    depend("tracks", ["detections"]);
    depend("associations", ["detections"]);
  } else depend("reports", ["decodedReplies", "interrogations"]);
  if (profile.products.truth) {
    const sourceRole =
      profile.kind === "steered_radar_profile"
        ? profile.products.beamSchedule
        : profile.products.interrogations;
    const shared = new Set([
      ...ancestors(captureRef),
      ...ancestors(sourceRole),
    ]);
    const sourceKinds = new Map(
      obs.sources.map((source) => [`source:${source.id}`, source.kind])
    );
    // Only shared source-level documents (for example methods or generator code) are
    // exempt. A raw product or instrument-data source does not become harmless
    // configuration merely because it also feeds the capture or schedule.
    const forbidden = [...ancestors(profile.products.truth)].filter(
      (ref) => !shared.has(ref) || sourceKinds.get(ref) !== "document"
    );
    if (
      [
        ...derived.map((role) => roleProducts[role]!),
        captureRef,
        sourceRole,
      ].some((ref) => forbidden.some((r) => ancestors(ref).has(r)))
    )
      issue(
        "RADAR.TRUTH_LEAK",
        "/products/truth",
        "Capture, schedule and processing lineage cannot consume the independent truth oracle."
      );
  }
  if (result.issues.length) {
    result.checks.semantics = "failed";
    return;
  }
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const checked = await evaluateProductSourceSelection(obs, sources, {
    assets,
  });
  if (
    !checked.success ||
    checked.checks.external !== "passed" ||
    checked.checks.content !== "passed"
  ) {
    result.checks.sources = "failed";
    issue(
      "RADAR.SOURCE_CONTENT",
      "/products",
      "All source layouts require matching pinned bytes, digests and valid selections."
    );
    return;
  }
  result.checks.sources = "passed";
  return { sources, assets, layouts, within, issue };
}
/** Validates retained sector-beam products. It does not certify antenna performance or operational capability. */
export async function evaluateSteeredRadarProfile(
  observation: unknown,
  context: unknown,
  selection: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<SteeredRadarProfileResult> {
  const result = resultFor<SteeredRadarProfile, SteeredRadarDecodedProducts>(
      STEERED_RADAR_PROFILE
    ),
    parsed = SteeredRadarProfileSchema.safeParse(profileInput);
  if (!parsed.success) {
    result.checks.structure = "failed";
    result.issues.push({
      code: "RADAR.PREREQUISITE",
      pointer: "/",
      message: "Steered radar declaration must satisfy its contract.",
    });
    return result;
  }
  const profile = parsed.data,
    p = await prepare(
      profile,
      observation,
      context,
      selection,
      options,
      result
    );
  if (!p) return result;
  const { issue, within } = p,
    returns = p.layouts.get(profile.products.returns),
    thresholds = p.layouts.get(profile.products.thresholds);
  if (
    !returns ||
    returns.kind !== "binary_array" ||
    !thresholds ||
    thresholds.kind !== "binary_array"
  ) {
    issue(
      "RADAR.ARRAY_LAYOUT",
      "/products",
      "Returns and thresholds require binary array layouts."
    );
    result.checks.semantics = "failed";
    return result;
  }
  const [dwellAxis, rangeAxis] = returns.axes;
  if (
    returns.axes.length !== 2 ||
    !dwellAxis ||
    dwellAxis.kind !== "index" ||
    dwellAxis.name !== "dwell" ||
    dwellAxis.firstIndex !== 0 ||
    !rangeAxis ||
    rangeAxis.kind !== "regular" ||
    rangeAxis.name !== "range" ||
    rangeAxis.unit !== "m" ||
    rangeAxis.origin < 0 ||
    rangeAxis.step <= 0
  )
    issue(
      "RADAR.AXES",
      "/products/returns",
      "Required axes are zero-based dwell and increasing nonnegative horizontal-range centers in meters."
    );
  for (const layout of [returns, thresholds])
    if (
      layout.elementType !== "float32" ||
      layout.byteOrder !== "little" ||
      layout.quantity !== "normalized_return_power" ||
      layout.unit !== "1"
    )
      issue(
        "RADAR.POWER_LAYOUT",
        "/products",
        "Arrays require little-endian float32 normalized return power with unit 1."
      );
  if (JSON.stringify(returns.axes) !== JSON.stringify(thresholds.axes))
    issue(
      "RADAR.THRESHOLD_AXES",
      "/products/thresholds",
      "Threshold axes must match returns exactly."
    );
  if (
    result.issues.length ||
    !dwellAxis ||
    dwellAxis.kind !== "index" ||
    !rangeAxis ||
    rangeAxis.kind !== "regular"
  ) {
    result.checks.semantics = "failed";
    return result;
  }
  let data: SteeredRadarDecodedProducts;
  try {
    data = readSteeredRadarProducts(
      p.sources.layouts,
      profile.products,
      p.assets
    );
  } catch (e) {
    issue(
      "RADAR.CONTENT",
      "/products",
      e instanceof Error ? e.message : String(e)
    );
    result.checks.semantics = "failed";
    return result;
  }
  const dwells = dwellAxis.length,
    ranges = rangeAxis.length;
  if (data.beamSchedule.length !== dwells)
    issue(
      "RADAR.DWELL_COUNT",
      "/products/beamSchedule",
      "One schedule row is required per retained dwell."
    );
  for (const [i, d] of data.beamSchedule.entries()) {
    const prior = data.beamSchedule[i - 1],
      pointer = `/products/beamSchedule/rows/${i}`;
    if (
      d.dwell_index !== i ||
      !Number.isSafeInteger(d.cycle_index) ||
      d.cycle_index < 0 ||
      (i === 0 && d.cycle_index !== 0) ||
      (prior &&
        (d.cycle_index < prior.cycle_index ||
          d.cycle_index > prior.cycle_index + 1))
    )
      issue(
        "RADAR.DWELL_ORDER",
        pointer,
        "Dwell indices are contiguous; cycle groups begin at zero and advance without skips or reversal."
      );
    if (
      !(d.start_s < d.end_s) ||
      !within(d.start_s) ||
      !within(d.end_s) ||
      (prior && d.start_s < prior.end_s)
    )
      issue(
        "RADAR.DWELL_TIME",
        pointer,
        "Ordered non-overlapping dwell intervals must lie inside acquisition time."
      );
    if (
      d.beam_azimuth_deg < 0 ||
      d.beam_azimuth_deg >= 360 ||
      d.beam_width_deg <= 0 ||
      d.beam_width_deg > 360
    )
      issue(
        "RADAR.BEAM",
        pointer,
        "Bearings are clockwise from north in [0,360); full beam width is positive and at most 360 degrees."
      );
  }
  for (const role of ["returns", "thresholds"] as const)
    if (data[role].some((v) => v < 0))
      issue(
        "RADAR.POWER_RANGE",
        `/products/${role}`,
        "Power cells are nonnegative, not restricted to the interval 0–1."
      );
  const detections = new Map<
      string,
      SteeredRadarDecodedProducts["detections"][number]
    >(),
    cells = new Set<number>();
  for (const [i, d] of data.detections.entries()) {
    const pointer = `/products/detections/rows/${i}`;
    if (detections.has(d.detection_id))
      issue(
        "RADAR.DETECTION_ID",
        pointer,
        "Detection identifiers must be unique."
      );
    detections.set(d.detection_id, d);
    if (!index(d.dwell_index, dwells) || !index(d.range_index, ranges)) {
      issue(
        "RADAR.DETECTION_CELL",
        pointer,
        "Detection cell lies outside capture."
      );
      continue;
    }
    const cell = d.dwell_index * ranges + d.range_index,
      dwell = data.beamSchedule[d.dwell_index];
    if (cells.has(cell))
      issue(
        "RADAR.DETECTION_CELL",
        pointer,
        "A cell cannot create duplicate detections."
      );
    cells.add(cell);
    if (!dwell || d.time_s < dwell.start_s || d.time_s >= dwell.end_s)
      issue(
        "RADAR.DETECTION_TIME",
        pointer,
        "Detection time must lie within its source dwell [start,end)."
      );
    if (dwell) {
      const angle = (dwell.beam_azimuth_deg * Math.PI) / 180,
        r = rangeAxis.origin + d.range_index * rangeAxis.step;
      if (
        !near(d.east_m, profile.origin.eastM + r * Math.sin(angle)) ||
        !near(d.north_m, profile.origin.northM + r * Math.cos(angle))
      )
        issue(
          "RADAR.DETECTION_GEOMETRY",
          pointer,
          "Detection must retain the scheduled beam/range cell center."
        );
    }
    if (
      !powerNear(d.power, data.returns[cell]!) ||
      data.returns[cell]! < data.thresholds[cell]!
    )
      issue(
        "RADAR.DETECTION_THRESHOLD",
        pointer,
        "Detection power must match and meet its own retained threshold."
      );
  }
  const tracks = new Map<
      string,
      SteeredRadarDecodedProducts["tracks"][number]
    >(),
    last = new Map<string, SteeredRadarDecodedProducts["tracks"][number]>();
  for (const [i, t] of data.tracks.entries()) {
    const pointer = `/products/tracks/rows/${i}`,
      key = `${t.track_id}/${t.dwell_index}`,
      prior = last.get(t.track_id),
      dwell = data.beamSchedule[t.dwell_index];
    if (!index(t.dwell_index, dwells) || tracks.has(key))
      issue(
        "RADAR.TRACK_ID",
        pointer,
        "Track/dwell identities must be unique and inside capture."
      );
    if (
      prior &&
      (t.dwell_index <= prior.dwell_index || t.time_s <= prior.time_s)
    )
      issue(
        "RADAR.TRACK_ORDER",
        pointer,
        "Track states must advance in dwell and time."
      );
    if (!dwell || t.time_s !== dwell.end_s)
      issue(
        "RADAR.TRACK_TIME",
        pointer,
        "Track output is available at its dwell end."
      );
    tracks.set(key, t);
    last.set(t.track_id, t);
    const a = t.cov_ee_m2,
      b = t.cov_en_m2,
      c = t.cov_nn_m2,
      s = Math.max(1, a, Math.abs(b), c);
    if (a < 0 || c < 0 || (a / s) * (c / s) - (b / s) ** 2 < -1e-12)
      issue(
        "RADAR.COVARIANCE",
        pointer,
        "Covariance must be positive semidefinite in square meters."
      );
  }
  const assigned = new Set<string>(),
    counts = new Map<string, number>();
  for (const [i, a] of data.associations.entries()) {
    const key = `${a.track_id}/${a.dwell_index}`,
      track = tracks.get(key),
      d = detections.get(a.detection_id),
      pointer = `/products/associations/rows/${i}`;
    if (
      !track ||
      !d ||
      d.dwell_index !== a.dwell_index ||
      d.time_s > track.time_s
    )
      issue(
        "RADAR.ASSOCIATION_REF",
        pointer,
        "An association must select this dwell's existing track and earlier detection."
      );
    if (assigned.has(a.detection_id))
      issue(
        "RADAR.ASSOCIATION_UNIQUE",
        pointer,
        "Each detection may be assigned once."
      );
    assigned.add(a.detection_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, t] of tracks)
    if ((t.state === "coasting") !== !(counts.get(key) ?? 0))
      issue(
        "RADAR.TRACK_STATE",
        `/products/tracks/${key}`,
        "Coasting has no detection; tentative and confirmed states require a detection association."
      );
  const truth = new Set<string>();
  for (const [i, t] of data.truth.entries()) {
    const key = `${t.target_id}/${t.dwell_index}/${t.time_s}`,
      d = data.beamSchedule[t.dwell_index];
    if (
      !index(t.dwell_index, dwells) ||
      truth.has(key) ||
      !d ||
      t.time_s < d.start_s ||
      t.time_s > d.end_s
    )
      issue(
        "RADAR.TRUTH_ROW",
        `/products/truth/rows/${i}`,
        "Truth requires unique target/dwell/time rows inside its dwell."
      );
    truth.add(key);
  }
  result.checks.semantics = result.issues.length ? "failed" : "passed";
  result.success = !result.issues.length;
  if (result.success)
    result.data = {
      declaration: profile,
      layouts: p.sources.layouts,
      products: data,
    };
  return result;
}
/** Validates cooperative report provenance, not transponder authenticity, geometric height or target identity. */
export async function evaluateSecondaryRadarProfile(
  observation: unknown,
  context: unknown,
  selection: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<SecondaryRadarProfileResult> {
  const result = resultFor<
      SecondaryRadarProfile,
      SecondaryRadarDecodedProducts
    >(SECONDARY_RADAR_PROFILE),
    parsed = SecondaryRadarProfileSchema.safeParse(profileInput);
  if (!parsed.success) {
    result.checks.structure = "failed";
    result.issues.push({
      code: "RADAR.PREREQUISITE",
      pointer: "/",
      message: "Secondary radar declaration must satisfy its contract.",
    });
    return result;
  }
  const profile = parsed.data,
    p = await prepare(
      profile,
      observation,
      context,
      selection,
      options,
      result
    );
  if (!p) return result;
  const { issue, within } = p;
  let data: SecondaryRadarDecodedProducts;
  try {
    data = readSecondaryRadarProducts(
      p.sources.layouts,
      profile.products,
      p.assets
    );
  } catch (e) {
    issue(
      "RADAR.CONTENT",
      "/products",
      e instanceof Error ? e.message : String(e)
    );
    result.checks.semantics = "failed";
    return result;
  }
  const interrogations = new Map<
    string,
    SecondaryRadarDecodedProducts["interrogations"][number]
  >();
  if (!data.interrogations.length)
    issue(
      "RADAR.INTERROGATION_COUNT",
      "/products/interrogations",
      "At least one retained interrogation is required."
    );
  for (const [i, q] of data.interrogations.entries()) {
    const pointer = `/products/interrogations/rows/${i}`,
      prior = data.interrogations[i - 1];
    if (interrogations.has(q.interrogation_id))
      issue(
        "RADAR.INTERROGATION_ID",
        pointer,
        "Interrogation IDs must be unique."
      );
    interrogations.set(q.interrogation_id, q);
    if (
      !(q.start_s < q.end_s) ||
      !within(q.start_s) ||
      !within(q.end_s) ||
      (prior && q.start_s < prior.end_s)
    )
      issue(
        "RADAR.INTERROGATION_TIME",
        pointer,
        "Ordered non-overlapping interrogation windows must lie inside acquisition time."
      );
    if (
      q.beam_azimuth_deg < 0 ||
      q.beam_azimuth_deg >= 360 ||
      q.beam_width_deg <= 0 ||
      q.beam_width_deg > 360
    )
      issue(
        "RADAR.BEAM",
        pointer,
        "Interrogation bearings and positive beam widths must be valid degrees."
      );
  }
  const replies = new Map<
    string,
    SecondaryRadarDecodedProducts["decodedReplies"][number]
  >();
  for (const [i, r] of data.decodedReplies.entries()) {
    const pointer = `/products/decodedReplies/rows/${i}`,
      q = interrogations.get(r.interrogation_id);
    if (replies.has(r.reply_id))
      issue("RADAR.REPLY_ID", pointer, "Reply IDs must be unique.");
    replies.set(r.reply_id, r);
    if (!q)
      issue(
        "RADAR.REPLY_REF",
        pointer,
        "Reply must select a retained interrogation."
      );
    if (
      !q ||
      r.time_s < q.start_s ||
      r.time_s >= q.end_s ||
      r.available_s < r.time_s ||
      !within(r.available_s)
    )
      issue(
        "RADAR.REPLY_TIME",
        pointer,
        "Reply time belongs to its interrogation; processing availability cannot precede reception or exceed acquisition."
      );
    if (r.validity === "invalid") {
      if (
        r.slant_range_m !== null ||
        r.bearing_deg !== null ||
        r.mode_a_code !== null ||
        r.pressure_altitude_ft !== null
      )
        issue(
          "RADAR.INVALID_REPLY",
          pointer,
          "This profile retains invalid receptions without decoded values; blanks remain null."
        );
    } else {
      if (
        r.slant_range_m === null ||
        r.slant_range_m < 0 ||
        r.bearing_deg === null ||
        r.bearing_deg < 0 ||
        r.bearing_deg >= 360
      )
        issue(
          "RADAR.REPLY_POSITION",
          pointer,
          "A valid reply requires nonnegative slant range and bearing in [0,360)."
        );
      if (
        q?.mode === "mode_a" &&
        (r.mode_a_code === null || r.pressure_altitude_ft !== null)
      )
        issue(
          "RADAR.MODE_FIELDS",
          pointer,
          "A Mode A reply retains its reported octal code, not altitude."
        );
      if (
        q?.mode === "mode_c" &&
        (r.mode_a_code !== null ||
          (r.pressure_altitude_ft !== null &&
            r.pressure_altitude_ft % 100 !== 0))
      )
        issue(
          "RADAR.MODE_FIELDS",
          pointer,
          "Mode C altitude is nullable, in 100-foot pressure-altitude increments; it is not geometric height or an identity code."
        );
    }
  }
  const reportIds = new Set<string>(),
    reported = new Set<string>();
  for (const [i, r] of data.reports.entries()) {
    const pointer = `/products/reports/rows/${i}`,
      source = replies.get(r.reply_id);
    if (reportIds.has(r.report_id) || reported.has(r.reply_id))
      issue(
        "RADAR.REPORT_ID",
        pointer,
        "Report IDs and source reply selections must be unique."
      );
    reportIds.add(r.report_id);
    reported.add(r.reply_id);
    if (!source || source.validity !== "valid")
      issue(
        "RADAR.REPORT_REF",
        pointer,
        "A report must select a retained valid decoded reply."
      );
    else if (
      Object.entries(source).some(
        ([key, value]) => r[key as keyof typeof r] !== value
      )
    )
      issue(
        "RADAR.REPORT_FIDELITY",
        pointer,
        "Report must preserve every decoded source field, including availability and null values."
      );
  }
  if (
    data.decodedReplies.some(
      (r) => r.validity === "valid" && !reported.has(r.reply_id)
    )
  )
    issue(
      "RADAR.REPORT_COMPLETENESS",
      "/products/reports",
      "Every valid decoded reply must have one report; invalid and absent replies must not create reports."
    );
  const truth = new Set<string>();
  for (const [i, t] of data.truth.entries()) {
    const key = `${t.target_id}/${t.interrogation_id}/${t.time_s}`,
      q = interrogations.get(t.interrogation_id);
    if (!q || truth.has(key) || t.time_s < q.start_s || t.time_s >= q.end_s)
      issue(
        "RADAR.TRUTH_ROW",
        `/products/truth/rows/${i}`,
        "Truth needs unique target/interrogation/time rows inside its interrogation."
      );
    truth.add(key);
  }
  result.checks.semantics = result.issues.length ? "failed" : "passed";
  result.success = !result.issues.length;
  if (result.success)
    result.data = {
      declaration: profile,
      layouts: p.sources.layouts,
      products: data,
    };
  return result;
}
