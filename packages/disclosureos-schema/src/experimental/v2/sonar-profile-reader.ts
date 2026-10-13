import {
  readProductSourceSelection,
  type ProductSourceLayout,
} from "./product-source-reader";

/** Minimal browser declaration. Use evaluateSonarProfile for document bindings and digests. */
export interface SonarDeclaration {
  timeOrigin: string;
  sampling: {
    pings: number;
    delayBins: number;
    delayStartSeconds: number;
    delayStepSeconds: number;
    pingStepSeconds: number;
  };
  propagation: {
    kind: "constant_assumed_sound_speed";
    soundSpeedMps: number;
    travelPath: "two_way";
    distanceMeaning: "modeled_one_way_path_length";
  };
  availability: {
    kind: "receive_retention_mask";
    unavailable: 0;
    available: 1;
    missingAmplitude: "zero_storage_placeholder";
  };
  products: { amplitudes: string; receiveMask: string };
}
export interface SonarDecodedProducts {
  /** Storage values only: receiveMask=0 makes this a placeholder, never a measured zero. */
  amplitudes: number[];
  receiveMask: number[];
}
const finite = (n: number) => Number.isFinite(n);
// Exact decimal timing comparisons; arithmetic intermediates must not widen a receive window.
const decimal = (value: number) => {
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value))!;
  const exponent = Number(m[3] ?? 0) - (m[2]?.length ?? 0),
    n = BigInt(`${m[1]}${m[2] ?? ""}`);
  return exponent >= 0
    ? { n: n * BigInt(10) ** BigInt(exponent), d: BigInt(1) }
    : { n, d: BigInt(10) ** BigInt(-exponent) };
};
const add = (a: { n: bigint; d: bigint }, b: { n: bigint; d: bigint }) => ({
  n: a.n * b.d + b.n * a.d,
  d: a.d * b.d,
});
const scaled = (value: number, count: number) => {
  const v = decimal(value);
  return { n: v.n * BigInt(count), d: v.d };
};
const numericDecimal = (v: { n: bigint; d: bigint }) =>
  Number(`${v.n}e-${v.d.toString().length - 1}`);
// No Date calendar normalization: 30 February must not become a March source time.
const validUtc = (value: string) => {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    );
  if (!m) return false;
  const year = Number(m[1]),
    month = Number(m[2]),
    day = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offset = m[7]!;
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1]! &&
    Number(m[4]) < 24 &&
    Number(m[5]) < 60 &&
    Number(m[6]) < 60 &&
    (offset === "Z" ||
      (Number(offset.slice(1, 3)) < 24 && Number(offset.slice(4, 6)) < 60)) &&
    Number.isFinite(Date.parse(value))
  );
};
/** Bound allocation and reject ambiguous receive windows before reading bytes. */
export function validateSonarDeclaration(profile: SonarDeclaration): void {
  const s = profile.sampling;
  if (
    !validUtc(profile.timeOrigin) ||
    !Number.isSafeInteger(s.pings) ||
    s.pings < 1 ||
    !Number.isSafeInteger(s.delayBins) ||
    s.delayBins < 1 ||
    s.pings * s.delayBins > 16777216 ||
    ![
      s.delayStartSeconds,
      s.delayStepSeconds,
      s.pingStepSeconds,
      profile.propagation.soundSpeedMps,
    ].every(finite) ||
    s.delayStartSeconds < 0 ||
    s.delayStepSeconds <= 0 ||
    s.pingStepSeconds <= 0 ||
    profile.propagation.soundSpeedMps <= 0 ||
    profile.propagation.kind !== "constant_assumed_sound_speed" ||
    profile.propagation.travelPath !== "two_way" ||
    profile.propagation.distanceMeaning !== "modeled_one_way_path_length" ||
    profile.availability.kind !== "receive_retention_mask" ||
    profile.availability.unavailable !== 0 ||
    profile.availability.available !== 1 ||
    profile.availability.missingAmplitude !== "zero_storage_placeholder" ||
    profile.products.amplitudes === profile.products.receiveMask
  )
    throw new Error(
      "Invalid monostatic envelope declaration or overlapping receive window."
    );
  const exactDelay = add(
      decimal(s.delayStartSeconds),
      scaled(s.delayStepSeconds, s.delayBins - 1)
    ),
    exactPing = decimal(s.pingStepSeconds);
  if (exactDelay.n * exactPing.d >= exactPing.n * exactDelay.d)
    throw new Error("Sonar receive window reaches the next ping.");
  const maxDelay = numericDecimal(exactDelay);
  if (
    !Number.isFinite((s.pings - 1) * s.pingStepSeconds + maxDelay) ||
    !Number.isFinite((maxDelay * profile.propagation.soundSpeedMps) / 2)
  )
    throw new Error("Sonar time or modeled distance arithmetic overflow.");
}

