import {
  parseExperimentalObservation,
  compareUtcInstants,
} from "@disclosureos/records/experimental/v2";
import { parseAcquisitionContext } from "@disclosureos/instruments/experimental/v2";
import {
  ProductSourceSelectionSchema,
  evaluateProductSourceSelection,
} from "./product-source-selection";
import {
  SonarProfileSchema,
  SONAR_PROFILE,
  type SonarProfile,
} from "./sonar-profile-schema";
import {
  readSonarProducts,
  validateSonarDeclaration,
  type SonarDecodedProducts,
} from "./sonar-profile-reader";
import type { ProductSourceLayout } from "./product-source-reader";

export interface SonarProfileIssue {
  code: string;
  pointer: string;
  message: string;
}
export interface SonarProfileResult {
  success: boolean;
  profile: typeof SONAR_PROFILE;
  issues: SonarProfileIssue[];
  checks: {
    structure: "passed" | "failed";
    sources: "passed" | "failed" | "not_checked";
    semantics: "passed" | "failed" | "not_checked";
  };
  scientific: "not_checked";
  physicalCalibration: "not_checked";
  propagationAccuracy: "not_checked";
  data?: {
    declaration: SonarProfile;
    layouts: ProductSourceLayout[];
    products: SonarDecodedProducts;
  };
}
// Decimal arithmetic preserves UTC digits finer than Date's millisecond resolution.
const decimal = (value: string) => {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value)!;
  const exponent = Number(m[4] ?? 0) - (m[3]?.length ?? 0),
    n = BigInt(`${m[1]}${m[2]}${m[3] ?? ""}`);
  return exponent >= 0
    ? { n: n * 10n ** BigInt(exponent), d: 1n }
    : { n, d: 10n ** BigInt(-exponent) };
};
const epoch = (s: string) => {
  const fraction = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/.exec(s),
    part = decimal(`0.${fraction?.[1] ?? "0"}`);
  return {
    n:
      BigInt(Date.parse(s.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/, "")) / 1000) *
        part.d +
      part.n,
    d: part.d,
  };
};
const add = (a: { n: bigint; d: bigint }, b: { n: bigint; d: bigint }) => ({
  n: a.n * b.d + b.n * a.d,
  d: a.d * b.d,
});
const scaled = (seconds: number, count: number) => {
  const value = decimal(String(seconds));
  return { n: value.n * BigInt(count), d: value.d };
};
const compareOffset = (
  origin: string,
  offset: { n: bigint; d: bigint },
  boundary: string
) => {
  const a = epoch(origin),
    b = epoch(boundary);
  const delta = (a.n * offset.d + offset.n * a.d) * b.d - b.n * a.d * offset.d;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};

/** Checks standard documents, retained bytes and declared meaning. It cannot establish
 * physical calibration, propagation accuracy, object identity or bathymetry. */
