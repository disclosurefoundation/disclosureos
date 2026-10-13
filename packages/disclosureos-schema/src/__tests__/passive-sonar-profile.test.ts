import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { evaluatePassiveSonarProfile } from "../experimental/v2/passive-sonar-profile";
import { PassiveSonarProfileSchema } from "../experimental/v2/passive-sonar-profile-schema";
import {
  readPassiveSonarProducts,
  readPassiveSonarSample,
  readPassiveSonarBin,
  passiveSonarSample,
  passiveSonarBin,
  passiveSonarDensityDb,
  computePassiveSonarSpectrum,
} from "../experimental/v2/passive-sonar-profile-reader";
const packet = async () =>
  (
    await import(
      new URL("../../../../examples/sonar-passive/build.mjs", import.meta.url)
        .href
    )
  ).createPacket();
type Packet = Awaited<ReturnType<typeof packet>>;
const evaluate = (p: Packet) =>
  evaluatePassiveSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
const failure = async (p: Packet, code: string) => {
  const r = await evaluate(p);
  expect(r.success).toBe(false);
  expect(r.data).toBeUndefined();
  expect(r.issues.map((v) => v.code)).toContain(code);
};
const repin = (p: Packet, role: string, bytes: Uint8Array) => {
  const ref = p.profile.products[role],
    digest = {
      algorithm: "sha256",
      value: createHash("sha256").update(bytes).digest("hex"),
    };
  p.assets.set(ref, bytes);
  Object.assign(
    p.selection.layouts.find(
      (x: { productRef: string }) => x.productRef === ref
    ),
    { digest, byteLength: bytes.byteLength }
  );
  p.observation.products.find(
    (x: { id: string }) => `product:${x.id}` === ref
  ).digest = digest;
  const acquired = p.context.products.find(
    (x: { id: string }) => `product:${x.id}` === ref
  );
  if (acquired)
    Object.assign(acquired.artifact, { digest, byteLength: bytes.byteLength });
};
describe("single-hydrophone pressure and spectral-density profile", () => {
  it("verifies source bindings and reproduction without claiming physical validity", async () => {
    const p = await packet(),
      r = await evaluate(p);
    expect(r.success, JSON.stringify(r.issues)).toBe(true);
    expect(r.checks).toEqual({
      structure: "passed",
      sources: "passed",
      semantics: "passed",
      reproduction: "passed",
    });
    expect(r.physicalCalibration).toBe("not_checked");
    expect(r.localization).toBe("not_checked");
    expect(r.scientific).toBe("not_checked");
    expect(r.data!.products.pressure).toHaveLength(32768);
    expect(r.data!.products.powerSpectralDensity).toHaveLength(65021);
    expect(r.data!.products.frameMask.filter((v) => v === 0)).toHaveLength(16);
  });
  it("maps selected PSD to its exact source window and frequency", async () => {
    const p = await packet(),
      d = readPassiveSonarProducts(p.profile, p.selection.layouts, p.assets),
      v = readPassiveSonarBin(p.profile, d, 32, 28);
    expect(v).toMatchObject({
      available: true,
      frequencyHz: 224,
      timeOffsetSeconds: 1,
      centerOffsetSeconds: 1.0625,
      startSample: 4096,
      endSampleExclusive: 4608,
      pressureByteOffset: 16384,
      pressureByteLength: 2048,
      sampleMaskByteOffset: 4096,
      sampleMaskByteLength: 512,
      densityByteOffset: (32 * 257 + 28) * 4,
    });
    expect(v.density).toBeGreaterThan(0);
    expect(v.densityDb).toBeCloseTo(10 * Math.log10(v.density! / 1e-12), 10);
    expect(readPassiveSonarSample(p.profile, d, 4352)).toMatchObject({
      available: true,
      timeOffsetSeconds: 1.0625,
      pressureByteOffset: 17408,
    });
  });
  it("keeps absent waveform and all overlapping spectral windows unavailable", async () => {
    const p = await packet(),
      d = readPassiveSonarProducts(p.profile, p.selection.layouts, p.assets);
    expect(readPassiveSonarSample(p.profile, d, 12800)).toMatchObject({
      available: false,
      pressure: null,
    });
    for (const frame of [
      97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 197, 198, 199, 200,
      201,
    ])
      expect(readPassiveSonarBin(p.profile, d, frame, 28)).toMatchObject({
        available: false,
        density: null,
        densityDb: null,
      });
    expect(readPassiveSonarBin(p.profile, d, 96, 28).available).toBe(true);
    expect(readPassiveSonarBin(p.profile, d, 108, 28).available).toBe(true);
  });
  it("defines retained zero density as negative infinity, not missing", async () => {
    const p = await packet();
    expect(passiveSonarDensityDb(p.profile, 0)).toBe(-Infinity);
    expect(passiveSonarDensityDb(p.profile, 1e-12)).toBe(0);
    expect(passiveSonarDensityDb(p.profile, 1e308)).toBe(3200);
  });
  it("preserves valid observed zero pressure", async () => {
    const p = await packet(),
      d = readPassiveSonarProducts(p.profile, p.selection.layouts, p.assets);
    d.pressure[0] = 0;
    expect(readPassiveSonarSample(p.profile, d, 0)).toMatchObject({
      pressure: 0,
      available: true,
    });
  });
  it.each([-1, 32768, 1.5, NaN])(
    "rejects outside pressure index %s",
    async (n) => {
      const p = await packet();
      expect(() => passiveSonarSample(p.profile, n)).toThrow();
    }
  );
  it.each([
    [-1, 0],
    [253, 0],
    [0, -1],
    [0, 257],
    [0.5, 0],
  ])("rejects outside spectral index %s/%s", async (f, b) => {
    const p = await packet();
    expect(() => passiveSonarBin(p.profile, f, b)).toThrow();
  });
  it.each([-1, NaN, Infinity])("rejects invalid density %s", async (v) => {
    const p = await packet();
    expect(() => passiveSonarDensityDb(p.profile, v)).toThrow();
  });
  it("does not verify declaration without source bytes", async () => {
    const p = await packet(),
      r = await evaluatePassiveSonarProfile(
        p.observation,
        p.context,
        p.selection,
        p.profile
      );
    expect(r.success).toBe(false);
    expect(r.checks.sources).toBe("failed");
  });
  it("rejects changed bytes even if changed pressure remains finite", async () => {
    const p = await packet();
    p.assets.get("product:pressure")[0] ^= 1;
    await failure(p, "PASSIVE_SONAR.SOURCE.EXTERNAL.DIGEST");
  });
  it("snapshots bytes before digest await", async () => {
    const p = await packet(),
      pending = evaluate(p);
    p.assets.get("product:pressure").fill(255);
    expect((await pending).success).toBe(true);
  });
  it.each(["observationId", "contextId", "sourceSelectionId"])(
    "rejects wrong %s",
    async (key) => {
      const p = await packet();
      p.profile[key] = "other";
      await failure(p, "PASSIVE_SONAR.IDENTITY");
    }
  );
  it("requires pressure units on the selected channel", async () => {
    const p = await packet();
    p.context.manifests[0].channels[0].unit = "V";
    await failure(p, "PASSIVE_SONAR.CHANNEL");
  });
  it.each(["acquisitionProductRef", "sampleMaskAcquisitionProductRef"])(
    "rejects acquisition mismatch in %s",
    async (key) => {
      const p = await packet();
      p.profile[key] = "product:other";
      await failure(p, "PASSIVE_SONAR.CAPTURE_BINDING");
    }
  );
  it("requires independently bound raw pressure and sample mask", async () => {
    const p = await packet();
    p.profile.sampleMaskAcquisitionProductRef = p.profile.acquisitionProductRef;
    await failure(p, "PASSIVE_SONAR.CAPTURE_ALIAS");
  });
  it("requires exact input lineage", async () => {
    const p = await packet();
    p.observation.processing[0].inputRefs = ["product:pressure"];
    await failure(p, "PASSIVE_SONAR.PROCESSING");
  });
  it("requires exact output lineage", async () => {
    const p = await packet();
    p.observation.processing[0].outputRefs = ["product:powerSpectralDensity"];
    await failure(p, "PASSIVE_SONAR.PREREQUISITE");
  });
  it("requires processing version agreement", async () => {
    const p = await packet();
    p.observation.methods[0].version = "different";
    await failure(p, "PASSIVE_SONAR.PREREQUISITE");
  });
  it("requires spectral outputs to be derived by the selected process", async () => {
    const p = await packet();
    p.observation.products[2] = {
      ...p.observation.products[0],
      id: "powerSpectralDensity",
      digest: p.observation.products[2].digest,
    };
    await failure(p, "PASSIVE_SONAR.PREREQUISITE");
  });
  it("accepts the exact final sample endpoint", async () => {
    const p = await packet();
    p.context.acquisitions[0].time.end = "2026-07-28T22:15:07.999755859375Z";
    p.observation.eventTime.value.end.value =
      p.context.acquisitions[0].time.end;
    expect((await evaluate(p)).success).toBe(true);
  });
  it("rejects an endpoint one picosecond before the final sample", async () => {
    const p = await packet();
    p.context.acquisitions[0].time.end = "2026-07-28T22:15:07.999755859374Z";
    await failure(p, "PASSIVE_SONAR.ACQUISITION_TIME");
  });
  it("rejects an observation ending before the waveform", async () => {
    const p = await packet();
    p.observation.eventTime.value.end.value = "2026-07-28T22:15:07Z";
    await failure(p, "PASSIVE_SONAR.OBSERVATION_TIME");
  });
  it.each([
    ["pressure units", (p: Packet) => (p.selection.layouts[0].unit = "V")],
    ["PSD units", (p: Packet) => (p.selection.layouts[2].unit = "Pa^2")],
    [
      "frequency step",
      (p: Packet) => (p.selection.layouts[2].axes[1].step = 4),
    ],
    [
      "sample time step",
      (p: Packet) =>
        (p.selection.layouts[0].axes[0].stepSeconds.denominator = 4095),
    ],
    [
      "frame time step",
      (p: Packet) =>
        (p.selection.layouts[3].axes[0].stepSeconds.numerator = 129),
    ],
    [
      "PSD bin count",
      (p: Packet) => (p.selection.layouts[2].axes[1].length = 256),
    ],
    ["byte order", (p: Packet) => (p.selection.layouts[0].byteOrder = "big")],
    [
      "aliased products",
      (p: Packet) =>
        (p.profile.products.frameMask = p.profile.products.sampleMask),
    ],
    ["nonpoweroftwo", (p: Packet) => (p.profile.transform.windowSamples = 510)],
    [
      "wrong window",
      (p: Packet) => (p.profile.transform.window = "symmetric_hann"),
    ],
    ["no detrend", (p: Packet) => (p.profile.transform.detrend = "none")],
    [
      "overflow samples",
      (p: Packet) => (p.profile.sampling.samples = 16777217),
    ],
  ])("reader rejects %s", async (_, mutate) => {
    const p = await packet();
    mutate(p);
    expect(() =>
      readPassiveSonarProducts(p.profile, p.selection.layouts, p.assets)
    ).toThrow();
  });
  it.each([
    ["negative PSD", "powerSpectralDensity", 0, -1],
    ["infinite pressure", "pressure", 0, Infinity],
    ["missing pressure nonzero", "pressure", 12800, 0.1],
    ["PSD numerical mismatch", "powerSpectralDensity", 32 * 257 + 28, 0.123],
    ["missing frame nonzero", "powerSpectralDensity", 100 * 257 + 28, 0.1],
  ])("evaluator rejects repinned %s", async (_, role, cell, value) => {
    const p = await packet(),
      bytes = Uint8Array.from(p.assets.get(p.profile.products[role]));
    new DataView(bytes.buffer).setFloat32(
      Number(cell) * 4,
      Number(value),
      true
    );
    repin(p, String(role), bytes);
    await failure(p, "PASSIVE_SONAR.CONTENT");
  });
  it.each([
    ["sampleMask", 0, 2],
    ["frameMask", 32, 0],
    ["frameMask", 100, 1],
  ])("rejects invalid %s cell%s=%s", async (role, cell, value) => {
    const p = await packet(),
      bytes = Uint8Array.from(p.assets.get(p.profile.products[role]));
    bytes[Number(cell)] = Number(value);
    repin(p, String(role), bytes);
    await failure(p, "PASSIVE_SONAR.CONTENT");
  });
  it("does not fill a missing zero-weight Hann endpoint", async () => {
    const p = await packet(),
      pressure = Uint8Array.from(p.assets.get("product:pressure")),
      mask = Uint8Array.from(p.assets.get("product:sampleMask"));
    pressure.fill(0, 0, 4);
    mask[0] = 0;
    repin(p, "pressure", pressure);
    repin(p, "sampleMask", mask);
    await failure(p, "PASSIVE_SONAR.CONTENT");
  });
  it("strictly rejects undeclared profile fields", async () => {
    const p = await packet();
    p.profile.rangeM = 10;
    expect(PassiveSonarProfileSchema.safeParse(p.profile).success).toBe(false);
  });
  it("has correct one-sided Nyquist power and weighted Parseval", () => {
    const n = 512,
      fs = 4096,
      x = Array.from({ length: n }, (_, i) => 0.7 * (i % 2 ? 1 : -1)),
      psd = computePassiveSonarSpectrum(x, fs);
    expect((psd.reduce((a, b) => a + b, 0) * fs) / n).toBeCloseTo(0.49, 12);
    expect(psd[n / 2]).toBeCloseTo(0.49 * (n / fs) * (2 / 3), 12);
  });
  it("removes DC before windowing", () => {
    expect(
      computePassiveSonarSpectrum(Array(512).fill(2), 4096).every(
        (x) => x === 0
      )
    ).toBe(true);
  });
});
