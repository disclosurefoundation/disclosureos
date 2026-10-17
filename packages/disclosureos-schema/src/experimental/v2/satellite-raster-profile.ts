import { parseExperimentalObservation } from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ProductSourceSelectionSchema,
  evaluateProductSourceSelection,
} from "./product-source-selection";
import {
  SatelliteRasterProfileSchema,
  SATELLITE_RASTER_PROFILE,
  type SatelliteRasterProfile,
} from "./satellite-raster-profile-schema";
import {
  readSatelliteRasterProducts,
  validateSatelliteRasterDeclaration,
  type SatelliteRasterDecodedProducts,
} from "./satellite-raster-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";
export interface SatelliteRasterProfileResult {
  success: boolean;
  profile: typeof SATELLITE_RASTER_PROFILE;
  issues: { code: string; pointer: string; message: string }[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  qualityAccuracy: "not_checked";
  georeferencing: "not_checked";
  data?: {
    declaration: SatelliteRasterProfile;
    layouts: ProductSourceLayout[];
    products: SatelliteRasterDecodedProducts;
  };
}
/** Verifies exact acquisition and product bindings, retained array bytes, decoded band values and
 * declared projected pixel geometry. This does not certify physical accuracy or classifications. */
export async function evaluateSatelliteRasterProfile(
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<SatelliteRasterProfileResult> {
  const result: SatelliteRasterProfileResult = {
    success: false,
    profile: SATELLITE_RASTER_PROFILE,
    issues: [],
    checks: {
      structure: "passed",
      sources: "not_checked",
      semantics: "not_checked",
    },
    scientific: "not_checked",
    physicalCalibration: "not_checked",
    qualityAccuracy: "not_checked",
    georeferencing: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  const parsed = SatelliteRasterProfileSchema.safeParse(profileInput),
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
      "SATELLITE_RASTER.PREREQUISITE",
      "/",
      "Profile, observation, acquisition context and source selection must satisfy their contracts."
    );
    return result;
  }
  const p = parsed.data,
    obs = observation.data,
    ctx = context.data,
    sources = selection.data;
  if (
    p.observationId !== obs.id ||
    p.contextId !== ctx.id ||
    p.sourceSelectionId !== sources.id ||
    sources.observationId !== obs.id
  )
    issue(
      "SATELLITE_RASTER.IDENTITY",
      "/",
      "Profile identifiers must select these exact documents."
    );
  try {
    validateSatelliteRasterDeclaration(p);
  } catch (error) {
    issue("SATELLITE_RASTER.DECLARATION", "/", (error as Error).message);
    result.checks.semantics = "failed";
    return result;
  }
  if (
    p.dataOrigin === "synthetic" &&
    p.quality.authority !== "authored_annotations"
  )
    issue(
      "SATELLITE_RASTER.QUALITY_ORIGIN",
      "/quality/authority",
      "Synthetic examples must identify their quality labels as authored annotations."
    );
  const capture = ctx.acquisitions.find(
      (a) => `acquisition:${a.id}` === p.acquisitionRef
    ),
    manifestRef =
      capture?.manifest.state === "pinned" ? capture.manifest.ref : undefined,
    manifest = ctx.manifests.find((m) => `manifest:${m.id}` === manifestRef),
    channel = manifest?.channels.find((c) => c.id === p.channelId);
  if (
    !capture ||
    !manifest ||
    manifest.instrumentRef !== capture.instrumentRef ||
    !channel ||
    !capture.channels.some((c) => c.channelId === p.channelId) ||
    channel.quantity !== "surface_reflectance" ||
    channel.unit !== "1"
  )
    issue(
      "SATELLITE_RASTER.CHANNEL",
      "/channelId",
      "Reflectance must select a surface_reflectance channel with unit 1 in this acquisition's pinned manifest."
    );
  if (
    p.dataOrigin === "synthetic" &&
    p.grid.registration !== "authored_grid_not_surveyed"
  )
    issue(
      "SATELLITE_RASTER.GRID_ORIGIN",
      "/grid/registration",
      "Synthetic grids must identify their authored registration."
    );
  if (new Set(Object.values(p.acquisitionProducts)).size !== 2)
    issue(
      "SATELLITE_RASTER.CAPTURE_ALIAS",
      "/acquisitionProducts",
      "Reflectance cube and quality grid require distinct acquisition products."
    );
  for (const role of ["reflectance", "quality"] as const) {
    const acquired = ctx.products.find(
        (v) => `product:${v.id}` === p.acquisitionProducts[role]
      ),
      product = obs.products.find(
        (v) => `product:${v.id}` === p.products[role]
      ),
      layout = sources.layouts.find((l) => l.productRef === p.products[role]);
    if (
      !acquired ||
      acquired.kind !== "raw" ||
      acquired.acquisitionRef !== p.acquisitionRef ||
      !product ||
      product.kind !== "raw" ||
      !layout ||
      acquired.artifact.digest.value !== layout.digest.value ||
      acquired.artifact.byteLength !== layout.byteLength ||
      acquired.artifact.mediaType !== layout.mediaType
    )
      issue(
        "SATELLITE_RASTER.CAPTURE_BINDING",
        `/products/${role}`,
        "The retained raster sources must bind to raw artifacts from this acquisition with matching digest, extent and media type."
      );
  }
  if (result.issues.length) {
    result.checks.semantics = "failed";
    return result;
  }
  const assets = new Map(
    [...(options.assets ?? [])].map(([ref, bytes]) => [
      ref,
      Uint8Array.from(bytes),
    ])
  );
  const sourceResult = await evaluateProductSourceSelection(obs, sources, {
    assets,
  });
  if (!sourceResult.success || sourceResult.checks.external !== "passed") {
    result.checks.sources = "failed";
    for (const entry of sourceResult.issues)
      issue(
        `SATELLITE_RASTER.SOURCE.${entry.code}`,
        entry.pointer,
        entry.message
      );
    if (!result.issues.length)
      issue(
        "SATELLITE_RASTER.SOURCE_BYTES",
        "/products",
        "Every retained source array is required for verification."
      );
    return result;
  }
  result.checks.sources = "passed";
  try {
    const products = readSatelliteRasterProducts(p, sources.layouts, assets);
    result.data = { declaration: p, layouts: sources.layouts, products };
    result.checks.semantics = "passed";
    result.success = true;
  } catch (error) {
    issue("SATELLITE_RASTER.CONTENT", "/products", (error as Error).message);
    result.checks.semantics = "failed";
  }
  return result;
}
