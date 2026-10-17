import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluateSonarProfile } from "../experimental/v2/sonar-profile";
import { SonarProfileSchema } from "../experimental/v2/sonar-profile-schema";
import {
  readSonarProducts,
  readSonarSample,
  sonarDistance,
  sonarSample,
} from "../experimental/v2/sonar-profile-reader";
import { readProductSourceSelection } from "../experimental/v2/product-source-reader";
const createPacket = async () =>
  (
    await import(
      new URL("../../../../examples/sonar-active/build.mjs", import.meta.url)
        .href
    )
  ).createPacket();
type Packet = Awaited<ReturnType<typeof createPacket>>;
const evaluate = (p: Packet) =>
  evaluateSonarProfile(p.observation, p.context, p.selection, p.profile, {
    assets: p.assets,
  });
const repin = (p: Packet, role: string, bytes: Uint8Array) => {
  const ref = p.profile.products[role],
    digest = {
      algorithm: "sha256",
      value: createHash("sha256").update(bytes).digest("hex"),
    };
  p.assets.set(ref, bytes);
  Object.assign(
    p.selection.layouts.find(
      (l: { productRef: string }) => l.productRef === ref
    ),
    { digest, byteLength: bytes.byteLength }
  );
  p.observation.products.find(
    (v: { id: string }) => `product:${v.id}` === ref
  ).digest = digest;
  Object.assign(
    p.context.products.find((v: { id: string }) => `product:${v.id}` === ref)
      .artifact,
    { digest, byteLength: bytes.byteLength }
  );
};
const failure = async (p: Packet, code: string) => {
  const result = await evaluate(p);
  expect(result.success).toBe(false);
  expect(result.data).toBeUndefined();
  expect(result.issues.map((i) => i.code)).toContain(code);
};

