import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { evaluateRadarProfile } from "../experimental/v2/radar-profile";
import { RadarProfileSchema } from "../experimental/v2/radar-profile-schema";
import { readRadarProducts } from "../experimental/v2/radar-profile-reader";
import { readSourceCsv } from "../experimental/v2/product-source-reader";

const load = async (scenario: string) =>
  (
    await import(
      new URL("../../../../examples/radar-site/build.mjs", import.meta.url).href
    )
  ).createPacket(scenario);
type Packet = Awaited<ReturnType<typeof load>>;
const baseline = load("ground");
const packet = async () => structuredClone(await baseline);
const evaluate = (p: Packet) =>
  evaluateRadarProfile(p.observation, p.context, p.selection, p.profile, {
    assets: p.assets,
  });
const decoded = (p: Packet) =>
  readRadarProducts(p.selection.layouts, p.profile.products, p.assets);
const layout = (p: Packet, role: string) =>
  p.selection.layouts.find(
    (l: { productRef: string }) => l.productRef === p.profile.products[role]
  );
const process = (p: Packet, id: string) =>
  p.observation.processing.find((r: { id: string }) => r.id === id);
function repin(p: Packet, role: string, bytes: Uint8Array) {
  const ref = p.profile.products[role];
  const digest = {
    algorithm: "sha256",
    value: createHash("sha256").update(bytes).digest("hex"),
  };
  p.assets.set(ref, bytes);
  Object.assign(layout(p, role), { digest, byteLength: bytes.byteLength });
  p.observation.products.find(
    (v: { id: string }) => `product:${v.id}` === ref
  ).digest = digest;
  const capture =
    role === "returns"
      ? p.profile.acquisitionProductRef
      : role === "referenceCapture"
      ? p.profile.preprocessing.referenceAcquisitionProductRef
      : null;
  if (capture)
    Object.assign(
      p.context.products.find(
        (v: { id: string }) => `product:${v.id}` === capture
      ).artifact,
      { digest, byteLength: bytes.byteLength }
    );
}
function floatCell(p: Packet, role: string, index: number, value: number) {
  const bytes = Uint8Array.from(p.assets.get(p.profile.products[role]));
  new DataView(bytes.buffer).setFloat32(index * 4, value, true);
  repin(p, role, bytes);
}
function table(
  p: Packet,
  role: string,
  edit: (rows: string[][], columns: string[]) => void
) {
  const rows = readSourceCsv(p.assets.get(p.profile.products[role])),
    columns = rows.shift()!;
  edit(rows, columns);
  repin(
    p,
    role,
    new TextEncoder().encode(
      [columns, ...rows].map((row) => row.join(",")).join("\n") + "\n"
    )
  );
  layout(p, role).rowCount = rows.length;
}
async function fails(p: Packet, code: string) {
  const r = await evaluate(p);
  expect(r.success).toBe(false);
  expect(r.data).toBeUndefined();
  expect(r.issues.map((i) => i.code)).toContain(code);
}

