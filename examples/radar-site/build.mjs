import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket as fixedPacket } from "../radar-scanning/build.mjs";
import { scenarioConfigs, simulate } from "./model.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + "\n");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const csv = (rows) =>
  Buffer.from(
    Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((row) => Object.values(row).join(",")).join("\n") +
      "\n"
  );
const binary = (values) => {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => b.writeFloatLE(v, i * 4));
  return b;
};
export async function createPacket(scenario = "ground") {
  const c = scenarioConfigs[scenario];
  if (!c) throw Error("Unknown site radar scenario");
  const base = await fixedPacket(),
    model = simulate(c),
    files = new Map();
  const definitions = {
    schedule: ["scan-schedule.csv", "raw"],
    returns: ["returns.f32", "raw"],
    referenceCapture: ["reference-capture.f32", "raw"],
    backgroundPower: ["background-power.f32", "derived"],
    eligibility: ["detection-eligibility.u8", "raw"],
    processedReturns: ["processed-returns.f32", "derived"],
    thresholds: ["thresholds.f32", "derived"],
    detections: ["detections.csv", "derived"],
    tracks: ["tracks.csv", "derived"],
    associations: ["associations.csv", "derived"],
    truth: ["scenario-truth.csv", "derived"],
    "track-state": ["track-state.csv", "derived"],
    siteFeatures: ["site-features.csv", "raw"],
  };
  for (const [key, [name]] of Object.entries(definitions)) {
    const values = key === "track-state" ? model.states : model[key];
    files.set(
      name,
      name.endsWith(".f32")
        ? binary(values)
        : name.endsWith(".u8")
        ? Buffer.from(values)
        : csv(values)
    );
  }
  const duration = c.scans * c.scanSeconds,
    endTime = new Date(
      Date.parse(c.timeOrigin) + duration * 1000
    ).toISOString(),
    referenceStart = new Date(
      Date.parse(c.timeOrigin) - c.referenceScans * c.scanSeconds * 1000
    ).toISOString();
  const methods = {
    id: `radar-${scenario}-methods-v1`,
    version: "1.0.0",
    fictional: true,
    config: c,
    description:
      scenario === "ground"
        ? "A fictional fixed-site horizontal surveillance capture with retained raw power, independent reference acquisition, explicit background subtraction and detector exclusions."
        : "A fictional primary airport surface-surveillance capture. Runway, taxiway and apron geometry are authored context; moving returns are not automatically classified or identified.",
    synthesis: {
      seedGenerator: "mulberry32",
      timeline:
        "Twenty-four 4-second rotating scans, 180 azimuth centers at 2-degree intervals and 64 horizontal range centers at 25+50r metres. Main samples evaluated at dwell midpoint. Eight target-free reference scans precede the main capture.",
      targetModel:
        scenario === "ground"
          ? "Scene A:E=-1700+28t,N=1200. Scene B:E=900,N=-1500+20t. Metres and seconds."
          : "Surface A:E=700,N=-1100+22t; surface B:E=-850+9t,N=300; surface C:E=-900,N=-400+8t through 87.5 seconds, then E=-900+8(t-87.5),N=300. All positions in a horizontal surface plane; no climb, landing guidance or aircraft-identity claim.",
      beam: "Gaussian power response sigma 1 degree, FWHM 2.354820045 degrees; range response sigma 36 m. Physical range, angular resolution and RF performance are not calibrated.",
      reference:
        "Independent reference seed and target-free source acquisition. The same static authored background appears in reference and main captures, with independent uniform [0.96,1.04] multiplicative texture and independent exponential noise mean 0.055 plus floor 0.025.",
      background:
        scenario === "ground"
          ? "Gaussian static components: E-900,N725,gain 6,angular sigma 4 degrees,range sigma95 m; E800,N-600,gain 4.5,sigma 5 degrees/110 m; E-450,N1450,gain 0.9,sigma 18 degrees/280 m."
          : "Gaussian static components: E-1250,N900,gain 7,angular sigma 5 degrees,range sigma100 m; E100,N-650,gain 5,sigma 12 degrees/110 m; E-1320,N100,gain 3.6,sigma 14 degrees/160 m.",
      attenuation:
        scenario === "ground"
          ? "Scene A gain 4.2. Scene B gain 3.8 falls to 0.008 in scans 11–13. Prescribed source fading, not a propagation or obstruction solution."
          : "Surface A gain 4.3; surface B gain 3.3 falls to 0.008 in scans 9–11; surface C gain 2.9. Prescribed source fading, not an operational coverage claim.",
      transient:
        "A gain 1.9 transient at bearing 240 degrees/range 2100 m during scan 5 is absent from the reference capture. It therefore survives static subtraction and is treated like any other return.",
      truth:
        "Separate scenario coordinates at every dwell end. Background estimation, detector policy, detection and tracking never consume these rows or target labels.",
    },
    preprocessing: {
      background:
        "At each azimuth/range cell, arithmetic mean of the eight retained float32 reference samples, rounded to float32 once. No truth or target position is used.",
      residual:
        "For every main source cell, float32(max(0,rawPower-backgroundPower)). The raw capture remains retained. Negative residuals are clamped, not interpreted as missing measurements.",
      eligibility:
        scenario === "ground"
          ? "Zero at cell centers within E[-170,170],N[1000,1500]; one elsewhere. This is a declared processing exclusion, not blocked reception or absence of an object."
          : "Zero at cell centers within E[-1600,-1000],N[-600,700], an authored apron processing exclusion; one elsewhere. Raw apron reception is retained. This policy is a demonstration, not a recommendation for airport operations.",
    },
    detector: {
      version: "eligible-residual-range-peaks-1",
      threshold:
        "max(0.6,4*mean(eligible training cells at range offsets -10..-3 and 3..10)). Boundaries clipped; if no eligible training cells exist, use 0.6. Not a calibrated CFAR false-alarm claim.",
      peaks:
        "Eligible centers only; retained residual power must meet threshold and be the maximum over eligible 3x3 azimuth/range neighbors. Azimuth wraps. Equal-power ties choose the lower storage index; first/last range bins excluded.",
      localization:
        "Exact retained horizontal range/azimuth cell center. No subcell interpolation or elevation inference.",
      timing:
        "Detection epoch is peak dwell midpoint. Neighboring azimuth processing requires the full scan; detections and tracks appear only at scan end.",
    },
    tracker: {
      ...base.index.methods.tracker,
      measurement:
        "Common horizontal detections only. Assumed independent sigma 60 m Cartesian errors; model confidence is not calibrated.",
      initialization:
        "Position from detection, zero velocity, covariance diag(3600,3600,900,900).",
      uncertainty:
        "95% Gaussian region conditional on the declared filter and fixed horizontal frame. No physical location accuracy is certified.",
    },
    siteContext:
      "site-features.csv contains authored static context in the same local horizontal frame. Structures, routes and exclusions are reference geometry, not measured radar contours. Labels do not classify detected objects.",
    exclusions: [
      ...base.index.methods.exclusions,
      "No blockage, terrain visibility, horizon, coverage-probability or detectability solution",
      "No airborne approach, target height, secondary transponder report, multi-sensor fusion or airport certification",
      "No real location, real airport layout or operational procedure",
    ],
  };
  files.set("methods.json", json(methods));
  files.set(
    "model.mjs",
    Buffer.from(
      (await readFile(path.join(here, "model.mjs"), "utf8")).replace(
        "../radar-scanning/model.mjs",
        "./radar-scanning-model.mjs"
      )
    )
  );
  files.set(
    "radar-scanning-model.mjs",
    await readFile(path.join(here, "../radar-scanning/model.mjs"))
  );
  files.set("README.md", await readFile(path.join(here, "README.md")));
  const artifact = (file) => ({
    digest: { algorithm: "sha256", value: sha(files.get(file)) },
    byteLength: files.get(file).length,
    mediaType:
      file.endsWith(".f32") || file.endsWith(".u8")
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
  observation.summary = methods.description;
  observation.eventTime.value.end.value = endTime;
  observation.frames[0].definition.description =
    "Fixed local east/north horizontal plane in metres. Station at (0,0); no terrestrial transform, target height or slant-range projection. Site geometry is authored context.";
  observation.extensions[
    "org.disclosure.simulation"
  ].model = `reduced_${scenario}_site_surveillance`;
  observation.sources.find((s) => s.id === "methods").digest =
    artifact("methods.json").digest;
  observation.sources.find((s) => s.id === "model-code").digest =
    artifact("model.mjs").digest;
  observation.sources.push({
    id: "model-base",
    kind: "document",
    access: "public",
    title: "Retained random generator and numerical tracker",
    digest: artifact("radar-scanning-model.mjs").digest,
  });
  observation.products = [];
  observation.methods = [];
  observation.processing = [];
  const process = (id, description, inputs, outputs) => {
    observation.methods.push({ id, version: "1.0.0", description });
    observation.processing.push({
      id,
      methodRef: `method:${id}`,
      methodVersion: "1.0.0",
      performedBy: "DisclosureOS deterministic numerical example",
      performedAt: endTime,
      inputRefs: [
        ...inputs,
        "source:methods",
        "source:model-code",
        "source:model-base",
      ],
      outputRefs: outputs,
    });
  };
  process(
    "background",
    "Arithmetic mean of retained reference samples.",
    ["product:referenceCapture"],
    ["product:backgroundPower"]
  );
  process(
    "subtract",
    "Float32 positive residual from raw capture and reference mean.",
    ["product:returns", "product:backgroundPower"],
    ["product:processedReturns"]
  );
  process(
    "threshold",
    "Range-neighborhood threshold on eligible residual cells.",
    ["product:processedReturns", "product:eligibility"],
    ["product:thresholds"]
  );
  process(
    "detect",
    "Eligible residual peaks at exact source-cell centers.",
    [
      "product:processedReturns",
      "product:thresholds",
      "product:eligibility",
      "product:schedule",
    ],
    ["product:detections"]
  );
  process(
    "track",
    "Detection-only constant-velocity Kalman estimate.",
    ["product:detections"],
    ["product:tracks", "product:associations", "product:track-state"]
  );
  process(
    "truth",
    "Separate authored scenario positions.",
    [],
    ["product:truth"]
  );
  const generatedBy = {
      backgroundPower: "background",
      processedReturns: "subtract",
      thresholds: "threshold",
      detections: "detect",
      tracks: "track",
      associations: "track",
      "track-state": "track",
      truth: "truth",
    },
    layouts = [],
    selections = [],
    assets = new Map();
  const azimuth = {
      kind: "regular",
      name: "azimuth",
      length: c.azimuthBins,
      origin: c.azimuthOriginDeg,
      step: c.azimuthStepDeg,
      unit: "deg",
    },
    range = {
      kind: "regular",
      name: "range",
      length: c.rangeBins,
      origin: c.rangeOriginM,
      step: c.rangeStepM,
      unit: "m",
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
    let indices;
    if (file.endsWith(".f32") || file.endsWith(".u8")) {
      const twoD = id === "backgroundPower" || id === "eligibility";
      const axes = twoD
        ? [azimuth, range]
        : [
            {
              kind: "index",
              name: id === "referenceCapture" ? "reference_scan" : "scan",
              length: id === "referenceCapture" ? c.referenceScans : c.scans,
              firstIndex: 0,
            },
            azimuth,
            range,
          ];
      layouts.push({
        ...common,
        kind: "binary_array",
        elementType: id === "eligibility" ? "uint8" : "float32",
        byteOrder: "little",
        order: "row_major",
        byteOffset: 0,
        quantity:
          id === "eligibility"
            ? "detection_eligibility"
            : "normalized_return_power",
        unit: "1",
        axes,
      });
      indices = axes.map(() => 0);
    } else {
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
      selector: indices
        ? { kind: "array_element", indices }
        : { kind: "table_row", row: 0 },
    });
    assets.set(`product:${id}`, files.get(file));
  }
  const context = structuredClone(base.context);
  context.id = `radar-${scenario}-context-v1`;
  context.instruments[0].identity.model =
    scenario === "ground"
      ? "Reduced fixed-site primary radar source"
      : "Reduced primary airport surface-surveillance source";
  context.manifests[0].artifact = artifact("methods.json");
  context.manifests[0].publishedAt = referenceStart;
  context.acquisitions[0].time.end = endTime;
  context.products[0].artifact = artifact("returns.f32");
  const reference = structuredClone(context.acquisitions[0]);
  reference.id = "radar-reference";
  reference.time.start = referenceStart;
  reference.time.end = c.timeOrigin;
  context.acquisitions.push(reference);
  context.products.push({
    id: "referenceCapture",
    kind: "raw",
    acquisitionRef: "acquisition:radar-reference",
    artifact: artifact("reference-capture.f32"),
  });
  context.extensions["org.disclosure.simulation"].model =
    observation.extensions["org.disclosure.simulation"].model;
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
    detectionPosition: { kind: "cell_center" },
    preprocessing: {
      kind: "reference_mean_subtraction",
      referenceAcquisitionRef: "acquisition:radar-reference",
      referenceAcquisitionProductRef: "product:referenceCapture",
      referenceChannelId: "return-power",
      arithmetic: "float32_outputs",
      exclusionMeaning: "detector_policy",
    },
    products: {
      ...base.profile.products,
      referenceCapture: "product:referenceCapture",
      backgroundPower: "product:backgroundPower",
      eligibility: "product:eligibility",
      processedReturns: "product:processedReturns",
      siteFeatures: "product:siteFeatures",
    },
  };
  for (const [name, v] of Object.entries({
    "observation.json": observation,
    "acquisition.json": context,
    "source-selection.json": selection,
    "radar-profile.json": profile,
  }))
    files.set(name, json(v));
  const index = {
    id: observation.id,
    config: c,
    files: Object.fromEntries(
      Object.entries(definitions).map(([id, [file]]) => [
        id,
        {
          file,
          sha256: sha(files.get(file)),
          byteLength: files.get(file).length,
          mediaType: artifact(file).mediaType,
        },
      ])
    ),
    schedule: model.schedule.map((row, i) => ({ row: i, ...row })),
    detections: model.detections.map((row, i) => ({ row: i, ...row })),
    tracks: model.tracks.map((row, i) => ({
      row: i,
      ...row,
      detection_ids: model.associations
        .filter(
          (a) => a.track_id === row.track_id && a.scan_index === row.scan_index
        )
        .map((a) => a.detection_id),
    })),
    truth: model.truth.map((row, i) => ({ row: i, ...row })),
    siteFeatures: model.siteFeatures.map((row, i) => ({ row: i, ...row })),
    methods,
    sources: Object.fromEntries(
      [...files].map(([name, bytes]) => [
        name,
        {
          sha256: sha(bytes),
          byteLength: bytes.length,
          mediaType: artifact(name).mediaType,
        },
      ])
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
    const p = await createPacket(scenario),
      destination = path.join(directory, scenario);
    await mkdir(destination, { recursive: true });
    for (const [name, bytes] of p.files)
      await writeFile(path.join(destination, name), bytes);
    packets.push(p);
  }
  return packets;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  for (const p of await emit(process.argv[2]))
    console.log(
      `${p.index.id}: ${p.files.size} files, ${p.model.detections.length} detections`
    );
