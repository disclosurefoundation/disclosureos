import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as modelConfig, simulate } from "./model.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n"),
  digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const unknown = (reason) => ({ state: "unknown", reason }),
  known = (value) => ({ state: "known", value });
const publishedAt = "2026-07-28T22:30:00Z";
const columns = {
  pulses: [
    "pulse_id",
    "scan_row",
    "scan_column",
    "aim_x_m",
    "aim_y_m",
    "aim_z_m",
    "status",
    "return_count",
  ],
  points: [
    "pulse_id",
    "return_number",
    "return_count",
    "x_m",
    "y_m",
    "z_m",
    "intensity",
    "class_code",
  ],
};
export async function createPacket() {
  const config = structuredClone(modelConfig),
    model = simulate(),
    files = new Map(),
    definitions = { pulses: "pulses.csv", points: "points.csv" };
  const rows = {
    pulses: model.pulses.map((p) => [
      p.id,
      p.scanRow,
      p.scanColumn,
      ...p.aim,
      p.status,
      p.returnCount ?? "",
    ]),
    points: model.points.map((p) => [
      p.pulseId,
      p.returnNumber,
      p.returnCount,
      p.x,
      p.y,
      p.z,
      p.intensity,
      p.classCode,
    ]),
  };
  for (const role of ["pulses", "points"])
    files.set(
      definitions[role],
      Buffer.from(
        [columns[role], ...rows[role]].map((row) => row.join(",")).join("\n") +
          "\n"
      )
    );
  const methods = {
    id: "lidar-point-cloud-methods-v1",
    version: "1.0.0",
    fictional: true,
    config,
    description:
      "Authored fixed-sensor lidar geometry with complete discrete-return groups and an explicit pulse ledger. This is a reference source table, not measured lidar or a radiometric simulation.",
    geometry:
      "33 rows x41 columns. Aim x=-18+36*column/40, y=2+28*row/32, z=0.5+0.025*x+0.02*y. Sensor=(0,0,18). Ray intersection at height h has t=(18-h)/(18-aim_z) and point=(aim_x*t,aim_y*t,h). Round stored coordinates to6 decimal places. Aim is a direction reference; no-return/unavailable rows do not measure it.",
    scene:
      "Roof z4.8 within x[2,9],y[6,12] yields one opaque roof-patch return; walls are not modeled. Otherwise a ray with z6.2 intersection inside ellipse centered(-7,12), radii(4.4,4.2), yields vegetation at6.2 and at3.8 except when(row+column)%3=0, followed by terrain. All other retained rays yield terrain. Ground rows at row15,column<4 are deliberately unassigned. Return ordinals increase in slant range.",
    amplitude:
      "Normalized authored return amplitudes: roof0.72+0.06*sin(column*0.5), top vegetation0.38+0.05*cos(row), lower vegetation0.29+0.04*sin(column), terrain0.48+0.08*sin(aim_x*0.31)*cos(aim_y*0.23); round to6 decimals. No calibrated radiometry or physical material inference.",
    availability:
      "Rows23..27 columns29..35 are unavailable with unknown count represented by an empty CSV cell. Rows3..8 columns3..8 are authored no_return detections with count0. No physical cause is assigned. Other rows retain every declared return. Missing/no-return cells are not surfaces or empty-volume certification.",
    classification:
      "Codes are an explicitly authored scene lookup:0 unassigned,2 terrain,5 vegetation,6 structure. They are source annotations, not inferred classifications or a claim of LAS conformance.",
    timing:
      "No per-pulse timestamps, travel times, frequency or scanning rate are supplied. Row-major pulse order is only an index. The document publication timestamp does not date the individual pulses.",
    tolerance:
      "Ray tolerance1e-5 m covers decimal serialization consistency only. It is not sensor accuracy, measurement uncertainty or a claimed survey resolution.",
    limits: [
      "No geographic registration or physical instrument calibration",
      "No beam footprint, divergence, propagation, receiver response, waveform or detection model",
      "No time-of-flight inference from geometric coordinates",
      "No material identity from intensity or automatic class accuracy",
      "No interpolation, ground estimate under the roof, or empty-space inference",
    ],
    references: [
      "https://lasformat.org/latest/02.00_definition.html#point-data-record-format-6",
      "https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-collection-requirements",
      "https://pubs.usgs.gov/tm/11b4/pdf/tm11-B4.pdf",
    ],
  };
  files.set("methods.json", json(methods));
  files.set("model.mjs", await readFile(path.join(here, "model.mjs")));
  files.set("README.md", await readFile(path.join(here, "README.md")));
  const artifact = (file) => ({
    digest: { algorithm: "sha256", value: digest(files.get(file)) },
    byteLength: files.get(file).length,
    mediaType: file.endsWith("csv")
      ? "text/csv"
      : file.endsWith("json")
      ? "application/json"
      : file.endsWith("md")
      ? "text/markdown"
      : "text/javascript",
  });
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "lidar-point-cloud-v1",
    status: "published",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    summary:
      "Fictional static lidar return cloud with authored terrain, vegetation and roof, complete pulse linkage and explicit unavailable/no-return cells.",
    eventTime: unknown("not_collected"),
    position: unknown("not_collected"),
    sources: [
      {
        id: "synthetic-lidar",
        kind: "instrument_data",
        access: "public",
        title: "Authored discrete-return lidar source tables",
      },
      {
        id: "methods",
        kind: "document",
        access: "public",
        title: "Authored local geometry and classification method",
        digest: artifact("methods.json").digest,
      },
      {
        id: "model-code",
        kind: "document",
        access: "public",
        title: "Executable lidar geometry model",
        digest: artifact("model.mjs").digest,
      },
    ],
    products: ["pulses", "points"].map((role) => ({
      id: role,
      kind: "raw",
      format: "text/csv",
      access: "public",
      digest: artifact(definitions[role]).digest,
      sourceRefs: [
        "source:synthetic-lidar",
        "source:methods",
        "source:model-code",
      ],
    })),
    methods: [],
    processing: [],
    assertions: [],
    measurements: [],
    frames: [],
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        partnerData: false,
        model: "static_discrete_return_raster",
        physicalValidation: "not_performed",
      },
    },
  };
  const context = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "lidar-point-cloud-context-v1",
    instruments: [
      {
        id: "lidar-example",
        identity: {
          state: "known",
          manufacturer: "DisclosureOS synthetic example",
          model: "Static discrete-return numerical geometry",
        },
      },
    ],
    manifests: [
      {
        id: "lidar-manifest",
        instrumentRef: "instrument:lidar-example",
        version: "1.0.0",
        publishedAt,
        artifact: artifact("methods.json"),
        configuration: {
          hardware: known("No physical lidar"),
          firmware: known("model.mjs version1.0.0"),
        },
        channels: [
          {
            id: "returns",
            quantity: "lidar_return_position",
            unit: "m",
            sampling: unknown(
              "Authored raster; pulse timing and instrument sampling characteristics are not provided"
            ),
          },
        ],
      },
    ],
    deployments: [],
    calibrations: [],
    acquisitions: [
      {
        id: "lidar-capture",
        instrumentRef: "instrument:lidar-example",
        manifest: { state: "pinned", ref: "manifest:lidar-manifest" },
        deployment: {
          state: "unresolved",
          reason: "Synthetic source without physical deployment",
        },
        classification: "known_control",
        time: unknown("Authored pulse indices have no timestamps"),
        clock: {
          source: unknown("No pulse timestamps"),
          synchronization: unknown("No physical synchronization"),
          resolution: unknown("No physical clock"),
          uncertainty: unknown("No physical clock"),
        },
        channels: [
          {
            channelId: "returns",
            calibration: {
              state: "unresolved",
              reason:
                "Coordinates and amplitudes are authored; physical calibration is not performed",
            },
          },
        ],
      },
    ],
    products: ["pulses", "points"].map((role) => ({
      id: role,
      kind: "raw",
      acquisitionRef: "acquisition:lidar-capture",
      artifact: artifact(definitions[role]),
    })),
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        physicalCalibration: "not_performed",
      },
    },
  };
  const layouts = ["pulses", "points"].map((role) => ({
    id: role,
    productRef: `product:${role}`,
    ...artifact(definitions[role]),
    kind: "csv_table",
    encoding: "utf-8",
    delimiter: ",",
    header: true,
    rowCount: rows[role].length,
    columns: [...columns[role]],
  }));
  const selection = {
    kind: "product_source_selection",
    schemaVersion: "0.1.0",
    id: "lidar-point-cloud-selection-v1",
    observationId: observation.id,
    layouts,
    selections: ["pulses", "points"].map((role) => ({
      id: `${role}-example`,
      layoutRef: `layout:${role}`,
      selector: { kind: "table_row", row: 0 },
    })),
  };
  const profile = {
    kind: "lidar_point_cloud_profile",
    schemaVersion: "0.1.0",
    id: "lidar-point-cloud-profile-v1",
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:lidar-capture",
    channelId: "returns",
    acquisitionProducts: { pulses: "product:pulses", points: "product:points" },
    dataOrigin: "synthetic",
    mode: "static_discrete_return_raster",
    coordinateFrame: {
      kind: "local_cartesian",
      axes: ["east", "north", "up"],
      unit: "m",
      handedness: "right_handed",
      originDescription:
        "Authored local origin and illustrative east/north/up axes; no surveyed geographic reference.",
      sensorOrigin: config.sensorOrigin,
      georeferencing: "not_provided",
    },
    scan: {
      rows: config.rows,
      columns: config.columns,
      pulses: model.pulses.length,
      points: model.points.length,
      order: "row_major_index_not_time",
      aim: "direction_reference_not_surface_hit",
    },
    geometry: {
      nearRangeM: config.nearRangeM,
      farRangeM: config.farRangeM,
      rayToleranceM: config.rayToleranceM,
      toleranceMeaning: "encoding_consistency_not_measurement_uncertainty",
      bounds: config.bounds,
    },
    intensity: {
      kind: "normalized_return_amplitude",
      min: 0,
      max: 1,
      calibration: "not_calibrated_to_reflectance",
    },
    classifications: {
      authority: "authored_annotations",
      method: methods.classification,
      classes: config.classes,
    },
    availability: {
      retained: "complete_return_group",
      noReturn: "zero_detected_returns_not_clear_space",
      unavailable: "unknown_return_count_empty_cell",
      noTiming: "no_per_pulse_timestamps",
    },
    products: { pulses: "product:pulses", points: "product:points" },
  };
  const assets = new Map(
    ["pulses", "points"].map((role) => [
      `product:${role}`,
      files.get(definitions[role]),
    ])
  );
  const index = {
    id: observation.id,
    config,
    counts: {
      pulses: model.pulses.length,
      points: model.points.length,
      retained: model.pulses.filter((p) => p.status === "retained").length,
      noReturn: model.pulses.filter((p) => p.status === "no_return").length,
      unavailable: model.pulses.filter((p) => p.status === "unavailable")
        .length,
    },
    files: Object.fromEntries(
      Object.entries(definitions).map(([role, file]) => [
        role,
        {
          file,
          sha256: digest(files.get(file)),
          byteLength: files.get(file).length,
          mediaType: artifact(file).mediaType,
        },
      ])
    ),
    methods,
  };
  for (const [file, value] of Object.entries({
    "observation.json": observation,
    "acquisition.json": context,
    "source-selection.json": selection,
    "lidar-profile.json": profile,
  }))
    files.set(file, json(value));
  index.sources = Object.fromEntries(
    [...files].map(([file, bytes]) => [
      file,
      {
        sha256: digest(bytes),
        byteLength: bytes.length,
        mediaType: artifact(file).mediaType,
      },
    ])
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
    model,
  };
}
export async function emit(directory = path.join(here, "generated")) {
  const packet = await createPacket();
  await mkdir(directory, { recursive: true });
  for (const [file, bytes] of packet.files)
    await writeFile(path.join(directory, file), bytes);
  return packet;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const p = await emit(process.argv[2]);
  console.log(
    `Generated ${p.files.size} lidar files; ${p.model.pulses.length} pulses, ${p.model.points.length} returns.`
  );
}