export async function evaluateSonarProfile(
  observationInput: unknown,
  contextInput: unknown,
  selectionInput: unknown,
  profileInput: unknown,
  options: { assets?: ReadonlyMap<string, Uint8Array> } = {}
): Promise<SonarProfileResult> {
  const result: SonarProfileResult = {
    success: false,
    profile: SONAR_PROFILE,
    issues: [],
    checks: {
      structure: "passed",
      sources: "not_checked",
      semantics: "not_checked",
    },
    scientific: "not_checked",
    physicalCalibration: "not_checked",
    propagationAccuracy: "not_checked",
  };
  const issue = (code: string, pointer: string, message: string) => {
    result.issues.push({ code, pointer, message });
  };
  const parsed = SonarProfileSchema.safeParse(profileInput),
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
      "SONAR.PREREQUISITE",
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
      "SONAR.IDENTITY",
      "/",
      "Profile identifiers must select these exact documents."
    );
  try {
    validateSonarDeclaration(p);
  } catch (error) {
    issue("SONAR.DECLARATION", "/sampling", (error as Error).message);
  }
  const capture = ctx.acquisitions.find(
    (a) => `acquisition:${a.id}` === p.acquisitionRef
  );
  const manifestRef =
    capture?.manifest.state === "pinned" ? capture.manifest.ref : undefined;
  const manifest = ctx.manifests.find(
    (m) => `manifest:${m.id}` === manifestRef
  );
  const channel = manifest?.channels.find((c) => c.id === p.channelId);
  if (
    !capture ||
    !manifest ||
    manifest.instrumentRef !== capture.instrumentRef ||
    !channel ||
    !capture.channels.some((c) => c.channelId === p.channelId) ||
    channel.quantity !== "normalized_echo_amplitude" ||
    channel.unit !== "1"
  )
    issue(
      "SONAR.CHANNEL",
      "/channelId",
      "Echo amplitude must select a channel in the acquisition's pinned instrument manifest with normalized_echo_amplitude quantity and unit 1."
    );
  if (p.acquisitionProductRef === p.receiveMaskAcquisitionProductRef)
    issue(
      "SONAR.CAPTURE_ALIAS",
      "/receiveMaskAcquisitionProductRef",
      "Envelope and receive mask require distinct acquisition products."
    );
  for (const role of ["amplitudes", "receiveMask"] as const) {
    const acquisitionRef =
      role === "amplitudes"
        ? p.acquisitionProductRef
        : p.receiveMaskAcquisitionProductRef;
    const acquired = ctx.products.find(
        (product) => `product:${product.id}` === acquisitionRef
      ),
      product = obs.products.find(
        (product) => `product:${product.id}` === p.products[role]
      );
    const layout = sources.layouts.find(
      (layout) => layout.productRef === p.products[role]
    );
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
        "SONAR.CAPTURE_BINDING",
        `/products/${role}`,
        "Both retained source products must bind to distinct raw artifacts from this acquisition, with matching bytes and media type."
      );
  }
  // Combine each declared decimal before rounding; e.g. 63*0.1+255*0.0001 is exactly 6.3255 seconds.
  const lastReceive = add(
    add(
      scaled(p.sampling.pingStepSeconds, p.sampling.pings - 1),
      decimal(String(p.sampling.delayStartSeconds))
    ),
    scaled(p.sampling.delayStepSeconds, p.sampling.delayBins - 1)
  );
  if (compareUtcInstants(p.timeOrigin, p.timeOrigin) === undefined)
    issue(
      "SONAR.TIME_ORIGIN",
      "/timeOrigin",
      "Time origin must be a valid UTC instant."
    );
  else {
    if (
      capture?.time.state !== "known" ||
      capture.time.kind !== "interval" ||
      capture.time.timeScale !== "UTC"
    )
      issue(
        "SONAR.ACQUISITION_TIME",
        "/acquisitionRef",
        "This profile requires a declared UTC acquisition interval."
      );
    else if (
      compareOffset(p.timeOrigin, { n: 0n, d: 1n }, capture.time.start) < 0 ||
      compareOffset(p.timeOrigin, lastReceive, capture.time.end) > 0
    )
      issue(
        "SONAR.ACQUISITION_TIME",
        "/timeOrigin",
        "All ping origins and received delay samples must be within the acquisition interval."
      );
    const event = obs.eventTime;
    if (
      event.state !== "known" ||
      event.value.kind !== "interval" ||
      event.value.start.kind !== "instant" ||
      event.value.end.kind !== "instant" ||
      event.value.start.timeScale !== "UTC" ||
      event.value.end.timeScale !== "UTC"
    )
      issue(
        "SONAR.OBSERVATION_TIME",
        "/observation/eventTime",
        "This profile requires a declared UTC observation interval."
      );
    else if (
      compareOffset(p.timeOrigin, { n: 0n, d: 1n }, event.value.start.value) <
        0 ||
      compareOffset(p.timeOrigin, lastReceive, event.value.end.value) > 0
    )
      issue(
        "SONAR.OBSERVATION_TIME",
        "/observation/eventTime",
        "Observation interval must contain the retained receive samples."
      );
  }
  if (result.issues.length) {
    result.checks.semantics = "failed";
    return result;
  }
  // Snapshot before awaiting digest validation; never decode mutable caller-owned bytes.
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
      issue(`SONAR.SOURCE.${entry.code}`, entry.pointer, entry.message);
    if (!result.issues.length)
      issue(
        "SONAR.SOURCE_BYTES",
        "/products",
        "All retained source bytes are required for verification."
      );
    return result;
  }
  result.checks.sources = "passed";
  try {
    const products = readSonarProducts(p, sources.layouts, assets);
    result.data = { declaration: p, layouts: sources.layouts, products };
    result.checks.semantics = "passed";
    result.success = true;
  } catch (error) {
    issue("SONAR.CONTENT", "/products", (error as Error).message);
    result.checks.semantics = "failed";
  }
  return result;
}
