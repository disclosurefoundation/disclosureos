import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config, simulate } from "./model.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const known = (value) => ({ state: "known", value }),
  unknown = (reason) => ({ state: "unknown", reason });
const end = "2026-07-28T22:15:08Z";
export async function createPacket() {
  const model = simulate(),
    files = new Map();
  const definitions = {
    pressure: "pressure.f32",
    sampleMask: "sample-mask.u8",
    powerSpectralDensity: "power-spectral-density.f32",
    frameMask: "frame-mask.u8",
  };
  for (const [role, file] of Object.entries(definitions)) {
    const values = model[role],
      mask = file.endsWith("u8"),
      bytes = Buffer.alloc(values.length * (mask ? 1 : 4));
    values.forEach((v, i) =>
      mask ? bytes.writeUInt8(v, i) : bytes.writeFloatLE(v, i * 4)
    );
    files.set(file, bytes);
  }
  const methods = {
    id: "sonar-passive-methods-v1",
    version: "1.0.0",
    fictional: true,
    config,
    description:
      "Authored single-channel pressure waveform with reproducible windowed spectral density. No physical hydrophone, measured acoustic field or propagation model.",
    waveform:
      "t=sample/4096. Tone=0.002*(0.85+0.15*cos(2π*0.4*t))*sin(2π*224*t); harmonic=0.0007*sin(2π*448*t+0.4). For u=t−1 in[0,6], chirp=0.0015*sin(π*u/6)^2*sin(2π*(480*u+(640/12)*u²)), otherwise 0. Transient=0.003*exp(−0.5*((t−5.7)/0.07)^2)*sin(2π*1450*t). Background is deterministic 32-bit integer-hash noise scaled to±0.00012 Pa; executable formula in model.mjs. Pressure=float32(sum).",
    transform:
      "For each complete 512-sample window, remove arithmetic mean before applying periodic Hann w[n]=0.5−0.5cos(2πn/N). PSD=|DFT(w*(x−mean))|²/(fs*sum(w²)), doubling bins1..N/2−1 only. Retain float32 Pa²/Hz. No zero padding. Window starts advance 128 samples; no partial final window.",
    availability:
      "Pressure indices 12800..13823 and 25600..25855 are not retained. Sample mask 0 means unavailable and uses a zero pressure storage placeholder. Frame mask 1 only if all 512 inputs are retained, including zero-weight Hann endpoints. Missing frames store zero PSD placeholders. No interpolation, filling or physical-cause inference.",
    timing:
      "UTC origin is authored, not clock-traceable. Sample index i maps to i/4096 s. Window index f starts at f*128/4096 s; full-window center is(startSample+256)/4096 s. Last contributing sample=(startSample+511)/4096 s. Last recording sample 7.999755859375 s; nominal capture span 8 s.",
    display:
      "10log10(PSD/1e−12) dB re 1 µPa²/Hz. Retained zero density is negative infinity, not unavailable. Viewer color clipping must not change the retained value. Density is not broadband SPL.",
    limits: [
      "Pressure values are authored, not a measured physical calibration",
      "One channel; no bearing, range, beamforming or localization",
      "No source identity inference or detector",
      "No empirical hydrophone response, anti-alias filter, acoustic propagation or ambient-noise characterization",
      "8 Hz bin spacing is not an independent physical frequency-resolution claim",
      "Successful reproduction verifies numerical and source consistency only",
    ],
    references: [
      "https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.periodogram.html",
      "https://oceanexplorer.noaa.gov/technology/sonar/",
      "https://oceanservice.noaa.gov/facts/hydrophone.html",
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
      : file.endsWith("json")
      ? "application/json"
      : file.endsWith("md")
      ? "text/markdown"
      : "text/javascript",
  });
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "sonar-passive-v1",
    status: "published",
    createdAt: config.timeOrigin,
    updatedAt: end,
    summary:
      "Fictional single-hydrophone pressure recording with complete source windows, reproducible spectral density and explicit unavailable intervals.",
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
        id: "synthetic-pressure",
        kind: "instrument_data",
        access: "public",
        title: "Authored hydrophone pressure source",
      },
      {
        id: "methods",
        kind: "document",
        access: "public",
        title: "Authored pressure and spectral processing method",
        digest: artifact("methods.json").digest,
      },
      {
        id: "model-code",
        kind: "document",
        access: "public",
        title: "Executable pressure and spectral model",
        digest: artifact("model.mjs").digest,
      },
    ],
    products: [],
    methods: [
      { id: "hann-psd", version: "1.0.0", description: methods.transform },
    ],
    processing: [
      {
        id: "windowed-psd",
        methodRef: "method:hann-psd",
        methodVersion: "1.0.0",
        performedBy: "DisclosureOS synthetic example generator",
        performedAt: end,
        inputRefs: ["product:pressure", "product:sampleMask"],
        outputRefs: ["product:powerSpectralDensity", "product:frameMask"],
      },
    ],
    assertions: [],
    measurements: [],
    frames: [],
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        partnerData: false,
        model: "single_hydrophone_pressure",
        physicalValidation: "not_performed",
      },
    },
  };
  const sampleAxis = {
    kind: "time",
    name: "sample",
    length: config.samples,
    start: config.timeOrigin,
    stepSeconds: { numerator: 1, denominator: config.sampleRateHz },
  };
  const frameAxis = {
    kind: "time",
    name: "window_start",
    length: config.frames,
    start: config.timeOrigin,
    stepSeconds: {
      numerator: config.hopSamples,
      denominator: config.sampleRateHz,
    },
  };
  const frequencyAxis = {
    kind: "regular",
    name: "frequency",
    length: config.frequencyBins,
    origin: 0,
    step: config.sampleRateHz / config.windowSamples,
    unit: "Hz",
  };
  const layouts = [],
    assets = new Map();
  for (const [role, file] of Object.entries(definitions)) {
    const raw = role === "pressure" || role === "sampleMask",
      mask = role === "sampleMask" || role === "frameMask";
    observation.products.push({
      id: role,
      kind: raw ? "raw" : "derived",
      format: "application/octet-stream",
      access: "public",
      digest: artifact(file).digest,
      ...(raw
        ? {
            sourceRefs: [
              "source:synthetic-pressure",
              "source:methods",
              "source:model-code",
            ],
          }
        : { generatedBy: "process:windowed-psd" }),
    });
    layouts.push({
      id: role,
      productRef: `product:${role}`,
      ...artifact(file),
      kind: "binary_array",
      elementType: mask ? "uint8" : "float32",
      byteOrder: "little",
      order: "row_major",
      byteOffset: 0,
      quantity: {
        pressure: "sound_pressure",
        sampleMask: "sample_availability",
        powerSpectralDensity: "sound_pressure_power_spectral_density",
        frameMask: "window_availability",
      }[role],
      unit: {
        pressure: "Pa",
        sampleMask: "1",
        powerSpectralDensity: "Pa^2/Hz",
        frameMask: "1",
      }[role],
      axes: raw
        ? [structuredClone(sampleAxis)]
        : role === "frameMask"
        ? [structuredClone(frameAxis)]
        : [structuredClone(frameAxis), structuredClone(frequencyAxis)],
    });
    assets.set(`product:${role}`, files.get(file));
  }
  const context = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "sonar-passive-context-v1",
    instruments: [
      {
        id: "hydrophone-example",
        identity: {
          state: "known",
          manufacturer: "DisclosureOS synthetic example",
          model: "Single-channel numerical pressure",
        },
      },
    ],
    manifests: [
      {
        id: "hydrophone-manifest",
        instrumentRef: "instrument:hydrophone-example",
        version: "1.0.0",
        publishedAt: config.timeOrigin,
        artifact: artifact("methods.json"),
        configuration: {
          hardware: known("No physical hydrophone"),
          firmware: known("model.mjs version 1.0.0"),
        },
        channels: [
          {
            id: "pressure",
            quantity: "sound_pressure",
            unit: "Pa",
            sampling: unknown(
              "Authored 4096 Hz pressure samples; no physical sampling system characterized"
            ),
          },
        ],
      },
    ],
    deployments: [],
    calibrations: [],
    acquisitions: [
      {
        id: "passive-capture",
        instrumentRef: "instrument:hydrophone-example",
        manifest: { state: "pinned", ref: "manifest:hydrophone-manifest" },
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
            channelId: "pressure",
            calibration: {
              state: "unresolved",
              reason:
                "Pascals are authored; physical hydrophone calibration is not performed",
            },
          },
        ],
      },
    ],
    products: ["pressure", "sampleMask"].map((role) => ({
      id: role,
      kind: "raw",
      acquisitionRef: "acquisition:passive-capture",
      artifact: artifact(definitions[role]),
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
    id: "sonar-passive-selection-v1",
    observationId: observation.id,
    layouts,
    selections: Object.keys(definitions).map((role) => ({
      id: `${role}-example`,
      layoutRef: `layout:${role}`,
      selector: {
        kind: "array_element",
        indices:
          role === "powerSpectralDensity"
            ? [32, 28]
            : role === "frameMask"
            ? [32]
            : [4352],
      },
    })),
  };
  const profile = {
    kind: "passive_sonar_profile",
    schemaVersion: "0.1.0",
    id: "sonar-passive-profile-v1",
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:passive-capture",
    acquisitionProductRef: "product:pressure",
    sampleMaskAcquisitionProductRef: "product:sampleMask",
    channelId: "pressure",
    processingRef: "process:windowed-psd",
    timeOrigin: config.timeOrigin,
    mode: "single_hydrophone_pressure",
    dataOrigin: "synthetic",
    sampling: { samples: config.samples, sampleRateHz: config.sampleRateHz },
    transform: {
      kind: "one_sided_power_spectral_density",
      windowSamples: config.windowSamples,
      hopSamples: config.hopSamples,
      window: "periodic_hann",
      detrend: "remove_arithmetic_mean_before_window",
      padding: "none_full_windows_only",
      scaling: "sum_squared_window_times_sample_rate",
      oneSided: "double_interior_bins_only",
      missingWindow: "unavailable_if_any_input_missing",
    },
    display: {
      densityReferencePa2PerHz: 1e-12,
      logarithm: "10_log10_density_over_reference",
      zeroDensity: "negative_infinity_no_floor",
    },
    availability: {
      unavailable: 0,
      available: 1,
      missingValue: "zero_storage_placeholder",
    },
    products: Object.fromEntries(
      Object.keys(definitions).map((role) => [role, `product:${role}`])
    ),
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
    "passive-sonar-profile.json": profile,
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
    `Generated ${p.files.size} passive-sonar files; ${
      p.model.frameMask.filter(Boolean).length
    } retained spectral windows.`
  );
}
