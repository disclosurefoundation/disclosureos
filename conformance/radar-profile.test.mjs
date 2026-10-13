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
