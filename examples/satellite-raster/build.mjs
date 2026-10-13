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
export async function createPacket() {
  const config = structuredClone(modelConfig),
    model = simulate(),
    files = new Map(),
    definitions = { reflectance: "reflectance.u16", quality: "quality.u8" };
  const cube = Buffer.alloc(model.dn.length * 2);
  model.dn.forEach((v, i) => cube.writeUInt16LE(v, i * 2));
  files.set(definitions.reflectance, cube);
  files.set(definitions.quality, Buffer.from(model.quality));
  const methods = {
    id: "satellite-raster-methods-v1",
    version: "1.0.0",
    fictional: true,
    config,
    description:
      "Authored multispectral reflectance scene on an arbitrary projected grid. No real satellite image, orbital simulation, atmospheric correction or physical calibration is supplied.",
    geometry:
      "72 rows x96 columns. WGS84 UTM11N. GDAL affine [500000,30,0,4102160,0,-30] defines upper-left cell corners; centers add 0.5 to row and column. Grid spacing30m is not sensor resolution or accuracy. Nominal location does not depict that real site.",
    scene:
      "Authored river and lake, vegetated patch, soil, developed patch and road. Class names define generation only and are not classifications inferred from spectra. See retained model.mjs for every pixel's deterministic decision and spectrum.",
    radiometry:
      "Each band stores round(authored_reflectance*10000) as uint16; decode DN*0.0001. Six nominal centers482,561,655,865,1610,2200nm do not define spectral response functions or assert any named satellite sensor. Broad spectra and sinusoidal texture are pedagogical, not physical material signatures.",
    quality:
      "Whole-pixel annotations: clear0, cloud1, shadow2, nodata3. Cloud ellipse center(70,51),radii(13,10); shadow ellipse center(59,43),radii(13,10), lower priority than cloud. Nodata columns>90 and rows<3 with40<column<53. Cloud spectra replace underlying authored surface; shadow scales reflectance0.22. These are numerical illustrations, not atmospheric transfer or shadow geometry predictions.",
    index:
      "NDVI=(scaled_NIR-scaled_red)/(scaled_NIR+scaled_red). Compute only when source quality is clear, both bands are present and nonnegative, and the sum is positive. It is not a landcover classifier or proof of vegetation. Band absence and quality remain separate.",
    edgeCases:
      "Row6,column6 has retained zero in every band: valid source values, undefined NDVI. Row6,column7 has missing NIR65535 but other bands retained and clear source annotation.",
    timing:
      "No acquisition timestamp, orbit, platform ephemeris or synchronized event time is supplied. Publication time dates documents only.",
    references: [
      "https://gdal.org/en/stable/tutorials/geotransforms_tut.html",
      "https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products",
      "https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index",
      "https://www.usgs.gov/landsat-missions/landsat-collection-2-quality-assessment-bands",
    ],
    limits: [
      "No physical radiometry, atmospheric correction or positional verification",
      "Quality annotations do not certify scientific usability",
      "Pixel spacing is not resolving power",
      "Nominal band centers are not spectral response functions",
      "No GeoTIFF or COG decoder",
      "No actual acquisition time or field-session synchronization",
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
      : file.endsWith("mjs")
      ? "text/javascript"
      : "application/octet-stream",
  });
  const observation = {
    kind: "observation",
    schemaVersion: "0.1.0",
    id: "satellite-raster-v1",
    status: "published",
    createdAt: publishedAt,
    updatedAt: publishedAt,
    summary:
      "Fictional six-band satellite raster with exact projected cell selection, retained DN values, decoded reflectance and explicit quality annotations.",
    eventTime: unknown("not_collected"),
    position: unknown("not_collected"),
    sources: [
      {
        id: "synthetic-satellite",
        kind: "instrument_data",
        access: "public",
        title: "Authored multispectral raster arrays",
      },
      {
        id: "methods",
        kind: "document",
        access: "public",
        title: "Authored projected grid and reflectance method",
        digest: artifact("methods.json").digest,
      },
      {
        id: "model-code",
        kind: "document",
        access: "public",
        title: "Executable synthetic raster model",
        digest: artifact("model.mjs").digest,
      },
    ],
    products: ["reflectance", "quality"].map((role) => ({
      id: role,
      kind: "raw",
      format: "application/octet-stream",
      access: "public",
      digest: artifact(definitions[role]).digest,
      sourceRefs: [
        "source:synthetic-satellite",
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
        model: "north_up_multispectral_reflectance",
        physicalValidation: "not_performed",
      },
    },
  };
  const context = {
    kind: "acquisition_context",
    schemaVersion: "0.1.0",
    id: "satellite-raster-context-v1",
    instruments: [
      {
        id: "satellite-example",
        identity: {
          state: "known",
          manufacturer: "DisclosureOS synthetic example",
          model: "Authored multispectral raster",
        },
      },
    ],
    manifests: [
      {
        id: "satellite-manifest",
        instrumentRef: "instrument:satellite-example",
        version: "1.0.0",
        publishedAt,
        artifact: artifact("methods.json"),
        configuration: {
          hardware: known("No physical satellite"),
          firmware: known("model.mjs version1.0.0"),
        },
        channels: [
          {
            id: "reflectance",
            quantity: "surface_reflectance",
            unit: "1",
            sampling: unknown(
              "Authored raster; acquisition time and physical sensor characteristics are not provided"
            ),
          },
        ],
      },
    ],
    deployments: [],
    calibrations: [],
    acquisitions: [
      {
        id: "satellite-capture",
        instrumentRef: "instrument:satellite-example",
        manifest: { state: "pinned", ref: "manifest:satellite-manifest" },
        deployment: {
          state: "unresolved",
          reason: "Synthetic source without physical deployment",
        },
        classification: "known_control",
        time: unknown("Authored pixels have no acquisition timestamp"),
        clock: {
          source: unknown("No acquisition timestamp"),
          synchronization: unknown("No physical synchronization"),
          resolution: unknown("No physical clock"),
          uncertainty: unknown("No physical clock"),
        },
        channels: [
          {
            channelId: "reflectance",
            calibration: {
              state: "unresolved",
              reason:
                "Grid coordinates and reflectance are authored; physical calibration is not performed",
            },
          },
        ],
      },
    ],
    products: ["reflectance", "quality"].map((role) => ({
      id: role,
      kind: "raw",
      acquisitionRef: "acquisition:satellite-capture",
      artifact: artifact(definitions[role]),
    })),
    extensions: {
      "org.disclosure.simulation": {
        fictional: true,
        physicalCalibration: "not_performed",
      },
    },
  };
  const layouts = ["reflectance", "quality"].map((role) => ({
    id: role,
    productRef: `product:${role}`,
    ...artifact(definitions[role]),
    kind: "binary_array",
    elementType: role === "reflectance" ? "uint16" : "uint8",
    byteOrder: "little",
    order: "row_major",
    byteOffset: 0,
    axes: (role === "reflectance"
      ? [
          ["band", config.bands.length],
          ["row", config.rows],
          ["column", config.columns],
        ]
      : [
          ["row", config.rows],
          ["column", config.columns],
        ]
    ).map(([name, length]) => ({ kind: "index", name, length, firstIndex: 0 })),
    quantity:
      role === "reflectance" ? "surface_reflectance_dn" : "pixel_quality_code",
    unit: role === "reflectance" ? "DN" : "code",
  }));
  const selection = {
    kind: "product_source_selection",
    schemaVersion: "0.1.0",
    id: "satellite-raster-selection-v1",
    observationId: observation.id,
    layouts,
    selections: [
      {
        id: "reflectance-example",
        layoutRef: "layout:reflectance",
        selector: { kind: "array_element", indices: [2, 50, 45] },
      },
      {
        id: "quality-example",
        layoutRef: "layout:quality",
        selector: { kind: "array_element", indices: [50, 45] },
      },
    ],
  };
  const profile = {
    kind: "satellite_raster_profile",
    schemaVersion: "0.1.0",
    id: "satellite-raster-profile-v1",
    observationId: observation.id,
    contextId: context.id,
    sourceSelectionId: selection.id,
    acquisitionRef: "acquisition:satellite-capture",
    channelId: "reflectance",
    acquisitionProducts: {
      reflectance: "product:reflectance",
      quality: "product:quality",
    },
    dataOrigin: "synthetic",
    mode: "north_up_multispectral_reflectance",
    grid: {
      rows: config.rows,
      columns: config.columns,
      crs: config.crs,
      transform: config.transform,
      pixelInterpretation: "area",
      registration: "authored_grid_not_surveyed",
    },
    bands: config.bands,
    radiometry: {
      quantity: "surface_reflectance",
      unit: "1",
      formula: "dn_times_scale_plus_offset",
      calibration: "not_verified",
    },
    quality: {
      authority: "authored_annotations",
      method: methods.quality,
      codes: { clear: 0, cloud: 1, shadow: 2, nodata: 3 },
      scope: "whole_pixel",
      interpretation: "source_annotation_not_accuracy_certification",
    },
    vegetationIndex: {
      redBandId: "red",
      nearInfraredBandId: "nir",
      method: "scaled_nir_minus_red_over_sum",
      qualityPolicy: "clear_nonnegative_nonzero_sum_only",
      interpretation: "spectral_index_not_land_cover_classification",
    },
    products: {
      reflectance: "product:reflectance",
      quality: "product:quality",
    },
  };
  const assets = new Map(
    ["reflectance", "quality"].map((role) => [
      `product:${role}`,
      files.get(definitions[role]),
    ])
  );
  const index = {
    id: observation.id,
    config,
    counts: {
      pixels: config.rows * config.columns,
      bands: config.bands.length,
      ...Object.fromEntries(
        ["clear", "cloud", "shadow", "nodata"].map((name, code) => [
          name,
          model.quality.filter((q) => q === code).length,
        ])
      ),
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
    "satellite-profile.json": profile,
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
    `Generated ${p.files.size} satellite files; ${p.index.counts.pixels} pixels, ${p.index.counts.bands} bands.`
  );
}
