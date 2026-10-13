import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  evaluateSteeredRadarProfile,
  evaluateSecondaryRadarProfile,
} from "../experimental/v2/advanced-radar-profile";
import {
  SteeredRadarProfileSchema,
  SecondaryRadarProfileSchema,
} from "../experimental/v2/advanced-radar-profile-schema";
import {
  readSteeredRadarProducts,
  readSecondaryRadarProducts,
} from "../experimental/v2/advanced-radar-profile-reader";
import { readSourceCsv } from "../experimental/v2/product-source-reader";
const createPacket = async (scenario: "military" | "secondary" = "military") =>
  (
    await import(
      new URL("../../../../examples/radar-advanced/build.mjs", import.meta.url)
        .href
    )
  ).createPacket(scenario);
type Packet = Awaited<ReturnType<typeof createPacket>>;
const evaluate = (p: Packet) =>
  (p.profile.kind === "steered_radar_profile"
    ? evaluateSteeredRadarProfile
    : evaluateSecondaryRadarProfile)(
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
  const layout = p.selection.layouts.find(
    (l: { productRef: string }) => l.productRef === ref
  );
  Object.assign(layout, { digest, byteLength: bytes.byteLength });
  p.observation.products.find(
    (v: { id: string }) => `product:${v.id}` === ref
  ).digest = digest;
  if (role === "returns" || role === "decodedReplies")
    Object.assign(p.context.products[0].artifact, {
      digest,
      byteLength: bytes.byteLength,
    });
};
const table = (
  p: Packet,
  role: string,
  edit: (rows: string[][], columns: string[]) => void
) => {
  const rows = readSourceCsv(p.assets.get(p.profile.products[role])),
    columns = rows.shift()!;
  edit(rows, columns);
  repin(
    p,
    role,
    new TextEncoder().encode(
      [columns, ...rows].map((r) => r.join(",")).join("\n") + "\n"
    )
  );
  p.selection.layouts.find(
    (l: { productRef: string }) => l.productRef === p.profile.products[role]
  ).rowCount = rows.length;
};
const cell = (
  p: Packet,
  role: string,
  column: string,
  value: string,
  row = 0
) =>
  table(p, role, (rows, columns) => {
    rows[row]![columns.indexOf(column)] = value;
  });
