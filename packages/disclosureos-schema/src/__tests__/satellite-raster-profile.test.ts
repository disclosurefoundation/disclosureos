import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { evaluateSatelliteRasterProfile } from "../experimental/v2/satellite-raster-profile";
import { SatelliteRasterProfileSchema } from "../experimental/v2/satellite-raster-profile-schema";
import {
  readSatelliteRasterProducts,
  satelliteCellBounds,
  validateSatelliteRasterDeclaration,
} from "../experimental/v2/satellite-raster-profile-reader";
const packet = async () =>
  (
    await import(
      new URL(
        "../../../../examples/satellite-raster/build.mjs",
        import.meta.url
      ).href
    )
  ).createPacket();
type Packet = Awaited<ReturnType<typeof packet>>;
const evaluate = (p: Packet) =>
  evaluateSatelliteRasterProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
const repin = (p: Packet, role: string, bytes: Uint8Array) => {
  const ref = p.profile.products[role],
    digest = {
      algorithm: "sha256",
      value: createHash("sha256").update(bytes).digest("hex"),
    };
  p.assets.set(ref, bytes);
  Object.assign(
    p.selection.layouts.find(
      (v: { productRef: string }) => v.productRef === ref
    ),
    { digest, byteLength: bytes.length }
  );
  p.observation.products.find(
    (v: { id: string }) => `product:${v.id}` === ref
  ).digest = digest;
  Object.assign(
    p.context.products.find((v: { id: string }) => `product:${v.id}` === ref)
      .artifact,
    { digest, byteLength: bytes.length }
  );
};
const failure = async (p: Packet, code?: string) => {
  const r = await evaluate(p);
  expect(r.success).toBe(false);
  expect(r.data).toBeUndefined();
  if (code) expect(r.issues.map((v) => v.code)).toContain(code);
};
describe("optional multispectral satellite raster profile", () => {
  it("verifies bound bytes and decoded geometry without scientific certification", async () => {
    const p = await packet(),
      r = await evaluate(p);
    expect(r.success, JSON.stringify(r.issues)).toBe(true);
    expect(r.checks).toEqual({
      structure: "passed",
      sources: "passed",
      semantics: "passed",
    });
    expect(r.scientific).toBe("not_checked");
    expect(r.physicalCalibration).toBe("not_checked");
    expect(r.qualityAccuracy).toBe("not_checked");
    expect(r.georeferencing).toBe("not_checked");
    expect(r.data!.products.cells).toHaveLength(6912);
  });
  it("preserves half-pixel centers, full projected footprint and exact band source offsets", async () => {
    const p = await packet(),
      d = readSatelliteRasterProducts(p.profile, p.selection.layouts, p.assets),
      first = d.cells[0]!,
      last = d.cells[6911]!;
    expect([first.easting, first.northing]).toEqual([500015, 4102145]);
    expect([last.easting, last.northing]).toEqual([502865, 4100015]);
    expect(satelliteCellBounds(p.profile, 71, 95)).toEqual({
      west: 502850,
      east: 502880,
      south: 4100000,
      north: 4100030,
    });
    expect(() => satelliteCellBounds(p.profile, 72, 0)).toThrow();
    expect(() => satelliteCellBounds(p.profile, 0, 0.5)).toThrow();
    for (const c of [first, d.cells[4845]!, last]) {
      expect(c.qualityByteOffset).toBe(c.index);
      for (let b = 0; b < 6; b++) {
        expect(c.byteOffsets[b]).toBe((b * 6912 + c.index) * 2);
        expect(
          p.assets.get("product:reflectance").readUInt16LE(c.byteOffsets[b])
        ).toBe(c.dn[b]);
      }
    }
  });
  it("keeps no-data, partial missingness, cloud, shadow and retained zero distinct", async () => {
    const p = await packet(),
      { cells } = readSatelliteRasterProducts(
        p.profile,
        p.selection.layouts,
        p.assets
      );
    for (const q of ["cloud", "shadow"]) {
      const c = cells.find((v) => v.quality === q)!;
      expect(c.reflectance.every((v) => v !== null)).toBe(true);
      expect(c.ndvi).toBeNull();
      expect(c.ndviReason).toBe("quality_excluded");
    }
    const missing = cells.find((v) => v.quality === "nodata")!;
    expect(missing.reflectance.every((v) => v === null)).toBe(true);
    expect(missing.dn).toEqual([65535, 65535, 65535, 65535, 65535, 65535]);
    expect(cells[582]!.dn).toEqual([0, 0, 0, 0, 0, 0]);
    expect(cells[582]!.ndviReason).toBe("zero_denominator");
    expect(cells[583]!.quality).toBe("clear");
    expect(cells[583]!.reflectance[3]).toBeNull();
    expect(cells[583]!.ndviReason).toBe("nodata");
  });
  it("computes NDVI from scale and additive offset rather than raw DN ratios", async () => {
    const p = await packet();
    p.profile.bands[2].offset = 0.04;
    p.profile.bands[3].offset = 0.02;
    const c = readSatelliteRasterProducts(
      p.profile,
      p.selection.layouts,
      p.assets
    ).cells[4845]!;
    const red = c.dn[2]! * 0.0001 + 0.04,
      nir = c.dn[3]! * 0.0001 + 0.02;
    expect(c.ndvi).toBeCloseTo((nir - red) / (nir + red), 14);
    expect(c.ndvi).not.toBeCloseTo(
      (c.dn[3]! - c.dn[2]!) / (c.dn[3]! + c.dn[2]!),
      5
    );
  });
  it("preserves permitted negative reflectance but excludes it from NDVI", async () => {
    const p = await packet();
    p.profile.bands[2].offset = -0.08;
    p.profile.bands[2].validRange = [-0.1, 1];
    const c = readSatelliteRasterProducts(
      p.profile,
      p.selection.layouts,
      p.assets
    ).cells[4845]!;
    expect(c.reflectance[2]).toBeLessThan(0);
    expect(c.ndvi).toBeNull();
    expect(c.ndviReason).toBe("negative_reflectance");
  });
  it("does not clamp finite reflectance above one", async () => {
    const p = await packet();
    p.profile.bands[0].offset = 0.9;
    p.profile.bands[0].validRange = [0, 2];
    const c = readSatelliteRasterProducts(
      p.profile,
      p.selection.layouts,
      p.assets
    ).cells.find((v) => v.quality === "cloud")!;
    expect(c.reflectance[0]).toBeGreaterThan(1);
  });
  it("requires every source array and snapshots assets before asynchronous checks", async () => {
    const p = await packet(),
      pending = evaluate(p);
    p.assets.get("product:reflectance").fill(255);
    const r = await pending;
    expect(r.success).toBe(true);
    expect(r.data!.products.cells[4845]!.quality).toBe("clear");
    const empty = await packet();
    empty.assets.delete("product:quality");
    await failure(empty);
  });
  it("rejects tampering even when byte extent is unchanged", async () => {
    const p = await packet();
    p.assets.get("product:reflectance")[0] ^= 1;
    await failure(p);
  });
  const badDeclarations: [string, (p: Packet) => void][] = [
    ["duplicate band", (p) => (p.profile.bands[1].id = p.profile.bands[0].id)],
    ["wrong EPSG zone", (p) => (p.profile.grid.crs.zone = 12)],
    ["wrong EPSG hemisphere", (p) => (p.profile.grid.crs.hemisphere = "south")],
    ["inverted decoded range", (p) => (p.profile.bands[0].validRange = [1, 0])],
    [
      "red spectral identity",
      (p) => (p.profile.bands[2].centerWavelengthNm = 865),
    ],
    [
      "NIR spectral identity",
      (p) => (p.profile.bands[3].centerWavelengthNm = 655),
    ],
    [
      "unknown index band",
      (p) => (p.profile.vegetationIndex.redBandId = "absent"),
    ],
    ["index aliases", (p) => (p.profile.vegetationIndex.redBandId = "nir")],
    [
      "array aliases",
      (p) => (p.profile.products.quality = "product:reflectance"),
    ],
    [
      "unbounded grid",
      (p) => {
        p.profile.grid.rows = 4096;
        p.profile.grid.columns = 4096;
      },
    ],
  ];
  for (const [label, mutate] of badDeclarations)
    it(`rejects ${label}`, async () => {
      const p = await packet();
      mutate(p);
      expect(() => validateSatelliteRasterDeclaration(p.profile)).toThrow();
      await failure(p, "SATELLITE_RASTER.DECLARATION");
    });
  const badStructures: [string, (p: Packet) => void][] = [
    ["rotated grid", (p) => (p.profile.grid.transform[2] = 1)],
    ["south-up grid", (p) => (p.profile.grid.transform[5] = 30)],
    ["cornerless transform", (p) => p.profile.grid.transform.pop()],
    ["extended transform", (p) => p.profile.grid.transform.push(0)],
    ["zero scale", (p) => (p.profile.bands[0].scale = 0)],
    [
      "false calibration",
      (p) => (p.profile.radiometry.calibration = "verified"),
    ],
    ["point pixels", (p) => (p.profile.grid.pixelInterpretation = "point")],
    ["wrong units", (p) => (p.profile.radiometry.unit = "DN")],
    ["extra field", (p) => (p.profile.confidence = 1)],
    ["arbitrary missing code", (p) => (p.profile.bands[0].nodata = -1)],
  ];
  for (const [label, mutate] of badStructures)
    it(`rejects ${label} structurally`, async () => {
      const p = await packet();
      mutate(p);
      expect(SatelliteRasterProfileSchema.safeParse(p.profile).success).toBe(
        false
      );
      await failure(p, "SATELLITE_RASTER.PREREQUISITE");
    });
  const badLayouts: [string, (l: Record<string, any>) => void][] = [
    ["band order", (l) => l.axes.reverse()],
    ["nonzero firstIndex", (l) => (l.axes[0].firstIndex = 1)],
    ["wrong quantity", (l) => (l.quantity = "radiance")],
    ["wrong unit", (l) => (l.unit = "1")],
    ["big endian", (l) => (l.byteOrder = "big")],
    ["wrong dtype", (l) => (l.elementType = "int16")],
    ["wrong extent", (l) => l.axes[1].length--],
    ["offset prefix", (l) => (l.byteOffset = 2)],
  ];
  for (const [label, mutate] of badLayouts)
    it(`rejects ${label} layout`, async () => {
      const p = await packet();
      mutate(p.selection.layouts[0]);
      expect(() =>
        readSatelliteRasterProducts(p.profile, p.selection.layouts, p.assets)
      ).toThrow();
      await failure(p);
    });
  it("rejects duplicate layouts", async () => {
    const p = await packet();
    p.selection.layouts.push({ ...p.selection.layouts[0], id: "alias" });
    expect(() =>
      readSatelliteRasterProducts(p.profile, p.selection.layouts, p.assets)
    ).toThrow();
    await failure(p);
  });
  it("rejects reserved quality codes even after digest repinning", async () => {
    const p = await packet();
    p.assets.get("product:quality")[0] = 4;
    repin(p, "quality", p.assets.get("product:quality"));
    await failure(p, "SATELLITE_RASTER.CONTENT");
  });
  it("rejects reflectance on a whole-pixel no-data cell", async () => {
    const p = await packet();
    p.assets.get("product:quality")[0] = 3;
    repin(p, "quality", p.assets.get("product:quality"));
    await failure(p, "SATELLITE_RASTER.CONTENT");
  });
  it("rejects decoded range violation without confusing nodata sentinel", async () => {
    const p = await packet();
    p.assets.get("product:reflectance").writeUInt16LE(30000, 0);
    repin(p, "reflectance", p.assets.get("product:reflectance"));
    await failure(p, "SATELLITE_RASTER.CONTENT");
  });
  for (const role of ["reflectance", "quality"])
    it(`binds ${role} to exact acquisition artifact`, async () => {
      const p = await packet();
      p.context.products.find(
        (v: { id: string }) => v.id === role
      ).artifact.digest.value = "f".repeat(64);
      await failure(p, "SATELLITE_RASTER.CAPTURE_BINDING");
    });
  it("requires pinned channel quantity and unit", async () => {
    const p = await packet();
    p.context.manifests[0].channels[0].unit = "W";
    await failure(p, "SATELLITE_RASTER.CHANNEL");
  });
  it("requires matching document identities", async () => {
    const p = await packet();
    p.profile.sourceSelectionId = "different";
    await failure(p, "SATELLITE_RASTER.IDENTITY");
  });
  it("requires synthetic registration and quality authority", async () => {
    const p = await packet();
    p.profile.grid.registration = "source_declared_not_verified";
    await failure(p, "SATELLITE_RASTER.GRID_ORIGIN");
    const q = await packet();
    q.profile.quality.authority = "source_annotations";
    await failure(q, "SATELLITE_RASTER.QUALITY_ORIGIN");
  });
});
