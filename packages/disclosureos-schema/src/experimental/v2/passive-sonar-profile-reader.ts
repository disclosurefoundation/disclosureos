import {
  readProductSourceSelection,
  type ProductSourceLayout,
} from "./product-source-reader";
/** Minimal browser declaration. The evaluator additionally verifies document lineage and hashes. */
export interface PassiveSonarDeclaration {
  timeOrigin: string;
  sampling: { samples: number; sampleRateHz: number };
  transform: {
    kind: "one_sided_power_spectral_density";
    windowSamples: number;
    hopSamples: number;
    window: "periodic_hann";
    detrend: "remove_arithmetic_mean_before_window";
    padding: "none_full_windows_only";
    scaling: "sum_squared_window_times_sample_rate";
    oneSided: "double_interior_bins_only";
    missingWindow: "unavailable_if_any_input_missing";
  };
  display: {
    densityReferencePa2PerHz: 1e-12;
    logarithm: "10_log10_density_over_reference";
    zeroDensity: "negative_infinity_no_floor";
  };
  availability: {
    unavailable: 0;
    available: 1;
    missingValue: "zero_storage_placeholder";
  };
  products: {
    pressure: string;
    sampleMask: string;
    powerSpectralDensity: string;
    frameMask: string;
  };
}
export interface PassiveSonarDecodedProducts {
  /** Storage values: sampleMask=0 indicates an unavailable sample, not measured silence. */
  pressure: number[];
  sampleMask: number[];
  /** Row-major window,frequency storage values, conditioned on frameMask. */
  powerSpectralDensity: number[];
  frameMask: number[];
}
const validUtc = (value: string) => {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(
      value
    );
  if (!m) return false;
  const year = Number(m[1]),
    month = Number(m[2]),
    day = Number(m[3]),
    offset = m[7]!;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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
export function passiveSonarDimensions(p: PassiveSonarDeclaration) {
  return {
    frames:
      Math.floor(
        (p.sampling.samples - p.transform.windowSamples) /
          p.transform.hopSamples
      ) + 1,
    bins: p.transform.windowSamples / 2 + 1,
  };
}
export function validatePassiveSonarDeclaration(
  p: PassiveSonarDeclaration
): void {
  const s = p.sampling,
    t = p.transform,
    { frames, bins } = passiveSonarDimensions(p);
  if (
    !validUtc(p.timeOrigin) ||
    !Number.isSafeInteger(s.samples) ||
    s.samples < 4 ||
    s.samples > 16777216 ||
    !Number.isSafeInteger(s.sampleRateHz) ||
    s.sampleRateHz <= 0 ||
    s.sampleRateHz > 1e9 ||
    !Number.isSafeInteger(t.windowSamples) ||
    t.windowSamples < 4 ||
    t.windowSamples > 65536 ||
    (t.windowSamples & (t.windowSamples - 1)) !== 0 ||
    t.windowSamples > s.samples ||
    !Number.isSafeInteger(t.hopSamples) ||
    t.hopSamples < 1 ||
    t.hopSamples > t.windowSamples ||
    frames * bins > 16777216 ||
    frames * t.windowSamples > 33554432 ||
    t.kind !== "one_sided_power_spectral_density" ||
    t.window !== "periodic_hann" ||
    t.detrend !== "remove_arithmetic_mean_before_window" ||
    t.padding !== "none_full_windows_only" ||
    t.scaling !== "sum_squared_window_times_sample_rate" ||
    t.oneSided !== "double_interior_bins_only" ||
    t.missingWindow !== "unavailable_if_any_input_missing" ||
    p.display.densityReferencePa2PerHz !== 1e-12 ||
    p.display.logarithm !== "10_log10_density_over_reference" ||
    p.display.zeroDensity !== "negative_infinity_no_floor" ||
    p.availability.unavailable !== 0 ||
    p.availability.available !== 1 ||
    p.availability.missingValue !== "zero_storage_placeholder" ||
    new Set(Object.values(p.products)).size !== 4
  )
    throw new Error("Invalid passive pressure/spectral-density declaration.");
}
/** Periodic Hann, frame mean removed before weighting. No zero padding; real one-sided PSD. */
export function computePassiveSonarSpectrum(
  samples: ArrayLike<number>,
  sampleRateHz: number
): number[] {
  const n = samples.length;
  if (
    !Number.isSafeInteger(n) ||
    n < 4 ||
    n > 65536 ||
    (n & (n - 1)) !== 0 ||
    !Number.isFinite(sampleRateHz) ||
    sampleRateHz <= 0
  )
    throw new Error("Invalid spectral input.");
  const real = new Float64Array(n),
    imag = new Float64Array(n);
  let mean = 0,
    energy = 0;
  for (let j = 0; j < n; j++) {
    if (!Number.isFinite(samples[j]))
      throw new Error("Nonfinite pressure input.");
    mean += samples[j]! / n;
  }
  for (let j = 0; j < n; j++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / n);
    real[j] = (samples[j]! - mean) * w;
    energy += w * w;
  }
  // In-place radix-2 FFT with explicit bit reversal.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const swap = real[i]!;
      real[i] = real[j]!;
      real[j] = swap;
    }
  }
  for (let width = 2; width <= n; width *= 2)
    for (let start = 0; start < n; start += width)
      for (let j = 0; j < width / 2; j++) {
        const a = start + j,
          b = a + width / 2,
          angle = (-2 * Math.PI * j) / width,
          c = Math.cos(angle),
          s = Math.sin(angle);
        const r = real[b]! * c - imag[b]! * s,
          q = real[b]! * s + imag[b]! * c;
        real[b] = real[a]! - r;
        imag[b] = imag[a]! - q;
        real[a] = real[a]! + r;
        imag[a] = imag[a]! + q;
      }
  const density = Array.from(
    { length: n / 2 + 1 },
    (_, k) =>
      ((real[k]! ** 2 + imag[k]! ** 2) / (sampleRateHz * energy)) *
      (k === 0 || k === n / 2 ? 1 : 2)
  );
  if (density.some((v) => !Number.isFinite(v)))
    throw new Error("Spectral arithmetic overflow.");
  return density;
}
export function passiveSonarSample(p: PassiveSonarDeclaration, sample: number) {
  validatePassiveSonarDeclaration(p);
  if (
    !Number.isSafeInteger(sample) ||
    sample < 0 ||
    sample >= p.sampling.samples
  )
    throw new Error("Pressure sample is outside the retained array.");
  return {
    sample,
    timeOffsetSeconds: sample / p.sampling.sampleRateHz,
    pressureByteOffset: sample * 4,
    sampleMaskByteOffset: sample,
  };
}
export function passiveSonarBin(
  p: PassiveSonarDeclaration,
  frame: number,
  bin: number
) {
  validatePassiveSonarDeclaration(p);
  const { frames, bins } = passiveSonarDimensions(p),
    n = p.transform.windowSamples,
    first = frame * p.transform.hopSamples,
    fs = p.sampling.sampleRateHz;
  if (
    !Number.isSafeInteger(frame) ||
    frame < 0 ||
    frame >= frames ||
    !Number.isSafeInteger(bin) ||
    bin < 0 ||
    bin >= bins
  )
    throw new Error("Spectral cell is outside the retained array.");
  return {
    frame,
    bin,
    frequencyHz: (bin * fs) / n,
    timeOffsetSeconds: first / fs,
    centerOffsetSeconds: (first + n / 2) / fs,
    startSample: first,
    endSampleExclusive: first + n,
    lastSampleOffsetSeconds: (first + n - 1) / fs,
    endOffsetSeconds: (first + n) / fs,
    pressureByteOffset: first * 4,
    pressureByteLength: n * 4,
    sampleMaskByteOffset: first,
    sampleMaskByteLength: n,
    densityByteOffset: (frame * bins + bin) * 4,
    frameMaskByteOffset: frame,
  };
}
export function passiveSonarDensityDb(
  p: PassiveSonarDeclaration,
  density: number
): number {
  validatePassiveSonarDeclaration(p);
  if (!Number.isFinite(density) || density < 0)
    throw new Error("Invalid pressure spectral density.");
  return density === 0
    ? -Infinity
    : 10 *
        (Math.log10(density) - Math.log10(p.display.densityReferencePa2PerHz));
}
const requireLengths = (
  p: PassiveSonarDeclaration,
  data: PassiveSonarDecodedProducts
) => {
  const { frames, bins } = passiveSonarDimensions(p);
  if (
    data.pressure.length !== p.sampling.samples ||
    data.sampleMask.length !== p.sampling.samples ||
    data.frameMask.length !== frames ||
    data.powerSpectralDensity.length !== frames * bins
  )
    throw new Error("Incomplete passive sonar products.");
};
export function readPassiveSonarSample(
  p: PassiveSonarDeclaration,
  data: PassiveSonarDecodedProducts,
  sample: number
) {
  const selected = passiveSonarSample(p, sample);
  requireLengths(p, data);
  const mask = data.sampleMask[sample],
    pressure = data.pressure[sample];
  if (
    (mask !== 0 && mask !== 1) ||
    !Number.isFinite(pressure) ||
    (mask === 0 && pressure !== 0)
  )
    throw new Error("Invalid pressure sample or availability mask.");
  return {
    ...selected,
    available: mask === 1,
    pressure: mask === 1 ? pressure! : null,
  };
}
export function readPassiveSonarBin(
  p: PassiveSonarDeclaration,
  data: PassiveSonarDecodedProducts,
  frame: number,
  bin: number
) {
  const selected = passiveSonarBin(p, frame, bin);
  requireLengths(p, data);
  const density =
      data.powerSpectralDensity[frame * passiveSonarDimensions(p).bins + bin],
    mask = data.frameMask[frame];
  if (
    (mask !== 0 && mask !== 1) ||
    density === undefined ||
    !Number.isFinite(density) ||
    density < 0 ||
    (mask === 0 && density !== 0)
  )
    throw new Error("Invalid spectral density or frame mask.");
  return {
    ...selected,
    available: mask === 1,
    density: mask === 1 ? density : null,
    densityDb: mask === 1 ? passiveSonarDensityDb(p, density) : null,
  };
}
/** Validate and reproduce the complete PSD against exact retained waveform bytes.
 * This dependency-free reader does not authenticate hashes or acquisition bindings. */