const failure = async (p: Packet, code: string) => {
  const r = await evaluate(p);
  expect(r.success).toBe(false);
  expect(r.data).toBeUndefined();
  expect(r.issues.map((v) => v.code)).toContain(code);
};
describe("advanced radar public contracts", () => {
  for (const scenario of ["military", "secondary"] as const) {
    it(`${scenario} validates all retained products without claiming scientific or identity validation`, async () => {
      const p = await createPacket(scenario),
        r = await evaluate(p);
      expect(r.issues).toEqual([]);
      expect(r.success).toBe(true);
      expect(r.checks).toEqual({
        structure: "passed",
        sources: "passed",
        semantics: "passed",
      });
      expect(r.identityVerification).toBe("not_checked");
      expect(r.scientific).toBe("not_checked");
      expect(r.physicalCalibration).toBe("not_checked");
    });
    it(`${scenario} does not pass with metadata alone`, async () => {
      const p = await createPacket(scenario);
      p.assets = new Map();
      await failure(p, "RADAR.SOURCE_CONTENT");
    });
    it(`${scenario} rejects tampered source bytes`, async () => {
      const p = await createPacket(scenario),
        ref = Object.values(p.profile.products)[0] as string,
        bytes = Uint8Array.from(p.assets.get(ref) as Uint8Array);
      bytes[0] = bytes[0]! ^ 1;
      p.assets.set(ref, bytes);
      await failure(p, "RADAR.SOURCE_CONTENT");
    });
    it(`${scenario} rejects aliased roles`, async () => {
      const p = await createPacket(scenario);
      p.profile.products.truth = Object.values(p.profile.products)[0];
      await failure(p, "RADAR.ROLE_ALIAS");
    });
    it(`${scenario} rejects capture binding mismatch`, async () => {
      const p = await createPacket(scenario);
      p.context.products[0].artifact.byteLength++;
      await failure(p, "RADAR.CAPTURE_BINDING");
    });
    it(`${scenario} rejects wrong acquisition channel`, async () => {
      const p = await createPacket(scenario);
      p.profile.channelId = "other";
      await failure(p, "RADAR.CHANNEL");
    });
    it(`${scenario} forbids truth as a processing input`, async () => {
      const p = await createPacket(scenario);
      p.observation.processing[0].inputRefs.push(p.profile.products.truth);
      await failure(p, "RADAR.TRUTH_LEAK");
    });
    it(`${scenario} rejects undeclared identity inference and arbitrary extra profile fields`, async () => {
      const p = await createPacket(scenario);
      p.profile.verifiedIdentity = "aircraft-x";
      await failure(p, "RADAR.PREREQUISITE");
    });
    it(`${scenario} rejects synthetic truth with instrument data origin`, async () => {
      const p = await createPacket(scenario);
      p.profile.dataOrigin = "instrument";
      await failure(p, "RADAR.TRUTH_ORIGIN");
    });
  }
  it("profiles are not interchangeable", async () => {
    const a = await createPacket(),
      b = await createPacket("secondary");
    expect(SecondaryRadarProfileSchema.safeParse(a.profile).success).toBe(
      false
    );
    expect(SteeredRadarProfileSchema.safeParse(b.profile).success).toBe(false);
  });
  it("keeps source byte snapshots stable across asynchronous validation", async () => {
    const p = await createPacket(),
      pending = evaluate(p);
    p.assets.get(p.profile.products.returns).fill(255);
    const result = await pending;
    expect(result.success).toBe(true);
  });
});
describe("steered sector numerical semantics", () => {
  it("reads nonuniform search/revisit schedules and variable bearing gaps", async () => {
    const p = await createPacket(),
      data = readSteeredRadarProducts(
        p.selection.layouts,
        p.profile.products,
        p.assets
      );
    expect(new Set(data.beamSchedule.map((d) => d.purpose))).toEqual(
      new Set(["search", "revisit"])
    );
    expect(data.returns.length).toBe(
      data.beamSchedule.length *
        p.selection.layouts.find(
          (l: { productRef: string }) =>
            l.productRef === p.profile.products.returns
        ).axes[1].length
    );
  });
  it("rejects a fabricated regular azimuth dimension", async () => {
    const p = await createPacket();
    p.selection.layouts.find(
      (l: { productRef: string }) => l.productRef === p.profile.products.returns
    ).axes[0].name = "azimuth";
    await failure(p, "RADAR.AXES");
  });
  for (const [name, role, column, value, code] of [
    [
      "noncontiguous dwell",
      "beamSchedule",
      "dwell_index",
      "9999",
      "RADAR.DWELL_ORDER",
    ],
    ["overlapping dwell", "beamSchedule", "end_s", "3", "RADAR.DWELL_TIME"],
    ["skipped cycle", "beamSchedule", "cycle_index", "2", "RADAR.DWELL_ORDER"],
    [
      "out-of-range bearing",
      "beamSchedule",
      "beam_azimuth_deg",
      "360",
      "RADAR.BEAM",
    ],
    [
      "unsupported purpose",
      "beamSchedule",
      "purpose",
      "weapons_guidance",
      "RADAR.CONTENT",
    ],
    [
      "negative beam width",
      "beamSchedule",
      "beam_width_deg",
      "0",
      "RADAR.BEAM",
    ],
    [
      "detection time outside dwell",
      "detections",
      "time_s",
      "-1",
      "RADAR.DETECTION_TIME",
    ],
    [
      "detection geometry altered",
      "detections",
      "east_m",
      "1000000",
      "RADAR.DETECTION_GEOMETRY",
    ],
    [
      "detection cell outside capture",
      "detections",
      "range_index",
      "99999",
      "RADAR.DETECTION_CELL",
    ],
    [
      "detection power mismatch",
      "detections",
      "power",
      "0",
      "RADAR.DETECTION_THRESHOLD",
    ],
    ["future track", "tracks", "time_s", "99999", "RADAR.TRACK_TIME"],
    ["invalid covariance", "tracks", "cov_ee_m2", "-1", "RADAR.COVARIANCE"],
    [
      "coasting with association",
      "tracks",
      "state",
      "coasting",
      "RADAR.TRACK_STATE",
    ],
    [
      "nonexistent association",
      "associations",
      "detection_id",
      "missing",
      "RADAR.ASSOCIATION_REF",
    ],
  ])
    it(`rejects ${name}`, async () => {
      const p = await createPacket();
      cell(p, role!, column!, value!);
      await failure(p, code!);
    });
  it("does not relax localization tolerances after translating the frame", async () => {
    const p = await createPacket();
    p.profile.origin.eastM = 1e9;
    table(p, "detections", (rows, cols) => {
      const i = cols.indexOf("east_m");
      for (const row of rows) row[i] = String(Number(row[i]) + 1e9 + 500);
    });
    await failure(p, "RADAR.DETECTION_GEOMETRY");
  });
  it("requires schedule lineage for source-cell localization", async () => {
    const p = await createPacket();
    const process = p.observation.processing.find(
      (v: { id: string }) => v.id === "detect"
    );
    process.inputRefs = process.inputRefs.filter(
      (ref: string) => ref !== p.profile.products.beamSchedule
    );
    await failure(p, "RADAR.LINEAGE");
  });
  it("rejects duplicate source detections", async () => {
    const p = await createPacket();
    table(p, "detections", (rows) => rows.push([...rows[0]!]));
    await failure(p, "RADAR.DETECTION_ID");
  });
});
describe("secondary cooperative reply semantics", () => {
  it("preserves leading-zero codes, null altitude and invalid receptions", async () => {
    const p = await createPacket("secondary"),
      d = readSecondaryRadarProducts(
        p.selection.layouts,
        p.profile.products,
        p.assets
      );
    expect(d.decodedReplies.some((r) => r.mode_a_code?.startsWith("0"))).toBe(
      true
    );
    expect(
      d.decodedReplies.some(
        (r) => r.validity === "invalid" && r.slant_range_m === null
      )
    ).toBe(true);
    expect(
      d.decodedReplies.some(
        (r) => r.validity === "valid" && r.pressure_altitude_ft === null
      )
    ).toBe(true);
    expect(d.reports.length).toBe(
      d.decodedReplies.filter((r) => r.validity === "valid").length
    );
  });
  for (const [name, role, column, value, code] of [
    [
      "unknown interrogation",
      "decodedReplies",
      "interrogation_id",
      "missing",
      "RADAR.REPLY_REF",
    ],
    [
      "reply before interrogation",
      "decodedReplies",
      "time_s",
      "-1",
      "RADAR.REPLY_TIME",
    ],
    [
      "available before receipt",
      "decodedReplies",
      "available_s",
      "-1",
      "RADAR.REPLY_TIME",
    ],
    [
      "valid range missing",
      "decodedReplies",
      "slant_range_m",
      "",
      "RADAR.REPLY_POSITION",
    ],
    [
      "negative range",
      "decodedReplies",
      "slant_range_m",
      "-1",
      "RADAR.REPLY_POSITION",
    ],
    [
      "non-octal code",
      "decodedReplies",
      "mode_a_code",
      "8888",
      "RADAR.CONTENT",
    ],
    [
      "lost leading zeros",
      "decodedReplies",
      "mode_a_code",
      "42",
      "RADAR.CONTENT",
    ],
    [
      "altered report range",
      "reports",
      "slant_range_m",
      "999999",
      "RADAR.REPORT_FIDELITY",
    ],
    [
      "inferred pressure altitude",
      "reports",
      "pressure_altitude_ft",
      "2000",
      "RADAR.REPORT_FIDELITY",
    ],
  ])
    it(`rejects ${name}`, async () => {
      const p = await createPacket("secondary");
      cell(p, role!, column!, value!);
      await failure(p, code!);
    });
  it("forbids decoded values on invalid receptions", async () => {
    const p = await createPacket("secondary");
    table(p, "decodedReplies", (rows, cols) => {
      const row = rows.find((r) => r[cols.indexOf("validity")] === "invalid")!;
      row[cols.indexOf("slant_range_m")] = "0";
    });
    await failure(p, "RADAR.INVALID_REPLY");
  });
  it("rejects unquantized Mode C pressure altitude", async () => {
    const p = await createPacket("secondary");
    table(p, "decodedReplies", (rows, cols) => {
      const row = rows.find(
        (r) => r[cols.indexOf("pressure_altitude_ft")] !== ""
      )!;
      row[cols.indexOf("pressure_altitude_ft")] = "1234";
    });
    await failure(p, "RADAR.MODE_FIELDS");
  });
  it("requires one report per valid decoded reply", async () => {
    const p = await createPacket("secondary");
    table(p, "reports", (rows) => rows.pop());
    await failure(p, "RADAR.REPORT_COMPLETENESS");
  });
  it("rejects duplicate reports for a source reply", async () => {
    const p = await createPacket("secondary");
    table(p, "reports", (rows) => rows.push([...rows[0]!]));
    await failure(p, "RADAR.REPORT_ID");
  });
  it("requires interrogation lineage in report processing", async () => {
    const p = await createPacket("secondary");
    p.observation.processing[0].inputRefs =
      p.observation.processing[0].inputRefs.filter(
        (ref: string) => ref !== p.profile.products.interrogations
      );
    await failure(p, "RADAR.LINEAGE");
  });
  it("rejects scalar sample mappings that change full-table meaning", async () => {
    const p = await createPacket("secondary");
    p.selection.layouts.find(
      (l: { productRef: string }) =>
        l.productRef === p.profile.products.decodedReplies
    ).partition = { by: "interrogation_id", value: "int-001" };
    const r = await evaluate(p);
    expect(r.success).toBe(false);
  });
});

