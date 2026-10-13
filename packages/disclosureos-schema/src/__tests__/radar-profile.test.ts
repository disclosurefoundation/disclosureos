import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateRadarProfile } from "../experimental/v2/radar-profile";
import {
  RadarProfileSchema,
  radarProfileJsonSchema,
} from "../experimental/v2/radar-profile-schema";
import {
  radarCovarianceScaleSquared,
  radarCellPosition,
  RADAR_TABLE_COLUMNS,
  readRadarProducts,
} from "../experimental/v2/radar-profile-reader";
import { readSourceCsv } from "../experimental/v2/product-source-reader";
// Load the executable example at runtime; it is outside this package's TS source root.
const createPacket = async () =>
  (
    await import(
      new URL("../../../../examples/radar-scanning/build.mjs", import.meta.url)
        .href
    )
  ).createPacket();

type Packet = Awaited<ReturnType<typeof createPacket>>;
const evaluate = (p: Packet) =>
  evaluateRadarProfile(p.observation, p.context, p.selection, p.profile, {
    assets: p.assets,
  });
const repin = (p: Packet, role: string, bytes: Uint8Array) => {
  const ref = p.profile.products[role],
    digest = {
      algorithm: "sha256",
      value: createHash("sha256").update(bytes).digest("hex"),
    };
  p.assets.set(ref, bytes);
  const layout = p.selection.layouts.find(
    (layout: { productRef: string }) => layout.productRef === ref
  );
  Object.assign(layout, { digest, byteLength: bytes.byteLength });
  p.observation.products.find(
    (product: { id: string }) => `product:${product.id}` === ref
  ).digest = digest;
  if (role === "returns")
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
  const rows = readSourceCsv(p.assets.get(p.profile.products[role]));
  const columns = rows.shift()!;
  edit(rows, columns);
  repin(
    p,
    role,
    new TextEncoder().encode(
      [columns, ...rows].map((row) => row.join(",")).join("\n") + "\n"
    )
  );
  p.selection.layouts.find(
    (layout: { productRef: string }) =>
      layout.productRef === p.profile.products[role]
  ).rowCount = rows.length;
};
const failure = async (p: Packet, code: string) => {
  const result = await evaluate(p);
  expect(result.success).toBe(false);
  expect(result.data).toBeUndefined();
  expect(result.issues.map((issue) => issue.code)).toContain(code);
};

const createPosePacket = async () => {
  const p = await createPacket();
  p.profile.platform = {
    kind: "moving",
    environment: "shipborne",
    poseSampling: "dwell_midpoint",
    attitudeModel: "level_yaw_only",
  };
  p.profile.beamReference = "platform_heading";
  p.profile.products.platformPose = "product:platform-pose";
  p.profile.uncertainty.conditioning = "declared_pose_and_projection";
  const dwells = readRadarProducts(
    p.selection.layouts,
    { ...p.profile.products, platformPose: undefined },
    p.assets
  ).scanSchedule;
  const columns = [...RADAR_TABLE_COLUMNS.platformPose];
  const bytes = new TextEncoder().encode(
    [
      columns.join(","),
      ...dwells.map((dwell) =>
        [
          dwell.scan_index,
          dwell.azimuth_index,
          (dwell.start_s + dwell.end_s) / 2,
          0,
          0,
          0,
          0,
        ].join(",")
      ),
    ].join("\n") + "\n"
  );
  const digest = {
    algorithm: "sha256",
    value: createHash("sha256").update(bytes).digest("hex"),
  };
  p.observation.products.push({
    id: "platform-pose",
    kind: "raw",
    format: "text/csv",
    access: "public",
    digest,
    sourceRefs: ["source:simulation", "source:methods"],
  });
  p.selection.layouts.push({
    id: "platform-pose",
    productRef: "product:platform-pose",
    kind: "csv_table",
    digest,
    byteLength: bytes.byteLength,
    mediaType: "text/csv",
    encoding: "utf-8",
    delimiter: ",",
    header: true,
    rowCount: dwells.length,
    columns,
  });
  p.assets.set("product:platform-pose", bytes);
  p.observation.processing
    .find((v: { id: string }) => v.id === "detect")
    .inputRefs.push("product:platform-pose");
  return p;
};

