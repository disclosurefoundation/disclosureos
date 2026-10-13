/** Reproducible synthetic pressure. These components are authored, not classified sources. */
export const config = Object.freeze({
  sampleRateHz: 4096,
  samples: 32768,
  windowSamples: 512,
  hopSamples: 128,
  frames: 253,
  frequencyBins: 257,
  timeOrigin: "2026-07-28T22:15:00Z",
});
export function retained(sample) {
  if (!Number.isInteger(sample) || sample < 0 || sample >= config.samples)
    throw new Error("Invalid pressure sample.");
  return (
    !(sample >= 12800 && sample < 13824) && !(sample >= 25600 && sample < 25856)
  );
}
export function pressureAt(sample) {
  retained(sample);
  const t = sample / config.sampleRateHz;
  const tone =
    0.002 *
    (0.85 + 0.15 * Math.cos(2 * Math.PI * 0.4 * t)) *
    Math.sin(2 * Math.PI * 224 * t);
  const harmonic = 0.0007 * Math.sin(2 * Math.PI * 448 * t + 0.4);
  const u = t - 1,
    chirp =
      u >= 0 && u <= 6
        ? 0.0015 *
          Math.sin((Math.PI * u) / 6) ** 2 *
          Math.sin(2 * Math.PI * (480 * u + (640 / 12) * u * u))
        : 0;
  const transient =
    0.003 *
    Math.exp(-0.5 * ((t - 5.7) / 0.07) ** 2) *
    Math.sin(2 * Math.PI * 1450 * t);
  // Stateless integer hash: deterministic broadband-like input, not empirical ambient noise.
  let h = Math.imul(sample + 1, 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  const background = 0.00012 * (((h >>> 0) / 4294967295) * 2 - 1);
  return Math.fround(tone + harmonic + chirp + transient + background);
}
export function spectrum(window, fs = config.sampleRateHz) {
  const n = window.length,
    real = new Float64Array(n),
    imag = new Float64Array(n);
  let mean = 0,
    energy = 0;
  for (const x of window) mean += x / n;
  for (let j = 0; j < n; j++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / n);
    real[j] = (window[j] - mean) * w;
    energy += w * w;
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let width = 2; width <= n; width *= 2)
    for (let start = 0; start < n; start += width)
      for (let j = 0; j < width / 2; j++) {
        const a = start + j,
          b = a + width / 2,
          angle = (-2 * Math.PI * j) / width,
          c = Math.cos(angle),
          s = Math.sin(angle),
          r = real[b] * c - imag[b] * s,
          q = real[b] * s + imag[b] * c;
        real[b] = real[a] - r;
        imag[b] = imag[a] - q;
        real[a] += r;
        imag[a] += q;
      }
  return Array.from({ length: n / 2 + 1 }, (_, k) =>
    Math.fround(
      ((real[k] ** 2 + imag[k] ** 2) / (fs * energy)) *
        (k === 0 || k === n / 2 ? 1 : 2)
    )
  );
}
export function simulate() {
  const pressure = [],
    sampleMask = [],
    powerSpectralDensity = [],
    frameMask = [];
  for (let i = 0; i < config.samples; i++) {
    const keep = retained(i);
    sampleMask.push(Number(keep));
    pressure.push(keep ? pressureAt(i) : 0);
  }
  for (let frame = 0; frame < config.frames; frame++) {
    const start = frame * config.hopSamples,
      keep = sampleMask
        .slice(start, start + config.windowSamples)
        .every((v) => v === 1);
    frameMask.push(Number(keep));
    powerSpectralDensity.push(
      ...(keep
        ? spectrum(pressure.slice(start, start + config.windowSamples))
        : Array(config.frequencyBins).fill(0))
    );
  }
  return { pressure, sampleMask, powerSpectralDensity, frameMask };
}
