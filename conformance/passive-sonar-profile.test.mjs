import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/sonar-passive/build.mjs";
import {
  PassiveSonarProfileSchema,
  passiveSonarProfileJsonSchema,
  evaluatePassiveSonarProfile,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
const artifact = JSON.parse(
  readFileSync(
    new URL(
      "../packages/disclosureos-schema/schema/experimental/passive-sonar-profile-0.1.0.schema.json",
      import.meta.url
    ),
    "utf8"
  )
);
const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
const validate = ajv.compile(artifact);
test("portable passive sonar schema equals public runtime schema", () =>
  assert.deepEqual(artifact, passiveSonarProfileJsonSchema()));
test("portable and runtime accept complete pressure/PSD profile", async () => {
  const p = await createPacket();
  assert.equal(validate(p.profile), true, JSON.stringify(validate.errors));
  assert.equal(PassiveSonarProfileSchema.safeParse(p.profile).success, true);
  const r = await evaluatePassiveSonarProfile(
    p.observation,
    p.context,
    p.selection,
    p.profile,
    { assets: p.assets }
  );
  assert.equal(r.success, true, JSON.stringify(r.issues));
  assert.equal(r.checks.reproduction, "passed");
});
test("portable and runtime reject unsupported semantics", async () => {
  for (const mutate of [
    (p) => (p.mode = "array"),
    (p) => (p.transform.window = "symmetric_hann"),
    (p) => (p.transform.detrend = "none"),
    (p) => (p.transform.oneSided = "double_all_bins"),
    (p) => (p.transform.missingWindow = "zero_fill"),
    (p) => (p.display.densityReferencePa2PerHz = 1),
    (p) => (p.products.pressure = "source:pressure"),
    (p) => (p.rangeM = 10),
    (p) => delete p.sampleMaskAcquisitionProductRef,
  ]) {
    const { profile } = await createPacket();
    mutate(profile);
    assert.equal(validate(profile), false);
    assert.equal(PassiveSonarProfileSchema.safeParse(profile).success, false);
  }
});