describe("optional rotating radar profile", () => {
  it("validates the complete source-backed scan, detection and tracking example without scientific certification", async () => {
    const p = await createPacket(),
      result = await evaluate(p);
    expect(result.issues).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.checks).toEqual({
      structure: "passed",
      sources: "passed",
      semantics: "passed",
    });
    expect(result.data!.products.returns).toHaveLength(16 * 72 * 64);
    expect(result.data!.products.scanSchedule).toHaveLength(16 * 72);
    expect(result.data!.products.truth).toHaveLength(2 * 16 * 72);
    expect(
      result.data!.products.tracks.some((row) => row.state === "coasting")
    ).toBe(true);
    expect(result.scientific).toBe("not_checked");
    expect(result.physicalCalibration).toBe("not_checked");
    expect(result.trackingPerformance).toBe("not_checked");
  });
  it("emits the committed strict portable schema", () => {
    const committed = JSON.parse(
      readFileSync(
        new URL(
          "../../schema/experimental/radar-profile-0.1.0.schema.json",
          import.meta.url
        ),
        "utf8"
      )
    );
    expect(committed).toEqual(radarProfileJsonSchema());
  });
  it("requires explicit localization semantics rather than assuming a pixel is a position", async () => {
    const p = await createPacket();
    delete p.profile.detectionPosition;
    expect(RadarProfileSchema.safeParse(p.profile).success).toBe(false);
  });
  it("rejects changed source bytes before exposing data", async () => {
    const p = await createPacket();
    p.assets.get(p.profile.products.returns)[0] ^= 1;
    await failure(p, "RADAR.SOURCE_CONTENT");
  });
  it("requires source bytes even when all declarations parse", async () => {
    const p = await createPacket();
    p.assets.delete(p.profile.products.detections);
    await failure(p, "RADAR.SOURCE_CONTENT");
  });
  it("rejects a truth oracle supplied to processing through a dependency", async () => {
    const p = await createPacket();
    p.observation.processing
      .find((v: { id: string }) => v.id === "threshold")
      .inputRefs.push(p.profile.products.truth);
    await failure(p, "RADAR.TRUTH_LEAK");
  });
  it("requires each role to have a distinct product", async () => {
    const p = await createPacket();
    p.profile.products.tracks = p.profile.products.detections;
    await failure(p, "RADAR.ROLE_ALIAS");
  });
  it("rejects oracle labeling on instrument data", async () => {
    const p = await createPacket();
    p.profile.dataOrigin = "instrument";
    await failure(p, "RADAR.TRUTH_ORIGIN");
  });
  it("requires a meter Cartesian frame", async () => {
    const p = await createPacket();
    p.observation.frames[0].unit = "km";
    await failure(p, "RADAR.FRAME");
  });
  it("requires exact capture bytes in the acquisition context", async () => {
    const p = await createPacket();
    p.context.products[0].artifact.digest.value = "0".repeat(64);
    await failure(p, "RADAR.CAPTURE_BINDING");
  });
  it("binds returns to a declared acquisition channel", async () => {
    const p = await createPacket();
    p.profile.channelId = "unrelated-channel";
    await failure(p, "RADAR.CHANNEL");
  });
  it("does not decode rows excluded by a declared product partition", async () => {
    const p = await createPacket();
    p.selection.layouts.find(
      (v: { productRef: string }) => v.productRef === p.profile.products.tracks
    ).partition = { column: "track_id", equals: "track-001" };
    await failure(p, "RADAR.CONTENT");
  });
  it("rejects an exclusive truth payload hidden behind a derived oracle", async () => {
    const p = await createPacket();
    p.observation.sources.push({
      id: "oracle-payload",
      kind: "document",
      access: "public",
    });
    for (const id of ["truth", "track"])
      p.observation.processing
        .find((v: { id: string }) => v.id === id)
        .inputRefs.push("source:oracle-payload");
    await failure(p, "RADAR.TRUTH_LEAK");
  });
  it("cannot exempt the oracle by making it a scan-schedule ancestor", async () => {
    const p = await createPacket();
    const schedule = p.observation.products.find(
      (v: { id: string }) => v.id === "schedule"
    );
    delete schedule.sourceRefs;
    schedule.kind = "derived";
    schedule.generatedBy = "process:oracle-schedule";
    p.observation.methods.push({ id: "oracle-schedule", version: "1" });
    p.observation.processing.push({
      id: "oracle-schedule",
      methodRef: "method:oracle-schedule",
      methodVersion: "1",
      performedBy: "adversarial test",
      performedAt: "2026-07-28T22:01:04Z",
      inputRefs: [p.profile.products.truth],
      outputRefs: [p.profile.products.scanSchedule],
    });
    await failure(p, "RADAR.TRUTH_LEAK");
  });
  it("preserves sub-millisecond precision in acquisition containment", async () => {
    const p = await createPacket();
    p.profile.timeOrigin = "2026-07-28T22:00:00.0001Z";
    await failure(p, "RADAR.ACQUISITION_TIME");
  });
  it("accepts an equivalent UTC-offset origin without inferring synchronization", async () => {
    const p = await createPacket();
    p.profile.timeOrigin = "2026-07-28T15:00:00-07:00";
    expect((await evaluate(p)).success).toBe(true);
  });
  it("rejects overlapping dwell intervals after independently re-pinning their bytes", async () => {
    const p = await createPacket();
    table(p, "scanSchedule", (rows, columns) => {
      rows[1]![columns.indexOf("start_s")] = "0";
    });
    await failure(p, "RADAR.DWELL_TIME");
  });
  it("rejects a missing or reordered dwell", async () => {
    const p = await createPacket();
    table(p, "scanSchedule", (rows) => {
      [rows[1], rows[2]] = [rows[2]!, rows[1]!];
    });
    await failure(p, "RADAR.DWELL_ORDER");
  });
  it("rejects beam directions inconsistent with retained azimuth bins", async () => {
    const p = await createPacket();
    table(p, "scanSchedule", (rows, columns) => {
      rows[0]![columns.indexOf("beam_azimuth_deg")] = "1";
    });
    await failure(p, "RADAR.BEAM");
  });
  it("rejects a scan outside the declared acquisition interval", async () => {
    const p = await createPacket();
    p.profile.timeOrigin = "2026-07-28T22:00:10Z";
    await failure(p, "RADAR.ACQUISITION_TIME");
  });
  it("rejects a fabricated detection position despite internally matching artifact digests", async () => {
    const p = await createPacket();
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("east_m")] = "9999";
    });
    await failure(p, "RADAR.DETECTION_GEOMETRY");
  });
  it("checks detection power against its exact retained cell", async () => {
    const p = await createPacket();
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("power")] = "0";
    });
    await failure(p, "RADAR.DETECTION_THRESHOLD");
  });
  it("rejects a detection assigned outside its actual dwell", async () => {
    const p = await createPacket();
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("time_s")] = "64";
    });
    await failure(p, "RADAR.DETECTION_TIME");
  });
  it("rejects covariance with positive diagonal entries but impossible correlation", async () => {
    const p = await createPacket();
    table(p, "tracks", (rows, columns) => {
      rows[0]![columns.indexOf("cov_ee_m2")] = "1";
      rows[0]![columns.indexOf("cov_nn_m2")] = "1";
      rows[0]![columns.indexOf("cov_en_m2")] = "2";
    });
    await failure(p, "RADAR.COVARIANCE");
  });
  it("rejects negative variance", async () => {
    const p = await createPacket();
    table(p, "tracks", (rows, columns) => {
      rows[0]![columns.indexOf("cov_nn_m2")] = "-1";
    });
    await failure(p, "RADAR.COVARIANCE");
  });
  it("rejects non-finite table values before spatial calculations", async () => {
    const p = await createPacket();
    table(p, "tracks", (rows, columns) => {
      rows[0]![columns.indexOf("cov_nn_m2")] = "Infinity";
    });
    await failure(p, "RADAR.CONTENT");
  });
  it("rejects unknown detection associations", async () => {
    const p = await createPacket();
    table(p, "associations", (rows, columns) => {
      rows[0]![columns.indexOf("detection_id")] = "not-a-detection";
    });
    await failure(p, "RADAR.ASSOCIATION_REF");
  });
  it("rejects assigning one detection twice", async () => {
    const p = await createPacket();
    table(p, "associations", (rows) => {
      rows.push([...rows[0]!]);
    });
    await failure(p, "RADAR.ASSOCIATION_UNIQUE");
  });
  it("does not present an associated estimate as coasting", async () => {
    const p = await createPacket();
    table(p, "tracks", (rows, columns) => {
      rows[0]![columns.indexOf("state")] = "coasting";
    });
    await failure(p, "RADAR.TRACK_STATE");
  });
  it("checks the complete return array, including unselected non-finite cells", async () => {
    const p = await createPacket(),
      bytes = Uint8Array.from(p.assets.get(p.profile.products.returns));
    new DataView(bytes.buffer).setFloat32(bytes.byteLength - 4, NaN, true);
    repin(p, "returns", bytes);
    await failure(p, "RADAR.CONTENT");
  });
  it("calculates a two-dimensional Gaussian probability contour, not 1.96-sigma coordinate intervals", () => {
    expect(radarCovarianceScaleSquared(0.95)).toBeCloseTo(5.99146454710798, 12);
    for (const p of [0, 1, -1, Infinity, NaN])
      expect(() => radarCovarianceScaleSquared(p)).toThrow();
  });
  it("exposes the same exact values through the dependency-free reader", async () => {
    const p = await createPacket(),
      evaluated = await evaluate(p);
    expect(
      readRadarProducts(p.selection.layouts, p.profile.products, p.assets)
    ).toEqual(evaluated.data!.products);
  });
});

