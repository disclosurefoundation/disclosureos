import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/radar-scanning/build.mjs";
import {
  evaluateRadarProfile,
  RadarProfileSchema,
  radarProfileJsonSchema,
  radarCovarianceScaleSquared,
  radarCellPosition,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";

const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/radar-profile-0.1.0.schema.json",
      import.meta.url
    ),
    "utf8"
  )
);
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(artifact);

test("portable radar schema equals emitted public contract", () => {
  assert.deepEqual(artifact, radarProfileJsonSchema());
});

test("independent JSON Schema and package validator accept the complete declaration", async () => {
  const packet = await createPacket();
  assert.equal(validate(packet.profile), true, JSON.stringify(validate.errors));
  assert.equal(RadarProfileSchema.safeParse(packet.profile).success, true);
  const result = await evaluateRadarProfile(
    packet.observation,
    packet.context,
    packet.selection,
    packet.profile,
    { assets: packet.assets }
  );
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.equal(result.scientific, "not_checked");
  assert.equal(result.physicalCalibration, "not_checked");
  assert.equal(result.trackingPerformance, "not_checked");
});

test("independent schema rejects unknown semantics and overconfident contours", async () => {
  for (const mutate of [
    (profile) => {
      profile.rangeConvention = "slant_range";
    },
    (profile) => {
      profile.uncertainty.confidenceProbability = 1;
    },
    (profile) => {
      profile.processingAvailability = "instantaneous";
    },
    (profile) => {
      profile.inventedAntennaCapability = true;
    },
    (profile) => {
      delete profile.detectionPosition;
    },
    (profile) => {
      profile.uncertainty.axes.push("up");
    },
    (profile) => {
      profile.uncertainty.axes.pop();
    },
  ]) {
    const { profile } = await createPacket();
    mutate(profile);
    assert.equal(validate(profile), false);
    assert.equal(RadarProfileSchema.safeParse(profile).success, false);
  }
});

test("metadata alone cannot receive a verified radar payload", async () => {
  const p = await createPacket(),
    result = await evaluateRadarProfile(
      p.observation,
      p.context,
      p.selection,
      p.profile
    );
  assert.equal(result.success, false);
  assert.equal(result.data, undefined);
  assert.equal(result.checks.sources, "failed");
});

test("public Gaussian contour helper is two dimensional", () => {
  assert.ok(
    Math.abs(radarCovarianceScaleSquared(0.95) - 5.99146454710798) < 1e-12
  );
});

test("portable schema and runtime agree on optional moving-platform declarations", async () => {
  const { profile } = await createPacket();
  profile.platform = {
    kind: "moving",
    environment: "airborne",
    poseSampling: "dwell_midpoint",
    attitudeModel: "level_yaw_only",
  };
  profile.beamReference = "platform_heading";
  profile.products.platformPose = "product:platform-pose";
  profile.rangeConvention = "slant_range";
  profile.projection = {
    kind: "declared_horizontal_plane",
    upM: 0,
    assumption: "all_returns_on_plane",
  };
  profile.uncertainty.conditioning = "declared_pose_and_projection";
  assert.equal(validate(profile), true, JSON.stringify(validate.errors));
  assert.equal(RadarProfileSchema.safeParse(profile).success, true);
  for (const change of [
    (p) => {
      delete p.platform;
    },
    (p) => {
      delete p.products.platformPose;
    },
    (p) => {
      delete p.projection;
    },
    (p) => {
      delete p.beamReference;
    },
    (p) => {
      delete p.uncertainty.conditioning;
    },
    (p) => {
      p.platform.poseSampling = "interpolate";
    },
    (p) => {
      p.platform.attitudeModel = "six_dof";
    },
    (p) => {
      p.rangeConvention = "horizontal_range";
    },
  ]) {
    const candidate = structuredClone(profile);
    change(candidate);
    assert.equal(validate(candidate), false);
    assert.equal(RadarProfileSchema.safeParse(candidate).success, false);
  }
  const horizontal = structuredClone(profile);
  horizontal.platform.environment = "shipborne";
  horizontal.rangeConvention = "horizontal_range";
  delete horizontal.projection;
  assert.equal(validate(horizontal), true, JSON.stringify(validate.errors));
  assert.equal(RadarProfileSchema.safeParse(horizontal).success, true);
});

test("public moving-cell helper distinguishes slant distance from plane distance", () => {
  const profile = {
    origin: { eastM: 0, northM: 0 },
    platform: { kind: "moving" },
    beamReference: "platform_heading",
    rangeConvention: "slant_range",
    projection: { kind: "declared_horizontal_plane", upM: 100 },
  };
  const pose = {
    scan_index: 0,
    azimuth_index: 0,
    time_s: 0.5,
    east_m: 10,
    north_m: 20,
    up_m: 400,
    heading_deg: 90,
  };
  const projected = radarCellPosition(profile, pose, 0, 500);
  assert.equal(projected.horizontalRangeM, 400);
  assert.equal(projected.eastM, 410);
  assert.ok(Math.abs(projected.northM - 20) < 1e-10);
  assert.equal(radarCellPosition(profile, pose, 0, 299), null);
});
