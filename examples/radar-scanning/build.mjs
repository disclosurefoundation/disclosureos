import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config, simulate } from "./model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const csv = (rows) =>
  Buffer.from(
    Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n") +
      "\n",
  );
const binary = (a) => {
  const b = Buffer.alloc(a.length * 4);
  a.forEach((v, i) => b.writeFloatLE(v, i * 4));
  return b;
};
const known = (value) => ({ state: "known", value });
const unknown = (reason) => ({ state: "unknown", reason });
const methods = {
  id: "radar-scanning-methods-v1",
  version: "1.0.0",
  fictional: true,
  config,
  description:
    "A seeded reduced model of rotating radar sampling, threshold detection and detection-only tracking. Relative power is an authored numerical scale, not calibrated received watts.",
  synthesis: {
    seedGenerator: "mulberry32",
    targetModel:
      "Scene A: east = 650 + 18t, north = 1650 - 10t; scene B: east = -1400 + 10t, north = 1100 + 6t (metres, seconds)",
    beam: "Gaussian power response sigma=2.1 degrees; FWHM=4.945122 degrees. Range response sigma=36 m. Samples evaluated at each dwell midpoint.",
    noise:
      "Independent exponential power, mean 0.055, plus 0.025 floor. Broad stationary clutter centered at bearing 145 degrees and range 1050 m, angular sigma 15 degrees and range sigma 240 m, peak 0.52 times uniform [0.8, 1.2] texture.",
    attenuation:
      "Scene A gain changes from 3.8 to 0.015 during scans 6–8. Scene B gain changes from 3.2 to 0.015 during scans 11–12. This is prescribed fading, not an inferred obstruction or electromagnetic propagation solution.",
    transient:
      "Additional transient echo during scan 4, bearing 235 degrees, range 2150 m, gain 2.4; the same detector/tracker handles it without knowing its origin.",
    truth:
      "Separate scenario-truth.csv gives positions at every dwell end. Generator truth labels are not supplied to detection or tracking.",
  },
  detector: {
    version: "range-neighbor-peaks-1",
    threshold: "max(0.6,4*mean(training range cells))",
    training:
      "Same azimuth; range offsets -10..-3 and 3..10, clipped at array boundaries. No angular training. This empirical threshold is not a calibrated constant-false-alarm-rate claim.",
    peaks:
      "Power >= retained float32 threshold and greatest power in a 3 × 3 azimuth/range neighborhood; azimuth wraps. Equal-valued ties choose lower storage index. First/last range bins are excluded.",
    localization:
      "Center of power over the same 3 × 3 neighborhood after subtracting a 0.08 floor and clamping weights to zero; transform each cell center into local east/north before averaging. Neighboring azimuth cells were sampled at different dwell times. The midpoint timestamp belongs to the peak cell; this estimator makes no motion compensation within the neighborhood. The assumed 45 m Cartesian filter error is a teaching assumption, not a demonstrated correction for scan skew.",
    timing:
      "time_s is selected dwell midpoint. Outputs become available only at the end of the complete scan, because peak/centroid calculations use neighboring azimuth dwells.",
  },
  tracker: {
    version: "nearest-neighbor-cv-kalman-1",
    stateOrder: [
      "east_m",
      "north_m",
      "velocity_east_m_s",
      "velocity_north_m_s",
    ],
    measurement:
      "Cartesian east/north from detections.csv only. Assumed independent errors with sigma = 45 m, R = diag(2025, 2025) m². This is an illustrative filter assumption, not demonstrated measurement accuracy.",
    transition:
      "Constant velocity. F=[[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]]. Q=sigma_a² G Gᵀ, G=[[dt²/2,0],[0,dt²/2],[dt,0],[0,dt]], sigma_a = 1.5 m/s²; each propagation interval has independent assumed acceleration.",
    association:
      "Detections processed by measurement time within a completed scan. Greedy minimum squared innovation Mahalanobis distance <= 9.21034. At most one detection per track per scan. Unassigned detections start new tracks; no scene identities or truth labels supplied.",
    initialization:
      "Position from detection; velocity=0; initial covariance diag(2025,2025,900,900) with mixed state units.",
    update:
      "Linear Kalman update with Joseph covariance form. Export all active states at scan end. Confirmed after 3 total updates; any missed update gives coasting; retire after 4 consecutive misses. Confirmed is a filter bookkeeping state, not identification or verification.",
    uncertainty:
      "Displayed 95% Gaussian position ellipse from east/north covariance; chi-square threshold 5.991464547 with 2 degrees of freedom. This describes the assumed filter model and has not been empirically calibrated.",
    fullCovariance:
      "track-state.csv stores all 4 × 4 entries p00..p33 and hit/miss counters. Position-only covariance is in tracks.csv.",
  },
  timing: {
    meaning:
      "Authored UTC origin plus retained relative seconds; no physical clock, synchronization or cross-capture alignment is claimed.",
    scanSeconds: 4,
    dwellSeconds: 4 / 72,
    batchAvailability:
      "Detections and tracks appear after the completed scan; returns become available after each dwell.",
  },
  exclusions: [
    "No physical radar calibration",
    "No RF waveform/pulse simulation",
    "No terrain masking, multipath or atmosphere",
    "No target identity or real-world capability claim",
    "No calibrated false-alarm probability",
    "No validated tracking confidence",
  ],
};

