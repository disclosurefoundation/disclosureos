import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket as fixedPacket } from "../radar-scanning/build.mjs";
import { scenarioConfigs, simulate } from "./model.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const csv = (rows) =>
  Buffer.from(
    Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((row) => Object.values(row).join(",")).join("\n") +
      "\n",
  );
const binary = (values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => bytes.writeFloatLE(v, i * 4));
  return bytes;
};
export async function createPacket(scenario = "airborne") {
  const config = scenarioConfigs[scenario];
  if (!config) throw Error(`Unknown moving radar scenario: ${scenario}`);
  const base = await fixedPacket(),
    model = simulate(config),
    files = new Map();
  const definitions = {
    schedule: ["scan-schedule.csv", "raw"],
    platformPose: ["platform-pose.csv", "raw"],
    returns: ["returns.f32", "raw"],
    thresholds: ["thresholds.f32", "derived"],
    detections: ["detections.csv", "derived"],
    tracks: ["tracks.csv", "derived"],
    associations: ["associations.csv", "derived"],
    truth: ["scenario-truth.csv", "derived"],
    "track-state": ["track-state.csv", "derived"],
  };
  for (const [key, [name]] of Object.entries(definitions)) {
    const data = key === "track-state" ? model.states : model[key];
    files.set(name, name.endsWith(".f32") ? binary(data) : csv(data));
  }
  const methods = {
    ...base.index.methods,
    id: `radar-${scenario}-methods-v1`,
    config,
    description: `A seeded ${scenario} rotating radar example with retained platform telemetry, per-cell coordinate compensation and detection-only tracking. Relative power is not calibrated watts.`,
    platform: {
      model:
        "Constant-speed, constant-turn level yaw path; see retained platform-pose.csv and executable model.",
      parameters: {
        speedMPerS: config.platformSpeedMPerS,
        initialHeadingDeg: config.platformHeadingDeg,
        turnRateDegPerS: config.platformTurnRateDegPerS,
        initialEastM: config.platformEastM,
        initialNorthM: config.platformNorthM,
        upM: config.platformUpM,
      },
      sampling:
        "One exact authored pose at every dwell midpoint, keyed by scan and azimuth indices.",
      attitude:
        "Level yaw only. Pitch, roll, heave, antenna mounting offsets and navigation errors are not modeled.",
      projection:
        scenario === "airborne"
          ? "Slant range projected onto the declared plane up=0, with each dwell platform up=900 m. Every modeled scattering component is assumed on that plane; elevation response is not modeled. Cells with slant range below platform height are unprojectable."
          : "Horizontal range reported directly on a declared surface plane; platform up=0 is the coordinate convention, not an antenna-height claim.",
    },
    synthesis: {
      seedGenerator: "mulberry32",
      targetModel:
        scenario === "airborne"
          ? "Ground A: E=950+8t,N=1700-3t; ground B: E=-1900+4t,N=2300+2t; stationary landmark:E=2600,N=-500. Metres and seconds."
          : "Vessel A:E=500+7t,N=1250-2t; vessel B:E=-1100+4t,N=800+3t; stationary buoy:E=1300,N=-100. Metres and seconds.",
      beam: `Gaussian power response sigma=2.1 degrees, FWHM=${config.beamWidthDeg} degrees; range response sigma=${config.rangeResponseSigmaM} m. Antenna azimuth is clockwise from platform heading. Geometry evaluated at dwell midpoint.`,
      noise: `Exponential power mean0.055 + floor0.025. World-anchored broad clutter peak0.48, angular sigma16 degrees and range sigma${scenario === "airborne" ? 450 : 280}m, uniform[0.8,1.2] texture. Clutter center ${scenario === "airborne" ? "E100,N850" : "E1350,N1300"}. ${scenario === "shipborne" ? "Short-range directional sea-return teaching component:0.18*exp(-range/700)*(0.45+0.55*cos(worldBearing-110degrees)^2)*texture." : "No terrain, propagation or elevation-beam model."}`,
      attenuation:
        "Target A gain4.2 becomes0.015 in scans6–8; target B gain3.6(airborne)/3.4(shipborne) becomes0.015 in scans11–12. Stationary landmark gain2.8/2.7. Prescribed fading, no physical obstruction solution.",
      transient: `One additional gain2.4 point component during scan4, at ${scenario === "airborne" ? "E-2600,N-1500" : "E-1800,N-1000"}, treated as any other return by the detector/tracker.`,
      truth: base.index.methods.synthesis.truth,
    },
    detector: {
      ...base.index.methods.detector,
      localization:
        "Center of positive power over the retained 3x3 neighborhood after subtracting0.08. Project each cell using its own dwell-midpoint position and heading; omit impossible slant-to-plane cells. Then average in common east/north coordinates. Peak-cell timestamp remains the detection epoch. Ownship motion is compensated; moving targets are not deskewed to a common epoch.",
    },
    tracker: {
      ...base.index.methods.tracker,
      measurement: `Common east/north detections only. Independent assumed sigma=${config.measurementSigmaM}m errors. Navigation and projection parameters are treated as exact, not propagated.`,
      initialization: `Position from detection; zero initial velocity; covariance diag(${config.measurementSigmaM ** 2},${config.measurementSigmaM ** 2},900,900).`,
      uncertainty:
        "95% Gaussian position ellipse conditional on the declared exact platform pose and projection plane. Assumed filter errors are not empirically calibrated.",
    },
    exclusions: [
      ...base.index.methods.exclusions,
      "No navigation, heading, altitude or projection-plane uncertainty propagation",
      "No pitch, roll, heave or antenna lever-arm solution",
      "No three-dimensional target-height measurement",
      "No compensation for target motion within the detection neighborhood",
    ],
  };
  files.set("methods.json", json(methods));
  files.set(
    "model.mjs",
    Buffer.from(
      (await readFile(path.join(here, "model.mjs"), "utf8")).replace(
        "../radar-scanning/model.mjs",
        "./radar-scanning-model.mjs",
      ),
    ),
  );
  files.set(
    "radar-scanning-model.mjs",
    await readFile(path.join(here, "../radar-scanning/model.mjs")),
  );
  files.set("README.md", await readFile(path.join(here, "README.md")));
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
  const observation = structuredClone(base.observation);
  observation.id = `radar-${scenario}-v1`;
  observation.summary = `Fictional ${scenario} scanning radar with retained platform states, return arrays, motion-compensated detections and estimated tracks. Separate truth does not enter the estimator.`;
  observation.frames[0].definition.description = `Common local east/north coordinates in metres, with a declared up=0 ${scenario === "airborne" ? "ground" : "surface"} plane. Moving platform poses use the same frame. No terrestrial transform.`;
  observation.extensions["org.disclosure.simulation"].model =
    `reduced_${scenario}_rotating_radar`;
  observation.sources.find((source) => source.id === "methods").digest =
    artifact("methods.json").digest;
  observation.sources.find((source) => source.id === "model-code").digest =
    artifact("model.mjs").digest;
  observation.sources.push({
    id: "model-base",
    kind: "document",
    access: "public",
    title: "Retained detector and tracker implementation",
    digest: artifact("radar-scanning-model.mjs").digest,
  });
  observation.processing.forEach((process) =>
    process.inputRefs.push("source:model-base"),
  );
  observation.processing
    .find((process) => process.id === "detect")
    .inputRefs.push("product:platformPose");
  observation.methods.find((method) => method.id === "detect").description =
    "Completed-scan peak selection, per-cell platform/plane coordinate compensation and weighted common-frame centroid.";
  observation.products = [];
  const layouts = [],
    selections = [],
    assets = new Map(),
    generatedBy = {
      thresholds: "threshold",
      detections: "detect",
      tracks: "track",
      associations: "track",
      "track-state": "track",
      truth: "truth",
    };
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
              "source:model-base",
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
          { kind: "index", name: "scan", length: config.scans, firstIndex: 0 },
          {
            kind: "regular",
            name: "azimuth",
            length: config.azimuthBins,
            origin: config.azimuthOriginDeg,
            step: config.azimuthStepDeg,
            unit: "deg",
          },
          {
            kind: "regular",
            name: "range",
            length: config.rangeBins,
            origin: config.rangeOriginM,
            step: config.rangeStepM,
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
  const context = structuredClone(base.context);
  context.id = `radar-${scenario}-context-v1`;
  context.instruments[0].identity.model = `Reduced ${scenario} rotating radar numerical source`;
  context.manifests[0].artifact = artifact("methods.json");
  context.products[0].artifact = artifact("returns.f32");
  context.extensions["org.disclosure.simulation"].model =
    `reduced_${scenario}_rotating_radar`;
  const selection = {
    ...base.selection,
    id: `radar-${scenario}-selection-v1`,
    observationId: observation.id,
    layouts,
    selections,
  };
  const profile = {
    ...base.profile,
    id: `radar-${scenario}-profile-v1`,
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    origin: {
      eastM: model.platformPose[0].east_m,
      northM: model.platformPose[0].north_m,
    },
    platform: {
      kind: "moving",
      environment: scenario,
      poseSampling: "dwell_midpoint",
      attitudeModel: "level_yaw_only",
    },
    beamReference: "platform_heading",
    rangeConvention:
      scenario === "airborne" ? "slant_range" : "horizontal_range",
    ...(scenario === "airborne"
      ? {
          projection: {
            kind: "declared_horizontal_plane",
            upM: 0,
            assumption: "all_returns_on_plane",
          },
        }
      : {}),
    products: {
      ...base.profile.products,
      platformPose: "product:platformPose",
    },
    uncertainty: {
      ...base.profile.uncertainty,
      conditioning: "declared_pose_and_projection",
    },
  };
  for (const [name, value] of Object.entries({
    "observation.json": observation,
    "acquisition.json": context,
    "source-selection.json": selection,
    "radar-profile.json": profile,
  }))
    files.set(name, json(value));
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
    schedule: model.schedule.map((row, i) => ({ row: i, ...row })),
    platformPose: model.platformPose.map((row, i) => ({ row: i, ...row })),
    detections: model.detections.map((row, i) => ({ row: i, ...row })),
    tracks: model.tracks.map((row, i) => ({
      row: i,
      ...row,
      detection_ids: model.associations
        .filter(
          (a) => a.track_id === row.track_id && a.scan_index === row.scan_index,
        )
        .map((a) => a.detection_id),
    })),
    truth: model.truth.map((row, i) => ({ row: i, ...row })),
    methods,
    sources: Object.fromEntries(
      [...files].map(([name, bytes]) => [
        name,
        {
          sha256: sha(bytes),
          byteLength: bytes.length,
          mediaType: artifact(name).mediaType,
        },
      ]),
    ),
  };
  files.set("index.json", json(index));
  return {
    files,
    assets,
    observation,
    context,
    selection,
    profile,
    index,
    model,
  };
}
export async function emit(directory = path.join(here, "generated")) {
  const packets = [];
  for (const scenario of Object.keys(scenarioConfigs)) {
    const packet = await createPacket(scenario),
      destination = path.join(directory, scenario);
    await mkdir(destination, { recursive: true });
    for (const [name, bytes] of packet.files)
      await writeFile(path.join(destination, name), bytes);
    packets.push(packet);
  }
  return packets;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  for (const p of await emit(process.argv[2]))
    console.log(
      `${p.index.id}: ${p.files.size} files, ${p.model.detections.length} detections, ${p.model.tracks.length} track states`,
    );
