import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/satellite-raster/build.mjs";
import {
  SatelliteRasterProfileSchema,
  satelliteRasterProfileJsonSchema,
  evaluateSatelliteRasterProfile,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/satellite-raster-profile-0.1.0.schema.json",
      import.meta.url
    ),
    "utf8"
  )
);
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(artifact);
test("portable satellite raster profile equals public runtime contract", () =>
  assert.deepEqual(artifact, satelliteRasterProfileJsonSchema()));
test("portable and runtime accept the complete local satellite raster profile", async () => {
  const p = await createPacket();
  assert.equal(validate(p.profile), true, JSON.stringify(validate.errors));
  assert.equal(SatelliteRasterProfileSchema.safeParse(p.profile).success, true);
  const r = await evaluateSatelliteRasterProfile(
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
    (p) => (p.mode = "orbital"),
    (p) => (p.grid.crs.unit = "degrees"),
    (p) => p.grid.transform.pop(),
    (p) => p.grid.transform.push(0),
    (p) => (p.grid.transform[2] = 1),
    (p) => (p.grid.transform[5] = 30),
    (p) => (p.bands[0].validRange = [0]),
    (p) => (p.radiometry.calibration = "verified"),
    (p) => (p.quality.codes.cloud = 8),
    (p) => (p.products.quality = "source:quality"),
    (p) => (p.extra = true),
  ]) {
    const { profile } = await createPacket();
    mutate(profile);
    assert.equal(validate(profile), false);
    assert.equal(
      SatelliteRasterProfileSchema.safeParse(profile).success,
      false
    );
  }
});