/** Conditional path length only; neither a measured depth nor a straight-line position. */
export function sonarDistance(
  profile: SonarDeclaration,
  delaySeconds: number
): number {
  validateSonarDeclaration(profile);
  const value = (delaySeconds * profile.propagation.soundSpeedMps) / 2;
  if (
    !Number.isFinite(delaySeconds) ||
    delaySeconds < 0 ||
    !Number.isFinite(value)
  )
    throw new Error("Invalid two-way delay.");
  return value;
}
export function sonarSample(
  profile: SonarDeclaration,
  ping: number,
  bin: number
) {
  validateSonarDeclaration(profile);
  const s = profile.sampling;
  if (
    !Number.isSafeInteger(ping) ||
    ping < 0 ||
    ping >= s.pings ||
    !Number.isSafeInteger(bin) ||
    bin < 0 ||
    bin >= s.delayBins
  )
    throw new Error("Sonar sample is outside the retained array.");
  const exactDelay = add(
      decimal(s.delayStartSeconds),
      scaled(s.delayStepSeconds, bin)
    ),
    exactPing = scaled(s.pingStepSeconds, ping);
  const delaySeconds = numericDecimal(exactDelay);
  return {
    ping,
    bin,
    delaySeconds,
    modeledDistanceM: sonarDistance(profile, delaySeconds),
    timeOffsetSeconds: numericDecimal(exactPing),
    receiveOffsetSeconds: numericDecimal(add(exactPing, exactDelay)),
    amplitudeByteOffset: (ping * s.delayBins + bin) * 4,
    maskByteOffset: ping * s.delayBins + bin,
  };
}
export function readSonarSample(
  profile: SonarDeclaration,
  data: SonarDecodedProducts,
  ping: number,
  bin: number
) {
  const sample = sonarSample(profile, ping, bin),
    i = ping * profile.sampling.delayBins + bin;
  if (
    data.amplitudes.length !==
      profile.sampling.pings * profile.sampling.delayBins ||
    data.receiveMask.length !== data.amplitudes.length
  )
    throw new Error("Incomplete decoded sonar products.");
  const mask = data.receiveMask[i],
    amplitude = data.amplitudes[i];
  if (
    (mask !== 0 && mask !== 1) ||
    amplitude === undefined ||
    !Number.isFinite(amplitude) ||
    amplitude < 0 ||
    amplitude > 1 ||
    (mask === 0 && amplitude !== 0)
  )
    throw new Error("Invalid sonar amplitude or receive mask.");
  return {
    ...sample,
    available: mask === 1,
    amplitude: mask === 1 ? amplitude : null,
  };
}

/** Decode exact retained cells. Missing reception remains separate from a zero amplitude.
 * This dependency-free reader checks layout/content, but not SHA-256 or acquisition lineage. */
export function readSonarProducts(
  profile: SonarDeclaration,
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>
): SonarDecodedProducts {
  validateSonarDeclaration(profile);
  const s = profile.sampling,
    total = s.pings * s.delayBins;
  const decoded = {} as SonarDecodedProducts;
  for (const role of ["amplitudes", "receiveMask"] as const) {
    const matches = layouts.filter(
      (l) => l.productRef === profile.products[role]
    );
    if (matches.length !== 1)
      throw new Error(`Sonar ${role} requires one source layout.`);
    const layout = matches[0]!,
      bytes = assets.get(layout.productRef),
      size = role === "amplitudes" ? 4 : 1;
    if (
      layout.kind !== "binary_array" ||
      layout.elementType !== (role === "amplitudes" ? "float32" : "uint8") ||
      layout.byteOrder !== "little" ||
      layout.order !== "row_major" ||
      layout.byteOffset !== 0 ||
      layout.quantity !==
        (role === "amplitudes"
          ? "normalized_echo_amplitude"
          : "receive_availability") ||
      layout.unit !== "1" ||
      !bytes ||
      bytes.byteLength !== total * size ||
      layout.byteLength !== bytes.byteLength
    )
      throw new Error(`Invalid sonar ${role} layout or retained bytes.`);
    const [ping, delay] = layout.axes;
    if (
      layout.axes.length !== 2 ||
      !ping ||
      ping.kind !== "time" ||
      ping.name !== "ping" ||
      ping.length !== s.pings ||
      ping.start !== profile.timeOrigin ||
      !Number.isSafeInteger(ping.stepSeconds.numerator) ||
      ping.stepSeconds.numerator <= 0 ||
      !Number.isSafeInteger(ping.stepSeconds.denominator) ||
      ping.stepSeconds.denominator <= 0 ||
      BigInt(ping.stepSeconds.numerator) * decimal(s.pingStepSeconds).d !==
        decimal(s.pingStepSeconds).n * BigInt(ping.stepSeconds.denominator) ||
      !delay ||
      delay.kind !== "regular" ||
      delay.name !== "two_way_delay" ||
      delay.unit !== "s" ||
      delay.length !== s.delayBins ||
      delay.origin !== s.delayStartSeconds ||
      delay.step !== s.delayStepSeconds
    )
      throw new Error(
        `Sonar ${role} must use the declared ping time and two-way delay axes.`
      );
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    decoded[role] = Array.from({ length: total }, (_, i) =>
      role === "amplitudes" ? view.getFloat32(i * 4, true) : view.getUint8(i)
    );
    // Reuse the standard locator for the last element as a boundary/extent check.
    readProductSourceSelection(
      layout,
      { kind: "array_element", indices: [s.pings - 1, s.delayBins - 1] },
      bytes
    );
  }
  for (let i = 0; i < total; i++) {
    const value = decoded.amplitudes[i]!,
      mask = decoded.receiveMask[i]!;
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1 ||
      (mask !== 0 && mask !== 1) ||
      (mask === 0 && value !== 0)
    )
      throw new Error(
        `Invalid sonar retained cell ${i}. Missing amplitudes must use the declared storage placeholder.`
      );
  }
  return decoded;
}