describe("advanced profile isolation and absence boundaries", () => {
  for (const scenario of ["military", "secondary"] as const) {
    it(`${scenario} rejects oracle products even when shared by capture and processing`, async () => {
      const p = await createPacket(scenario),
        capture =
          scenario === "military"
            ? p.profile.products.returns
            : p.profile.products.decodedReplies;
      p.observation.products.push({
        id: "shared-oracle",
        kind: "raw",
        format: "text/csv",
        access: "public",
        sourceRefs: ["source:simulation"],
      });
      p.observation.processing
        .find((v: { id: string }) => v.id === "truth")
        .inputRefs.push("product:shared-oracle");
      p.observation.processing[0].inputRefs.push("product:shared-oracle");
      // The schedule's shared synthesis ancestry also reaches the oracle.
      const schedule =
        scenario === "military"
          ? p.profile.products.beamSchedule
          : p.profile.products.interrogations;
      const source = p.observation.products.find(
        (v: { id: string }) => `product:${v.id}` === schedule
      );
      delete source.sourceRefs;
      source.kind = "derived";
      source.generatedBy = "process:schedule";
      p.observation.processing.push({
        id: "schedule",
        methodRef: "method:truth",
        methodVersion: "1.0.0",
        performedBy: "Synthetic test",
        performedAt: p.observation.processing[0].performedAt,
        inputRefs: ["product:shared-oracle", capture],
        outputRefs: [schedule],
      });
      await failure(p, "RADAR.TRUTH_LEAK");
    });
    it(`${scenario} rejects shared instrument-data oracle sources`, async () => {
      const p = await createPacket(scenario);
      p.observation.processing
        .find((v: { id: string }) => v.id === "truth")
        .inputRefs.push("source:simulation");
      p.observation.processing[0].inputRefs.push("source:simulation");
      await failure(p, "RADAR.TRUTH_LEAK");
    });
    it(`${scenario} rejects a calculated product relabeled raw`, async () => {
      const p = await createPacket(scenario),
        role = scenario === "military" ? "thresholds" : "reports",
        product = p.observation.products.find(
          (v: { id: string }) => `product:${v.id}` === p.profile.products[role]
        );
      delete product.generatedBy;
      product.kind = "raw";
      product.sourceRefs = ["source:simulation"];
      await failure(p, "RADAR.PREREQUISITE");
    });
  }
  it("accepts a valid Mode C report with unavailable altitude as null", async () => {
    const p = await createPacket("secondary"),
      qs = readSourceCsv(p.assets.get(p.profile.products.interrogations)),
      qcols = qs.shift()!;
    const modeC = qs.find((r) => r[qcols.indexOf("mode")] === "mode_c")![
      qcols.indexOf("interrogation_id")
    ];
    for (const role of ["decodedReplies", "reports"])
      table(p, role, (rows, cols) => {
        const row = rows.find(
          (r) =>
            r[cols.indexOf("interrogation_id")] === modeC &&
            r[cols.indexOf("validity")] === "valid"
        )!;
        row[cols.indexOf("pressure_altitude_ft")] = "";
      });
    const r = await evaluate(p);
    expect(r.success).toBe(true);
    expect(r.data?.products).toBeDefined();
  });
  it("accepts duplicate reported Mode A codes without asserting identity", async () => {
    const p = await createPacket("secondary");
    for (const role of ["decodedReplies", "reports"])
      table(p, role, (rows, cols) => {
        for (const row of rows)
          if (row[cols.indexOf("mode_a_code")] !== "")
            row[cols.indexOf("mode_a_code")] = "0042";
      });
    const r = await evaluate(p);
    expect(r.success).toBe(true);
    expect(r.identityVerification).toBe("not_checked");
  });
  it("rejects accepted reports created from invalid raw replies", async () => {
    const p = await createPacket("secondary"),
      raw = readSourceCsv(p.assets.get(p.profile.products.decodedReplies)),
      cols = raw.shift()!,
      invalid = raw.find((r) => r[cols.indexOf("validity")] === "invalid")!;
    table(p, "reports", (rows) => {
      rows.push(["fake-report", ...invalid]);
    });
    await failure(p, "RADAR.REPORT_REF");
  });
  it("reports cannot appear before their exact source processing availability", async () => {
    const p = await createPacket("secondary");
    table(p, "reports", (rows, cols) => {
      rows[0]![cols.indexOf("available_s")] = rows[0]![cols.indexOf("time_s")]!;
    });
    await failure(p, "RADAR.REPORT_FIDELITY");
  });
});

