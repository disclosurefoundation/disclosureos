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
  RadarProfileSchema,
  RADAR_PROFILE,
  type RadarProfile,
} from "./radar-profile-schema";
import {
  readRadarProducts,
  radarCellPosition,
  type RadarDecodedProducts,
} from "./radar-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";

export interface RadarProfileIssue {
  code: string;
  pointer: string;
  message: string;
}
export interface RadarProfileResult {
  success: boolean;
  profile: typeof RADAR_PROFILE;
  issues: RadarProfileIssue[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  trackingPerformance: "not_checked";
  data?: {
    declaration: RadarProfile;
    layouts: ProductSourceLayout[];
    products: RadarDecodedProducts;
  };
}

const close = (a: number, b: number, tolerance = 1e-6) =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
// Translation of a coordinate frame must not relax localization accuracy.
const positionClose = (a: number, b: number) =>
  Math.abs(a - b) <=
  1e-6 + 32 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const index = (n: number, length: number) =>
  Number.isSafeInteger(n) && n >= 0 && n < length;
const key = (id: string, scan: number) => `${id}/${scan}`;

// Compare declared decimal seconds without collapsing sub-millisecond UTC digits.
const decimal = (value: string): { n: bigint; d: bigint } => {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value)!;
  const fraction = match[3] ?? "",
    exponent = Number(match[4] ?? 0) - fraction.length;
  const coefficient = BigInt(`${match[1]}${match[2]}${fraction}`);
  return exponent >= 0
    ? { n: coefficient * 10n ** BigInt(exponent), d: 1n }
    : { n: coefficient, d: 10n ** BigInt(-exponent) };
};
const epoch = (instant: string) => {
  const fraction = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/.exec(instant);
  const whole = instant.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, "");
  const part = decimal(`0.${fraction?.[1] ?? "0"}`);
  return { n: BigInt(Date.parse(whole) / 1000) * part.d + part.n, d: part.d };
};
const compareOffset = (origin: string, seconds: number, boundary: string) => {
  const a = epoch(origin),
    offset = decimal(String(seconds)),
    b = epoch(boundary);
  const delta = (a.n * offset.d + offset.n * a.d) * b.d - b.n * a.d * offset.d;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};

/** Validates a fixed or declared moving-platform full-rotation product profile.
 * It checks declared lineage and retained numerical consistency, not detector performance,
 * target identity, physical calibration, antenna adequacy or Gaussian error coverage. */
