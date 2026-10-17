import test from "node:test";
import assert from "node:assert/strict";
import { simulate, config } from "./model.mjs";
import { createPacket } from "./build.mjs";
const model = simulate();
test("authored raster retains complete source status and group counts", () => {
  assert.equal(model.pulses.length, 1353);
  assert.equal(model.points.length, 1546);
  assert.equal(
    model.pulses.filter((p) => p.status === "unavailable").length,
    35
  );
  assert.equal(model.pulses.filter((p) => p.status === "no_return").length, 36);
  for (const pulse of model.pulses) {
    const points = model.points.filter((p) => p.pulseId === pulse.id);
    assert.equal(points.length, pulse.returnCount ?? 0);
    if (pulse.status === "unavailable") assert.equal(pulse.returnCount, null);
    for (const [i, p] of points.entries()) {
      assert.equal(p.returnNumber, i + 1);
      assert.equal(p.returnCount, points.length);
    }
  }
});
test("retained returns are on declared local rays and increase in range", () => {
  for (const pulse of model.pulses) {
    const ray = pulse.aim.map((v, i) => v - config.sensorOrigin[i]),
      norm = Math.hypot(...ray);
    let previous = 0;
    for (const point of model.points.filter((p) => p.pulseId === pulse.id)) {
      const delta = [point.x, point.y, point.z].map(
          (v, i) => v - config.sensorOrigin[i]
        ),
        range = Math.hypot(...delta),
        along = delta.reduce((s, v, i) => s + (v * ray[i]) / norm, 0),
        residual = Math.hypot(
          ...delta.map((v, i) => v - (along * ray[i]) / norm)
        );
      assert.ok(range > previous);
      assert.ok(residual <= config.rayToleranceM);
      previous = range;
    }
  }
});
test("opaque roof rays do not manufacture a hidden terrain return", () => {
  const roof = model.points.filter((p) => p.classCode === 6);
  assert.equal(roof.length, 90);
  for (const p of roof) {
    assert.equal(p.returnCount, 1);
    assert.equal(p.z, 4.8);
    assert.ok(p.x >= 2 && p.x <= 9 && p.y >= 6 && p.y <= 12);
  }
  assert.ok(model.pulses.some((p) => p.returnCount === 3));
  assert.ok(model.points.some((p) => p.classCode === 0));
});
test("regeneration is deterministic and preserves unavailable blank cells", async () => {
  const a = await createPacket(),
    b = await createPacket();
  assert.deepEqual(a.files, b.files);
  assert.match(a.files.get("pulses.csv").toString(), /unavailable,\n/);
  assert.match(a.files.get("pulses.csv").toString(), /no_return,0\n/);
  assert.equal(
    a.profile.geometry.toleranceMeaning,
    "encoding_consistency_not_measurement_uncertainty"
  );
});