describe("empty radar products are retained outcomes", () => {
  it("accepts a complete secondary capture with no received replies", async () => {
    const p = await createPacket("secondary");
    for (const role of ["decodedReplies", "reports"]) {
      table(p, role, (rows) => {
        rows.length = 0;
      });
      const layout = p.selection.layouts.find(
        (l: { productRef: string }) => l.productRef === p.profile.products[role]
      );
      p.selection.selections = p.selection.selections.filter(
        (s: { layoutRef: string }) => s.layoutRef !== `layout:${layout.id}`
      );
    }
    const r = await evaluate(p);
    expect(r.issues).toEqual([]);
    expect(r.success).toBe(true);
    expect(
      (r.data!.products as { decodedReplies: unknown[] }).decodedReplies
    ).toEqual([]);
  });
  it("accepts a power capture with no detections or tracks", async () => {
    const p = await createPacket();
    for (const role of ["detections", "tracks", "associations"]) {
      table(p, role, (rows) => {
        rows.length = 0;
      });
      const layout = p.selection.layouts.find(
        (l: { productRef: string }) => l.productRef === p.profile.products[role]
      );
      p.selection.selections = p.selection.selections.filter(
        (s: { layoutRef: string }) => s.layoutRef !== `layout:${layout.id}`
      );
    }
    const r = await evaluate(p);
    expect(r.issues).toEqual([]);
    expect(r.success).toBe(true);
    expect((r.data!.products as { detections: unknown[] }).detections).toEqual(
      []
    );
  });
  it("rejects row zero when an empty table has no selectable rows", async () => {
    const p = await createPacket("secondary");
    table(p, "reports", (rows) => {
      rows.length = 0;
    });
    await failure(p, "RADAR.SOURCE_CONTENT");
  });
});
