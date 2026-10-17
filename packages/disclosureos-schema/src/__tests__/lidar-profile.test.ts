import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { evaluateLidarProfile } from "../experimental/v2/lidar-profile";
import { LidarProfileSchema } from "../experimental/v2/lidar-profile-schema";
import {
  readLidarProducts,
  validateLidarDeclaration,
} from "../experimental/v2/lidar-profile-reader";
const packet = async () =>
  (
    await import(
      new URL(
        "../../../../examples/lidar-point-cloud/build.mjs",
        import.meta.url
      ).href
    )
  ).createPacket();
type Packet = Awaited<ReturnType<typeof packet>>;
const evaluate = (p: Packet) =>
  evaluateLidarProfile(p.observation, p.context, p.selection, p.profile, {
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
const edit = (p: Packet, role: string, change: (rows: string[][]) => void) => {
  const rows = new TextDecoder()
    .decode(p.assets.get(`product:${role}`))
    .trimEnd()
    .split("\n")
    .map((row) => row.split(","));
  change(rows);
  repin(
    p,
    role,
    new TextEncoder().encode(rows.map((r) => r.join(",")).join("\n") + "\n")
  );
};
const failure = async (p: Packet, code: string) => {
  const r = await evaluate(p);
  expect(r.success).toBe(false);
  expect(r.data).toBeUndefined();
  expect(r.issues.map((v) => v.code)).toContain(code);
};
describe("optional static lidar point-cloud profile", () => {
  it("verifies retained source tables and local groups without certification", async () => {
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
    expect(r.classificationAccuracy).toBe("not_checked");
    expect(r.georeferencing).toBe("not_checked");
    expect(r.data!.products.pulses).toHaveLength(1353);
    expect(r.data!.products.points.length).toBeGreaterThan(1353);
  });
  it("keeps unavailable unknown counts distinct from no return", async () => {
    const p = await packet(),
      d = readLidarProducts(p.profile, p.selection.layouts, p.assets);
    expect(d.pulses.filter((v) => v.status === "unavailable")).toHaveLength(35);
    expect(d.pulses.filter((v) => v.status === "no_return")).toHaveLength(36);
    expect(
      d.pulses.find((v) => v.status === "unavailable")!.returnCount
    ).toBeNull();
    expect(d.pulses.find((v) => v.status === "no_return")!.returnCount).toBe(0);
  });
  it("locates exact source bytes and complete same-pulse groups", async () => {
    const p = await packet(),
      d = readLidarProducts(p.profile, p.selection.layouts, p.assets),
      pulse = d.pulses.find((v) => v.returnCount === 3)!;
    expect(pulse).toBeDefined();
    for (const i of pulse.pointIndices) {
      const point = d.points[i]!,
        bytes = p.assets.get("product:points");
      expect(
        new TextDecoder().decode(
          bytes.subarray(
            point.row.byteOffset,
            point.row.byteOffset + point.row.byteLength
          )
        )
      ).toBe(
        [
          point.pulseId,
          point.returnNumber,
          point.returnCount,
          point.x,
          point.y,
          point.z,
          point.intensity,
          point.classCode,
        ].join(",")
      );
      expect(point.pulseIndex).toBe(pulse.index);
    }
    expect(d.points[pulse.pointIndices[0]!]!.rangeM).toBeLessThan(
      d.points[pulse.pointIndices[2]!]!.rangeM
    );
  });
  it("supports CRLF and quoted cells without losing exact spans", async () => {
    const p = await packet();
    for (const role of ["pulses", "points"]) {
      const bytes = p.assets.get(`product:${role}`),
        text = new TextDecoder()
          .decode(bytes)
          .replace(/pulse-0000/g, '"pulse-0000"')
          .replace(/\n/g, "\r\n");
      repin(p, role, new TextEncoder().encode(text));
    }
    const r = await evaluate(p);
    expect(r.success, JSON.stringify(r.issues)).toBe(true);
    const point = r.data!.products.points[0]!,
      bytes = p.assets.get("product:points");
    expect(
      new TextDecoder().decode(
        bytes.subarray(
          point.row.byteOffset,
          point.row.byteOffset + point.row.byteLength
        )
      )
    ).toMatch(/^"pulse-0000",/);
  });
  it("supports an all-no-return capture with a header-only cloud", async () => {
    const p = await packet();
    edit(p, "pulses", (rows) =>
      rows.slice(1).forEach((r) => {
        r[6] = "no_return";
        r[7] = "0";
      })
    );
    edit(p, "points", (rows) => rows.splice(1));
    p.profile.scan.points = 0;
    p.selection.layouts[1].rowCount = 0;
    p.selection.selections = p.selection.selections.filter(
      (s: { layoutRef: string }) => s.layoutRef !== "layout:points"
    );
    const r = await evaluate(p);
    expect(r.success, JSON.stringify(r.issues)).toBe(true);
    expect(r.data!.products.points).toHaveLength(0);
  });
  const profileMutations: [string, (p: Packet) => void, string][] = [
    [
      "document identity",
      (p) => (p.profile.observationId = "wrong"),
      "LIDAR.IDENTITY",
    ],
    [
      "source selection identity",
      (p) => (p.profile.sourceSelectionId = "wrong"),
      "LIDAR.IDENTITY",
    ],
    [
      "acquisition identity",
      (p) => (p.profile.acquisitionRef = "acquisition:absent"),
      "LIDAR.CHANNEL",
    ],
    [
      "channel quantity",
      (p) => (p.context.manifests[0].channels[0].quantity = "temperature"),
      "LIDAR.CHANNEL",
    ],
    [
      "channel unit",
      (p) => (p.context.manifests[0].channels[0].unit = "ft"),
      "LIDAR.CHANNEL",
    ],
    [
      "manifest instrument",
      (p) => {
        p.context.instruments.push({
          ...p.context.instruments[0],
          id: "other",
        });
        p.context.manifests[0].instrumentRef = "instrument:other";
      },
      "LIDAR.PREREQUISITE",
    ],
    [
      "synthetic class origin",
      (p) => (p.profile.classifications.authority = "source_annotations"),
      "LIDAR.CLASSIFICATION_ORIGIN",
    ],
    [
      "acquisition alias",
      (p) =>
        (p.profile.acquisitionProducts.points =
          p.profile.acquisitionProducts.pulses),
      "LIDAR.CAPTURE_ALIAS",
    ],
    [
      "artifact mismatch",
      (p) => p.context.products[0].artifact.byteLength++,
      "LIDAR.CAPTURE_BINDING",
    ],
    ["grid dimensions", (p) => p.profile.scan.rows++, "LIDAR.DECLARATION"],
    [
      "reversed range",
      (p) => (p.profile.geometry.nearRangeM = 70),
      "LIDAR.DECLARATION",
    ],
    [
      "reversed bounds",
      (p) => (p.profile.geometry.bounds.min[0] = 19),
      "LIDAR.DECLARATION",
    ],
    [
      "duplicate class codes",
      (p) => (p.profile.classifications.classes[1].code = 0),
      "LIDAR.DECLARATION",
    ],
    [
      "product aliases",
      (p) => (p.profile.products.points = p.profile.products.pulses),
      "LIDAR.DECLARATION",
    ],
    [
      "unknown schema field",
      (p) => (p.profile.timeOrigin = "2026-01-01T00:00:00Z"),
      "LIDAR.PREREQUISITE",
    ],
  ];
  for (const [name, mutate, code] of profileMutations)
    it(`rejects ${name}`, async () => {
      const p = await packet();
      mutate(p);
      await failure(p, code);
    });
  const tableMutations: [string, string, (rows: string[][]) => void][] = [
    ["duplicate pulse ID", "pulses", (r) => (r[2]![0] = r[1]![0]!)],
    ["wrong raster index", "pulses", (r) => (r[2]![2] = "0")],
    ["negative return count", "pulses", (r) => (r[1]![7] = "-1")],
    [
      "unavailable zero count",
      "pulses",
      (r) => {
        const row = r.find((v) => v[6] === "unavailable")!;
        row[7] = "0";
      },
    ],
    [
      "no-return unknown count",
      "pulses",
      (r) => {
        const row = r.find((v) => v[6] === "no_return")!;
        row[7] = "";
      },
    ],
    ["unknown pulse status", "pulses", (r) => (r[1]![6] = "not_acquired")],
    [
      "sensor-coincident aim",
      "pulses",
      (r) => {
        r[1]![3] = "0";
        r[1]![4] = "0";
        r[1]![5] = "18";
      },
    ],
    ["undeclared pulse link", "points", (r) => (r[1]![0] = "absent")],
    ["point in no-return pulse", "points", (r) => (r[1]![0] = "pulse-0126")],
    [
      "duplicate return ordinal",
      "points",
      (r) => {
        const i = r.findIndex((v) => v[1] === "2");
        r[i]![1] = "1";
      },
    ],
    ["inconsistent return count", "points", (r) => (r[1]![2] = "2")],
    ["empty numeric point", "points", (r) => (r[1]![3] = "")],
    [
      "quoted trailing newline coordinate",
      "points",
      (r) => {
        r[1]![3] = '"-18\n"';
      },
    ],
    [
      "quoted trailing newline identifier",
      "pulses",
      (r) => {
        r[1]![0] = '"pulse-0000\n"';
      },
    ],
    ["nonfinite point", "points", (r) => (r[1]![3] = "NaN")],
    ["hexadecimal point", "points", (r) => (r[1]![3] = "0x10")],
    ["whitespace numeric cell", "points", (r) => (r[1]![3] = " 0")],
    ["point outside bounds", "points", (r) => (r[1]![3] = "100")],
    ["point off pulse ray", "points", (r) => (r[1]![4] = "3")],
    ["unknown class", "points", (r) => (r[1]![7] = "99")],
    ["fractional class", "points", (r) => (r[1]![7] = "2.5")],
    ["intensity over range", "points", (r) => (r[1]![6] = "1.1")],
    ["intensity below range", "points", (r) => (r[1]![6] = "-0.1")],
    [
      "backward return ordering",
      "points",
      (r) => {
        const i = r.findIndex((v) => v[1] === "2");
        const xyz = r[i - 1]!.slice(3, 6);
        for (let j = 0; j < 3; j++) {
          r[i - 1]![3 + j] = r[i]![3 + j]!;
          r[i]![3 + j] = xyz[j]!;
        }
      },
    ],
  ];
  for (const [name, role, mutate] of tableMutations)
    it(`rejects ${name} after source repinning`, async () => {
      const p = await packet();
      edit(p, role, mutate);
      await failure(p, "LIDAR.CONTENT");
    });
  it("rejects incomplete groups even with corrected point row extent", async () => {
    const p = await packet();
    edit(p, "points", (r) =>
      r.splice(
        r.findIndex((v) => v[1] === "3"),
        1
      )
    );
    p.profile.scan.points--;
    p.selection.layouts[1].rowCount--;
    await failure(p, "LIDAR.CONTENT");
  });
  it("requires both exact source artifacts", async () => {
    const p = await packet();
    p.assets.delete("product:pulses");
    const r = await evaluate(p);
    expect(r.success).toBe(false);
    expect(r.checks.sources).toBe("failed");
  });
  it("rejects a source digest mismatch", async () => {
    const p = await packet(),
      bytes = p.assets.get("product:points");
    bytes[120] ^= 1;
    const r = await evaluate(p);
    expect(r.success).toBe(false);
    expect(r.checks.sources).toBe("failed");
  });
  it("rejects a narrowed or reordered table contract", async () => {
    const p = await packet();
    p.selection.layouts[1].columns.reverse();
    await failure(p, "LIDAR.SOURCE.SELECTION.CONTENT");
  });
  it("rejects geometry terms outside the supported browser contract", async () => {
    const p = await packet();
    p.profile.coordinateFrame.sensorOrigin = [];
    expect(() => validateLidarDeclaration(p.profile)).toThrow();
    expect(LidarProfileSchema.safeParse(p.profile).success).toBe(false);
  });
});
