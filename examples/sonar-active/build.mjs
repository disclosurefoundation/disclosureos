import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config, simulate } from "./model.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const known = (value) => ({ state: "known", value });
const unknown = (reason) => ({ state: "unknown", reason });
const end = "2026-07-28T22:11:04Z";
export async function createPacket() {
  const model = simulate(),
    files = new Map();
  const envelope = Buffer.alloc(model.amplitudes.length * 4);
  model.amplitudes.forEach((v, i) => envelope.writeFloatLE(v, i * 4));
  files.set("echo-envelope.f32", envelope);
  files.set("receive-mask.u8", Buffer.from(model.receiveMask));
  const methods = {
    id: "sonar-active-methods-v1",
    version: "1.0.0",
    fictional: true,
    config,
    description:
      "Authored normalized echo envelope with a separate receive-retention mask. No physical receiver or acoustic propagation simulation.",
    formula:
      "G(x,w)=exp(-0.5*(x/w)^2). First=0.46*(0.85+0.15*cos(0.15*p))*G(b-(42+1.6*p),3.5). Second=0.34*(0.85+0.15*sin(0.22*p))*G(b-(189-1.25*p),5). Transient=0.28*G(p-15,1.7)*G(b-222,3). Background=0.018+0.007*sin(1.3*b+0.33*p)+0.005*cos(0.18*b-0.4*p). Available amplitude=float32(clamp(sum,0,1)). p is ping index; b is delay bin. Component names are authored terms, not recovered objects.",
    timing:
      "Ping p originates at timeOrigin+p seconds. Delay b is b*0.001 seconds after transmission, not the ping interval. Receive offset is p+b*0.001 seconds. UTC is authored, with no physical clock traceability.",
    distance:
      "Conditional one-way path length=1500*two-way delay/2 metres. Constant sound speed is assumed, not measured. No direction, depth or straight-line position is established. Bin spacing is not physical range resolution.",
    availability:
      "Mask0 for pings28..30, and for pings44..49 with bins120..151; otherwise1. Mask0 means amplitude not retained. Its float32 slot is a zero placeholder, not a measured value. Gaps are authored omissions without an inferred physical cause.",
    limits: [
      "No physical calibration or sound-pressure units",
      "No waveform, Doppler or carrier-frequency model",
      "No beam geometry, localization or bathymetry",
      "No detector, tracking or object identities",
      "No pulse bandwidth, propagation, multipath or measured sound-speed profile",
      "No empirical uncertainty or physical sample-resolution claim",
    ],
  };
  files.set("methods.json", json(methods));
  files.set("model.mjs", await readFile(path.join(here, "model.mjs")));
  files.set("README.md", await readFile(path.join(here, "README.md")));
  const artifact = (file) => ({
    digest: { algorithm: "sha256", value: digest(files.get(file)) },
    byteLength: files.get(file).length,
    mediaType: /\.(f32|u8)$/.test(file)
      ? "application/octet-stream"
      : file.endsWith(".json")
      ? "application/json"
      : file.endsWith(".md")
      ? "text/markdown"
      : "text/javascript",
  });
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "sonar-active-v1",
    status: "published",
    createdAt: config.timeOrigin,
    updatedAt: end,
    summary:
      "Fictional active sonar echo-envelope capture with explicit sample retention and an assumed two-way distance conversion.",
    eventTime: {
      state: "known",
      value: {
        kind: "interval",
        start: { kind: "instant", value: config.timeOrigin, timeScale: "UTC" },
        end: { kind: "instant", value: end, timeScale: "UTC" },
      },
      sourceRefs: ["source:methods"],
    },
    position: unknown("not_collected"),
    sources: [
      {
        id: "synthetic-envelope",
        kind: "instrument_data",
        access: "public",
        title: "Authored monostatic echo-envelope source",
      },
      {
        id: "methods",
        kind: "document",
        access: "public",
        title: "Authored envelope methods and assumptions",
        digest: artifact("methods.json").digest,
      },
      {
        id: "model-code",
        kind: "document",
        access: "public",
        title: "Executable numerical envelope model",
        digest: artifact("model.mjs").digest,
      },
    ],
    products: [],
    methods: [],
    processing: [],
    assertions: [],
    measurements: [],
    frames: [],
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        partnerData: false,
        model: "monostatic_echo_envelope",
        physicalValidation: "not_performed",
      },
    },
  };
  const axes = [
    {
      kind: "time",
      name: "ping",
      length: config.pings,
      start: config.timeOrigin,
      stepSeconds: { numerator: 1, denominator: 1 },
    },
    {
      kind: "regular",
      name: "two_way_delay",
      length: config.delayBins,
      origin: config.delayStartSeconds,
      step: config.delayStepSeconds,
      unit: "s",
    },
  ];
  const definitions = {
      amplitudes: "echo-envelope.f32",
      receiveMask: "receive-mask.u8",
    },
    layouts = [],
    assets = new Map();
  for (const [role, file] of Object.entries(definitions)) {
    observation.products.push({
      id: role,
      kind: "raw",
      format: "application/octet-stream",
      access: "public",
      digest: artifact(file).digest,
      sourceRefs: [
        "source:synthetic-envelope",
        "source:methods",
        "source:model-code",
      ],
    });
    layouts.push({
      id: role,
      productRef: `product:${role}`,
      ...artifact(file),
      kind: "binary_array",
      elementType: role === "amplitudes" ? "float32" : "uint8",
      byteOrder: "little",
      order: "row_major",
      byteOffset: 0,
      quantity:
        role === "amplitudes"
          ? "normalized_echo_amplitude"
          : "receive_availability",
      unit: "1",
      axes: structuredClone(axes),
    });
    assets.set(`product:${role}`, files.get(file));
  }
  const context = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "sonar-active-context-v1",
    instruments: [
      {
        id: "sonar-example",
        identity: {
          state: "known",
          manufacturer: "DisclosureOS synthetic example",
          model: "Monostatic numerical echo envelope",
        },
      },
    ],
    manifests: [
      {
        id: "sonar-manifest",
        instrumentRef: "instrument:sonar-example",
        version: "1.0.0",
        publishedAt: config.timeOrigin,
        artifact: artifact("methods.json"),
        configuration: {
          hardware: known("No physical hardware"),
          firmware: known("model.mjs version 1.0.0"),
        },
        channels: [
          {
            id: "echo-envelope",
            quantity: "normalized_echo_amplitude",
            unit: "1",
            sampling: unknown(
              "Authored ping/delay grid, no physical receiver sample rate characterized"
            ),
          },
        ],
      },
    ],
    deployments: [],
    calibrations: [],
    acquisitions: [
      {
        id: "sonar-capture",
        instrumentRef: "instrument:sonar-example",
        manifest: { state: "pinned", ref: "manifest:sonar-manifest" },
        deployment: {
          state: "unresolved",
          reason: "Synthetic source without physical deployment",
        },
        classification: "known_control",
        time: {
          state: "known",
          kind: "interval",
          start: config.timeOrigin,
          end,
          timeScale: "UTC",
        },
        clock: {
          source: known("Authored source timeline"),
          synchronization: unknown("No physical synchronization"),
          resolution: unknown("No physical clock characterized"),
          uncertainty: unknown("No physical clock characterized"),
        },
        channels: [
          {
            channelId: "echo-envelope",
            calibration: {
              state: "unresolved",
              reason: "Normalized amplitude has no physical calibration",
            },
          },
        ],
      },
    ],
    products: Object.entries(definitions).map(([role, file]) => ({
      id: role,
      kind: "raw",
      acquisitionRef: "acquisition:sonar-capture",
      artifact: artifact(file),
    })),
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        physicalCalibration: "not_performed",
      },
    },
  };
  const selection = {
    kind: "product_source_selection",
    schemaVersion: "0.1.0",
    id: "sonar-active-selection-v1",
    observationId: observation.id,
    layouts,
    selections: Object.keys(definitions).flatMap((role) =>
      [
        [0, 0],
        [28, 130],
        [63, 255],
      ].map(([ping, bin], i) => ({
        id: `${role}-${i}`,
        layoutRef: `layout:${role}`,
        selector: { kind: "array_element", indices: [ping, bin] },
      }))
    ),
  };
  const { timeOrigin, soundSpeedMps, ...sampling } = config;
  const profile = {
    kind: "sonar_profile",
    schemaVersion: "0.1.0",
    id: "sonar-active-profile-v1",
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:sonar-capture",
    acquisitionProductRef: "product:amplitudes",
    receiveMaskAcquisitionProductRef: "product:receiveMask",
    channelId: "echo-envelope",
    timeOrigin,
    mode: "monostatic_echo_envelope",
    dataOrigin: "synthetic",
    amplitudeRepresentation: "normalized_envelope",
    sampling,
    propagation: {
      kind: "constant_assumed_sound_speed",
      soundSpeedMps,
      travelPath: "two_way",
      distanceMeaning: "modeled_one_way_path_length",
    },
    availability: {
      kind: "receive_retention_mask",
      unavailable: 0,
      available: 1,
      missingAmplitude: "zero_storage_placeholder",
    },
    products: {
      amplitudes: "product:amplitudes",
      receiveMask: "product:receiveMask",
    },
  };
  const index = {
    id: observation.id,
    config,
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
    "sonar-profile.json": profile,
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
  const packet = await emit(process.argv[2]);
  console.log(
    `Generated ${packet.files.size} sonar files with ${
      packet.model.receiveMask.filter((v) => v === 1).length
    } retained amplitudes.`
  );
}