export async function createPacket() {
  const m = simulate(),
    files = new Map();
  files.set("returns.f32", binary(m.returns));
  files.set("thresholds.f32", binary(m.thresholds));
  files.set("scan-schedule.csv", csv(m.schedule));
  files.set("detections.csv", csv(m.detections));
  files.set("tracks.csv", csv(m.tracks));
  files.set("associations.csv", csv(m.associations));
  files.set("scenario-truth.csv", csv(m.truth));
  files.set("track-state.csv", csv(m.states));
  files.set("methods.json", json(methods));
  files.set("model.mjs", await readFile(path.join(here, "model.mjs")));
  files.set("README.md", await readFile(path.join(here, "README.md")));
  const definitions = {
    schedule: ["scan-schedule.csv", "raw"],
    returns: ["returns.f32", "raw"],
    thresholds: ["thresholds.f32", "derived"],
    detections: ["detections.csv", "derived"],
    tracks: ["tracks.csv", "derived"],
    associations: ["associations.csv", "derived"],
    truth: ["scenario-truth.csv", "derived"],
    "track-state": ["track-state.csv", "derived"],
  };
  const artifact = (file) => ({
    digest: { algorithm: "sha256", value: sha(files.get(file)) },
    byteLength: files.get(file).length,
    mediaType: file.endsWith(".f32")
      ? "application/octet-stream"
      : file.endsWith(".csv")
        ? "text/csv"
        : file.endsWith(".json")
          ? "application/json"
          : file.endsWith(".md")
            ? "text/markdown"
            : "text/javascript",
  });
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "radar-scanning-v1",
    status: "published",
    createdAt: config.timeOrigin,
    updatedAt: config.timeOrigin,
    summary:
      "Fictional rotating radar capture with reproducible returns, threshold detections and estimated tracks. Model truth is separate from the measurements and estimator.",
    eventTime: {
      state: "known",
      value: {
        kind: "interval",
        start: { kind: "instant", value: config.timeOrigin, timeScale: "UTC" },
        end: {
          kind: "instant",
          value: "2026-07-28T22:01:04Z",
          timeScale: "UTC",
        },
      },
      sourceRefs: ["source:methods"],
    },
    position: { state: "unknown", reason: "not_collected" },
    sources: [
      {
        id: "simulation",
        kind: "instrument_data",
        access: "public",
        title: "Deterministic reduced radar simulation",
      },
      {
        id: "methods",
        kind: "document",
        access: "public",
        title: "Declared simulation and processing methods",
        digest: artifact("methods.json").digest,
      },
      {
        id: "model-code",
        kind: "document",
        access: "public",
        title: "Executable simulation and processing code",
        digest: artifact("model.mjs").digest,
      },
    ],
    products: [],
    methods: [],
    processing: [],
    assertions: [],
    measurements: [],
    frames: [
      {
        id: "radar-local",
        kind: "cartesian",
        definition: {
          state: "described",
          description:
            "Local east/north in metres, fixed radar at (0, 0), zero elevation plane. No terrestrial transform.",
        },
        unit: "m",
      },
    ],
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        partnerData: false,
        model: "reduced_rotating_radar",
        physicalValidation: "not_performed",
      },
    },
  };
  const process = (id, description, inputs, outputs) => {
    observation.methods.push({ id, version: "1.0.0", description });
    observation.processing.push({
      id,
      methodRef: `method:${id}`,
      methodVersion: "1.0.0",
      performedBy: "DisclosureOS deterministic numerical example",
      performedAt: "2026-07-28T22:01:04Z",
      inputRefs: inputs,
      outputRefs: outputs,
    });
  };
  process(
    "threshold",
    "Range-neighborhood threshold; no calibrated false-alarm claim.",
    ["product:returns", "source:methods", "source:model-code"],
    ["product:thresholds"],
  );
  process(
    "detect",
    "Completed-scan peak selection and weighted center-of-power localization.",
    [
      "product:returns",
      "product:thresholds",
      "product:schedule",
      "source:methods",
      "source:model-code",
    ],
    ["product:detections"],
  );
  process(
    "track",
    "Detection-only nearest-neighbor constant-velocity Kalman estimator.",
    ["product:detections", "source:methods", "source:model-code"],
    ["product:tracks", "product:associations", "product:track-state"],
  );
  process(
    "truth",
    "Separate scenario-state oracle for evaluating the fictional capture.",
    ["source:methods", "source:model-code"],
    ["product:truth"],
  );
  const generatedBy = {
    thresholds: "threshold",
    detections: "detect",
    tracks: "track",
    associations: "track",
    "track-state": "track",
    truth: "truth",
  };
  const layouts = [],
    selections = [],
    assets = new Map();
  for (const [id, [file, kind]] of Object.entries(definitions)) {
    const a = artifact(file);
    observation.products.push({
      id,
      kind,
      format: a.mediaType,
      access: "public",
      digest: a.digest,
      ...(kind === "raw"
        ? {
            sourceRefs: [
              "source:simulation",
              "source:methods",
              "source:model-code",
            ],
          }
        : { generatedBy: `process:${generatedBy[id]}` }),
    });
    const common = { id, productRef: `product:${id}`, ...a };
    if (file.endsWith(".f32"))
      layouts.push({
        ...common,
        kind: "binary_array",
        elementType: "float32",
        byteOrder: "little",
        order: "row_major",
        byteOffset: 0,
        quantity: "normalized_return_power",
        unit: "1",
        axes: [
          { kind: "index", name: "scan", length: 16, firstIndex: 0 },
          {
            kind: "regular",
            name: "azimuth",
            length: 72,
            origin: 0,
            step: 5,
            unit: "deg",
          },
          {
            kind: "regular",
            name: "range",
            length: 64,
            origin: 25,
            step: 50,
            unit: "m",
          },
        ],
      });
    else {
      const lines = files.get(file).toString().trim().split("\n");
      layouts.push({
        ...common,
        kind: "csv_table",
        encoding: "utf-8",
        delimiter: ",",
        header: true,
        rowCount: lines.length - 1,
        columns: lines[0].split(","),
      });
    }
    selections.push({
      id: `${id}-first`,
      layoutRef: `layout:${id}`,
      selector: file.endsWith(".f32")
        ? { kind: "array_element", indices: [0, 0, 0] }
        : { kind: "table_row", row: 0 },
    });
    assets.set(`product:${id}`, files.get(file));
  }
  const context = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "radar-scanning-context-v1",
    instruments: [
      {
        id: "radar-simulator",
        identity: {
          state: "known",
          manufacturer: "DisclosureOS synthetic example",
          model: "Reduced rotating radar numerical source",
        },
      },
    ],
    manifests: [
      {
        id: "radar-manifest",
        instrumentRef: "instrument:radar-simulator",
        version: "1.0.0",
        publishedAt: config.timeOrigin,
        artifact: artifact("methods.json"),
        configuration: {
          hardware: known("No physical hardware"),
          firmware: known("model.mjs version 1.0.0"),
        },
        channels: [
          {
            id: "return-power",
            quantity: "normalized_return_power",
            unit: "1",
            sampling: unknown(
              "Sequential angle/range cells; see retained dwell schedule rather than a single physical sample rate",
            ),
          },
        ],
      },
    ],
    deployments: [],
    calibrations: [],
    acquisitions: [
      {
        id: "radar-capture",
        instrumentRef: "instrument:radar-simulator",
        manifest: { state: "pinned", ref: "manifest:radar-manifest" },
        deployment: {
          state: "unresolved",
          reason: "Synthetic local frame, no physical deployment",
        },
        classification: "known_control",
        time: {
          state: "known",
          kind: "interval",
          start: config.timeOrigin,
          end: "2026-07-28T22:01:04Z",
          timeScale: "UTC",
        },
        clock: {
          source: known("Authored simulation timeline"),
          synchronization: unknown("No physical synchronization"),
          resolution: unknown("No physical clock characterized"),
          uncertainty: unknown("No physical clock characterized"),
        },
        channels: [
          {
            channelId: "return-power",
            calibration: {
              state: "unresolved",
              reason: "Numerical relative power has no physical calibration",
            },
          },
        ],
      },
    ],
    products: [
      {
        id: "returns",
        kind: "raw",
        acquisitionRef: "acquisition:radar-capture",
        artifact: artifact("returns.f32"),
      },
    ],
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        model: "reduced_rotating_radar",
        physicalCalibration: "not_performed",
      },
    },
  };
  const selection = {
    kind: "product_source_selection",
    schemaVersion: "0.1.0",
    id: "radar-scanning-selection-v1",
    observationId: observation.id,
    layouts,
    selections,
  };
  const profile = {
    kind: "radar_profile",
    schemaVersion: "0.1.0",
    id: "radar-scanning-profile-v1",
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:radar-capture",
    acquisitionProductRef: "product:returns",
    channelId: "return-power",
    frameRef: "frame:radar-local",
    origin: { eastM: 0, northM: 0 },
    timeOrigin: config.timeOrigin,
    mode: "rotating_scan",
    dataOrigin: "synthetic",
    beamWidthConvention: "full_width_half_maximum_power",
    processingAvailability: "scan_end",
    products: {
      scanSchedule: "product:schedule",
      returns: "product:returns",
      thresholds: "product:thresholds",
      detections: "product:detections",
      tracks: "product:tracks",
      associations: "product:associations",
      truth: "product:truth",
    },
    uncertainty: {
      kind: "gaussian_position_covariance",
      axes: ["east", "north"],
      unit: "m2",
      confidenceProbability: 0.95,
    },
    detectionPosition: {
      kind: "power_weighted_neighborhood",
      azimuthRadius: 1,
      rangeRadius: 1,
      backgroundPower: 0.08,
    },
    bearingConvention: "clockwise_from_north",
    rangeConvention: "horizontal_range",
  };
  const index = {
    id: observation.id,
    config,
    files: Object.fromEntries(
      Object.entries(definitions).map(([id, [file]]) => [
        id,
        {
          file,
          sha256: sha(files.get(file)),
          byteLength: files.get(file).length,
          mediaType: artifact(file).mediaType,
        },
      ]),
    ),
    schedule: m.schedule.map((r, row) => ({ row, ...r })),
    detections: m.detections.map((r, row) => ({ row, ...r })),
    tracks: m.tracks.map((r, row) => ({
      row,
      ...r,
      detection_ids: m.associations
        .filter(
          (a) => a.track_id === r.track_id && a.scan_index === r.scan_index,
        )
        .map((a) => a.detection_id),
    })),
    truth: m.truth.map((r, row) => ({ row, ...r })),
    methods,
  };
  const documents = {
    "observation.json": observation,
    "acquisition.json": context,
    "source-selection.json": selection,
    "radar-profile.json": profile,
  };
  for (const [name, value] of Object.entries(documents))
    files.set(name, json(value));
  // Index every retained source and contract, without a recursive hash of this index itself.
  index.sources = Object.fromEntries(
    [...files].map(([name, bytes]) => [
      name,
      {
        sha256: sha(bytes),
        byteLength: bytes.length,
        mediaType: artifact(name).mediaType,
      },
    ]),
  );
  files.set("index.json", json(index));
  return {
    files,
    assets,
    observation,
    context,
    selection,
    profile,
    index,
    model: m,
  };
}
export async function emit(directory = path.join(here, "generated")) {
  const p = await createPacket();
  await mkdir(directory, { recursive: true });
  for (const [name, bytes] of p.files)
    await writeFile(path.join(directory, name), bytes);
  return p;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const p = await emit(process.argv[2]);
  console.log(
    `Generated ${p.files.size} files; ${p.model.detections.length} detections, ${p.model.tracks.length} track states.`,
  );
}
