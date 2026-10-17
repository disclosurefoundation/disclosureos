import { parseExperimentalObservation } from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ProductSourceSelectionSchema,
  evaluateProductSourceSelection,
} from "./product-source-selection";
import {
  LidarProfileSchema,
  LIDAR_PROFILE,
  type LidarProfile,
} from "./lidar-profile-schema";
import {
  readLidarProducts,
  validateLidarDeclaration,
  type LidarDecodedProducts,
} from "./lidar-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";
export interface LidarProfileResult {
  success: boolean;
  profile: typeof LIDAR_PROFILE;
  issues: { code: string; pointer: string; message: string }[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  classificationAccuracy: "not_checked";
  georeferencing: "not_checked";
  data?: {
    declaration: LidarProfile;
    layouts: ProductSourceLayout[];
    products: LidarDecodedProducts;
  };
}
/** Verifies exact acquisition and product bindings, retained table bytes, return groups and
 * declared local ray geometry. This does not certify physical accuracy or classifications. */
export async function evaluateLidarProfile(
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<LidarProfileResult> {
  const result: LidarProfileResult = {
    success: false,
    profile: LIDAR_PROFILE,
    issues: [],
    checks: {
      structure: "passed",
      sources: "not_checked",
      semantics: "not_checked",
    },
    scientific: "not_checked",
    physicalCalibration: "not_checked",
    classificationAccuracy: "not_checked",
    georeferencing: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  const parsed = LidarProfileSchema.safeParse(profileInput),
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
      "LIDAR.PREREQUISITE",
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
      "LIDAR.IDENTITY",
      "/",
      "Profile identifiers must select these exact documents."
    );
  try {
    validateLidarDeclaration(p);
  } catch (error) {
    issue("LIDAR.DECLARATION", "/", (error as Error).message);
    result.checks.semantics = "failed";
    return result;
  }
  if (
    p.dataOrigin === "synthetic" &&
    p.classifications.authority !== "authored_annotations"
  )
    issue(
      "LIDAR.CLASSIFICATION_ORIGIN",
      "/classifications/authority",
      "Synthetic examples must identify their class labels as authored annotations."
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
    channel.quantity !== "lidar_return_position" ||
    channel.unit !== "m"
  )
    issue(
      "LIDAR.CHANNEL",
      "/channelId",
      "Return positions must select a lidar_return_position channel in metres in this acquisition's pinned manifest."
    );
  if (new Set(Object.values(p.acquisitionProducts)).size !== 2)
    issue(
      "LIDAR.CAPTURE_ALIAS",
      "/acquisitionProducts",
      "Pulse ledger and return table require distinct acquisition products."
    );
  for (const role of ["pulses", "points"] as const) {
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
        "LIDAR.CAPTURE_BINDING",
        `/products/${role}`,
        "The retained source tables must bind to raw artifacts from this acquisition with matching digest, extent and media type."
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
      issue(`LIDAR.SOURCE.${entry.code}`, entry.pointer, entry.message);
    if (!result.issues.length)
      issue(
        "LIDAR.SOURCE_BYTES",
        "/products",
        "Every retained source table is required for verification."
      );
    return result;
  }
  result.checks.sources = "passed";
  try {
    const products = readLidarProducts(p, sources.layouts, assets);
    result.data = { declaration: p, layouts: sources.layouts, products };
    result.checks.semantics = "passed";
    result.success = true;
  } catch (error) {
    issue("LIDAR.CONTENT", "/products", (error as Error).message);
    result.checks.semantics = "failed";
  }
  return result;
}
