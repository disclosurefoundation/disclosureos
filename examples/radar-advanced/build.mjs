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
      rows
        .map((row) =>
          Object.values(row)
            .map((value) => value ?? "")
            .join(",")
        )
        .join("\n") +
      "\n"
  );
const binary = (values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return bytes;
};
export async function createPacket(scenario = "military") {
  const config = scenarioConfigs[scenario];
  if (!config) throw Error(`Unknown advanced radar scenario: ${scenario}`);
  const base = await fixedPacket(),
    model = simulate(config),
    files = new Map(),
    military = scenario === "military";
  const definitions = military
    ? {
        schedule: ["beam-schedule.csv", "raw"],
        returns: ["returns.f32", "raw"],
        thresholds: ["thresholds.f32", "derived"],
        detections: ["detections.csv", "derived"],
        tracks: ["tracks.csv", "derived"],
        associations: ["associations.csv", "derived"],
        truth: ["scenario-truth.csv", "derived"],
        "track-state": ["track-state.csv", "derived"],
      }
    : {
        interrogations: ["interrogations.csv", "raw"],
        decodedReplies: ["decoded-replies.csv", "raw"],
        reports: ["reports.csv", "derived"],
        truth: ["scenario-truth.csv", "derived"],
      };
  for (const [key, [name]] of Object.entries(definitions))
    files.set(
      name,
      name.endsWith(".f32")
        ? binary(model[key])
        : csv(key === "track-state" ? model.states : model[key])
    );
  const duration = military
    ? model.schedule.at(-1).end_s
    : config.cycles * config.cycleSeconds;
  const endTime = new Date(
    Date.parse(config.timeOrigin) + duration * 1000
  ).toISOString();
  const methods = military
    ? {
        id: "radar-military-methods-v1",
        version: "1.0.0",
        fictional: true,
        config,
        description:
          "An educational electronically steered sector search and prescribed revisit schedule. This is one possible scheduling pattern, not a definition of military radar or a model of operational hardware.",
        synthesis: {
          seedGenerator: "mulberry32",
          schedule:
            "Sixteen cycles. Twelve 0.10 s search dwells cover bearings -55 to +55 degrees in 10 degree steps. After search slots2 and8, a0.18 s revisit points at26+0.5*cycle degrees. After slots5 and11, a0.18 s revisit points at-34+0.7*cycle degrees. The complete schedule is prescribed before detection and is not a tracking or adaptive resource-allocation solution.",
          targetModel:
            "Scene A:E=900+12t,N=1900-4t; Scene B:E=-1000+10t,N=1500+3t. Metres,seconds. Fixed horizontal plane, no elevation or target-height solution.",
          beam: "Gaussian power response sigma2.1 degrees, FWHM4.945122 degrees. Gaussian range response sigma36 m. Beam direction evaluated at retained dwell midpoint.",
          noise:
            "Exponential mean0.055 plus floor0.025. Broad stationary clutter peak0.42 at bearing-15 degrees and range900 m, angular sigma14 degrees, range sigma240 m, multiplied by uniform[0.8,1.2] texture.",
          attenuation:
            "Scene A gain4.2 becomes0.005 during cycles6–8. Scene B gain3.7 becomes0.005 during cycles11–12. Prescribed fading, not physical obstruction.",
          transient:
            "Additional gain2.4 component at bearing-5 degrees,range2200 m during cycle4. Detector and tracker see only its retained power.",
          truth:
            "Separate positions at each dwell midpoint. Scenario labels never enter the detector or tracker.",
        },
        detector: {
          version: "per-dwell-range-peaks-1",
          threshold:
            "max(0.6,4*mean(range offsets -10..-3 and3..10)), clipped at range boundaries. No calibrated CFAR probability.",
          peaks:
            "Power at least retained threshold; strictly greater than previous range bin and at least next range bin. First/last range bins excluded. No comparison across neighboring dwells because their directions and durations differ.",
          localization:
            "Exact retained range-bin center and scheduled beam direction in the fixed local horizontal plane. No subcell position, range interpolation or invented elevation.",
          timing:
            "Detection time is dwell midpoint; results become available at that dwell end. Arrays are indexed[dwell,range], with direction and duration supplied only by beam-schedule.csv.",
        },
        tracker: {
          ...base.index.methods.tracker,
          version: "chronological-dwell-nearest-neighbor-cv-kalman-1",
          measurement:
            "Common east/north detections only. Assumed independent sigma70 m errors; no truth label or target velocity input.",
          association:
            "Chronological per-dwell measurement updates; greedy squared Mahalanobis gate9.21034; at most one detection per track per dwell. No identity labels and no bearing/dwell-purpose hints.",
          initialization:
            "Position from detection, zero velocity, covariance diag(4900,4900,900,900).",
          update:
            "Joseph covariance update; predict and export active states at every dwell end. Confirmed after3 total hits. Coasting means no update during this dwell and is common when the beam looks elsewhere; it is not a missed-target claim. Retire after8 seconds without any detection update, not after a fixed number of beam visits.",
          uncertainty:
            "95% Gaussian horizontal ellipse from declared filter covariance. Fixed origin and horizontal geometry treated as exact; not a calibrated accuracy claim.",
          fullCovariance:
            "track-state.csv stores all4x4 entries plus total hits and last detection timestamp.",
        },
        exclusions: [
          ...base.index.methods.exclusions,
          "No adaptive scheduling, operational military specifications, weapon guidance, threat classification or IFF",
          "No elevation scan, propagation, antenna array or waveform simulation",
        ],
      }
    : {
        id: "radar-secondary-methods-v1",
        version: "1.0.0",
        fictional: true,
        config,
        description:
          "Fictional Mode A/Mode C interrogation and decoded reply records. This starts at decoded receiver output, not RF waveforms or pulse decoding. The derived report is an exact qualified selection of a retained decoded reply.",
        synthesis: {
          seedGenerator: "mulberry32",
          schedule:
            "Sixteen4-second cycles. Four0.5-second interrogations start at offsets0,0.8,1.6,2.4 seconds; the first pair points30 degrees,the second330 degrees, each50 degrees wide. Each pair is Mode A then Mode C. Authored reply time=start+0.3 s,available time=reply time+0.08 s. The timing is a reduced example, not a protocol latency claim.",
          targetModel:
            "Cooperative A:E=1200+18t,N=3400-8t,up1400 m,code0421,reported pressure altitude4600 ft. Cooperative B:E=-1500+11t,N=2700+5t,up2100 m,code6312,reported pressure altitude6800 ft. Unreplied scene:E=250+5t,N=2200+4t,up900 m,transponder disabled. Geometric up and reported pressure altitude are independent authored quantities.",
          sampling:
            "A transponder replies only when inside the current authored azimuth beam. Slant range is sqrt(E²+N²+up²) plus uniform±12 m; bearing plus uniform±0.12 degrees. No elevation response, horizon, terrain, propagation, multipath, mode interlace decoding or receiver RF simulation.",
          dropout:
            "A has no retained replies during cycles6–8; B during cycle10. Absence is represented by no decoded reply for an interrogation, never a synthetic zero range or altitude.",
          garble:
            "B has invalid decoded rows during cycle4. Every measurement/code/altitude is blank in those rows; invalid data remains inspectable and is not promoted into a usable report.",
          unavailableAltitude:
            "B Mode C rows during cycles11–12 have retained range/bearing but blank pressure altitude. Blank means not recorded. It is not zero altitude, geometric height or a negative observation.",
          truth:
            "Separate scenario positions and authored transponder state. The source without replies is visible only when explicitly inspecting generator truth; it does not appear as a sensor-reported aircraft.",
        },
        reports: {
          version: "qualified-decoded-reply-selection-1",
          selection:
            "One derived report per valid decoded reply, with report_id added and all retained fields copied exactly. The referenced interrogation must exist. Invalid replies are excluded without erasing them from the raw table.",
          identity:
            "Four-digit octal Mode A code is a reported transponder code. It is not aircraft identity, verified ownership, military classification or friend-or-foe authentication. Mode A and Mode C rows are not fused or associated into an aircraft track.",
          altitude:
            "Mode C pressure altitude uses1013.25 hPa reference and100 ft increments. No conversion to geometric elevation, terrain clearance or horizontal ground range is performed.",
          display:
            "Polar slant range and bearing. Do not treat the radial distance as horizontal range or place reports on an east/north ground map.",
          availability:
            "Explicit available_s controls report visibility. A valid row with unknown altitude remains a usable range/bearing report. A no-reply interval supports only the statement that no reply was retained.",
        },
        exclusions: [
          "No physical radar calibration or RF pulse decoder",
          "No operational protocol timing or hardware sensitivity claim",
          "No primary radar returns or inferred detection of the source with no reply",
          "No transponder identity verification, Mode S address, IFF or aircraft authentication",
          "No geometric-height conversion, target tracking or fusion across modes",
          "No calibrated false-reply probability or uncertainty ellipse",
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
  observation.summary = military
    ? "Fictional electronically steered sector capture with prescribed search/revisit beams, retained return arrays and chronological detection-only tracking."
    : "Fictional Mode A and Mode C decoded reply records with explicit valid, invalid and missing information. Usable reports retain exact reply lineage; separate scenario truth is not a sensor observation.";
  observation.eventTime.value.end.value = endTime;
  observation.frames[0].definition.description = military
    ? "Fixed local east/north horizontal plane in metres, radar at(0,0). No terrestrial transform or target elevation."
    : "Local east/north/up frame for independent generator truth only. Secondary reports remain polar slant range and bearing; no horizontal ground projection.";
  observation.extensions["org.disclosure.simulation"].model = military
    ? "reduced_steered_sector_radar"
    : "reduced_mode_a_mode_c_reply_source";
  observation.sources.find((s) => s.id === "methods").digest =
    artifact("methods.json").digest;
  observation.sources.find((s) => s.id === "model-code").digest =
    artifact("model.mjs").digest;
  observation.sources.push({
    id: "model-base",
    kind: "document",
    access: "public",
    title: "Retained random generator and numerical tracking primitives",
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
  if (military) {
    process(
      "threshold",
      "Empirical per-dwell range-neighborhood threshold.",
      ["product:returns"],
      ["product:thresholds"]
    );
    process(
      "detect",
      "Independent per-dwell range peak and exact range/beam cell center.",
      ["product:returns", "product:thresholds", "product:schedule"],
      ["product:detections"]
    );
    process(
      "track",
      "Detection-only chronological-dwell Kalman estimate.",
      ["product:detections", "product:schedule"],
      ["product:tracks", "product:associations", "product:track-state"]
    );
  } else
    process(
      "report",
      "Preserve valid decoded reply fields without identity fusion or altitude conversion.",
      ["product:decodedReplies", "product:interrogations"],
      ["product:reports"]
    );
  process(
    "truth",
    "Independent authored source scene for example evaluation.",
    [],
    ["product:truth"]
  );
  const layouts = [],
    selections = [],
    assets = new Map();
  const generatedBy = {
    thresholds: "threshold",
    detections: "detect",
    tracks: "track",
    associations: "track",
    "track-state": "track",
    truth: "truth",
    reports: "report",
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
          {
            kind: "index",
            name: "dwell",
            length: model.schedule.length,
            firstIndex: 0,
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
        ? { kind: "array_element", indices: [0, 0] }
        : { kind: "table_row", row: 0 },
    });
    assets.set(`product:${id}`, files.get(file));
  }
  const context = structuredClone(base.context);
  context.id = `radar-${scenario}-context-v1`;
  context.instruments[0].identity.model = military
    ? "Reduced electronically steered sector numerical source"
    : "Reduced Mode A and Mode C decoded reply source";
  context.manifests[0].artifact = artifact("methods.json");
  context.acquisitions[0].time.end = endTime;
  const acquisitionProduct = military ? "returns" : "decodedReplies",
    channelId = military ? "return-power" : "decoded-reply";
  context.products[0] = {
    id: acquisitionProduct,
    kind: "raw",
    acquisitionRef: "acquisition:radar-capture",
    artifact: artifact(definitions[acquisitionProduct][0]),
  };
  if (!military) {
    context.manifests[0].channels[0] = {
      id: channelId,
      quantity: "decoded_reply",
      unit: "1",
      sampling: {
        state: "unknown",
        reason:
          "Event-driven decoded replies; see retained interrogation and reply timestamps",
      },
    };
    context.acquisitions[0].channels = [
      {
        channelId,
        calibration: {
          state: "unresolved",
          reason:
            "Authored decoded source; no physical range, bearing or decoder calibration",
        },
      },
    ];
  }
  context.extensions["org.disclosure.simulation"].model =
    observation.extensions["org.disclosure.simulation"].model;
  const selection = {
    ...base.selection,
    id: `radar-${scenario}-selection-v1`,
    observationId: observation.id,
    layouts,
    selections,
  };
  const commonProfile = {
    schemaVersion: "0.1.0",
    id: `radar-${scenario}-profile-v1`,
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:radar-capture",
    acquisitionProductRef: `product:${acquisitionProduct}`,
    channelId,
    frameRef: "frame:radar-local",
    origin: { eastM: 0, northM: 0 },
    timeOrigin: config.timeOrigin,
    dataOrigin: "synthetic",
    bearingConvention: "clockwise_from_north",
  };
  const profile = military
    ? {
        ...commonProfile,
        kind: "steered_radar_profile",
        mode: "electronically_steered_sector",
        rangeConvention: "horizontal_range",
        beamWidthConvention: "full_width_half_maximum_power",
        processingAvailability: "dwell_end",
        detectionPosition: { kind: "cell_center" },
        products: {
          beamSchedule: "product:schedule",
          returns: "product:returns",
          thresholds: "product:thresholds",
          detections: "product:detections",
          tracks: "product:tracks",
          associations: "product:associations",
          truth: "product:truth",
        },
        uncertainty: base.profile.uncertainty,
      }
    : {
        ...commonProfile,
        kind: "secondary_radar_profile",
        mode: "mode_a_mode_c",
        rangeConvention: "slant_range",
        positionRepresentation: "polar_only",
        altitudeConvention: "pressure_altitude_1013_25_hpa",
        identitySemantics: "reported_code_not_verified_identity",
        processingAvailability: "explicit_available_time",
        products: {
          interrogations: "product:interrogations",
          decodedReplies: "product:decodedReplies",
          reports: "product:reports",
          truth: "product:truth",
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
    config: {
      ...config,
      durationSeconds: duration,
      ...(military ? { dwells: model.schedule.length } : {}),
    },
    files: Object.fromEntries(
      Object.entries(definitions).map(([id, [file]]) => [
        id === "schedule" ? "beamSchedule" : id,
        {
          file,
          sha256: sha(files.get(file)),
          byteLength: files.get(file).length,
          mediaType: artifact(file).mediaType,
        },
      ])
    ),
    ...Object.fromEntries(
      Object.entries(model)
        .filter(([key]) => !["returns", "thresholds", "states"].includes(key))
        .map(([key, rows]) => [key, rows.map((row, i) => ({ row: i, ...row }))])
    ),
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
  for (const packet of await emit(process.argv[2]))
    console.log(`${packet.index.id}: ${packet.files.size} files`);