describe("moving-platform radar contract", () => {
  it("keeps localization accuracy independent of a large frame translation", async () => {
    const { createPacket: movingPacket } = await import(
      new URL("../../../../examples/radar-moving/build.mjs", import.meta.url)
        .href
    );
    const p = await movingPacket("shipborne"),
      translation = 1e9;
    p.profile.origin.eastM += translation;
    p.profile.origin.northM += translation;
    for (const role of ["platformPose", "detections", "tracks", "truth"])
      table(p, role, (rows, columns) => {
        for (const row of rows)
          for (const column of ["east_m", "north_m"])
            row[columns.indexOf(column)] = String(
              Number(row[columns.indexOf(column)]) + translation
            );
      });
    expect((await evaluate(p)).issues).toEqual([]);
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("east_m")] = String(
        Number(rows[0]![columns.indexOf("east_m")]) + 500
      );
    });
    await failure(p, "RADAR.DETECTION_GEOMETRY");
  });

  it("accepts the full airborne and shipborne packets with motion compensation and conditional covariance", async () => {
    const { createPacket: movingPacket } = await import(
      new URL("../../../../examples/radar-moving/build.mjs", import.meta.url)
        .href
    );
    for (const scenario of ["airborne", "shipborne"]) {
      const p = await movingPacket(scenario),
        result = await evaluate(p);
      expect(result.issues).toEqual([]);
      expect(result.success).toBe(true);
      expect(result.data!.products.platformPose).toHaveLength(1152);
      expect(result.scientific).toBe("not_checked");
      expect(result.physicalCalibration).toBe("not_checked");
      expect(result.trackingPerformance).toBe("not_checked");
    }
  });
  it("rejects physically impossible slant-to-plane detection centers instead of clamping them", async () => {
    const { createPacket: movingPacket } = await import(
      new URL("../../../../examples/radar-moving/build.mjs", import.meta.url)
        .href
    );
    const p = await movingPacket("airborne");
    table(p, "platformPose", (rows, columns) => {
      for (const row of rows) row[columns.indexOf("up_m")] = "100000";
    });
    await failure(p, "RADAR.PROJECTION_GEOMETRY");
  });
  it("rechecks declared target-plane geometry rather than trusting stored detection positions", async () => {
    const { createPacket: movingPacket } = await import(
      new URL("../../../../examples/radar-moving/build.mjs", import.meta.url)
        .href
    );
    const p = await movingPacket("airborne");
    p.profile.projection.upM = 100;
    await failure(p, "RADAR.DETECTION_GEOMETRY");
  });

  it("accepts explicit horizontal moving-platform geometry with retained midpoint poses", async () => {
    const result = await evaluate(await createPosePacket());
    expect(result.issues).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.data!.products.platformPose).toHaveLength(1152);
    expect(result.data!.declaration.uncertainty.conditioning).toBe(
      "declared_pose_and_projection"
    );
  });
  it("rejects incomplete moving declarations and undeclared pose products structurally", async () => {
    for (const change of [
      (p: Packet) => {
        delete p.profile.products.platformPose;
      },
      (p: Packet) => {
        delete p.profile.platform;
      },
      (p: Packet) => {
        delete p.profile.beamReference;
      },
      (p: Packet) => {
        delete p.profile.uncertainty.conditioning;
      },
      (p: Packet) => {
        p.profile.rangeConvention = "slant_range";
      },
      (p: Packet) => {
        p.profile.platform.attitudeModel = "implicit_six_dof";
      },
    ]) {
      const p = await createPosePacket();
      change(p);
      expect(RadarProfileSchema.safeParse(p.profile).success).toBe(false);
    }
  });
  it("rejects an omitted pose and a reordered pose even with matching source digests", async () => {
    const missing = await createPosePacket();
    table(missing, "platformPose", (rows) => {
      rows.pop();
    });
    await failure(missing, "RADAR.POSE_COUNT");
    const reordered = await createPosePacket();
    table(reordered, "platformPose", (rows) => {
      [rows[0], rows[1]] = [rows[1]!, rows[0]!];
    });
    await failure(reordered, "RADAR.POSE_ORDER");
  });
  it("does not silently interpolate pose samples or accept headings outside their convention", async () => {
    const timing = await createPosePacket();
    table(timing, "platformPose", (rows, columns) => {
      rows[12]![columns.indexOf("time_s")] = "0.7";
    });
    await failure(timing, "RADAR.POSE_TIME");
    const heading = await createPosePacket();
    table(heading, "platformPose", (rows, columns) => {
      rows[12]![columns.indexOf("heading_deg")] = "360";
    });
    await failure(heading, "RADAR.POSE_HEADING");
  });
  it("requires the declared anchor to match the first pose", async () => {
    const p = await createPosePacket();
    p.profile.origin.eastM = 42;
    await failure(p, "RADAR.POSE_ORIGIN");
  });
  it("recomputes source-cell localization using each retained pose", async () => {
    const p = await createPosePacket();
    table(p, "platformPose", (rows, columns) => {
      for (const row of rows) row[columns.indexOf("heading_deg")] = "90";
    });
    await failure(p, "RADAR.DETECTION_GEOMETRY");
  });
  it("requires detections to use pose sampling time", async () => {
    const p = await createPosePacket();
    table(p, "detections", (rows, columns) => {
      rows[0]![columns.indexOf("time_s")] = String(
        Number(rows[0]![columns.indexOf("time_s")]) + 0.001
      );
    });
    await failure(p, "RADAR.DETECTION_POSE_TIME");
  });
  it("requires retained pose and schedule in detector ancestry", async () => {
    for (const ref of ["product:platform-pose", "product:schedule"]) {
      const p = await createPosePacket(),
        detect = p.observation.processing.find(
          (v: { id: string }) => v.id === "detect"
        );
      detect.inputRefs = detect.inputRefs.filter(
        (input: string) => input !== ref
      );
      await failure(p, "RADAR.PLATFORM_LINEAGE");
    }
  });
  it("rejects a pose derived from the target truth oracle", async () => {
    const p = await createPosePacket(),
      pose = p.observation.products.find(
        (v: { id: string }) => v.id === "platform-pose"
      );
    delete pose.sourceRefs;
    pose.kind = "derived";
    pose.generatedBy = "process:oracle-pose";
    p.observation.methods.push({ id: "oracle-pose", version: "1" });
    p.observation.processing.push({
      id: "oracle-pose",
      methodRef: "method:oracle-pose",
      methodVersion: "1",
      performedBy: "adversarial test",
      performedAt: "2026-07-28T22:01:04Z",
      inputRefs: [p.profile.products.truth],
      outputRefs: [p.profile.products.platformPose],
    });
    await failure(p, "RADAR.TRUTH_LEAK");
  });
  it("projects slant range onto only the declared plane and refuses impossible geometry", () => {
    const profile = {
      origin: { eastM: 0, northM: 0 },
      platform: { kind: "moving" as const },
      beamReference: "platform_heading" as const,
      rangeConvention: "slant_range" as const,
      projection: { kind: "declared_horizontal_plane" as const, upM: 0 },
    };
    const pose = {
      scan_index: 0,
      azimuth_index: 0,
      time_s: 0.5,
      east_m: 100,
      north_m: 200,
      up_m: 300,
      heading_deg: 90,
    };
    const position = radarCellPosition(profile, pose, 0, 500)!;
    expect(position.horizontalRangeM).toBe(400);
    expect(position.eastM).toBe(500);
    expect(position.northM).toBeCloseTo(200, 10);
    expect(position.bearingDeg).toBe(90);
    expect(radarCellPosition(profile, pose, 0, 299)).toBeNull();
    expect(radarCellPosition(profile, pose, 0, 300)!.horizontalRangeM).toBe(0);
    expect(() => radarCellPosition(profile, undefined, 0, 500)).toThrow(/pose/);
  });
});
