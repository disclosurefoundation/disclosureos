import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/lidar-point-cloud/build.mjs";
import {
  LidarProfileSchema,
  lidarProfileJsonSchema,
  evaluateLidarProfile,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/lidar-point-cloud-profile-0.1.0.schema.json",
      import.meta.url
    ),
    "utf8"
  )
);
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(artifact);
test("portable lidar profile equals public runtime contract", () =>
  assert.deepEqual(artifact, lidarProfileJsonSchema()));
test("portable and runtime accept the complete local lidar profile", async () => {
  const p = await createPacket();
  assert.equal(validate(p.profile), true, JSON.stringify(validate.errors));
  assert.equal(LidarProfileSchema.safeParse(p.profile).success, true);
  const r = await evaluateLidarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
  assert.equal(r.success, true, JSON.stringify(r.issues));
});
test("portable and runtime reject unsupported geometry and semantics", async () => {
  for (const mutate of [
    (p) => (p.mode = "mobile"),
    (p) => (p.coordinateFrame.unit = "ft"),
    (p) => (p.coordinateFrame.sensorOrigin = [0, 0]),
    (p) => (p.coordinateFrame.sensorOrigin = [0, 0, 0, 0]),
    (p) => (p.coordinateFrame.axes = ["east", "north"]),
    (p) => (p.geometry.bounds.min = [0, 0]),
    (p) => (p.scan.order = "timestamps"),
    (p) => (p.intensity.calibration = "reflectance"),
    (p) => (p.availability.unavailable = "zero"),
    (p) => (p.geometry.rayToleranceM = 1),
    (p) => (p.timeOrigin = "2026-01-01T00:00:00Z"),
    (p) => (p.products.points = "source:points"),
  ]) {
    const { profile } = await createPacket();
    mutate(profile);
    assert.equal(validate(profile), false);
    assert.equal(LidarProfileSchema.safeParse(profile).success, false);
  }
});
