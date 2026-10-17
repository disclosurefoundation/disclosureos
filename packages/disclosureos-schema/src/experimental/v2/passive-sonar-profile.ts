import { parseExperimentalObservation } from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ProductSourceSelectionSchema,
  evaluateProductSourceSelection,
} from "./product-source-selection";
import {
  PassiveSonarProfileSchema,
  PASSIVE_SONAR_PROFILE,
  type PassiveSonarProfile,
} from "./passive-sonar-profile-schema";
import {
  readPassiveSonarProducts,
  validatePassiveSonarDeclaration,
  type PassiveSonarDecodedProducts,
} from "./passive-sonar-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";
export interface PassiveSonarProfileResult {
  success: boolean;
  profile: typeof PASSIVE_SONAR_PROFILE;
  issues: { code: string; pointer: string; message: string }[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
    reproduction: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  localization: "not_checked";
  data?: {
    declaration: PassiveSonarProfile;
    layouts: ProductSourceLayout[];
    products: PassiveSonarDecodedProducts;
  };
}
const epoch = (s: string) => {
  const f = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/.exec(s)?.[1] ?? "";
  const d = BigInt(10) ** BigInt(f.length);
  return {
    n:
      BigInt(Date.parse(s.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, "")) / 1000) *
        d +
      BigInt(f || "0"),
    d,
  };
};
const compareOffset = (
  origin: string,
  n: number,
  d: number,
  boundary: string
) => {
  const a = epoch(origin),
    b = epoch(boundary),
    rate = BigInt(d);
  const delta = (a.n * rate + BigInt(n) * a.d) * b.d - b.n * a.d * rate;
  return delta < BigInt(0) ? -1 : delta > BigInt(0) ? 1 : 0;
};
const sameRefs = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  b.every((x) => a.includes(x));
/** Validates bindings, exact time coverage, retained bytes and numerical PSD reproduction.
 * A successful result does not certify real pressure calibration or locate a sound source. */
export async function evaluatePassiveSonarProfile(
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<PassiveSonarProfileResult> {
  const result: PassiveSonarProfileResult = {
    success: false,
    profile: PASSIVE_SONAR_PROFILE,
    issues: [],
    checks: {
      structure: "passed",
      sources: "not_checked",
      semantics: "not_checked",
      reproduction: "not_checked",
    },
    scientific: "not_checked",
    physicalCalibration: "not_checked",
    localization: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) =>
    result.issues.push({ code, pointer, message });
  const parsed = PassiveSonarProfileSchema.safeParse(profileInput),
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
      "PASSIVE_SONAR.PREREQUISITE",
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
      "PASSIVE_SONAR.IDENTITY",
      "/",
      "Profile identifiers must select these exact documents."
    );
  try {
    validatePassiveSonarDeclaration(p);
  } catch (error) {
    issue("PASSIVE_SONAR.DECLARATION", "/sampling", (error as Error).message);
    result.checks.semantics = "failed";
    return result;
  }
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
    channel.quantity !== "sound_pressure" ||
    channel.unit !== "Pa"
  )
    issue(
      "PASSIVE_SONAR.CHANNEL",
      "/channelId",
      "Pressure must select a sound_pressure channel with unit Pa in this acquisition's pinned manifest."
    );
  if (p.acquisitionProductRef === p.sampleMaskAcquisitionProductRef)
    issue(
      "PASSIVE_SONAR.CAPTURE_ALIAS",
      "/sampleMaskAcquisitionProductRef",
      "Pressure and sample mask require distinct acquisition products."
    );
  for (const role of ["pressure", "sampleMask"] as const) {
    const acquisitionRef =
      role === "pressure"
        ? p.acquisitionProductRef
        : p.sampleMaskAcquisitionProductRef;
    const acquired = ctx.products.find(
        (v) => `product:${v.id}` === acquisitionRef
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
        "PASSIVE_SONAR.CAPTURE_BINDING",
        `/products/${role}`,
        "Pressure and sample mask must bind to raw retained artifacts from this acquisition, with matching digest, extent and media type."
      );
  }
  const processing = obs.processing.find(
      (v) => `process:${v.id}` === p.processingRef
    ),
    method = obs.methods.find(
      (m) => `method:${m.id}` === processing?.methodRef
    );
  if (
    !processing ||
    !method ||
    method.version !== processing.methodVersion ||
    !sameRefs(processing.inputRefs, [
      p.products.pressure,
      p.products.sampleMask,
    ]) ||
    !sameRefs(processing.outputRefs, [
      p.products.powerSpectralDensity,
      p.products.frameMask,
    ])
  )
    issue(
      "PASSIVE_SONAR.PROCESSING",
      "/processingRef",
      "The declared processing activity must use exactly the pressure and sample mask and produce the density and frame mask with a matching method version."
    );
  for (const role of ["powerSpectralDensity", "frameMask"] as const) {
    const product = obs.products.find(
      (v) => `product:${v.id}` === p.products[role]
    );
    if (
      !product ||
      product.kind !== "derived" ||
      product.generatedBy !== p.processingRef
    )
      issue(
        "PASSIVE_SONAR.DERIVED_BINDING",
        `/products/${role}`,
        "Spectral density and frame mask must be derived outputs of the declared processing activity."
      );
  }
  const inside = (start: string, end: string) =>
    compareOffset(p.timeOrigin, 0, 1, start) >= 0 &&
    compareOffset(
      p.timeOrigin,
      p.sampling.samples - 1,
      p.sampling.sampleRateHz,
      end
    ) <= 0;
  if (
    capture?.time.state !== "known" ||
    capture.time.kind !== "interval" ||
    capture.time.timeScale !== "UTC" ||
    !inside(capture.time.start, capture.time.end)
  )
    issue(
      "PASSIVE_SONAR.ACQUISITION_TIME",
      "/timeOrigin",
      "Acquisition must declare a UTC interval containing every retained sample timestamp."
    );
  const event = obs.eventTime;
  if (
    event.state !== "known" ||
    event.value.kind !== "interval" ||
    event.value.start.kind !== "instant" ||
    event.value.end.kind !== "instant" ||
    event.value.start.timeScale !== "UTC" ||
    event.value.end.timeScale !== "UTC" ||
    !inside(event.value.start.value, event.value.end.value)
  )
    issue(
      "PASSIVE_SONAR.OBSERVATION_TIME",
      "/observation/eventTime",
      "Observation UTC interval must contain every retained sample timestamp."
    );
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
      issue(`PASSIVE_SONAR.SOURCE.${entry.code}`, entry.pointer, entry.message);
    if (!result.issues.length)
      issue(
        "PASSIVE_SONAR.SOURCE_BYTES",
        "/products",
        "Every retained source product is required for verification."
      );
    return result;
  }
  result.checks.sources = "passed";
  try {
    const products = readPassiveSonarProducts(p, sources.layouts, assets);
    result.data = { declaration: p, layouts: sources.layouts, products };
    result.checks.semantics = "passed";
    result.checks.reproduction = "passed";
    result.success = true;
  } catch (error) {
    issue("PASSIVE_SONAR.CONTENT", "/products", (error as Error).message);
    result.checks.semantics = "failed";
    result.checks.reproduction = "failed";
  }
  return result;
}
