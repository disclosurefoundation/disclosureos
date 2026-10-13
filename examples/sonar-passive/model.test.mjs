import test from "node:test";
import assert from "node:assert/strict";
import { config, simulate, spectrum } from "./model.mjs";
const direct = (input, fs) => {
  const n = input.length,
    mean = input.reduce((a, b) => a + b, 0) / n,
    w = input.map((_, j) => 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / n)),
    energy = w.reduce((a, b) => a + b * b, 0);
  return Array.from({ length: n / 2 + 1 }, (_, k) => {
    let re = 0,
      im = 0;
    for (let j = 0; j < n; j++) {
      const x = (input[j] - mean) * w[j],
        a = (2 * Math.PI * j * k) / n;
      re += x * Math.cos(a);
      im -= x * Math.sin(a);
    }
    return (
      ((re * re + im * im) / (fs * energy)) * (k === 0 || k === n / 2 ? 1 : 2)
    );
  });
};
test("every retained PSD value is finite nonnegative and every missing slot is zero", () => {
  const d = simulate();
  assert.equal(d.pressure.length, 32768);
  assert.equal(d.powerSpectralDensity.length, 65021);
  assert.equal(d.sampleMask.filter((x) => !x).length, 1280);
  assert.equal(d.frameMask.filter((x) => !x).length, 16);
  for (let f = 0; f < config.frames; f++) {
    const start = f * config.hopSamples;
    assert.equal(
      d.frameMask[f],
      Number(d.sampleMask.slice(start, start + 512).every(Boolean))
    );
    for (let b = 0; b < 257; b++) {
      const v = d.powerSpectralDensity[f * 257 + b];
      assert.ok(Number.isFinite(v) && v >= 0);
      if (!d.frameMask[f]) assert.equal(v, 0);
    }
  }
});
test("stored FFT matches independent direct DFT and window-weighted Parseval", () => {
  const d = simulate();
  for (const frame of [0, 32, 80, 160, 182, 252]) {
    const x = d.pressure.slice(frame * 128, frame * 128 + 512),
      expected = direct(x, 4096),
      actual = d.powerSpectralDensity.slice(frame * 257, (frame + 1) * 257);
    for (let k = 0; k < 257; k++)
      assert.ok(
        Math.abs(actual[k] - expected[k]) <=
          Math.max(1e-25, expected[k] * 1e-5),
        `${frame}/${k}`
      );
    const mean = x.reduce((a, b) => a + b, 0) / 512,
      w = x.map((_, j) => 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / 512)),
      target =
        x.reduce((a, v, j) => a + (v - mean) ** 2 * w[j] ** 2, 0) /
        w.reduce((a, b) => a + b * b, 0);
    assert.ok(
      Math.abs(actual.reduce((a, b) => a + b, 0) * 8 - target) < target * 1e-6
    );
  }
});
test("Nyquist is not doubled and constant input is removed", () => {
  assert.ok(spectrum(Array(512).fill(2)).every((x) => x === 0));
  const values = spectrum(
    Array.from({ length: 512 }, (_, j) => (j % 2 ? 0.7 : -0.7))
  );
  assert.ok(Math.abs(values.reduce((a, b) => a + b, 0) * 8 - 0.49) < 1e-7);
});
