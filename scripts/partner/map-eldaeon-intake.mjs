import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  lstatSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  SourceIntakeSchema,
  evaluateSourceIntake,
} from "../../packages/disclosureos-schema/dist/experimental/v2/index.js";
import { auditWindow } from "../audit-partner-window.mjs";

export const ADAPTER = Object.freeze({
  id: "eldaeon-public-export-mapping",
  version: "0.1.0",
});
const MAX_BYTES = 32 * 1024 * 1024;
const own = (v, k) => Object.hasOwn(v, k);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const pointer = (parts) =>
  parts
    .map((p) => "/" + String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("");
const decode = (bytes) =>
  JSON.parse(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes)
  );
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const note = (target, meaning, unitHint, requires) => ({
  target,
  meaning,
  unitHint,
  requires,
});
// Hints describe source fields. They are not unit conversions or approved channels.
const HINTS = {
  "radio_frequency.rf_spectrum_analyzer": {
    power_min_dbm: note(
      "channel candidate",
      "minimum reported power",
      "dBm",
      "Power reference, detector mode, bandwidth and calibration"
    ),
    power_max_dbm: note(
      "channel candidate",
      "maximum reported power",
      "dBm",
      "Power reference, detector mode, bandwidth and calibration"
    ),
    power_avg_dbm: note(
      "channel candidate",
      "reported power average",
      "dBm",
      "Averaging domain and bandwidth; do not infer linear power"
    ),
    peak_freq_mhz: note(
      "channel candidate",
      "reported peak frequency",
      "MHz",
      "Frequency axis, resolution and calibration"
    ),
  },
  "environmental.env_pod": {
    emf_ut: note(
      "channel candidate",
      "reported magnetic field",
      "µT",
      "Axis/aggregation definition, device and calibration"
    ),
    ef_v_m: note(
      "channel candidate",
      "reported electric field",
      "V/m",
      "Detector/aggregation definition, device and calibration"
    ),
    cpm_l: note(
      "channel candidate",
      "low-channel count rate",
      "counts/min",
      "Counting interval, channel thresholds and normalization"
    ),
    cpm_h: note(
      "channel candidate",
      "high-channel count rate",
      "counts/min",
      "Counting interval, channel thresholds and normalization"
    ),
    rf_dbm: note(
      "channel candidate",
      "reported RF level",
      "dBm",
      "Power reference and detector definition; do not equate with mission irradiance"
    ),
  },
  "environmental.gnss_receiver": {
    latitude: note(
      "location candidate",
      "reported latitude",
      "degree",
      "Datum and deidentification transform; no recovered precision"
    ),
    longitude: note(
      "location candidate",
      "reported longitude",
      "degree",
      "Datum and deidentification transform; no recovered precision"
    ),
    altitude_m: note(
      "channel candidate",
      "reported altitude",
      "m",
      "Vertical datum, solution type and uncertainty"
    ),
    speed_mps: note(
      "channel candidate",
      "reported speed",
      "m/s",
      "Reference frame and solution uncertainty"
    ),
  },
  "quantum.cosmic_ray_muon": {
    total: note(
      "channel candidate",
      "reported total count",
      "count",
      "Channel relationships, integration interval and dead time"
    ),
    window_seconds: note(
      "time context candidate",
      "reported integration duration",
      "s",
      "Whether timestamp denotes start, center, end, or emission"
    ),
  },
  "radio_frequency.passive_radar": {
    range_km: note(
      "channel candidate",
      "reported track range",
      "km",
      "Bistatic geometry and processing definition; not slant range by assumption"
    ),
    radial_velocity_mps: note(
      "channel candidate",
      "reported track velocity",
      "m/s",
      "Geometry and transformation; not interchangeable with raw bistatic velocity"
    ),
    doppler_hz: note(
      "channel candidate",
      "reported Doppler",
      "Hz",
      "Reference frequency, sign convention, processing and uncertainty"
    ),
    "raw.bistatic_range_m": note(
      "channel candidate",
      "reported bistatic range",
      "m",
      "Path-length convention and transmitter/receiver geometry"
    ),
    "raw.bistatic_velocity_mps": note(
      "channel candidate",
      "reported bistatic velocity",
      "m/s",
      "Path-rate convention and processing; retain separately from track velocity"
    ),
  },
  "environmental.air_quality": {
    co2_ppm: note(
      "channel candidate",
      "reported CO2 concentration",
      "ppm",
      "Measurement versus estimate, device and calibration"
    ),
    co2eq_ppm: note(
      "channel candidate",
      "reported equivalent CO2 estimate",
      "ppm",
      "Estimator and inputs; do not merge with measured CO2"
    ),
    eco2_ppm: note(
      "channel candidate",
      "reported eCO2 estimate",
      "ppm",
      "Estimator and inputs; do not merge with measured CO2"
    ),
  },
};
function hint(modality, path, types) {
  const leaf = path.at(-1);
  if (
    path.length === 1 &&
    [
      "timestamp",
      "timestamp_start",
      "timestamp_end",
      "first_seen",
      "last_seen",
    ].includes(leaf)
  )
    return note(
      "acquisition time candidate",
      "source time label",
      null,
      "Epoch/time scale, event meaning, integration bounds, synchronization and clock uncertainty"
    );
  if (path.length === 1 && leaf === "node")
    return note(
      "provenance label",
      "compute-unit label, not a physical instrument ID",
      null,
      "Stable device/channel mapping and manifest revision"
    );
  if (
    ["confidence", "category", "adsb_correlated_icao", "_coherence"].includes(
      leaf
    )
  )
    return note(
      "source assertion only",
      "unreviewed provider classification/correlation label",
      null,
      "Method, attribution and review; never copy into DisclosureOS confidence or confirmed status"
    );
  const key =
    path.length === 1 && !path[0]?.includes(".")
      ? path[0]
      : path.length === 2 &&
        path[0] === "raw" &&
        typeof path[1] === "string" &&
        !path[1].includes(".")
      ? path.join(".")
      : null;
  const known =
    key && own(HINTS, modality) && own(HINTS[modality], key)
      ? HINTS[modality][key]
      : null;
  if (known) return known;
  if (types.includes("array"))
    return note(
      "retained source array",
      "opaque array in the pinned export",
      null,
      "Native format, axes/units, processing and sample/integration semantics"
    );
  return note(
    "unmapped",
    "preserved in the source artifact",
    null,
    "Document field semantics before mapping"
  );
}
function inventory(records, base) {
  const fields = new Map();
  let visited = 0;
  function visit(value, path, actual, depth) {
    if (++visited > 2000000 || depth > 32)
      throw Error("Export field traversal limit exceeded.");
    const key = JSON.stringify(path);
    let f = fields.get(key);
    if (!f) {
      if (fields.size >= 20000)
        throw Error("Export field count limit exceeded.");
      f = {
        path,
        firstPointer: pointer(actual),
        occurrences: 0,
        types: new Set(),
        nullCount: 0,
      };
      fields.set(key, f);
    }
    const type =
      value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
    f.occurrences++;
    f.types.add(type);
    if (value === null) f.nullCount++;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++)
        visit(value[i], [...path, null], [...actual, i], depth + 1);
    } else if (object(value)) {
      for (const [k, v] of Object.entries(value))
        visit(v, [...path, k], [...actual, k], depth + 1);
    }
  }
  records.forEach((r, i) => {
    for (const [k, v] of Object.entries(r))
      visit(v, [k], [...base, "records", i, k], 0);
  });
  return [...fields.values()].map((f) => ({
    ...f,
    types: [...f.types].sort(),
  }));
}
/** A provenance report, never a converter into observations or reviewed context. */
export async function mapEldaeonIntake(receiptInput, artifactId, inputBytes) {
  const receipt = SourceIntakeSchema.parse(receiptInput);
  const entry = receipt.artifacts.find((a) => a.id === artifactId);
  if (!entry) throw Error("Selected artifact is not in the intake.");
  if (!(inputBytes instanceof Uint8Array) || inputBytes.length > MAX_BYTES)
    throw Error("Expected at most 32 MiB of local source bytes.");
  const bytes = Uint8Array.from(inputBytes);
  const validation = await evaluateSourceIntake(receipt, {
    files: new Map([[artifactId, bytes]]),
  });
  if (
    validation.checks.semantic !== "passed" ||
    validation.files.find((f) => f.id === artifactId)?.status !== "passed"
  )
    throw Error(
      "Selected artifact identity or intake semantics failed; no mapping produced."
    );
  const data = decode(bytes);
  let visited = 0;
  function checkJson(value, depth = 0) {
    if (++visited > 2000000 || depth > 32)
      throw Error("Export JSON traversal limit exceeded.");
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error("Export contains a number outside finite JSON parser range.");
    if (value && typeof value === "object")
      for (const child of Object.values(value)) checkJson(child, depth + 1);
  }
  checkJson(data);
  if (!object(data) || !object(data.records_by_modality))
    throw Error("Expected an ELDÆON public export with records_by_modality.");
  const groups = Object.entries(data.records_by_modality);
  if (!groups.length || groups.length > 128)
    throw Error("Expected 1–128 modality groups.");
  let count = 0;
  for (const [, g] of groups) {
    if (
      !object(g) ||
      !Array.isArray(g.records) ||
      g.records.some((r) => !object(r))
    )
      throw Error("Each modality requires an array of record objects.");
    count += g.records.length;
  }
  if (count > 100000) throw Error("Export record limit exceeded.");
  const declarations = [
    "title",
    "publisher",
    "license",
    "generatedAt",
    "window",
    "standard",
    "deidentification",
    "_missing",
  ]
    .filter((k) => own(data, k))
    .map((k) => ({
      pointer: pointer([k]),
      value: data[k],
      status: "source_declared",
    }));
  const contextNeeds = [
    {
      id: "instrument_identity",
      target: "instruments[].identity / acquisitions[].instrumentRef",
      reason: "Compute labels do not identify physical instruments.",
      request:
        "Provide pseudonymous stable device IDs, channel-to-device mapping and exact manifest revisions.",
    },
    {
      id: "clock_semantics",
      target: "acquisitions[].time / acquisitions[].clock",
      reason:
        "Source timestamps do not establish capture boundaries or clock uncertainty.",
      request:
        "Define every timestamp epoch/time scale and event meaning; provide synchronization history, bounds and integration intervals.",
    },
    {
      id: "session_membership",
      target: "sessions[].members",
      reason:
        "An export window is not independently verified acquisition membership.",
      request:
        "Provide session/acquisition IDs and start/end definitions, explaining records outside the declared window.",
    },
    {
      id: "calibration",
      target: "calibrations[] / acquisitions[].channels",
      reason:
        "Export values do not supply purpose-specific calibration records.",
      request:
        "Provide channel units/definitions, calibration reports, validity intervals, uncertainty models and review status.",
    },
    {
      id: "native_products",
      target: "products[] / processing provenance",
      reason:
        "This composite JSON export is not a native acquisition file inventory.",
      request:
        "Provide a representative native-file inventory with hashes, byte lengths, encodings, channel mapping and raw-to-derived processing versions.",
    },
    {
      id: "classification",
      target: "acquisitions[].classification / attributed claims",
      reason:
        "Source categories and confidence numbers are unreviewed declarations.",
      request:
        "Label background/control/candidate acquisitions explicitly and document correlation/classification methods without assigning unexplained status by default.",
    },
  ];
  let windowDiagnostic;
  try {
    windowDiagnostic = {
      status: "conditional",
      convention:
        "Numeric timestamps assumed Unix seconds; ISO strings parsed with Date.parse. Inclusive export endpoints with 1 ms tolerance. This does not establish clock meaning or v2 half-open acquisition intervals.",
      groups: auditWindow(data),
    };
  } catch (error) {
    windowDiagnostic = { status: "not_checked", reason: error.message };
  }
  return {
    kind: "partner_mapping_report",
    adapter: ADAPTER,
    status: "needs_context",
    source: {
      intakeId: receipt.id,
      artifactId,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
      scope: "selected_artifact_only",
    },
    intakeValidation: validation,
    proposedRole: "source_export",
    declarations,
    rootFields: Object.keys(data).map((k) => ({
      pointer: pointer([k]),
      handling:
        k === "records_by_modality"
          ? "inventoried"
          : declarations.some((d) => d.pointer === pointer([k]))
          ? "source_declared"
          : "unmapped",
    })),
    modalities: groups.map(([name, g]) => {
      const base = ["records_by_modality", name];
      return {
        name,
        pointer: pointer(base),
        actualCount: g.records.length,
        declaredCount: own(g, "count") ? g.count : null,
        countMatches:
          Number.isSafeInteger(g.count) && g.count >= 0
            ? g.count === g.records.length
            : null,
        metadata: Object.keys(g)
          .filter((k) => k !== "records")
          .map((k) => ({
            pointer: pointer([...base, k]),
            value: g[k],
            status: "source_declared",
          })),
        fields: inventory(g.records, base).map((f) => ({
          ...f,
          mapping: hint(name, f.path, f.types),
        })),
      };
    }),
    windowDiagnostic,
    contextNeeds,
    acquisitionContext: "not_created",
    observations: "not_created",
    scientificEligibility: "not_checked",
    authorization: "not_checked",
  };
}
function readLocal(path, limit) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  );
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit)
      throw Error("Expected a bounded regular local file.");
    const chunks = [];
    let size = 0;
    for (;;) {
      const b = Buffer.alloc(Math.min(65536, limit - size + 1)),
        n = readSync(fd, b, 0, b.length, null);
      if (!n) break;
      size += n;
      if (size > limit) throw Error("Local file limit exceeded.");
      chunks.push(b.subarray(0, n));
    }
    return Buffer.concat(chunks);
  } finally {
    closeSync(fd);
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2)
      throw Error(
        "Usage: node scripts/partner/map-eldaeon-intake.mjs <intake.json> <artifact-id>"
      );
    const path = resolve(args[0]),
      manifest = readLocal(path, 8 * 1024 * 1024),
      receipt = SourceIntakeSchema.parse(decode(manifest));
    if (!receipt.artifacts.some((a) => a.id === args[1]))
      throw Error("Selected artifact is not in the intake.");
    const folder = join(dirname(path), "files");
    if (!lstatSync(folder).isDirectory())
      throw Error("Expected a real files directory, not a symlink.");
    const report = await mapEldaeonIntake(
      receipt,
      args[1],
      readLocal(join(folder, args[1]), MAX_BYTES)
    );
    report.source.intakeManifestSha256 = hash(manifest);
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.log(
      JSON.stringify({
        kind: "partner_mapping_error",
        success: false,
        message: error.message,
      })
    );
    process.exitCode = 2;
  }
}