describe("monostatic echo-envelope profile", () => {
  it("verifies independent source bindings and keeps scientific status separate", async () => {
    const p = await createPacket(),
      result = await evaluate(p);
    expect(result.success, JSON.stringify(result.issues)).toBe(true);
    expect(result.checks).toEqual({
      structure: "passed",
      sources: "passed",
      semantics: "passed",
    });
    expect(result.scientific).toBe("not_checked");
    expect(result.physicalCalibration).toBe("not_checked");
    expect(result.propagationAccuracy).toBe("not_checked");
    expect(result.data!.products.amplitudes).toHaveLength(16384);
    expect(
      result.data!.products.receiveMask.filter((v) => v === 0)
    ).toHaveLength(960);
  });
  it("returns null for unavailable amplitude while preserving exact source byte location", async () => {
    const p = await createPacket(),
      products = readSonarProducts(p.profile, p.selection.layouts, p.assets);
    const selected = readSonarSample(p.profile, products, 28, 130);
    expect(selected).toMatchObject({
      available: false,
      amplitude: null,
      timeOffsetSeconds: 28,
      delaySeconds: 0.13,
      modeledDistanceM: 97.5,
      receiveOffsetSeconds: 28.13,
      amplitudeByteOffset: (28 * 256 + 130) * 4,
      maskByteOffset: 28 * 256 + 130,
    });
    const generic = readProductSourceSelection(
      p.selection.layouts[0],
      { kind: "array_element", indices: [28, 130] },
      p.assets.get("product:amplitudes")
    );
    expect(generic.value).toBe(0);
    expect(generic.byteOffset).toBe(selected.amplitudeByteOffset);
    expect(generic.time).toEqual({
      start: p.profile.timeOrigin,
      offsetSeconds: { numerator: 28, denominator: 1 },
    });
  });
  it("distinguishes a valid observed zero from the unavailable placeholder", async () => {
    const p = await createPacket(),
      bytes = Uint8Array.from(p.assets.get("product:amplitudes"));
    new DataView(bytes.buffer).setFloat32(0, 0, true);
    repin(p, "amplitudes", bytes);
    const result = await evaluate(p);
    expect(result.success).toBe(true);
    expect(
      readSonarSample(p.profile, result.data!.products, 0, 0)
    ).toMatchObject({ available: true, amplitude: 0 });
  });
  it("derives both delay origin and sound speed from the declaration", async () => {
    const p = await createPacket();
    p.profile.sampling.delayStartSeconds = 0.01;
    p.profile.propagation.soundSpeedMps = 1480;
    expect(sonarSample(p.profile, 2, 20)).toMatchObject({
      timeOffsetSeconds: 2,
      delaySeconds: 0.03,
      modeledDistanceM: 22.2,
      receiveOffsetSeconds: 2.03,
    });
    expect(sonarDistance(p.profile, 0.1)).toBe(74);
  });
  it.each([
    [-1, 0],
    [64, 0],
    [0, -1],
    [0, 256],
    [1.5, 2],
    [NaN, 1],
  ])("rejects invalid sample indices %s/%s", async (ping, bin) => {
    const p = await createPacket();
    expect(() => sonarSample(p.profile, ping, bin)).toThrow();
  });
  it.each([-1, NaN, Infinity])("rejects invalid delay %s", async (delay) => {
    const p = await createPacket();
    expect(() => sonarDistance(p.profile, delay)).toThrow();
  });
  it("does not verify metadata without source bytes", async () => {
    const p = await createPacket();
    const result = await evaluateSonarProfile(
      p.observation,
      p.context,
      p.selection,
      p.profile
    );
    expect(result.success).toBe(false);
    expect(result.checks.sources).toBe("failed");
    expect(result.data).toBeUndefined();
  });
  it("rejects changed bytes even when numerical ranges remain valid", async () => {
    const p = await createPacket();
    p.assets.get("product:amplitudes")[0] ^= 1;
    await failure(p, "SONAR.SOURCE.EXTERNAL.DIGEST");
  });
  it("snapshots caller-owned bytes before digest await", async () => {
    const p = await createPacket();
    const pending = evaluate(p);
    p.assets.get("product:amplitudes").fill(255);
    const result = await pending;
    expect(result.success).toBe(true);
    expect(result.data!.products.amplitudes[0]).toBeGreaterThan(0);
  });
  it.each(["observationId", "contextId", "sourceSelectionId"])(
    "rejects mismatched %s",
    async (key) => {
      const p = await createPacket();
      p.profile[key] = "another-document";
      await failure(p, "SONAR.IDENTITY");
    }
  );
  it("rejects a channel with a different quantity or unit", async () => {
    const p = await createPacket();
    p.context.manifests[0].channels[0].unit = "Pa";
    await failure(p, "SONAR.CHANNEL");
  });
  it("requires a selected acquisition channel", async () => {
    const p = await createPacket();
    p.profile.channelId = "other-channel";
    await failure(p, "SONAR.CHANNEL");
  });
  it("requires both role artifacts to belong to this acquisition", async () => {
    const p = await createPacket();
    p.profile.receiveMaskAcquisitionProductRef = "product:missing";
    await failure(p, "SONAR.CAPTURE_BINDING");
  });
  it("rejects an aliased acquisition artifact", async () => {
    const p = await createPacket();
    p.profile.receiveMaskAcquisitionProductRef =
      p.profile.acquisitionProductRef;
    await failure(p, "SONAR.CAPTURE_ALIAS");
  });
  it("rejects semantic role aliasing", async () => {
    const p = await createPacket();
    p.profile.products.receiveMask = p.profile.products.amplitudes;
    await failure(p, "SONAR.DECLARATION");
  });
  it("rejects receive windows that reach the next ping", async () => {
    const p = await createPacket();
    p.profile.sampling.pingStepSeconds = 0.255;
    await failure(p, "SONAR.DECLARATION");
  });
  it("rejects acquisition intervals shorter than the final received sample", async () => {
    const p = await createPacket();
    p.context.acquisitions[0].time.end = "2026-07-28T22:11:03.254999999Z";
    await failure(p, "SONAR.ACQUISITION_TIME");
  });
  it("accepts a final receive sample exactly on the interval boundary", async () => {
    const p = await createPacket();
    p.context.acquisitions[0].time.end = "2026-07-28T22:11:03.255Z";
    expect((await evaluate(p)).success).toBe(true);
  });
  it("compares decimal sampling intervals without Number rounding at exact UTC boundaries", async () => {
    const p = await createPacket();
    p.profile.sampling.pingStepSeconds = 0.1;
    p.profile.sampling.delayStepSeconds = 0.0001;
    for (const layout of p.selection.layouts) {
      layout.axes[0].stepSeconds = { numerator: 1, denominator: 10 };
      layout.axes[1].step = 0.0001;
    }
    const end = "2026-07-28T22:10:06.3255Z";
    p.context.acquisitions[0].time.end = end;
    p.observation.eventTime.value.end.value = end;
    const result = await evaluate(p);
    expect(result.success, JSON.stringify(result.issues)).toBe(true);
    expect(sonarSample(p.profile, 63, 255).receiveOffsetSeconds).toBe(6.3255);
    p.context.acquisitions[0].time.end = "2026-07-28T22:10:06.325499999Z";
    await failure(p, "SONAR.ACQUISITION_TIME");
  });
  it("does not accept a rounded rational ping axis as the exact declared decimal step", async () => {
    const p = await createPacket();
    p.profile.sampling.pingStepSeconds = 1 / 3;
    for (const layout of p.selection.layouts)
      layout.axes[0].stepSeconds = { numerator: 1, denominator: 3 };
    await failure(p, "SONAR.CONTENT");
  });
  it("rejects a receive window equal to the next ping despite cancellation rounding", async () => {
    const p = await createPacket();
    p.profile.sampling.delayStartSeconds = 0.001;
    p.profile.sampling.delayStepSeconds = 0.001;
    p.profile.sampling.pingStepSeconds = 0.256;
    expect(() => sonarSample(p.profile, 0, 0)).toThrow();
  });
  it("requires observation time to contain the receive window too", async () => {
    const p = await createPacket();
    p.observation.eventTime.value.end.value = "2026-07-28T22:11:03Z";
    await failure(p, "SONAR.OBSERVATION_TIME");
  });
  it("rejects an invalid origin in the dependency-free reader even when both axes repeat it", async () => {
    const p = await createPacket();
    p.profile.timeOrigin = "2026-02-30T00:00:00Z";
    p.selection.layouts.forEach((l: { axes: { start: string }[] }) => {
      l.axes[0]!.start = p.profile.timeOrigin;
    });
    expect(() =>
      readSonarProducts(p.profile, p.selection.layouts, p.assets)
    ).toThrow();
  });
  it("rejects an invalid calendar date", async () => {
    const p = await createPacket();
    p.profile.timeOrigin = "2026-02-30T00:00:00Z";
    expect((await evaluate(p)).success).toBe(false);
  });
  it.each(["axes", "units", "dimensions", "time", "offset", "endianness"])(
    "rejects inconsistent %s metadata",
    async (mode) => {
      const p = await createPacket(),
        layout = p.selection.layouts[1];
      if (mode === "axes") layout.axes.reverse();
      if (mode === "units") layout.unit = "m";
      if (mode === "dimensions") {
        layout.axes[0].length = 32;
        layout.axes[1].length = 512;
      }
      if (mode === "time") layout.axes[0].start = "2026-07-28T22:10:01Z";
      if (mode === "offset") layout.byteOffset = 1;
      if (mode === "endianness") layout.byteOrder = "big";
      const result = await evaluate(p);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    }
  );
  it.each([NaN, Infinity, -0.1, 1.1])(
    "rejects repinned invalid amplitude %s",
    async (value) => {
      const p = await createPacket(),
        bytes = Uint8Array.from(p.assets.get("product:amplitudes"));
      new DataView(bytes.buffer).setFloat32(0, value, true);
      repin(p, "amplitudes", bytes);
      expect((await evaluate(p)).success).toBe(false);
    }
  );
  it("rejects a repinned nonbinary receive mask", async () => {
    const p = await createPacket(),
      bytes = Uint8Array.from(p.assets.get("product:receiveMask"));
    bytes[0] = 2;
    repin(p, "receiveMask", bytes);
    await failure(p, "SONAR.CONTENT");
  });
  it("rejects a nonzero value behind the missing-data mask", async () => {
    const p = await createPacket(),
      bytes = Uint8Array.from(p.assets.get("product:amplitudes"));
    new DataView(bytes.buffer).setFloat32((28 * 256 + 130) * 4, 0.5, true);
    repin(p, "amplitudes", bytes);
    await failure(p, "SONAR.CONTENT");
  });
  it("accepts an entirely unavailable capture without inventing observations", async () => {
    const p = await createPacket();
    repin(p, "amplitudes", new Uint8Array(64 * 256 * 4));
    repin(p, "receiveMask", new Uint8Array(64 * 256));
    const result = await evaluate(p);
    expect(result.success).toBe(true);
    expect(
      readSonarSample(p.profile, result.data!.products, 63, 255).amplitude
    ).toBeNull();
  });
  it("rejects truncated sources even if their artifact metadata is repinned", async () => {
    const p = await createPacket();
    repin(p, "receiveMask", p.assets.get("product:receiveMask").subarray(1));
    expect((await evaluate(p)).success).toBe(false);
  });
  it("rejects invalid scalar domains and undeclared fields in runtime schema", async () => {
    const p = await createPacket();
    for (const mutate of [
      (v: Packet) => {
        v.sampling.pings = 0;
      },
      (v: Packet) => {
        v.propagation.soundSpeedMps = 0;
      },
      (v: Packet) => {
        v.availability.unavailable = 2;
      },
      (v: Packet) => {
        v.rangeResolutionM = 0.75;
      },
    ]) {
      const profile = structuredClone(p.profile);
      mutate(profile);
      expect(SonarProfileSchema.safeParse(profile).success).toBe(false);
    }
  });
});
