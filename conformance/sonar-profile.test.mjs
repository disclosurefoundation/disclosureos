import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/sonar-active/build.mjs";
import {
  SonarProfileSchema,
  sonarProfileJsonSchema,
  evaluateSonarProfile,
  readSonarProducts,
  readSonarSample,
  sonarDistance,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/sonar-profile-0.1.0.schema.json",
      import.meta.url
    ),
    "utf8"
  )
);
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(artifact);
test("portable sonar schema equals emitted public contract", () =>
  assert.deepEqual(artifact, sonarProfileJsonSchema()));
test("portable schema and runtime accept the complete sonar profile and verified source packet", async () => {
  const p = await createPacket();
  assert.equal(validate(p.profile), true, JSON.stringify(validate.errors));
  assert.equal(SonarProfileSchema.safeParse(p.profile).success, true);
  const result = await evaluateSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
  assert.equal(result.success, true, JSON.stringify(result.issues));
  assert.equal(result.propagationAccuracy, "not_checked");
  const decoded = readSonarProducts(p.profile, p.selection.layouts, p.assets);
  assert.equal(readSonarSample(p.profile, decoded, 28, 130).amplitude, null);
  assert.equal(sonarDistance(p.profile, 0.1), 75);
});
test("portable and runtime schemas reject unsupported semantics and unknown fields", async () => {
  for (const mutate of [
    (p) => {
      p.mode = "multistatic";
    },
    (p) => {
      p.amplitudeRepresentation = "pressure";
    },
    (p) => {
      p.sampling.pings = 1.5;
    },
    (p) => {
      p.sampling.delayStepSeconds = 0;
    },
    (p) => {
      p.propagation.soundSpeedMps = -1;
    },
    (p) => {
      p.propagation.travelPath = "one_way";
    },
    (p) => {
      p.propagation.distanceMeaning = "depth";
    },
    (p) => {
      p.availability.unavailable = 2;
    },
    (p) => {
      p.availability.missingAmplitude = "measured_zero";
    },
    (p) => {
      p.products.tracks = "product:tracks";
    },
    (p) => {
      p.acquisitionProductRef = "source:amplitudes";
    },
    (p) => {
      delete p.receiveMaskAcquisitionProductRef;
    },
  ]) {
    const { profile } = await createPacket();
    mutate(profile);
    assert.equal(validate(profile), false);
    assert.equal(SonarProfileSchema.safeParse(profile).success, false);
  }
});
test("portable declaration alone never certifies missing source bytes", async () => {
  const p = await createPacket();
  const result = await evaluateSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile
  );
  assert.equal(result.success, false);
  assert.equal(result.checks.sources, "failed");
  assert.equal(result.data, undefined);
});