describe("fixed-site radar preprocessing and context", () => {
  it.each(["ground", "civilian"])(
    "validates the complete %s source chain without certifying physical coverage",
    async (scenario) => {
      const p = await load(scenario),
        r = await evaluate(p);
      expect(r.issues).toEqual([]);
      expect(r.success).toBe(true);
      expect(r.data!.products.referenceCapture).toHaveLength(8 * 180 * 64);
      expect(r.data!.products.processedReturns).toHaveLength(24 * 180 * 64);
      expect(r.data!.products.eligibility).toContain(0);
      expect(r.data!.products.siteFeatures.length).toBeGreaterThan(0);
      expect(r.scientific).toBe("not_checked");
      expect(r.physicalCalibration).toBe("not_checked");
    }
  );
  it("keeps the original profile readable without any optional preprocessing products", async () => {
    const p = await (
      await import(
        new URL(
          "../../../../examples/radar-scanning/build.mjs",
          import.meta.url
        ).href
      )
    ).createPacket();
    const d = decoded(p);
    expect(d.referenceCapture).toEqual([]);
    expect(d.processedReturns).toEqual([]);
    expect(d.siteFeatures).toEqual([]);
  });
  it("requires the entire preprocessing declaration and all its roles", async () => {
    const p = await packet();
    delete p.profile.products.eligibility;
    expect(RadarProfileSchema.safeParse(p.profile).success).toBe(false);
  });
  it.each([
    ["referenceCapture", "RADAR.REFERENCE_AXES"],
    ["backgroundPower", "RADAR.BACKGROUND_AXES"],
    ["processedReturns", "RADAR.PROCESSED_AXES"],
    ["eligibility", "RADAR.ELIGIBILITY_LAYOUT"],
  ])("rejects shifted %s spatial cells", async (role, code) => {
    const p = await packet();
    layout(p, role).axes = structuredClone(layout(p, role).axes);
    layout(p, role).axes.at(-1).origin += 1;
    await fails(p, code);
  });
  it("rejects a renamed unit on the reference powers", async () => {
    const p = await packet();
    layout(p, "referenceCapture").unit = "dBm";
    await fails(p, "RADAR.PREPROCESS_LAYOUT");
  });
  it("rejects a background value that is not its independently retained mean", async () => {
    const p = await packet();
    floatCell(p, "backgroundPower", 0, 100);
    await fails(p, "RADAR.BACKGROUND_REDUCTION");
  });
  it("rejects altered reference samples even after byte metadata is repinned", async () => {
    const p = await packet();
    floatCell(p, "referenceCapture", 0, 100);
    await fails(p, "RADAR.BACKGROUND_REDUCTION");
  });
  it("checks subtraction even in excluded cells, which remain acquired", async () => {
    const p = await packet(),
      index = decoded(p).eligibility.indexOf(0);
    floatCell(p, "processedReturns", index, 100);
    await fails(p, "RADAR.RESIDUAL");
  });
  it("rejects mask codes that could be misread as missing or physically blocked reception", async () => {
    const p = await packet(),
      bytes = Uint8Array.from(p.assets.get(p.profile.products.eligibility));
    bytes[0] = 2;
    repin(p, "eligibility", bytes);
    await fails(p, "RADAR.ELIGIBILITY_VALUE");
  });
  it("does not admit a detection from a detector-policy excluded cell", async () => {
    const p = await packet(),
      d = decoded(p).detections[0]!,
      bytes = Uint8Array.from(p.assets.get(p.profile.products.eligibility));
    bytes[d.azimuth_index * 64 + d.range_index] = 0;
    repin(p, "eligibility", bytes);
    await fails(p, "RADAR.DETECTION_EXCLUDED");
  });
  it("does not substitute raw power for a detection's declared residual input", async () => {
    const p = await packet(),
      data = decoded(p),
      d = data.detections[0]!;
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("power")] = String(
        data.returns[
          (d.scan_index * 180 + d.azimuth_index) * 64 + d.range_index
        ]
      );
    });
    await fails(p, "RADAR.DETECTION_THRESHOLD");
  });
  it("rejects an unknown reference acquisition", async () => {
    const p = await packet();
    p.profile.preprocessing.referenceAcquisitionRef = "acquisition:missing";
    await fails(p, "RADAR.REFERENCE_ACQUISITION");
  });
  it("rejects a reference interval after capture starts, including submillisecond overruns", async () => {
    const p = await packet();
    p.context.acquisitions[1].time.end = "2026-07-28T22:00:00.000001Z";
    await fails(p, "RADAR.REFERENCE_TIME");
  });
  it("rejects a reference acquisition with different retained bytes", async () => {
    const p = await packet();
    p.context.products[1].artifact.digest.value = "0".repeat(64);
    await fails(p, "RADAR.REFERENCE_BINDING");
  });
  it.each([
    ["background", "product:referenceCapture", "RADAR.BACKGROUND_LINEAGE"],
    ["subtract", "product:backgroundPower", "RADAR.PROCESSED_LINEAGE"],
    ["threshold", "product:processedReturns", "RADAR.PREPROCESS_LINEAGE"],
  ])("requires the %s processing input", async (id, ref, code) => {
    const p = await packet();
    process(p, id).inputRefs = process(p, id).inputRefs.filter(
      (r: string) => r !== ref
    );
    await fails(p, code);
  });
  it("requires eligibility in the detector ancestry", async () => {
    const p = await packet();
    for (const id of ["threshold", "detect"])
      process(p, id).inputRefs = process(p, id).inputRefs.filter(
        (r: string) => r !== "product:eligibility"
      );
    await fails(p, "RADAR.PREPROCESS_LINEAGE");
  });
  it("forbids synthetic truth in the reference reduction", async () => {
    const p = await packet();
    process(p, "background").inputRefs.push("product:truth");
    await fails(p, "RADAR.TRUTH_LEAK");
  });
  it("does not mistake a shared raw oracle for shared configuration", async () => {
    const p = await packet();
    p.observation.sources.push({
      id: "oracle",
      kind: "instrument_data",
      access: "public",
    });
    for (const id of ["returns", "schedule", "siteFeatures"])
      p.observation.products
        .find((r: { id: string }) => r.id === id)
        .sourceRefs.push("source:oracle");
    process(p, "truth").inputRefs.push("source:oracle");
    await fails(p, "RADAR.TRUTH_LEAK");
  });
  it.each([
    ["vertex_index", "9", "RADAR.SITE_ORDER"],
    ["label", "Changed feature", "RADAR.SITE_IDENTITY"],
    ["closed", "true", "RADAR.CONTENT"],
    ["kind", "aircraft", "RADAR.CONTENT"],
    ["label", "", "RADAR.CONTENT"],
  ])("rejects invalid site %s values", async (column, value, code) => {
    const p = await packet();
    table(p, "siteFeatures", (rows, columns) => {
      rows[1]![columns.indexOf(column)] = value;
    });
    await fails(p, code);
  });
  it("requires a closed feature to repeat its initial endpoint", async () => {
    const p = await packet();
    table(p, "siteFeatures", (rows, columns) => {
      rows[0]![columns.indexOf("east_m")] = "-12345";
    });
    await fails(p, "RADAR.SITE_GEOMETRY");
  });
  it("permits an explicitly empty site context without pretending row zero exists", async () => {
    const p = await packet();
    table(p, "siteFeatures", (rows) => {
      rows.length = 0;
    });
    p.selection.selections = p.selection.selections.filter(
      (s: { layoutRef: string }) => s.layoutRef !== "layout:siteFeatures"
    );
    const result = await evaluate(p);
    expect(result.issues).toEqual([]);
    expect(result.data!.products.siteFeatures).toEqual([]);
  });
});