export function readPassiveSonarProducts(
  p: PassiveSonarDeclaration,
  layouts: readonly ProductSourceLayout[],
  assets: ReadonlyMap<string, Uint8Array>
): PassiveSonarDecodedProducts {
  validatePassiveSonarDeclaration(p);
  const { frames, bins } = passiveSonarDimensions(p),
    s = p.sampling,
    t = p.transform,
    decoded = {} as PassiveSonarDecodedProducts;
  for (const role of [
    "pressure",
    "sampleMask",
    "powerSpectralDensity",
    "frameMask",
  ] as const) {
    const matches = layouts.filter((l) => l.productRef === p.products[role]);
    if (matches.length !== 1)
      throw new Error(`Passive sonar ${role} requires one source layout.`);
    const layout = matches[0]!,
      bytes = assets.get(layout.productRef),
      mask = role === "sampleMask" || role === "frameMask",
      waveform = role === "pressure" || role === "sampleMask";
    const length = waveform
        ? s.samples
        : role === "frameMask"
        ? frames
        : frames * bins,
      size = mask ? 1 : 4;
    const quantity = {
      pressure: "sound_pressure",
      sampleMask: "sample_availability",
      powerSpectralDensity: "sound_pressure_power_spectral_density",
      frameMask: "window_availability",
    }[role];
    const unit = {
      pressure: "Pa",
      sampleMask: "1",
      powerSpectralDensity: "Pa^2/Hz",
      frameMask: "1",
    }[role];
    if (
      layout.kind !== "binary_array" ||
      layout.elementType !== (mask ? "uint8" : "float32") ||
      layout.byteOrder !== "little" ||
      layout.order !== "row_major" ||
      layout.byteOffset !== 0 ||
      layout.quantity !== quantity ||
      layout.unit !== unit ||
      !bytes ||
      bytes.byteLength !== length * size ||
      layout.byteLength !== bytes.byteLength
    )
      throw new Error(`Invalid passive sonar ${role} layout or bytes.`);
    const axis = layout.axes[0],
      frequency = layout.axes[1],
      numerator = waveform ? 1 : t.hopSamples;
    if (
      !axis ||
      axis.kind !== "time" ||
      axis.name !== (waveform ? "sample" : "window_start") ||
      axis.length !== (waveform ? s.samples : frames) ||
      axis.start !== p.timeOrigin ||
      !Number.isSafeInteger(axis.stepSeconds.numerator) ||
      axis.stepSeconds.numerator <= 0 ||
      !Number.isSafeInteger(axis.stepSeconds.denominator) ||
      axis.stepSeconds.denominator <= 0 ||
      BigInt(axis.stepSeconds.numerator) * BigInt(s.sampleRateHz) !==
        BigInt(numerator) * BigInt(axis.stepSeconds.denominator) ||
      layout.axes.length !== (role === "powerSpectralDensity" ? 2 : 1)
    )
      throw new Error(`Invalid passive sonar ${role} time axis.`);
    if (
      role === "powerSpectralDensity" &&
      (!frequency ||
        frequency.kind !== "regular" ||
        frequency.name !== "frequency" ||
        frequency.unit !== "Hz" ||
        frequency.length !== bins ||
        frequency.origin !== 0 ||
        frequency.step !== s.sampleRateHz / t.windowSamples)
    )
      throw new Error("Invalid passive sonar frequency axis.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    decoded[role] = Array.from({ length }, (_, i) =>
      mask ? view.getUint8(i) : view.getFloat32(i * 4, true)
    );
    readProductSourceSelection(
      layout,
      {
        kind: "array_element",
        indices:
          role === "powerSpectralDensity"
            ? [frames - 1, bins - 1]
            : [length - 1],
      },
      bytes
    );
  }
  for (let sample = 0; sample < s.samples; sample++) {
    const v = decoded.pressure[sample]!,
      m = decoded.sampleMask[sample]!;
    if (!Number.isFinite(v) || (m !== 0 && m !== 1) || (m === 0 && v !== 0))
      throw new Error(`Invalid retained pressure cell ${sample}.`);
  }
  for (let frame = 0; frame < frames; frame++) {
    const start = frame * t.hopSamples,
      available = decoded.sampleMask
        .slice(start, start + t.windowSamples)
        .every((v) => v === 1),
      m = decoded.frameMask[frame];
    if (m !== Number(available))
      throw new Error(
        `Frame ${frame} availability disagrees with its exact input window.`
      );
    const expected = available
      ? computePassiveSonarSpectrum(
          decoded.pressure.slice(start, start + t.windowSamples),
          s.sampleRateHz
        )
      : undefined;
    for (let bin = 0; bin < bins; bin++) {
      const value = decoded.powerSpectralDensity[frame * bins + bin]!;
      if (!Number.isFinite(value) || value < 0 || (!available && value !== 0))
        throw new Error(`Invalid retained spectral cell ${frame}/${bin}.`);
      if (
        expected &&
        Math.abs(value - expected[bin]!) >
          Math.max(1e-25, Math.abs(expected[bin]!) * 1e-5)
      )
        throw new Error(
          `Spectral cell ${frame}/${bin} does not reproduce from its retained pressure window.`
        );
    }
  }
  return decoded;
}