export async function evaluateRadarProfile(
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<RadarProfileResult> {
  const result: RadarProfileResult = {
    success: false,
    profile: RADAR_PROFILE,
    issues: [],
    checks: {
      structure: "passed",
      sources: "not_checked",
      semantics: "not_checked",
    },
    scientific: "not_checked",
    physicalCalibration: "not_checked",
    trackingPerformance: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) => {
    result.issues.push({ code, pointer, message });
  };
  const parsed = RadarProfileSchema.safeParse(profileInput),
    observation = parseExperimentalObservation(observationInput),
    context = parseAcquisitionContext(contextInput),
    selection = ProductSourceSelectionSchema.safeParse(selectionInput);
  if (
    !parsed.success ||
    !observation.success ||
    !context.success ||
    !selection.success
  ) {
    result.checks.structure = "failed";
    issue(
      "RADAR.PREREQUISITE",
      "/",
      "Profile, observation, acquisition context and source selection must satisfy their contracts."
    );
    return result;
  }
  const profile = parsed.data,
    obs = observation.data,
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
  const roleRefs = Object.values(profile.products).filter(
    (ref): ref is string => ref !== undefined
  );
  if (new Set(roleRefs).size !== roleRefs.length)
    issue(
      "RADAR.ROLE_ALIAS",
      "/products",
      "Each radar role must reference a distinct retained product."
    );
  if (profile.products.truth && profile.dataOrigin !== "synthetic")
    issue(
      "RADAR.TRUTH_ORIGIN",
      "/products/truth",
      "The optional truth oracle is only defined for explicitly synthetic products."
    );
  const frame = obs.frames.find(
    (frame) => `frame:${frame.id}` === profile.frameRef
  );
  if (!frame || frame.kind !== "cartesian" || frame.unit !== "m")
    issue(
      "RADAR.FRAME",
      "/frameRef",
      "Radar positions require a declared Cartesian frame in meters."
    );
  const acquisition = ctx.acquisitions.find(
      (item) => `acquisition:${item.id}` === profile.acquisitionRef
    ),
    capture = ctx.products.find(
      (item) => `product:${item.id}` === profile.acquisitionProductRef
    );
  if (
    !acquisition ||
    !capture ||
    capture.acquisitionRef !== profile.acquisitionRef
  )
    issue(
      "RADAR.ACQUISITION",
      "/acquisitionProductRef",
      "The retained capture must belong to the selected acquisition."
    );
  const layouts = new Map(
    sources.layouts.map((layout) => [layout.productRef, layout])
  );
  for (const [role, ref] of Object.entries(profile.products))
    if (ref && !layouts.has(ref))
      issue(
        "RADAR.LAYOUT",
        `/products/${role}`,
        "The role needs a standard source layout."
      );
  const returns = layouts.get(profile.products.returns),
    thresholds = layouts.get(profile.products.thresholds);
  if (
    !returns ||
    returns.kind !== "binary_array" ||
    !thresholds ||
    thresholds.kind !== "binary_array"
  )
    issue(
      "RADAR.ARRAY_LAYOUT",
      "/products",
      "Returns and thresholds must be standard binary arrays."
    );
  if (
    result.issues.length ||
    !returns ||
    returns.kind !== "binary_array" ||
    !thresholds ||
    thresholds.kind !== "binary_array"
  ) {
    result.checks.semantics = "failed";
    return result;
  }
  const [scanAxis, azimuthAxis, rangeAxis] = returns.axes;
  const manifestRef =
    acquisition?.manifest.state === "pinned"
      ? acquisition.manifest.ref
      : undefined;
  const manifest = ctx.manifests.find(
    (item) => `manifest:${item.id}` === manifestRef
  );
  const channel = manifest?.channels.find(
    (item) => item.id === profile.channelId
  );
  if (
    !acquisition?.channels.some(
      (item) => item.channelId === profile.channelId
    ) ||
    !channel ||
    channel.quantity !== returns.quantity ||
    channel.unit !== returns.unit
  ) {
    issue(
      "RADAR.CHANNEL",
      "/channelId",
      "Return power must select an acquisition channel from its pinned manifest with matching quantity and unit."
    );
  }
  if (
    returns.axes.length !== 3 ||
    !scanAxis ||
    scanAxis.kind !== "index" ||
    scanAxis.name !== "scan" ||
    scanAxis.firstIndex !== 0 ||
    !azimuthAxis ||
    azimuthAxis.kind !== "regular" ||
    azimuthAxis.name !== "azimuth" ||
    azimuthAxis.unit !== "deg" ||
    azimuthAxis.origin < 0 ||
    azimuthAxis.origin >= azimuthAxis.step ||
    !close(azimuthAxis.step * azimuthAxis.length, 360) ||
    !rangeAxis ||
    rangeAxis.kind !== "regular" ||
    rangeAxis.name !== "range" ||
    rangeAxis.unit !== "m" ||
    rangeAxis.origin < 0
  )
    issue(
      "RADAR.AXES",
      "/products/returns",
      "Required axes are zero-based scan, full clockwise azimuth rotation (degrees, bin centers), and nonnegative range centers (meters) in the declared range convention."
    );
  for (const [role, layout] of [
    ["returns", returns],
    ["thresholds", thresholds],
  ] as const) {
    if (
      layout.elementType !== "float32" ||
      layout.byteOrder !== "little" ||
      layout.quantity !== "normalized_return_power" ||
      layout.unit !== "1"
    )
      issue(
        "RADAR.POWER_LAYOUT",
        `/products/${role}`,
        "This profile requires little-endian float32 normalized return power with unit 1."
      );
  }
  if (JSON.stringify(returns.axes) !== JSON.stringify(thresholds.axes))
    issue(
      "RADAR.THRESHOLD_AXES",
      "/products/thresholds",
      "Thresholds must share every return-cell coordinate."
    );
  if (
    capture &&
    (capture.artifact.digest.value !== returns.digest.value ||
      capture.artifact.byteLength !== returns.byteLength ||
      capture.artifact.mediaType !== returns.mediaType)
  )
    issue(
      "RADAR.CAPTURE_BINDING",
      "/acquisitionProductRef",
      "Acquisition artifact and retained return layout must identify the same bytes."
    );
  const products = new Map(
      obs.products.map((product) => [`product:${product.id}`, product])
    ),
    processes = new Map(
      obs.processing.map((process) => [`process:${process.id}`, process])
    );
  if (products.get(profile.products.returns)?.kind !== "raw")
    issue(
      "RADAR.RETURNS_ORIGIN",
      "/products/returns",
      "The retained return array is the input capture for this profile. Derived inputs need a separately specified profile."
    );
  const ancestors = (ref: string) => {
    const found = new Set<string>(),
      queue = [ref];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      if (found.has(current)) continue;
      found.add(current);
      const product = products.get(current),
        process = processes.get(current);
      if (product?.kind === "derived") queue.push(product.generatedBy);
      if (product?.kind === "raw") queue.push(...product.sourceRefs);
      if (process) queue.push(...process.inputRefs);
    }
    return found;
  };
  for (const role of [
    "thresholds",
    "detections",
    "tracks",
    "associations",
  ] as const)
    if (products.get(profile.products[role])?.kind !== "derived")
      issue(
        "RADAR.PROCESSING",
        `/products/${role}`,
        "Calculated radar products must have explicit processing lineage."
      );
  const detectionInputs = ancestors(profile.products.detections),
    trackInputs = ancestors(profile.products.tracks),
    thresholdInputs = ancestors(profile.products.thresholds),
    associationInputs = ancestors(profile.products.associations);
  if (!thresholdInputs.has(profile.products.returns))
    issue(
      "RADAR.THRESHOLD_LINEAGE",
      "/products/thresholds",
      "Threshold generation must declare the retained return capture as an input."
    );
  if (
    !detectionInputs.has(profile.products.returns) ||
    !detectionInputs.has(profile.products.thresholds)
  )
    issue(
      "RADAR.DETECTION_LINEAGE",
      "/products/detections",
      "Detection processing must depend on returns and thresholds."
    );
  if (
    !trackInputs.has(profile.products.detections) ||
    !associationInputs.has(profile.products.detections)
  )
    issue(
      "RADAR.TRACK_LINEAGE",
      "/products/tracks",
      "Track estimates and associations must depend on detections."
    );
  if (
    profile.platform &&
    (!detectionInputs.has(profile.products.platformPose!) ||
      !detectionInputs.has(profile.products.scanSchedule))
  )
    issue(
      "RADAR.PLATFORM_LINEAGE",
      "/products/detections",
      "Moving-platform localization must depend on the retained pose and scan schedule."
    );
  if (profile.products.truth) {
    // Block both the oracle product and its exclusive source payload. Shared methods/configuration
    // can describe a generator; they do not make the oracle an allowed tracker input.
    const sharedSynthesis = new Set([
      ...ancestors(profile.products.returns),
      ...ancestors(profile.products.scanSchedule),
    ]);
    const forbidden = [
      profile.products.truth,
      ...[...ancestors(profile.products.truth)].filter(
        (ref) => !sharedSynthesis.has(ref)
      ),
    ];
    if (
      [
        thresholdInputs,
        detectionInputs,
        trackInputs,
        associationInputs,
        ...(profile.products.platformPose
          ? [ancestors(profile.products.platformPose)]
          : []),
      ].some((inputs) => forbidden.some((ref) => inputs.has(ref)))
    )
      issue(
        "RADAR.TRUTH_LEAK",
        "/products/truth",
        "Detection, threshold, tracking, association and platform-pose lineage must not consume the synthetic truth oracle."
      );
  }
  if (
    result.issues.length ||
    !scanAxis ||
    scanAxis.kind !== "index" ||
    !azimuthAxis ||
    azimuthAxis.kind !== "regular" ||
    !rangeAxis ||
    rangeAxis.kind !== "regular"
  ) {
    result.checks.semantics = "failed";
    return result;
  }
  // Snapshot before the first await, so the bytes checked and decoded cannot diverge.
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const sourceResult = await evaluateProductSourceSelection(obs, sources, {
    assets,
  });
  if (
    !sourceResult.success ||
    sourceResult.checks.external !== "passed" ||
    sourceResult.checks.content !== "passed"
  ) {
    result.checks.sources = "failed";
    issue(
      "RADAR.SOURCE_CONTENT",
      "/products",
      "All source layouts require matching bytes, digests and valid source selections."
    );
    return result;
  }
  result.checks.sources = "passed";
  let data: RadarDecodedProducts;
  try {
    data = readRadarProducts(sources.layouts, profile.products, assets);
  } catch (error) {
    result.checks.semantics = "failed";
    issue(
      "RADAR.CONTENT",
      "/products",
      error instanceof Error ? error.message : String(error)
    );
    return result;
  }
  const scans = scanAxis.length,
    azimuths = azimuthAxis.length,
    ranges = rangeAxis.length;
  if (data.scanSchedule.length !== scans * azimuths)
    issue(
      "RADAR.DWELL_COUNT",
      "/products/scanSchedule",
      "A full-rotation schedule needs exactly one dwell per scan/azimuth cell."
    );
  for (const [i, dwell] of data.scanSchedule.entries()) {
    const pointer = `/products/scanSchedule/rows/${i}`;
    if (
      dwell.scan_index !== Math.floor(i / azimuths) ||
      dwell.azimuth_index !== i % azimuths
    )
      issue(
        "RADAR.DWELL_ORDER",
        pointer,
        "Dwell rows must follow scan then azimuth order without duplicates or gaps."
      );
    if (
      dwell.start_s < 0 ||
      dwell.end_s <= dwell.start_s ||
      (i > 0 && dwell.start_s < data.scanSchedule[i - 1]!.end_s)
    )
      issue(
        "RADAR.DWELL_TIME",
        pointer,
        "Dwells need positive, non-overlapping, ordered intervals."
      );
    if (
      !close(
        dwell.beam_azimuth_deg,
        azimuthAxis.origin + dwell.azimuth_index * azimuthAxis.step
      ) ||
      dwell.beam_width_deg <= 0 ||
      dwell.beam_width_deg > 360
    )
      issue(
        "RADAR.BEAM",
        pointer,
        "Declared beam centers must match azimuth cells, with positive full angular width at most 360 degrees."
      );
  }
  if (profile.platform) {
    if (data.platformPose.length !== data.scanSchedule.length)
      issue(
        "RADAR.POSE_COUNT",
        "/products/platformPose",
        "Moving radar needs exactly one retained pose for every dwell."
      );
    for (const [i, pose] of data.platformPose.entries()) {
      const dwell = data.scanSchedule[i],
        pointer = `/products/platformPose/rows/${i}`;
      if (
        !dwell ||
        pose.scan_index !== dwell.scan_index ||
        pose.azimuth_index !== dwell.azimuth_index
      )
        issue(
          "RADAR.POSE_ORDER",
          pointer,
          "Pose rows must select their exact dwell in schedule order without duplicates or gaps."
        );
      if (
        !dwell ||
        Math.abs(pose.time_s - (dwell.start_s + dwell.end_s) / 2) > 1e-7
      )
        issue(
          "RADAR.POSE_TIME",
          pointer,
          "Each retained pose is sampled at its dwell midpoint; no interpolation is implicit."
        );
      if (pose.heading_deg < 0 || pose.heading_deg >= 360)
        issue(
          "RADAR.POSE_HEADING",
          pointer,
          "Platform heading is clockwise from frame north in [0, 360) degrees."
        );
    }
    const initial = data.platformPose[0];
    if (
      !initial ||
      Math.abs(initial.east_m - profile.origin.eastM) > 1e-6 ||
      Math.abs(initial.north_m - profile.origin.northM) > 1e-6
    )
      issue(
        "RADAR.POSE_ORIGIN",
        "/origin",
        "A moving profile origin is the first retained pose, not a fixed sensor position."
      );
  }
  const first = data.scanSchedule[0],
    last = data.scanSchedule.at(-1);
  // ISO calendar validation uses the existing exact UTC contract rather than Date normalization.
  if (compareUtcInstants(profile.timeOrigin, profile.timeOrigin) === undefined)
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
      "Rotating scans require a known acquisition interval."
    );
  else if (
    first &&
    last &&
    compareUtcInstants(profile.timeOrigin, profile.timeOrigin) !== undefined &&
    (compareOffset(profile.timeOrigin, first.start_s, acquisition.time.start) <
      0 ||
      compareOffset(profile.timeOrigin, last.end_s, acquisition.time.end) > 0)
  )
    issue(
      "RADAR.ACQUISITION_TIME",
      "/timeOrigin",
      "Every dwell must lie in the selected acquisition interval."
    );
  for (const role of ["returns", "thresholds"] as const)
    if (data[role].some((value) => value < 0))
      issue(
        "RADAR.POWER_RANGE",
        `/products/${role}`,
        "Relative power and threshold cells must be nonnegative; unit 1 does not imply a 0–1 interval."
      );
  const detections = new Map<string, (typeof data.detections)[number]>(),
    selectedCells = new Set<string>();
  for (const [i, detection] of data.detections.entries()) {
    const pointer = `/products/detections/rows/${i}`;
    if (detections.has(detection.detection_id))
      issue(
        "RADAR.DETECTION_ID",
        pointer,
        "Detection identifiers must be unique."
      );
    detections.set(detection.detection_id, detection);
    if (
      !index(detection.scan_index, scans) ||
      !index(detection.azimuth_index, azimuths) ||
      !index(detection.range_index, ranges)
    ) {
      issue(
        "RADAR.DETECTION_CELL",
        pointer,
        "Detection source cell lies outside the capture."
      );
      continue;
    }
    const cell =
      (detection.scan_index * azimuths + detection.azimuth_index) * ranges +
      detection.range_index;
    if (selectedCells.has(String(cell)))
      issue(
        "RADAR.DETECTION_CELL",
        pointer,
        "A retained cell cannot create duplicate detections."
      );
    selectedCells.add(String(cell));
    const dwell =
      data.scanSchedule[
        detection.scan_index * azimuths + detection.azimuth_index
      ];
    if (
      !dwell ||
      detection.time_s < dwell.start_s ||
      detection.time_s >= dwell.end_s
    )
      issue(
        "RADAR.DETECTION_TIME",
        pointer,
        "Detection time must lie within its own source dwell [start, end)."
      );
    if (
      profile.platform &&
      dwell &&
      Math.abs(detection.time_s - (dwell.start_s + dwell.end_s) / 2) > 1e-7
    )
      issue(
        "RADAR.DETECTION_POSE_TIME",
        pointer,
        "Moving-platform detections use their retained dwell-midpoint pose and time."
      );
    const position = (az: number, r: number) => {
      const pose = data.platformPose[detection.scan_index * azimuths + az];
      if (profile.platform && !pose) return null;
      return radarCellPosition(
        profile,
        pose,
        azimuthAxis.origin + az * azimuthAxis.step,
        rangeAxis.origin + r * rangeAxis.step
      );
    };
    const center = position(detection.azimuth_index, detection.range_index);
    if (!center)
      issue(
        "RADAR.PROJECTION_GEOMETRY",
        pointer,
        "A detection source cell must reach the declared horizontal plane with a retained pose."
      );
    let east = center?.eastM ?? NaN,
      north = center?.northM ?? NaN;
    const rule = profile.detectionPosition;
    if (rule.kind === "power_weighted_neighborhood") {
      if (
        2 * rule.azimuthRadius + 1 > azimuths ||
        detection.range_index - rule.rangeRadius < 0 ||
        detection.range_index + rule.rangeRadius >= ranges
      )
        issue(
          "RADAR.CENTROID_EXTENT",
          pointer,
          "The declared centroid neighborhood must fit the radial extent and visit each azimuth at most once."
        );
      else {
        let weightSum = 0;
        east = 0;
        north = 0;
        for (let da = -rule.azimuthRadius; da <= rule.azimuthRadius; da++)
          for (let dr = -rule.rangeRadius; dr <= rule.rangeRadius; dr++) {
            const az = (detection.azimuth_index + da + azimuths) % azimuths,
              r = detection.range_index + dr,
              projected = position(az, r);
            // An impossible slant/plane cell has no Cartesian location. Do not
            // clamp it to the platform or permit its power to bias the centroid.
            if (!projected) continue;
            const power =
                data.returns[
                  (detection.scan_index * azimuths + az) * ranges + r
                ]!,
              weight = Math.max(0, power - rule.backgroundPower);
            weightSum += weight;
            east += weight * projected.eastM;
            north += weight * projected.northM;
          }
        if (!(weightSum > 0))
          issue(
            "RADAR.CENTROID_WEIGHT",
            pointer,
            "The centroid requires positive retained weight in projectable cells."
          );
        else {
          east /= weightSum;
          north /= weightSum;
        }
      }
    }
    if (
      !positionClose(detection.east_m, east) ||
      !positionClose(detection.north_m, north)
    )
      issue(
        "RADAR.DETECTION_GEOMETRY",
        pointer,
        "Detection position must match the declared localization rule applied to retained cells and their own dwell poses."
      );
    if (
      !close(detection.power, data.returns[cell]!, 1e-6) ||
      data.returns[cell]! < data.thresholds[cell]!
    )
      issue(
        "RADAR.DETECTION_THRESHOLD",
        pointer,
        "Detection power must match its source cell and meet that cell’s retained threshold."
      );
  }
  const tracks = new Map<string, (typeof data.tracks)[number]>(),
    lastTrack = new Map<string, (typeof data.tracks)[number]>();
  for (const [i, track] of data.tracks.entries()) {
    const pointer = `/products/tracks/rows/${i}`,
      k = key(track.track_id, track.scan_index),
      prior = lastTrack.get(track.track_id);
    if (!index(track.scan_index, scans) || tracks.has(k))
      issue(
        "RADAR.TRACK_ID",
        pointer,
        "Track estimates need unique track/scan identities inside the capture."
      );
    if (
      prior &&
      (track.scan_index <= prior.scan_index || track.time_s <= prior.time_s)
    )
      issue(
        "RADAR.TRACK_ORDER",
        pointer,
        "Each track’s estimates must advance in scan and time."
      );
    tracks.set(k, track);
    lastTrack.set(track.track_id, track);
    const start = data.scanSchedule[track.scan_index * azimuths]?.start_s,
      end = data.scanSchedule[(track.scan_index + 1) * azimuths - 1]?.end_s;
    if (
      start === undefined ||
      end === undefined ||
      track.time_s < start ||
      track.time_s > end
    )
      issue(
        "RADAR.TRACK_TIME",
        pointer,
        "Track estimate time must lie within its stated scan, including the scan end."
      );
    const a = track.cov_ee_m2,
      b = track.cov_en_m2,
      c = track.cov_nn_m2;
    const scale = Math.max(1, a, Math.abs(b), c);
    if (a < 0 || c < 0 || (a / scale) * (c / scale) - (b / scale) ** 2 < -1e-12)
      issue(
        "RADAR.COVARIANCE",
        pointer,
        "The symmetric east/north covariance must be positive semidefinite, in square meters."
      );
  }
  const assigned = new Set<string>(),
    counts = new Map<string, number>();
  for (const [i, association] of data.associations.entries()) {
    const pointer = `/products/associations/rows/${i}`,
      k = key(association.track_id, association.scan_index),
      track = tracks.get(k),
      detection = detections.get(association.detection_id);
    if (
      !track ||
      !detection ||
      detection.scan_index !== association.scan_index ||
      detection.time_s > track.time_s
    )
      issue(
        "RADAR.ASSOCIATION_REF",
        pointer,
        "Association must connect an existing estimate to an earlier detection in the same scan."
      );
    if (assigned.has(association.detection_id))
      issue(
        "RADAR.ASSOCIATION_UNIQUE",
        pointer,
        "Each detection can be assigned to at most one estimate."
      );
    assigned.add(association.detection_id);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, track] of tracks)
    if ((track.state === "coasting") !== !(counts.get(k) ?? 0))
      issue(
        "RADAR.TRACK_STATE",
        `/products/tracks/${k}`,
        "A coasting estimate has no detection association; tentative and confirmed estimates have at least one."
      );
  const truthIds = new Set<string>();
  for (const [i, truth] of data.truth.entries()) {
    const k = `${truth.target_id}/${truth.scan_index}/${truth.time_s}`,
      start = data.scanSchedule[truth.scan_index * azimuths]?.start_s,
      end = data.scanSchedule[(truth.scan_index + 1) * azimuths - 1]?.end_s;
    if (
      !index(truth.scan_index, scans) ||
      truthIds.has(k) ||
      start === undefined ||
      end === undefined ||
      truth.time_s < start ||
      truth.time_s > end
    )
      issue(
        "RADAR.TRUTH_ROW",
        `/products/truth/rows/${i}`,
        "Truth coordinates require unique target/scan/time rows within their scan."
      );
    truthIds.add(k);
  }
  result.checks.semantics = result.issues.length ? "failed" : "passed";
  result.success = result.issues.length === 0;
  if (result.success)
    result.data = {
      declaration: profile,
      layouts: sources.layouts,
      products: data,
    };
  return result;
}
