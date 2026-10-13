import test from "node:test";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { createPacket } from "../examples/radar-advanced/build.mjs";
import {
  SteeredRadarProfileSchema,
  SecondaryRadarProfileSchema,
  steeredRadarProfileJsonSchema,
  secondaryRadarProfileJsonSchema,
  evaluateSteeredRadarProfile,
  evaluateSecondaryRadarProfile,
} from "../packages/disclosureos-schema/dist/experimental/v2/index.js";
for (const [scenario, name, schema, emit, evaluate] of [
  [
    "military",
    "steered-radar-profile",
    SteeredRadarProfileSchema,
    steeredRadarProfileJsonSchema,
    evaluateSteeredRadarProfile,
  ],
  [
    "secondary",
    "secondary-radar-profile",
    SecondaryRadarProfileSchema,
    secondaryRadarProfileJsonSchema,
    evaluateSecondaryRadarProfile,
  ],
]) {
  const artifact = JSON.parse(
    readFileSync(
      new URL(
        `../packages/disclosureos-schema/schema/experimental/${name}-0.1.0.schema.json`,
        import.meta.url
      ),
      "utf8"
    )
  );
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(artifact);
  test(`${name} portable artifact equals emitted contract`, () =>
    assert.deepEqual(artifact, emit()));
  test(`${name} portable/runtime validators and full evaluator accept the canonical packet`, async () => {
    const p = await createPacket(scenario);
    assert.equal(validate(p.profile), true, JSON.stringify(validate.errors));
    assert.equal(schema.safeParse(p.profile).success, true);
    const r = await evaluate(p.observation, p.context, p.selection, p.profile, {
      assets: p.assets,
    });
    assert.equal(r.success, true, JSON.stringify(r.issues));
  });
  test(`${name} portable/runtime reject unsupported or overconfident declarations`, async () => {
    const mutations = [
      (p) => {
        p.mode = "generic_radar";
      },
      (p) => {
        p.processingAvailability = "instantaneous";
      },
      (p) => {
        p.targetIdentity = "confirmed";
      },
      (p) => {
        delete p.products;
      },
      (p) => {
        p.origin.eastM = "0";
      },
      (p) => {
        p.acquisitionRef = "product:radar-capture";
      },
    ];
    if (scenario === "military")
      mutations.push(
        (p) => {
          p.uncertainty.axes.push("up");
        },
        (p) => {
          p.uncertainty.axes.pop();
        },
        (p) => {
          p.uncertainty.confidenceProbability = 1;
        },
        (p) => {
          p.rangeConvention = "slant_range";
        }
      );
    else
      mutations.push(
        (p) => {
          p.positionRepresentation = "horizontal_ground_map";
        },
        (p) => {
          p.altitudeConvention = "geometric_height";
        },
        (p) => {
          p.identitySemantics = "verified_aircraft_identity";
        },
        (p) => {
          p.products.returns = "product:invented-power";
        }
      );
    for (const mutate of mutations) {
      const p = (await createPacket(scenario)).profile;
      mutate(p);
      assert.equal(validate(p), false);
      assert.equal(schema.safeParse(p).success, false);
    }
  });
  test(`${name} public package schema subpath is importable`, async () => {
    const resolve = createRequire(
      new URL("../packages/disclosureos-schema/package.json", import.meta.url)
    ).resolve;
    const path = resolve(
      `@disclosureos/schema/experimental/v2/${name}/schema/0.1.0`
    );
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), artifact);
  });
}
